import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type PointerEvent,
} from "react";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  Heart,
  Plus,
  Search,
  Square,
  SquareCheckBig,
  X,
} from "lucide-react";
import { supabase, hasSupabaseConfig } from "../lib/supabase";
import { useWeddingPhase } from "../lib/weddingPhase";

const PHOTO_UPLOAD_API_URL = String(
  import.meta.env.VITE_PHOTO_UPLOAD_API_URL || ""
).replace(/\/$/, "");
const USE_GOOGLE_DRIVE_UPLOAD = Boolean(PHOTO_UPLOAD_API_URL);
const MAX_FILE_COUNT = 30;
const MAX_IMAGE_FILE_SIZE = 30 * 1024 * 1024;
const MAX_VIDEO_FILE_SIZE = 100 * 1024 * 1024;
const SLIDE_DURATION = 260;
const VIEWER_PREFETCH_DISTANCE = 2;
const ADMIN_FAVORITES_KEY = "wedding_admin_favorite_photos";
const ADMIN_DOWNLOADED_KEY = "wedding_admin_downloaded_photos";
const IMAGE_EXTENSIONS = ["avif", "heic", "heif", "jpeg", "jpg", "png", "webp"];
const VIDEO_EXTENSIONS = ["mov", "mp4", "webm"];
const IMAGE_MIME_TYPES = new Set([
  "image/avif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

type UploadStatus = "waiting" | "uploading" | "success" | "error";
type SlideTarget = "prev" | "next" | "center" | null;
type AdminPhotoFilter =
  | "all"
  | "image"
  | "video"
  | "favorites"
  | "downloaded"
  | "not-downloaded";
type AdminPhotoSort = "newest" | "oldest" | "name";
type AdminUploaderSort = "latest" | "oldest" | "name";

type UploadFileItem = {
  id: string;
  file: File;
  previewUrl: string;
  status: UploadStatus;
  errorMessage?: string;
};

type ScreenWakeLock = {
  released: boolean;
  release: () => Promise<void>;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<ScreenWakeLock>;
  };
};

type MyUploadItem = {
  id: string;
  photo_url: string;
  thumbnail_url: string | null;
  media_type: string | null;
  original_name: string | null;
  created_at: string;
};

type AdminSummaryItem = {
  uploader_folder_key: string;
  uploader_name: string | null;
  uploader_phone: string | null;
  total_count: number;
  image_count: number;
  video_count: number;
  first_uploaded_at: string;
  last_uploaded_at: string;
};

type AdminPhotoItem = {
  id: string;
  uploader_folder_key: string;
  uploader_name: string | null;
  uploader_phone: string | null;
  photo_url: string;
  thumbnail_url: string | null;
  media_type: string | null;
  original_name: string | null;
  storage_path: string | null;
  thumbnail_storage_path: string | null;
  file_size: number | null;
  created_at: string;
};

type ViewerMediaItem = {
  id: string;
  photo_url: string;
  thumbnail_url: string | null;
  media_type: string | null;
  original_name: string | null;
};

type DriveStorageStats = {
  storage: {
    usageBytes: number;
    accountLimitBytes: number;
    uploadLimitBytes: number;
    remainingUploadBytes: number;
    usagePercent: number;
    guestOriginalBytes: number;
  };
  files: {
    records: number;
    driveOriginals: number;
    driveThumbnails: number;
    missingThumbnails: number;
    legacyFiles: number;
  };
  folders: {
    originals: { ok: boolean; status: number; name: string | null };
    thumbnails: { ok: boolean; status: number; name: string | null };
  };
};

class UploadRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "UploadRequestError";
    this.status = status;
  }
}

function getStoredIdSet(key: string) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return new Set<string>(Array.isArray(value) ? value : []);
  } catch {
    return new Set<string>();
  }
}

function storeIdSet(key: string, values: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...values]));
  } catch {
    // Private browsing or strict storage settings may block localStorage.
  }
}

function PhotoViewerMedia({ item }: { item: ViewerMediaItem }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);

  if (item.media_type === "video") {
    return (
      <video
        key={item.id}
        src={item.photo_url}
        controls
        playsInline
        preload="metadata"
      />
    );
  }

  return (
    <div className="photo-viewer-media">
      {!loaded && item.thumbnail_url && (
        <img
          className={`photo-viewer-placeholder${previewLoaded ? " is-loaded" : ""}`}
          src={item.thumbnail_url}
          alt=""
          aria-hidden="true"
          decoding="async"
          draggable={false}
          onLoad={() => setPreviewLoaded(true)}
        />
      )}

      {!loaded && !failed && (
        <div className="photo-viewer-loading" aria-live="polite">
          <span />
          <p>사진을 불러오는 중입니다</p>
        </div>
      )}

      {failed && !item.thumbnail_url && (
        <div className="photo-viewer-loading" role="status">
          <p>사진을 불러오지 못했습니다</p>
        </div>
      )}

      <img
        className={`photo-viewer-original${loaded ? " is-loaded" : ""}`}
        src={item.photo_url}
        alt={item.original_name || "업로드 사진"}
        loading="eager"
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function formatFileSize(size: number) {
  const mb = size / 1024 / 1024;

  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)}GB`;
  }

  return `${mb.toFixed(1)}MB`;
}

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() || "file";
}

function getMediaType(file: File) {
  const extension = getFileExtension(file.name);

  if (file.type.startsWith("image/") || IMAGE_EXTENSIONS.includes(extension)) {
    return "image";
  }

  if (file.type.startsWith("video/") || VIDEO_EXTENSIONS.includes(extension)) {
    return "video";
  }

  return "unknown";
}

function isAllowedFile(file: File) {
  const extension = getFileExtension(file.name);

  return (
    IMAGE_MIME_TYPES.has(file.type.toLowerCase()) ||
    VIDEO_MIME_TYPES.has(file.type.toLowerCase()) ||
    IMAGE_EXTENSIONS.includes(extension) ||
    VIDEO_EXTENSIONS.includes(extension)
  );
}

function getUploadContentType(file: File) {
  if (file.type) {
    return file.type;
  }

  const extension = getFileExtension(file.name);
  const contentTypes: Record<string, string> = {
    avif: "image/avif",
    heic: "image/heic",
    heif: "image/heif",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    mov: "video/quicktime",
    mp4: "video/mp4",
    webm: "video/webm",
  };

  return contentTypes[extension] || "application/octet-stream";
}

function getFileSignature(file: File) {
  return [
    file.name.toLowerCase(),
    file.size,
    file.lastModified,
    file.type.toLowerCase(),
  ].join(":");
}

async function getUploadError(response: Response) {
  if (response.status === 429) {
    return "현재 사진 공유가 몰리고 있어요. 선택한 파일은 그대로 두었으니 잠시 후 다시 시도해주세요.";
  }

  try {
    const data = (await response.json()) as { error?: string };
    return data.error || `업로드 실패 (${response.status})`;
  } catch {
    return `업로드 실패 (${response.status})`;
  }
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function normalizeName(value: string) {
  return value.replace(/\s/g, "").trim();
}

function getPhoneLast4(phone: string) {
  const digits = normalizePhone(phone);

  if (digits.length < 4) {
    return "";
  }

  return digits.slice(-4);
}

function getFallbackPassword(phone: string) {
  return getPhoneLast4(phone);
}

function romanizeKoreanText(value: string) {
  const initial = [
    "g",
    "kk",
    "n",
    "d",
    "tt",
    "r",
    "m",
    "b",
    "pp",
    "s",
    "ss",
    "",
    "j",
    "jj",
    "ch",
    "k",
    "t",
    "p",
    "h",
  ];

  const medial = [
    "a",
    "ae",
    "ya",
    "yae",
    "eo",
    "e",
    "yeo",
    "ye",
    "o",
    "wa",
    "wae",
    "oe",
    "yo",
    "u",
    "wo",
    "we",
    "wi",
    "yu",
    "eu",
    "ui",
    "i",
  ];

  const final = [
    "",
    "g",
    "kk",
    "gs",
    "n",
    "nj",
    "nh",
    "d",
    "l",
    "lg",
    "lm",
    "lb",
    "ls",
    "lt",
    "lp",
    "lh",
    "m",
    "b",
    "bs",
    "s",
    "ss",
    "ng",
    "j",
    "ch",
    "k",
    "t",
    "p",
    "h",
  ];

  return value
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);

      if (code < 0xac00 || code > 0xd7a3) {
        return char;
      }

      const syllableIndex = code - 0xac00;
      const initialIndex = Math.floor(syllableIndex / 588);
      const medialIndex = Math.floor((syllableIndex % 588) / 28);
      const finalIndex = syllableIndex % 28;

      return `${initial[initialIndex]}${medial[medialIndex]}${final[finalIndex]}`;
    })
    .join("");
}

function makeSafePathText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/_+/g, "_")
    .replace(/-+/g, "-")
    .replace(/^_+|_+$/g, "")
    .replace(/^-+|-+$/g, "");
}

function getUploaderFolderName(name: string, phone: string) {
  const normalizedName = normalizeName(name);
  const romanName = makeSafePathText(romanizeKoreanText(normalizedName));
  const phoneKey = normalizePhone(phone);

  const safeName = romanName || "unknown";
  const safePhone = phoneKey || "no_phone";

  return `${safeName}_${safePhone}`;
}

async function createPasswordHash(password: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function createImageThumbnail(file: File) {
  return new Promise<Blob>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);

      const maxDimension = 960;
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");

      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("썸네일을 만들 수 없습니다."));
        return;
      }

      context.drawImage(image, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("썸네일을 만들 수 없습니다."));
          }
        },
        "image/webp",
        0.72
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("썸네일용 사진을 불러오지 못했습니다."));
    };

    image.src = url;
  });
}

function formatCreatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function PhotoUploadSection() {
  const { ceremonyStarted } = useWeddingPhase();

  const goUploadPage = () => {
    window.location.hash = "upload";
  };

  return (
    <section className={`section upload-entry-section${ceremonyStarted ? " post-wedding" : ""}`}>
      <div className="upload-entry-heading">
        <p className="upload-entry-script">{ceremonyStarted ? "Wedding Album" : "Photo Share"}</p>
        <h2 className="upload-entry-title">
          {ceremonyStarted ? "오늘의 순간 공유" : "소중한 순간 공유"}
        </h2>
      </div>

      <div className="upload-entry-icon-wrap">
        <div className="upload-entry-icon-circle">
          <Camera size={34} />
        </div>
      </div>

      <p className="upload-entry-desc">
        {ceremonyStarted ? "함께한 오늘의 사진과 동영상을" : "결혼식 현장에서 찍은 사진들을"}
        <br />
        신랑신부와 함께 나눠보세요
      </p>

      <button className="upload-entry-button" onClick={goUploadPage}>
        <Camera size={18} />
        <span>사진·동영상 올리기</span>
      </button>
    </section>
  );
}

export function PhotoUploadPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const filesRef = useRef<UploadFileItem[]>([]);
  const wakeLockRef = useRef<ScreenWakeLock | null>(null);
  const uploadedFileSignaturesRef = useRef(new Set<string>());

  const [isDragging, setIsDragging] = useState(false);

  const [uploaderPhone, setUploaderPhone] = useState("");
  const [uploaderName, setUploaderName] = useState("");
  const [uploaderPassword, setUploaderPassword] = useState("");

  const [files, setFiles] = useState<UploadFileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState("");
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  const [uploadComplete, setUploadComplete] = useState<{
    count: number;
    name: string;
    phone: string;
  } | null>(null);

  const [uploadProgress, setUploadProgress] = useState({
    current: 0,
    total: 0,
    success: 0,
    fail: 0,
  });
  const [stagedUploadProgress, setStagedUploadProgress] = useState(0);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!uploading) {
      return;
    }

    let active = true;
    const wakeLock = (navigator as WakeLockNavigator).wakeLock;

    const requestWakeLock = async () => {
      if (!wakeLock || document.visibilityState !== "visible") {
        return;
      }

      try {
        const lock = await wakeLock.request("screen");

        if (!active) {
          await lock.release();
          return;
        }

        wakeLockRef.current = lock;
      } catch (error) {
        console.warn("화면 켜짐 유지 기능을 사용할 수 없습니다.", error);
      }
    };

    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        (!wakeLockRef.current || wakeLockRef.current.released)
      ) {
        void requestWakeLock();
      }
    };

    void requestWakeLock();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      const lock = wakeLockRef.current;
      wakeLockRef.current = null;

      if (lock && !lock.released) {
        void lock.release();
      }
    };
  }, [uploading]);

  useEffect(() => {
    return () => {
      filesRef.current.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  useEffect(() => {
    if (!uploading) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [uploading]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1600);
  };

  const goBackInvitation = () => {
    if (uploading) {
      showToast("업로드 중에는 이동할 수 없습니다.");
      return;
    }

    window.location.hash = "";
  };

  const goMyPhotosPage = () => {
    if (uploading) {
      showToast("업로드 중에는 이동할 수 없습니다.");
      return;
    }

    window.location.hash = "my-photos";
  };

  const addFiles = (selectedFiles: File[]) => {
    const allowedFiles = selectedFiles.filter(isAllowedFile);

    if (allowedFiles.length !== selectedFiles.length) {
      showToast("지원되는 사진 또는 동영상 파일만 업로드할 수 있습니다.");
      return;
    }

    const oversizedFile = allowedFiles.find((file) => {
      const maxSize = getMediaType(file) === "video"
        ? MAX_VIDEO_FILE_SIZE
        : MAX_IMAGE_FILE_SIZE;
      return file.size > maxSize;
    });

    if (oversizedFile) {
      const isVideo = getMediaType(oversizedFile) === "video";
      const maxSize = isVideo ? MAX_VIDEO_FILE_SIZE : MAX_IMAGE_FILE_SIZE;
      showToast(
        `${isVideo ? "동영상" : "사진"}은 개당 ${formatFileSize(maxSize)} 이하입니다.`
      );
      return;
    }

    const knownSignatures = new Set([
      ...uploadedFileSignaturesRef.current,
      ...files.map((item) => getFileSignature(item.file)),
    ]);
    const uniqueFiles: File[] = [];
    let duplicateCount = 0;

    allowedFiles.forEach((file) => {
      const signature = getFileSignature(file);

      if (knownSignatures.has(signature)) {
        duplicateCount += 1;
        return;
      }

      knownSignatures.add(signature);
      uniqueFiles.push(file);
    });

    if (uniqueFiles.length === 0) {
      showToast("이미 선택했거나 업로드한 파일입니다.");
      return;
    }

    const availableCount = Math.max(0, MAX_FILE_COUNT - files.length);

    if (availableCount === 0) {
      showToast(`파일은 한 번에 최대 ${MAX_FILE_COUNT}개까지 선택할 수 있습니다.`);
      return;
    }

    const filesToAdd = uniqueFiles.slice(0, availableCount);
    const overflowCount = uniqueFiles.length - filesToAdd.length;

    const nextItems: UploadFileItem[] = filesToAdd.map((file) => ({
      id: `${Date.now()}-${crypto.randomUUID()}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: "waiting",
    }));

    setFiles((prev) => [...prev, ...nextItems]);

    if (overflowCount > 0 && duplicateCount > 0) {
      showToast(
        `최대 ${MAX_FILE_COUNT}장만 추가하고 중복 ${duplicateCount}장도 제외했습니다.`
      );
    } else if (overflowCount > 0) {
      showToast(`최대 ${MAX_FILE_COUNT}장까지만 목록에 추가했습니다.`);
    } else if (duplicateCount > 0) {
      showToast(`중복 사진 ${duplicateCount}장은 제외했습니다.`);
    }
  };

  const handleInputFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);

    if (selected.length === 0) {
      return;
    }

    addFiles(selected);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files || []);

    if (droppedFiles.length === 0) {
      return;
    }

    addFiles(droppedFiles);
  };

  const removeSelectedFile = (id: string) => {
    setFiles((prev) => {
      const target = prev.find((item) => item.id === id);

      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }

      return prev.filter((item) => item.id !== id);
    });
  };

  const clearSelectedFiles = () => {
    files.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl);
    });

    setFiles([]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadOneFile = async (
    item: UploadFileItem,
    passwordHash: string | null,
    uploadGroupId: string,
    onOriginalUploaded?: () => void
  ) => {
    const trimmedName = uploaderName.trim();
    const trimmedPhone = uploaderPhone.trim();

    const nameKey = normalizeName(trimmedName).toLowerCase();
    const phoneKey = normalizePhone(trimmedPhone);
    const uploaderFolder = getUploaderFolderName(trimmedName, trimmedPhone);

    if (!USE_GOOGLE_DRIVE_UPLOAD) {
      throw new Error("파일 업로드 서버가 설정되지 않았습니다.");
    }

    const response = await fetch(`${PHOTO_UPLOAD_API_URL}/upload`, {
      method: "POST",
      headers: {
        "content-type": getUploadContentType(item.file),
        "x-upload-uploader-name": encodeURIComponent(trimmedName),
        "x-upload-uploader-phone": trimmedPhone,
        "x-upload-name-key": encodeURIComponent(nameKey),
        "x-upload-phone-key": phoneKey,
        "x-upload-folder-key": uploaderFolder,
        "x-upload-password-hash": passwordHash || "",
        "x-upload-group-id": uploadGroupId,
        "x-upload-original-name": encodeURIComponent(item.file.name),
      },
      body: item.file,
    });

    if (!response.ok) {
      throw new UploadRequestError(await getUploadError(response), response.status);
    }

    const uploaded = (await response.json()) as {
      id: string;
      fileId: string;
    };

    onOriginalUploaded?.();

    if (getMediaType(item.file) === "image") {
      try {
        const thumbnailBlob = await createImageThumbnail(item.file);
        const thumbnailParams = new URLSearchParams({
          recordId: uploaded.id,
          originalFileId: uploaded.fileId,
        });
        const thumbnailResponse = await fetch(
          `${PHOTO_UPLOAD_API_URL}/thumbnail?${thumbnailParams}`,
          {
            method: "POST",
            headers: {
              "content-type": "image/webp",
              "x-upload-folder-key": uploaderFolder,
            },
            body: thumbnailBlob,
          }
        );

        if (!thumbnailResponse.ok) {
          console.warn("썸네일 업로드 실패:", await getUploadError(thumbnailResponse));
        }
      } catch (error) {
        console.warn("썸네일 생성 실패, 원본 업로드는 유지합니다:", error);
      }
    }

    return;
  };

  const uploadFiles = async () => {
    if (!hasSupabaseConfig) {
      showToast("Supabase 연결 정보가 아직 설정되지 않았습니다.");
      return;
    }

    const trimmedName = uploaderName.trim();
    const trimmedPhone = uploaderPhone.trim();
    const trimmedPassword = uploaderPassword.trim();

    if (!trimmedName) {
      showToast("이름을 입력해주세요.");
      return;
    }

    if (files.length === 0) {
      showToast("업로드할 사진 또는 동영상을 선택해주세요.");
      return;
    }

    const queuedFiles = files.filter(
      (item) => item.status === "waiting" || item.status === "error"
    );

    if (queuedFiles.length === 0) {
      showToast("다시 업로드할 파일이 없습니다.");
      return;
    }

    if (!navigator.onLine) {
      showToast("인터넷 연결을 확인한 뒤 다시 시도해주세요.");
      return;
    }

    setUploading(true);
    setStagedUploadProgress(0);

    setUploadProgress({
      current: 0,
      total: queuedFiles.length,
      success: 0,
      fail: 0,
    });

    let passwordHash: string | null = null;

    if (trimmedPassword) {
      passwordHash = await createPasswordHash(trimmedPassword);
    } else {
      const fallbackPassword = getFallbackPassword(trimmedPhone);

      if (fallbackPassword) {
        passwordHash = await createPasswordHash(fallbackPassword);
      }
    }

    const uploadGroupId = crypto.randomUUID();

    let successCount = 0;
    let failCount = 0;
    let interrupted = false;
    let rateLimited = false;

    for (const [index, item] of queuedFiles.entries()) {
      if (!navigator.onLine) {
        interrupted = true;
        break;
      }

      setStagedUploadProgress(
        Math.round(((index + 0.1) / queuedFiles.length) * 100)
      );

      setUploadProgress((prev) => ({
        ...prev,
        current: index + 1,
      }));

      setFiles((prev) =>
        prev.map((fileItem) =>
          fileItem.id === item.id
            ? { ...fileItem, status: "uploading", errorMessage: undefined }
            : fileItem
        )
      );

      try {
        await uploadOneFile(item, passwordHash, uploadGroupId, () => {
          setStagedUploadProgress(
            Math.round(((index + 0.75) / queuedFiles.length) * 100)
          );
        });

        successCount += 1;
        uploadedFileSignaturesRef.current.add(getFileSignature(item.file));
        setStagedUploadProgress(
          Math.round(((index + 1) / queuedFiles.length) * 100)
        );

        setUploadProgress((prev) => ({
          ...prev,
          success: prev.success + 1,
        }));

        setFiles((prev) =>
          prev.map((fileItem) =>
            fileItem.id === item.id ? { ...fileItem, status: "success" } : fileItem
          )
        );
      } catch (error) {
        console.error("파일 업로드 실패:", error);

        const isNetworkError = error instanceof TypeError || !navigator.onLine;
        const isRateLimited = error instanceof UploadRequestError && error.status === 429;
        const errorMessage = isNetworkError
          ? "네트워크 연결을 확인해주세요."
          : error instanceof Error
            ? error.message
            : "업로드 실패";

        failCount += 1;
        interrupted = isNetworkError;
        rateLimited = isRateLimited;
        setStagedUploadProgress(
          Math.round(((index + 1) / queuedFiles.length) * 100)
        );

        setUploadProgress((prev) => ({
          ...prev,
          fail: prev.fail + 1,
        }));

        setFiles((prev) =>
          prev.map((fileItem) =>
            fileItem.id === item.id
              ? { ...fileItem, status: "error", errorMessage }
              : fileItem
          )
        );

        if (!interrupted && !rateLimited) {
          showToast(errorMessage);
        }

        if (interrupted || rateLimited) {
          break;
        }
      }
    }

    if (interrupted || rateLimited) {
      setUploading(false);
      showToast(
        rateLimited
          ? "현재 사진 공유가 몰리고 있어요. 선택한 파일은 그대로 두었으니 잠시 후 다시 시도해주세요."
          : "연결이 끊겼습니다. 연결 후 남은 파일을 다시 시도해주세요."
      );
      return;
    }

    if (failCount === 0) {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    }

    setUploading(false);

    if (failCount === 0) {
      localStorage.setItem(
        "wedding_last_upload_lookup",
        JSON.stringify({
          name: trimmedName,
          phone: trimmedPhone,
        })
      );

      setUploadComplete({
        count:
          files.filter((item) => item.status === "success").length +
          successCount,
        name: trimmedName,
        phone: trimmedPhone,
      });

      clearSelectedFiles();

      return;
    }

    showToast(`${successCount}개 성공, ${failCount}개 실패했습니다.`);
  };

  const uploadPercent =
    uploadProgress.total > 0 ? stagedUploadProgress : 0;
  const failedFileCount = files.filter((item) => item.status === "error").length;
  const shareMorePhotos = () => {
    setUploadComplete(null);
    fileInputRef.current?.click();
  };

  return (
    <section className="section upload-page-section">
      <button className="upload-back-button" onClick={goBackInvitation}>
        <ChevronLeft size={18} />
        <span>청첩장보러 가기</span>
      </button>

      <div className="upload-page-heading">
        <p className="upload-page-script">Photo Upload</p>
        <h2 className="upload-page-title">스냅 작가가 되어주세요!</h2>
      </div>

      <p className="upload-page-main-text">
        소중한 순간을 함께 나눠주세요.
        <br />
        추첨을 통해 작은 선물을 드립니다!
      </p>

      <div className="upload-page-guide-block">
        <p className="upload-page-guide-title">이런 순간들을 담아주세요! 📷</p>

        <ul className="upload-page-bullets">
          <li>행복한 신랑&amp;신부 사진</li>
          <li>가족 &amp; 친구들과 함께한 순간</li>
          <li>여러분들의 사진</li>
        </ul>
      </div>

      <div className="upload-page-sub-guide">
        <p>• 연락처와 이름을 입력하시면 추첨에 참여됩니다</p>
        <p>• 비밀번호를 설정하지 않으면 연락처 뒷자리 4자리로 조회할 수 있습니다</p>
      </div>

      <div className="upload-form-group">
        <label>이름</label>
        <input
          value={uploaderName}
          onChange={(e) => setUploaderName(e.target.value)}
          placeholder="홍성훈"
          disabled={uploading}
        />
      </div>

      <div className="upload-form-group">
        <label>
          연락처 <span>(선택사항)</span>
        </label>
        <input
          value={uploaderPhone}
          onChange={(e) => setUploaderPhone(e.target.value)}
          placeholder="01012345678"
          disabled={uploading}
        />
        <p className="upload-form-help">
          <Search size={14} />
          <span>연락처를 입력하면 내가 공유한 사진과 영상을 다시 확인할 수 있어요.</span>
        </p>
      </div>

      <div className="upload-form-group">
        <label>
          비밀번호 <span>(선택사항)</span>
        </label>
        <input
          type="password"
          value={uploaderPassword}
          onChange={(e) => setUploaderPassword(e.target.value)}
          placeholder="설정하지 않으면 전화번호 뒷자리 4개"
          disabled={uploading}
        />
      </div>

      <div className="upload-form-group">
          <label>사진·동영상 선택</label>

        <div
          className={`upload-dropzone ${isDragging ? "dragging" : ""}`}
          onClick={() => {
            if (!uploading) {
              fileInputRef.current?.click();
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!uploading) {
              setIsDragging(true);
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!uploading) {
              setIsDragging(true);
            }
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
          }}
          onDrop={(e) => {
            if (uploading) {
              return;
            }

            handleDrop(e);
          }}
        >
          <Plus size={40} strokeWidth={1.4} />
          <p>
            사진 또는 동영상을 선택하거나 드래그해서 올려주세요
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          accept="image/*,video/mp4,video/quicktime,video/webm,.mov"
          onChange={handleInputFiles}
          disabled={uploading}
        />

        <div className="upload-limit-guide">
          <p>• 한 번에 최대 {MAX_FILE_COUNT}개까지 업로드하실 수 있습니다</p>
          <p>• 사진은 개당 {formatFileSize(MAX_IMAGE_FILE_SIZE)}, 동영상은 {formatFileSize(MAX_VIDEO_FILE_SIZE)} 이하입니다</p>
          {USE_GOOGLE_DRIVE_UPLOAD && <p>• 사진과 동영상은 화질 저하 없이 원본으로 보관됩니다</p>}
        </div>
      </div>

      {files.length > 0 && (
        <div className="upload-preview-section">
          <p className="upload-preview-count">
            선택된 파일 {files.length}개 / 최대 {MAX_FILE_COUNT}개
          </p>

          <div className="upload-preview-grid">
            {files.map((item) => {
              const mediaType = getMediaType(item.file);

              return (
                <div className="upload-preview-card" key={item.id}>
                  <div className="upload-preview-thumb">
                    {mediaType === "video" ? (
                      <video
                        src={item.previewUrl}
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={item.previewUrl}
                        alt={item.file.name}
                        loading="lazy"
                        decoding="async"
                      />
                    )}

                    {mediaType === "video" && (
                      <span className="my-photo-video-badge">VIDEO</span>
                    )}

                    {!uploading && item.status !== "success" && (
                      <button
                        className="upload-preview-remove"
                        onClick={() => removeSelectedFile(item.id)}
                        type="button"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <div className="upload-preview-meta">
                    <em className={`upload-status-badge ${item.status}`}>
                      {item.status === "waiting" && "대기"}
                      {item.status === "uploading" && "업로드 중"}
                      {item.status === "success" && "완료"}
                      {item.status === "error" && "실패"}
                    </em>
                    {item.status === "error" && item.errorMessage && (
                      <span className="upload-error-message" title={item.errorMessage}>
                        {item.errorMessage}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button
        className="upload-submit-main-button"
        onClick={uploadFiles}
        disabled={uploading}
      >
        {uploading
          ? "업로드 중..."
          : failedFileCount > 0
            ? `실패한 파일 ${failedFileCount}개 다시 시도`
            : "사진·동영상 업로드하기"}
      </button>

      <button
        className="upload-my-photos-button"
        onClick={goMyPhotosPage}
        type="button"
        disabled={uploading}
      >
        <Search size={18} />
        <span>내가 공유한 사진·영상 보러가기</span>
      </button>

      {toast && <div className="toast">{toast}</div>}

      {uploading && (
        <div className="upload-blocking-overlay">
          <div className="upload-blocking-modal upload-cute-modal">
            <div className="upload-camera-emoji">📸</div>

            <div className="upload-dots">
              <span />
              <span />
              <span />
            </div>

            <h3>
              💕 소중한 순간을
              <br />
              전달하고 있어요
            </h3>

            <p>
              업로드가 완료될 때까지
              <br />
              이 화면을 닫지 말아주세요.
            </p>

            {!isOnline && (
              <div className="upload-offline-notice" role="alert">
                인터넷 연결이 끊겼습니다
              </div>
            )}

            <div className="upload-progress-percent">{uploadPercent}%</div>

            <div className="upload-progress-bar cute">
              <span
                style={{
                  width: `${uploadPercent}%`,
                }}
              />
            </div>

            <div className="upload-progress-sub">
              {uploadProgress.current} / {uploadProgress.total}
              {uploadProgress.fail > 0 && ` · 실패 ${uploadProgress.fail}개`}
            </div>
          </div>
        </div>
      )}

      {uploadComplete && (
        <div className="upload-complete-overlay">
          <div className="upload-complete-modal">
            <div className="upload-complete-emoji">💕</div>

            <h3>업로드가 완료되었습니다</h3>

            <p>
              소중한 파일 {uploadComplete.count}개를
              <br />
              공유해주셔서 감사합니다.
            </p>

            <div className="upload-complete-actions">
              <button
                type="button"
                className="upload-complete-primary"
                onClick={shareMorePhotos}
              >
                <Plus size={17} />
                <span>사진 더 공유하기</span>
              </button>

              <button
                type="button"
                className="upload-complete-secondary"
                onClick={() => {
                  setUploadComplete(null);
                  window.location.hash = "my-photos";
                }}
              >
                내가 공유한 사진·영상 보기
              </button>

              <button
                type="button"
                className="upload-complete-tertiary"
                onClick={() => {
                  setUploadComplete(null);
                  window.location.hash = "";
                }}
              >
                청첩장으로 돌아가기
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="upload-bottom-message">
        소중한 순간을 함께해 주셔서 감사합니다
      </div>
    </section>
  );
}

export function MyPhotosPage() {
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupName, setLookupName] = useState("");
  const [lookupPassword, setLookupPassword] = useState("");

  const [loadingMyUploads, setLoadingMyUploads] = useState(false);
  const [myUploads, setMyUploads] = useState<MyUploadItem[]>([]);
  const [searched, setSearched] = useState(false);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const [toast, setToast] = useState("");

  const selectedIndexRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const latestOffsetRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const animatingRef = useRef(false);
  const pendingTargetRef = useRef<SlideTarget>(null);
  const animationTimerRef = useRef<number | null>(null);
  const hasDraggedRef = useRef(false);
  const preparingSlideRef = useRef(false);
  const slideRequestIdRef = useRef(0);
  const preloadedPreviewSetRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const savedLookup = localStorage.getItem("wedding_last_upload_lookup");

    if (!savedLookup) {
      return;
    }

    try {
      const parsed = JSON.parse(savedLookup) as {
        name?: string;
        phone?: string;
      };

      if (parsed.name) {
        setLookupName(parsed.name);
      }

      if (parsed.phone) {
        setLookupPhone(parsed.phone);
      }
    } catch {
      // 저장된 값이 잘못된 경우 무시
    }
  }, []);

  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1600);
  };

  const goBackUpload = () => {
    window.location.hash = "upload";
  };

  const goBackInvitation = () => {
    window.location.hash = "";
  };

  const getPrevIndex = (index: number) => {
    return index === 0 ? myUploads.length - 1 : index - 1;
  };

  const getNextIndex = (index: number) => {
    return index === myUploads.length - 1 ? 0 : index + 1;
  };

  const preloadUploadPreview = (index: number) => {
    const item = myUploads[index];

    if (!item || item.media_type === "video") {
      return Promise.resolve();
    }

    const src = item.thumbnail_url || item.photo_url;

    if (preloadedPreviewSetRef.current.has(src)) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const image = new Image();

      const finish = async () => {
        try {
          if (typeof image.decode === "function") {
            await image.decode();
          }
        } catch {
          // 일부 모바일 브라우저의 decode 실패는 로드 완료로 처리합니다.
        }

        preloadedPreviewSetRef.current.add(src);
        resolve();
      };

      image.onload = () => {
        void finish();
      };
      image.onerror = () => resolve();
      image.src = src;

      if (image.complete) {
        void finish();
      }
    });
  };

  const preloadAroundIndex = (index: number) => {
    const indexes = new Set<number>([index]);
    let prev = index;
    let next = index;

    for (let step = 0; step < VIEWER_PREFETCH_DISTANCE; step += 1) {
      prev = getPrevIndex(prev);
      next = getNextIndex(next);
      indexes.add(prev);
      indexes.add(next);
    }

    indexes.forEach((previewIndex) => {
      void preloadUploadPreview(previewIndex);
    });
  };

  const clearAnimationTimer = () => {
    if (animationTimerRef.current !== null) {
      window.clearTimeout(animationTimerRef.current);
      animationTimerRef.current = null;
    }
  };

  const resetPointer = () => {
    pointerIdRef.current = null;
    startXRef.current = null;
    startYRef.current = null;
    latestOffsetRef.current = 0;
  };

  const resetDraggedState = () => {
    hasDraggedRef.current = false;
    setHasDragged(false);
  };

  const resetAnimation = () => {
    clearAnimationTimer();
    slideRequestIdRef.current += 1;
    preparingSlideRef.current = false;
    animatingRef.current = false;
    pendingTargetRef.current = null;
    setIsAnimating(false);
    setDragOffset(0);
    latestOffsetRef.current = 0;
  };

  const openViewer = (index: number) => {
    slideRequestIdRef.current += 1;
    selectedIndexRef.current = index;
    setSelectedIndex(index);
    preloadAroundIndex(index);
    resetPointer();
    resetAnimation();
    resetDraggedState();
  };

  const closeViewer = () => {
    slideRequestIdRef.current += 1;
    selectedIndexRef.current = null;
    setSelectedIndex(null);
    resetPointer();
    resetAnimation();
    resetDraggedState();
  };

  const completeSlide = () => {
    const currentIndex = selectedIndexRef.current;
    const target = pendingTargetRef.current;

    if (currentIndex === null || !target) {
      resetAnimation();
      return;
    }

    let nextSelectedIndex = currentIndex;

    if (target === "next") {
      nextSelectedIndex = getNextIndex(currentIndex);
    }

    if (target === "prev") {
      nextSelectedIndex = getPrevIndex(currentIndex);
    }

    clearAnimationTimer();

    selectedIndexRef.current = nextSelectedIndex;
    pendingTargetRef.current = null;
    animatingRef.current = false;
    latestOffsetRef.current = 0;

    setIsAnimating(false);
    setSelectedIndex(nextSelectedIndex);
    setDragOffset(0);

    window.setTimeout(() => {
      resetDraggedState();
    }, 0);
  };

  const finishSlide = async (target: Exclude<SlideTarget, null>) => {
    const currentIndex = selectedIndexRef.current;

    if (
      currentIndex === null ||
      animatingRef.current ||
      preparingSlideRef.current
    ) {
      return;
    }

    if (target !== "center" && myUploads.length <= 1) {
      return;
    }

    const requestId = slideRequestIdRef.current + 1;
    slideRequestIdRef.current = requestId;

    if (target !== "center") {
      const targetIndex = target === "next"
        ? getNextIndex(currentIndex)
        : getPrevIndex(currentIndex);

      preparingSlideRef.current = true;
      await preloadUploadPreview(targetIndex);
      preparingSlideRef.current = false;

      if (
        slideRequestIdRef.current !== requestId ||
        selectedIndexRef.current !== currentIndex
      ) {
        return;
      }
    }

    const width = window.innerWidth;
    let finalOffset = 0;

    if (target === "next") {
      finalOffset = -width;
    }

    if (target === "prev") {
      finalOffset = width;
    }

    pendingTargetRef.current = target;
    animatingRef.current = true;

    setIsAnimating(true);
    setDragOffset(finalOffset);
    latestOffsetRef.current = finalOffset;

    clearAnimationTimer();

    animationTimerRef.current = window.setTimeout(() => {
      completeSlide();
    }, SLIDE_DURATION + 40);
  };

  const slidePrev = () => {
    finishSlide("prev");
  };

  const slideNext = () => {
    finishSlide("next");
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (animatingRef.current) {
      return;
    }

    const target = event.target as HTMLElement;

    if (
      target.closest(".gallery-slide-button") ||
      target.closest(".modal-close") ||
      target.closest(".gallery-modal-count") ||
      target.closest("video")
    ) {
      return;
    }

    pointerIdRef.current = event.pointerId;
    startXRef.current = event.clientX;
    startYRef.current = event.clientY;
    latestOffsetRef.current = 0;
    hasDraggedRef.current = false;
    setHasDragged(false);

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // pointer capture 실패 시 무시
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (
      pointerIdRef.current !== event.pointerId ||
      startXRef.current === null ||
      startYRef.current === null ||
      animatingRef.current
    ) {
      return;
    }

    const diffX = event.clientX - startXRef.current;
    const diffY = event.clientY - startYRef.current;

    const absX = Math.abs(diffX);
    const absY = Math.abs(diffY);

    if (absY > absX && absY > 12) {
      resetPointer();
      setDragOffset(0);
      latestOffsetRef.current = 0;
      resetDraggedState();

      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // 이미 해제된 경우 무시
      }

      return;
    }

    if (absX < 8) {
      return;
    }

    event.preventDefault();

    hasDraggedRef.current = true;
    setHasDragged(true);
    setDragOffset(diffX);
    latestOffsetRef.current = diffX;
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) {
      return;
    }

    const offset = latestOffsetRef.current;

    resetPointer();

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // 이미 release 된 경우 무시
    }

    const width = window.innerWidth;
    const threshold = Math.min(110, width * 0.25);

    if (offset <= -threshold) {
      finishSlide("next");
      return;
    }

    if (offset >= threshold) {
      finishSlide("prev");
      return;
    }

    if (Math.abs(offset) < 8) {
      resetAnimation();

      window.setTimeout(() => {
        resetDraggedState();
      }, 0);
      return;
    }

    finishSlide("center");
  };

  const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) {
      return;
    }

    resetPointer();

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // 이미 해제된 경우 무시
    }

    resetAnimation();

    window.setTimeout(() => {
      resetDraggedState();
    }, 0);
  };

  const loadMyUploads = async () => {
    if (!hasSupabaseConfig) {
      showToast("Supabase 연결 정보가 아직 설정되지 않았습니다.");
      return;
    }

    const trimmedPhone = lookupPhone.trim();
    const trimmedName = lookupName.trim();
    const trimmedPassword = lookupPassword.trim();

    if (!trimmedPhone) {
      showToast("연락처를 입력해주세요.");
      return;
    }

    if (!trimmedName) {
      showToast("이름을 입력해주세요.");
      return;
    }

    let passwordToUse = trimmedPassword;

    if (!passwordToUse) {
      passwordToUse = getFallbackPassword(trimmedPhone);
    }

    if (!passwordToUse) {
      showToast("비밀번호를 입력하거나 연락처 뒷자리 4자리를 확인해주세요.");
      return;
    }

    setLoadingMyUploads(true);
    setSearched(true);
    closeViewer();

    try {
      const passwordHash = await createPasswordHash(passwordToUse);

      const { data, error } = await supabase.rpc("get_my_uploaded_photos", {
        p_phone: trimmedPhone,
        p_name: trimmedName,
        p_password_hash: passwordHash,
      });

      if (error) {
        console.error("내 업로드 조회 실패:", error);
        showToast("내가 공유한 사진을 불러오지 못했습니다.");
        setLoadingMyUploads(false);
        return;
      }

      setMyUploads((data || []) as MyUploadItem[]);
    } finally {
      setLoadingMyUploads(false);
    }
  };

  const renderViewerMedia = (item: MyUploadItem, label: string) => {
    if (item.media_type === "video") {
      return (
        <video
          key={item.id}
          src={item.photo_url}
          controls
          playsInline
          preload="metadata"
        />
      );
    }

    return (
      <img
        key={item.id}
        src={item.thumbnail_url || item.photo_url}
        alt={label}
        draggable={false}
        loading="eager"
        decoding="async"
      />
    );
  };

  useEffect(() => {
    if (selectedIndex === null) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedIndex]);

  useEffect(() => {
    if (selectedIndex === null) {
      return;
    }

    preloadAroundIndex(selectedIndex);

    const clearPointerState = () => {
      if (pointerIdRef.current === null) {
        return;
      }

      resetPointer();
      resetAnimation();
      resetDraggedState();
    };

    window.addEventListener("pointerup", clearPointerState);
    window.addEventListener("pointercancel", clearPointerState);
    window.addEventListener("blur", clearPointerState);

    return () => {
      window.removeEventListener("pointerup", clearPointerState);
      window.removeEventListener("pointercancel", clearPointerState);
      window.removeEventListener("blur", clearPointerState);
    };
  }, [selectedIndex]);

  useEffect(() => {
    if (selectedIndex === null) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeViewer();
      }

      if (event.key === "ArrowLeft") {
        slidePrev();
      }

      if (event.key === "ArrowRight") {
        slideNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedIndex, myUploads]);

  useEffect(() => {
    return () => {
      clearAnimationTimer();
    };
  }, []);

  const prevIndex =
    selectedIndex !== null && myUploads.length > 0
      ? getPrevIndex(selectedIndex)
      : null;

  const nextIndex =
    selectedIndex !== null && myUploads.length > 0
      ? getNextIndex(selectedIndex)
      : null;
  return (
    <section className="section my-photos-page-section">
      <button className="upload-back-button" onClick={goBackUpload}>
        <ChevronLeft size={18} />
        <span>파일 업로드로 돌아가기</span>
      </button>

      <div className="upload-page-heading">
        <p className="upload-page-script">My Photos</p>
        <h2 className="upload-page-title">내가 공유한 사진·영상</h2>
      </div>

      <p className="upload-page-main-text">
        업로드할 때 입력한 연락처와 이름으로
        <br />
        내가 공유한 사진과 영상을 다시 확인할 수 있습니다.
        <br />
        비밀번호를 설정하지 않았다면 연락처 뒷자리 4자리를 입력해주세요.
      </p>

      <div className="upload-form-group">
        <label>이름</label>
        <input
          value={lookupName}
          onChange={(e) => setLookupName(e.target.value)}
          placeholder="홍성훈"
        />
      </div>

      <div className="upload-form-group">
        <label>연락처</label>
        <input
          value={lookupPhone}
          onChange={(e) => setLookupPhone(e.target.value)}
          placeholder="01012345678"
        />
      </div>

      <div className="upload-form-group">
        <label>비밀번호</label>
        <input
          type="password"
          value={lookupPassword}
          onChange={(e) => setLookupPassword(e.target.value)}
          placeholder="설정한 비밀번호 또는 전화번호 뒷자리 4개"
        />
      </div>

      <button
        className="upload-submit-main-button"
        onClick={loadMyUploads}
        disabled={loadingMyUploads}
        type="button"
      >
        {loadingMyUploads ? "불러오는 중..." : "사진 검색하기"}
      </button>

      {myUploads.length > 0 && (
        <div className="my-photos-result-section gallery-section">
          <p className="upload-preview-count">
            내가 공유한 파일 {myUploads.length}개
          </p>

          <div className="gallery-grid my-photos-gallery-grid">
            {myUploads.map((item, index) => (
              <button
                className="gallery-item my-photo-gallery-item"
                key={item.id}
                type="button"
                onClick={() => openViewer(index)}
              >
                {item.media_type === "video" ? (
                  <video
                    src={item.photo_url}
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <img
                    src={item.thumbnail_url || item.photo_url}
                    alt={item.original_name || "업로드 사진"}
                    loading="lazy"
                    decoding="async"
                  />
                )}

                {item.media_type === "video" && (
                  <span className="my-photo-video-badge">VIDEO</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {!loadingMyUploads && searched && myUploads.length === 0 && (
        <p className="upload-lookup-empty">
          조회된 사진이 없습니다. 연락처, 이름 또는 비밀번호를 확인해주세요.
        </p>
      )}

      <button
        className="upload-my-photos-button"
        onClick={goBackInvitation}
        type="button"
      >
        청첩장보러 가기
      </button>

      {toast && <div className="toast">{toast}</div>}

      {selectedIndex !== null && prevIndex !== null && nextIndex !== null && (
        <div
          className="image-modal photo-viewer-modal"
          onClick={(event) => {
            if (hasDragged || hasDraggedRef.current) {
              event.stopPropagation();
              return;
            }

            closeViewer();
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          role="presentation"
        >
          <button
            className="modal-close"
            type="button"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              closeViewer();
            }}
            aria-label="사진 닫기"
          >
            ×
          </button>

          {myUploads.length > 1 && (
            <button
              className="gallery-slide-button gallery-slide-prev"
              type="button"
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                slidePrev();
              }}
              aria-label="이전 사진"
            >
              <ChevronLeft size={34} />
            </button>
          )}

          <div
            className="photo-viewer-window"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="photo-viewer-track"
              style={{
                transform: `translate3d(calc(-100vw + ${dragOffset}px), 0, 0)`,
                transition: isAnimating
                  ? `transform ${SLIDE_DURATION}ms cubic-bezier(0.22, 0.61, 0.36, 1)`
                  : "none",
              }}
            >
              <div className="photo-viewer-panel">
                {renderViewerMedia(myUploads[prevIndex], `이전 사진 ${prevIndex + 1}`)}
              </div>

              <div className="photo-viewer-panel">
                {renderViewerMedia(myUploads[selectedIndex], `확대 사진 ${selectedIndex + 1}`)}
              </div>

              <div className="photo-viewer-panel">
                {renderViewerMedia(myUploads[nextIndex], `다음 사진 ${nextIndex + 1}`)}
              </div>
            </div>
          </div>

          {myUploads.length > 1 && (
            <button
              className="gallery-slide-button gallery-slide-next"
              type="button"
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                slideNext();
              }}
              aria-label="다음 사진"
            >
              <ChevronRight size={34} />
            </button>
          )}

          <div
            className="gallery-modal-count"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
          >
            {selectedIndex + 1} / {myUploads.length}
          </div>
        </div>
      )}

      <div className="upload-bottom-message">
        소중한 순간을 함께해 주셔서 감사합니다
      </div>
    </section>
  );
}

export function AdminPhotosPage() {
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPasswordHash, setAdminPasswordHash] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  const [summaries, setSummaries] = useState<AdminSummaryItem[]>([]);
  const [photos, setPhotos] = useState<AdminPhotoItem[]>([]);
  const [driveStats, setDriveStats] = useState<DriveStorageStats | null>(null);
  const [selectedUploader, setSelectedUploader] =
    useState<AdminSummaryItem | null>(null);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [toast, setToast] = useState("");
  const [uploaderQuery, setUploaderQuery] = useState("");
  const [uploaderSort, setUploaderSort] = useState<AdminUploaderSort>("latest");
  const [photoFilter, setPhotoFilter] = useState<AdminPhotoFilter>("all");
  const [photoSort, setPhotoSort] = useState<AdminPhotoSort>("newest");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() =>
    getStoredIdSet(ADMIN_FAVORITES_KEY)
  );
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(() =>
    getStoredIdSet(ADMIN_DOWNLOADED_KEY)
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectedIndexRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const latestOffsetRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const animatingRef = useRef(false);
  const pendingTargetRef = useRef<SlideTarget>(null);
  const animationTimerRef = useRef<number | null>(null);

  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  useEffect(() => {
    storeIdSet(ADMIN_FAVORITES_KEY, favoriteIds);
  }, [favoriteIds]);

  useEffect(() => {
    storeIdSet(ADMIN_DOWNLOADED_KEY, downloadedIds);
  }, [downloadedIds]);

  const visibleSummaries = useMemo(() => {
    const query = uploaderQuery.trim().toLocaleLowerCase("ko-KR");
    const filtered = summaries.filter((summary) => {
      if (!query) return true;
      return [summary.uploader_name, summary.uploader_phone]
        .some((value) => String(value || "").toLocaleLowerCase("ko-KR").includes(query));
    });

    return [...filtered].sort((left, right) => {
      if (uploaderSort === "name") {
        return String(left.uploader_name || "").localeCompare(
          String(right.uploader_name || ""),
          "ko-KR"
        );
      }

      const leftTime = new Date(left.last_uploaded_at).getTime();
      const rightTime = new Date(right.last_uploaded_at).getTime();
      return uploaderSort === "oldest" ? leftTime - rightTime : rightTime - leftTime;
    });
  }, [summaries, uploaderQuery, uploaderSort]);

  const visiblePhotos = useMemo(() => {
    const filtered = photos.filter((item) => {
      if (photoFilter === "image") return item.media_type !== "video";
      if (photoFilter === "video") return item.media_type === "video";
      if (photoFilter === "favorites") return favoriteIds.has(item.id);
      if (photoFilter === "downloaded") return downloadedIds.has(item.id);
      if (photoFilter === "not-downloaded") return !downloadedIds.has(item.id);
      return true;
    });

    return [...filtered].sort((left, right) => {
      if (photoSort === "name") {
        return String(left.original_name || "").localeCompare(
          String(right.original_name || ""),
          "ko-KR"
        );
      }

      const leftTime = new Date(left.created_at).getTime();
      const rightTime = new Date(right.created_at).getTime();
      return photoSort === "oldest" ? leftTime - rightTime : rightTime - leftTime;
    });
  }, [photos, photoFilter, photoSort, favoriteIds, downloadedIds]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1600);
  };

  const goBackInvitation = () => {
    window.location.hash = "";
  };

  const getPrevIndex = (index: number) => {
    return index === 0 ? visiblePhotos.length - 1 : index - 1;
  };

  const getNextIndex = (index: number) => {
    return index === visiblePhotos.length - 1 ? 0 : index + 1;
  };

  const clearAnimationTimer = () => {
    if (animationTimerRef.current !== null) {
      window.clearTimeout(animationTimerRef.current);
      animationTimerRef.current = null;
    }
  };

  const resetPointer = () => {
    pointerIdRef.current = null;
    startXRef.current = null;
    startYRef.current = null;
    latestOffsetRef.current = 0;
  };

  const resetAnimation = () => {
    clearAnimationTimer();
    animatingRef.current = false;
    pendingTargetRef.current = null;
    setIsAnimating(false);
    setDragOffset(0);
    latestOffsetRef.current = 0;
  };

  const openViewer = (index: number) => {
    selectedIndexRef.current = index;
    setSelectedIndex(index);
    resetPointer();
    resetAnimation();
  };

  const closeViewer = () => {
    selectedIndexRef.current = null;
    setSelectedIndex(null);
    resetPointer();
    resetAnimation();
  };

  const completeSlide = () => {
    const currentIndex = selectedIndexRef.current;
    const target = pendingTargetRef.current;

    if (currentIndex === null || !target) {
      resetAnimation();
      return;
    }

    let nextSelectedIndex = currentIndex;

    if (target === "next") {
      nextSelectedIndex = getNextIndex(currentIndex);
    }

    if (target === "prev") {
      nextSelectedIndex = getPrevIndex(currentIndex);
    }


    clearAnimationTimer();

    selectedIndexRef.current = nextSelectedIndex;
    pendingTargetRef.current = null;
    animatingRef.current = false;
    latestOffsetRef.current = 0;

    setIsAnimating(false);
    setSelectedIndex(nextSelectedIndex);
    setDragOffset(0);
  };

  const finishSlide = (target: Exclude<SlideTarget, null>) => {
    const currentIndex = selectedIndexRef.current;

    if (currentIndex === null || animatingRef.current) {
      return;
    }

    if (target !== "center" && visiblePhotos.length <= 1) {
      return;
    }

    const width = window.innerWidth;
    let finalOffset = 0;

    if (target === "next") {
      finalOffset = -width;
    }

    if (target === "prev") {
      finalOffset = width;
    }

    pendingTargetRef.current = target;
    animatingRef.current = true;

    setIsAnimating(true);
    setDragOffset(finalOffset);
    latestOffsetRef.current = finalOffset;

    clearAnimationTimer();

    animationTimerRef.current = window.setTimeout(() => {
      completeSlide();
    }, SLIDE_DURATION + 40);
  };

  const slidePrev = () => {
    finishSlide("prev");
  };

  const slideNext = () => {
    finishSlide("next");
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (animatingRef.current) {
      return;
    }

    const target = event.target as HTMLElement;

    if (
      target.closest(".gallery-slide-button") ||
      target.closest(".modal-close") ||
      target.closest(".gallery-modal-count") ||
      target.closest("video")
    ) {
      return;
    }

    pointerIdRef.current = event.pointerId;
    startXRef.current = event.clientX;
    startYRef.current = event.clientY;
    latestOffsetRef.current = 0;

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // pointer capture 실패 시 무시
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (
      pointerIdRef.current !== event.pointerId ||
      startXRef.current === null ||
      startYRef.current === null ||
      animatingRef.current
    ) {
      return;
    }

    const diffX = event.clientX - startXRef.current;
    const diffY = event.clientY - startYRef.current;

    const absX = Math.abs(diffX);
    const absY = Math.abs(diffY);

    if (absY > absX && absY > 8) {
      resetPointer();
      setDragOffset(0);
      latestOffsetRef.current = 0;

      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // 이미 해제된 경우 무시
      }

      return;
    }

    if (absX < 8) {
      return;
    }

    event.preventDefault();

    setDragOffset(diffX);
    latestOffsetRef.current = diffX;
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) {
      return;
    }

    const offset = latestOffsetRef.current;

    resetPointer();

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // 이미 release 된 경우 무시
    }

    const width = window.innerWidth;
    const threshold = Math.min(110, width * 0.25);

    if (offset <= -threshold) {
      finishSlide("next");
      return;
    }

    if (offset >= threshold) {
      finishSlide("prev");
      return;
    }

    if (Math.abs(offset) < 8) {
      resetAnimation();
      return;
    }

    finishSlide("center");
  };

  const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) {
      return;
    }

    resetPointer();

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // 이미 해제된 경우 무시
    }

    resetAnimation();
  };

  const loadSummary = async () => {
    if (!hasSupabaseConfig) {
      showToast("Supabase 연결 정보가 없습니다.");
      return;
    }

    const trimmedPassword = adminPassword.trim();

    if (!trimmedPassword) {
      showToast("관리자 비밀번호를 입력해주세요.");
      return;
    }

    setLoadingSummary(true);

    try {
      const passwordHash = await createPasswordHash(trimmedPassword);

      const { data, error } = await supabase.rpc(
        "get_uploaded_photos_admin_summary",
        {
          p_admin_password_hash: passwordHash,
        }
      );

      if (error) {
        console.error("관리자 요약 조회 실패:", error);
        showToast("관리자 데이터를 불러오지 못했습니다.");
        return;
      }

      let nextDriveStats: DriveStorageStats | null = null;

      if (USE_GOOGLE_DRIVE_UPLOAD) {
        try {
          const statsResponse = await fetch(
            `${PHOTO_UPLOAD_API_URL}/admin/storage-stats`,
            {
              headers: { "x-admin-password-hash": passwordHash },
            }
          );

          if (!statsResponse.ok) {
            throw new Error(await getUploadError(statsResponse));
          }

          nextDriveStats = (await statsResponse.json()) as DriveStorageStats;
        } catch (statsError) {
          console.warn("Google Drive 관리 현황 조회 실패:", statsError);
          showToast("사진 목록은 불러왔지만 Drive 현황은 확인하지 못했습니다.");
        }
      }

      const rows = (data || []) as AdminSummaryItem[];

      if (rows.length === 0) {
        showToast("조회 결과가 없습니다. 비밀번호를 확인해주세요.");
      }

      setAdminPasswordHash(passwordHash);
      setSummaries(rows);
      setDriveStats(nextDriveStats);
      setSelectedUploader(null);
      setPhotos([]);
      setSelectedIds(new Set());
      closeViewer();
    } finally {
      setLoadingSummary(false);
    }
  };

  const loadPhotosByUploader = async (summary: AdminSummaryItem) => {
    if (!adminPasswordHash) {
      showToast("관리자 비밀번호를 먼저 확인해주세요.");
      return;
    }

    setLoadingPhotos(true);
    setSelectedUploader(summary);
    setPhotos([]);
    setSelectedIds(new Set());
    closeViewer();

    try {
      const { data, error } = await supabase.rpc(
        "get_uploaded_photos_admin_by_folder",
        {
          p_admin_password_hash: adminPasswordHash,
          p_uploader_folder_key: summary.uploader_folder_key,
        }
      );

      if (error) {
        console.error("관리자 사진 조회 실패:", error);
        showToast("사진을 불러오지 못했습니다.");
        return;
      }

      setPhotos((data || []) as AdminPhotoItem[]);
    } finally {
      setLoadingPhotos(false);
    }
  };

  const renderViewerMedia = (item: AdminPhotoItem) => {
    return <PhotoViewerMedia key={item.id} item={item} />;
  };

  const triggerOriginalDownload = (item: AdminPhotoItem) => {
    try {
      const downloadUrl = new URL(item.photo_url);
      const fileName = item.original_name || "wedding-original";

      downloadUrl.searchParams.set("download", fileName);

      const anchor = document.createElement("a");
      anchor.href = downloadUrl.toString();
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      return true;
    } catch {
      return false;
    }
  };

  const markDownloaded = (ids: string[]) => {
    setDownloadedIds((current) => new Set([...current, ...ids]));
  };

  const downloadOriginal = (item: AdminPhotoItem) => {
    if (triggerOriginalDownload(item)) {
      if (photoFilter === "not-downloaded") closeViewer();
      markDownloaded([item.id]);
    } else {
      showToast("원본 파일을 다운로드하지 못했습니다.");
    }
  };

  const toggleFavorite = (id: string) => {
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = visiblePhotos.map((item) => item.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

    setSelectedIds((current) => {
      const next = new Set(current);
      visibleIds.forEach((id) => {
        if (allSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  const downloadSelected = () => {
    const targets = photos.filter((item) => selectedIds.has(item.id));

    if (targets.length === 0) {
      showToast("다운로드할 파일을 선택해주세요.");
      return;
    }

    targets.forEach((item, index) => {
      window.setTimeout(() => triggerOriginalDownload(item), index * 450);
    });
    markDownloaded(targets.map((item) => item.id));
    setSelectedIds(new Set());
    showToast(`원본 ${targets.length}개 다운로드를 시작했습니다.`);
  };

  useEffect(() => {
    if (selectedIndex === null) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedIndex]);

  useEffect(() => {
    if (selectedIndex === null) {
      return;
    }

    const clearPointerState = () => {
      if (pointerIdRef.current === null) {
        return;
      }

      resetPointer();
      resetAnimation();
    };

    window.addEventListener("pointerup", clearPointerState);
    window.addEventListener("pointercancel", clearPointerState);
    window.addEventListener("blur", clearPointerState);

    return () => {
      window.removeEventListener("pointerup", clearPointerState);
      window.removeEventListener("pointercancel", clearPointerState);
      window.removeEventListener("blur", clearPointerState);
    };
  }, [selectedIndex]);

  useEffect(() => {
    if (selectedIndex === null) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeViewer();
      }

      if (event.key === "ArrowLeft") {
        slidePrev();
      }

      if (event.key === "ArrowRight") {
        slideNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedIndex, visiblePhotos]);

  useEffect(() => {
    return () => {
      clearAnimationTimer();
    };
  }, []);

  const prevIndex =
    selectedIndex !== null && visiblePhotos.length > 0
      ? getPrevIndex(selectedIndex)
      : null;

  const nextIndex =
    selectedIndex !== null && visiblePhotos.length > 0
      ? getNextIndex(selectedIndex)
      : null;

const adminStats = summaries.reduce(
  (acc, item) => {
    acc.totalUploaders += 1;
    acc.totalFiles += Number(item.total_count || 0);
    acc.totalImages += Number(item.image_count || 0);
    acc.totalVideos += Number(item.video_count || 0);

    return acc;
  },
  {
    totalUploaders: 0,
    totalFiles: 0,
    totalImages: 0,
    totalVideos: 0,
  }
);

  return (
    <section className="section admin-photos-page-section">
      <button className="upload-back-button" onClick={goBackInvitation}>
        <ChevronLeft size={18} />
        <span>청첩장보러 가기</span>
      </button>

      <div className="upload-page-heading">
        <p className="upload-page-script">Admin</p>
        <h2 className="upload-page-title">업로드 사진 관리자</h2>
      </div>

      <p className="upload-page-main-text">
        하객들이 업로드한 사진을
        <br />
        사람별로 확인할 수 있습니다.
      </p>

      <div className="upload-form-group">
        <label>관리자 비밀번호</label>
        <input
          type="password"
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          placeholder="관리자 비밀번호"
        />
      </div>

      <button
        className="upload-submit-main-button"
        type="button"
        onClick={loadSummary}
        disabled={loadingSummary}
      >
        {loadingSummary ? "불러오는 중..." : "관리자 조회"}
      </button>

<button
  className="upload-my-photos-button"
  type="button"
  onClick={() => {
    window.location.hash = "admin-guestbook";
  }}
>
  방명록 관리자 열기
</button>

<button
  className="upload-my-photos-button"
  type="button"
  onClick={() => {
    window.location.hash = "admin-rsvp";
  }}
>
  참석여부 관리자 열기
</button>

{summaries.length > 0 && (
  <div className="admin-stats-grid">
    <div className="admin-stat-card">
      <span>업로더</span>
      <strong>{adminStats.totalUploaders}</strong>
    </div>

    <div className="admin-stat-card">
      <span>전체 파일</span>
      <strong>{adminStats.totalFiles}</strong>
    </div>

    <div className="admin-stat-card">
      <span>사진</span>
      <strong>{adminStats.totalImages}</strong>
    </div>

    <div className="admin-stat-card">
      <span>영상</span>
      <strong>{adminStats.totalVideos}</strong>
    </div>
  </div>
)}

      {driveStats && (
        <div className="drive-storage-section">
          <div className="drive-storage-heading">
            <strong>Google Drive 저장 현황</strong>
            <span>{driveStats.storage.usagePercent.toFixed(1)}% 사용</span>
          </div>

          <div
            className="drive-storage-progress"
            role="progressbar"
            aria-label="Google Drive 업로드 한도 사용률"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(driveStats.storage.usagePercent)}
          >
            <span style={{ width: `${driveStats.storage.usagePercent}%` }} />
          </div>

          <div className="drive-storage-metrics">
            <div>
              <span>Drive 전체 사용</span>
              <strong>{formatFileSize(driveStats.storage.usageBytes)}</strong>
            </div>
            <div>
              <span>업로드 가능 용량</span>
              <strong>{formatFileSize(driveStats.storage.remainingUploadBytes)}</strong>
            </div>
            <div>
              <span>원본</span>
              <strong>{driveStats.files.driveOriginals}개</strong>
            </div>
            <div>
              <span>썸네일</span>
              <strong>{driveStats.files.driveThumbnails}개</strong>
            </div>
          </div>

          <div className="drive-folder-status">
            <span className={driveStats.folders.originals.ok ? "ok" : "error"}>
              원본 폴더 {driveStats.folders.originals.ok ? "정상" : "연결 오류"}
            </span>
            <span className={driveStats.folders.thumbnails.ok ? "ok" : "error"}>
              썸네일 폴더 {driveStats.folders.thumbnails.ok ? "정상" : "연결 오류"}
            </span>
          </div>

          {(driveStats.files.missingThumbnails > 0 ||
            driveStats.files.legacyFiles > 0 ||
            driveStats.storage.usagePercent >= 80) && (
            <div className="drive-storage-warnings">
              {driveStats.storage.usagePercent >= 80 && (
                <p>Drive 업로드 한도의 80% 이상을 사용했습니다.</p>
              )}
              {driveStats.files.missingThumbnails > 0 && (
                <p>썸네일이 없는 원본이 {driveStats.files.missingThumbnails}개 있습니다.</p>
              )}
              {driveStats.files.legacyFiles > 0 && (
                <p>기존 Supabase Storage 파일이 {driveStats.files.legacyFiles}개 있습니다.</p>
              )}
            </div>
          )}
        </div>
      )}

      {summaries.length > 0 && (
        <div className="admin-uploader-list">
          <div className="admin-media-controls">
            <label className="admin-media-search">
              <Search size={16} />
              <input
                type="search"
                value={uploaderQuery}
                onChange={(event) => setUploaderQuery(event.target.value)}
                placeholder="이름 또는 연락처 검색"
              />
            </label>
            <select
              aria-label="업로더 정렬"
              value={uploaderSort}
              onChange={(event) => setUploaderSort(event.target.value as AdminUploaderSort)}
            >
              <option value="latest">최근 업로드순</option>
              <option value="oldest">오래된 업로드순</option>
              <option value="name">이름순</option>
            </select>
          </div>

          <p className="upload-preview-count">
            업로더 {visibleSummaries.length}명
            {visibleSummaries.length !== summaries.length && ` / 전체 ${summaries.length}명`}
          </p>

          {visibleSummaries.map((summary) => (
            <button
              className={`admin-uploader-card ${
                selectedUploader?.uploader_folder_key ===
                summary.uploader_folder_key
                  ? "active"
                  : ""
              }`}
              key={summary.uploader_folder_key}
              type="button"
              onClick={() => loadPhotosByUploader(summary)}
            >
              <strong>{summary.uploader_name || "이름 없음"}</strong>

              <span>{summary.uploader_phone || "연락처 없음"}</span>

              <em>
                총 {summary.total_count}개 · 사진 {summary.image_count}개
                {summary.video_count > 0 && ` · 영상 ${summary.video_count}개`}
              </em>

              <small>{summary.uploader_folder_key}</small>
            </button>
          ))}
        </div>
      )}

      {selectedUploader && (
        <div className="admin-selected-uploader">
          <strong>{selectedUploader.uploader_name || "이름 없음"}</strong>
          <span>{selectedUploader.uploader_phone || "연락처 없음"}</span>
        </div>
      )}

      {loadingPhotos && (
        <p className="upload-lookup-empty">사진을 불러오는 중입니다...</p>
      )}

      {photos.length > 0 && (
        <div className="my-photos-result-section gallery-section">
          <div className="admin-photo-tools">
            <div className="admin-media-controls admin-photo-filters">
              <select
                aria-label="파일 필터"
                value={photoFilter}
                onChange={(event) => {
                  setPhotoFilter(event.target.value as AdminPhotoFilter);
                  closeViewer();
                }}
              >
                <option value="all">전체 파일</option>
                <option value="image">사진만</option>
                <option value="video">동영상만</option>
                <option value="favorites">즐겨찾기</option>
                <option value="downloaded">저장 완료</option>
                <option value="not-downloaded">저장 안 함</option>
              </select>
              <select
                aria-label="파일 정렬"
                value={photoSort}
                onChange={(event) => {
                  setPhotoSort(event.target.value as AdminPhotoSort);
                  closeViewer();
                }}
              >
                <option value="newest">최신순</option>
                <option value="oldest">오래된순</option>
                <option value="name">파일명순</option>
              </select>
            </div>

            <div className="admin-photo-selection-actions">
              <button type="button" onClick={toggleSelectAllVisible}>
                {visiblePhotos.length > 0 && visiblePhotos.every((item) => selectedIds.has(item.id)) ? (
                  <SquareCheckBig size={17} />
                ) : (
                  <Square size={17} />
                )}
                <span>현재 목록 전체</span>
              </button>
              <button
                className="primary"
                type="button"
                onClick={downloadSelected}
                disabled={selectedIds.size === 0}
              >
                <Download size={17} />
                <span>선택 원본 {selectedIds.size}개 저장</span>
              </button>
            </div>
          </div>

          <p className="upload-preview-count">
            파일 {visiblePhotos.length}개
            {visiblePhotos.length !== photos.length && ` / 전체 ${photos.length}개`}
          </p>

          <div className="gallery-grid my-photos-gallery-grid">
            {visiblePhotos.map((item, index) => (
              <div
                className={`admin-photo-card${selectedIds.has(item.id) ? " selected" : ""}`}
                key={item.id}
              >
                <button
                  className="gallery-item my-photo-gallery-item"
                  type="button"
                  onClick={() => openViewer(index)}
                >
                  {item.media_type === "video" ? (
                    <video
                      src={item.photo_url}
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={item.thumbnail_url || item.photo_url}
                      alt={item.original_name || "업로드 사진"}
                      loading="lazy"
                      decoding="async"
                    />
                  )}

                  {item.media_type === "video" && (
                    <span className="my-photo-video-badge">VIDEO</span>
                  )}
                  {downloadedIds.has(item.id) && (
                    <span className="admin-photo-downloaded-badge">저장됨</span>
                  )}
                </button>

                <button
                  className={`admin-photo-card-action favorite${favoriteIds.has(item.id) ? " active" : ""}`}
                  type="button"
                  onClick={() => toggleFavorite(item.id)}
                  title={favoriteIds.has(item.id) ? "즐겨찾기 해제" : "즐겨찾기"}
                  aria-label={favoriteIds.has(item.id) ? "즐겨찾기 해제" : "즐겨찾기"}
                >
                  <Heart size={17} fill={favoriteIds.has(item.id) ? "currentColor" : "none"} />
                </button>
                <button
                  className={`admin-photo-card-action select${selectedIds.has(item.id) ? " active" : ""}`}
                  type="button"
                  onClick={() => toggleSelected(item.id)}
                  title={selectedIds.has(item.id) ? "선택 해제" : "다운로드 선택"}
                  aria-label={selectedIds.has(item.id) ? "선택 해제" : "다운로드 선택"}
                >
                  {selectedIds.has(item.id) ? <SquareCheckBig size={17} /> : <Square size={17} />}
                </button>
              </div>
            ))}
          </div>

          {visiblePhotos.length === 0 && (
            <p className="upload-lookup-empty">조건에 맞는 파일이 없습니다.</p>
          )}
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}

      {selectedIndex !== null &&
        selectedIndex < visiblePhotos.length &&
        prevIndex !== null &&
        nextIndex !== null && (
        <div
          className="image-modal photo-viewer-modal"
          onClick={closeViewer}
          role="presentation"
        >
          <button
            className="modal-close"
            type="button"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              closeViewer();
            }}
          >
            ×
          </button>

          {visiblePhotos.length > 1 && (
            <button
              className="gallery-slide-button gallery-slide-prev"
              type="button"
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                slidePrev();
              }}
              aria-label="이전 사진"
            >
              <ChevronLeft size={34} />
            </button>
          )}

          <div
            className="photo-viewer-window"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={handlePointerCancel}
          >
            <div
              className="photo-viewer-track"
              style={{
                transform: `translate3d(calc(-100vw + ${dragOffset}px), 0, 0)`,
                transition: isAnimating
                  ? `transform ${SLIDE_DURATION}ms cubic-bezier(0.22, 0.61, 0.36, 1)`
                  : "none",
              }}
            >
              <div className="photo-viewer-panel">
                {renderViewerMedia(visiblePhotos[prevIndex])}
              </div>

              <div className="photo-viewer-panel">
                {renderViewerMedia(visiblePhotos[selectedIndex])}
              </div>

              <div className="photo-viewer-panel">
                {renderViewerMedia(visiblePhotos[nextIndex])}
              </div>
            </div>
          </div>

          {visiblePhotos.length > 1 && (
            <button
              className="gallery-slide-button gallery-slide-next"
              type="button"
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                slideNext();
              }}
              aria-label="다음 사진"
            >
              <ChevronRight size={34} />
            </button>
          )}

          <div
            className="gallery-modal-count"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
          >
            {selectedIndex + 1} / {visiblePhotos.length}
          </div>

          <button
            className={`admin-photo-favorite-button${favoriteIds.has(visiblePhotos[selectedIndex].id) ? " active" : ""}`}
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              if (
                photoFilter === "favorites" &&
                favoriteIds.has(visiblePhotos[selectedIndex].id)
              ) {
                closeViewer();
              }
              toggleFavorite(visiblePhotos[selectedIndex].id);
            }}
            title="즐겨찾기"
            aria-label="현재 파일 즐겨찾기"
          >
            <Heart
              size={20}
              fill={favoriteIds.has(visiblePhotos[selectedIndex].id) ? "currentColor" : "none"}
            />
          </button>

          <button
            className={`admin-photo-download-button${downloadedIds.has(visiblePhotos[selectedIndex].id) ? " downloaded" : ""}`}
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              downloadOriginal(visiblePhotos[selectedIndex]);
            }}
            title="원본 파일 다운로드"
            aria-label="현재 원본 파일 다운로드"
          >
            {downloadedIds.has(visiblePhotos[selectedIndex].id) ? (
              <SquareCheckBig size={18} />
            ) : (
              <Download size={18} />
            )}
            <span>{downloadedIds.has(visiblePhotos[selectedIndex].id) ? "저장 완료" : "원본 저장"}</span>
          </button>
        </div>
      )}

      <div className="upload-bottom-message">관리자 페이지입니다</div>
    </section>
  );
}
