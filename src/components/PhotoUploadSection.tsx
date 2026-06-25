import {
  useEffect,
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
  Plus,
  Search,
  X,
} from "lucide-react";
import { supabase, hasSupabaseConfig } from "../lib/supabase";

const MAX_FILE_COUNT = 100;
const MAX_FILE_SIZE = 500 * 1024 * 1024;
const SLIDE_DURATION = 260;

type UploadStatus = "waiting" | "uploading" | "success" | "error";
type SlideTarget = "prev" | "next" | "center" | null;

type UploadFileItem = {
  id: string;
  file: File;
  previewUrl: string;
  status: UploadStatus;
  errorMessage?: string;
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
  if (file.type.startsWith("image/")) {
    return "image";
  }

  if (file.type.startsWith("video/")) {
    return "video";
  }

  return "unknown";
}

function isAllowedFile(file: File) {
  return file.type.startsWith("image/") || file.type.startsWith("video/");
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

      const canvas = document.createElement("canvas");
      const size = 500;

      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Canvas context를 생성하지 못했습니다."));
        return;
      }

      const sourceSize = Math.min(image.width, image.height);
      const sourceX = (image.width - sourceSize) / 2;
      const sourceY = (image.height - sourceSize) / 2;

      ctx.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        size,
        size
      );

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("썸네일 생성 실패"));
            return;
          }

          resolve(blob);
        },
        "image/webp",
        0.72
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 불러오지 못했습니다."));
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
  const goUploadPage = () => {
    window.location.hash = "upload";
  };

  return (
    <section className="section upload-entry-section">
      <div className="upload-entry-heading">
        <p className="upload-entry-script">Photo Share</p>
        <h2 className="upload-entry-title">소중한 순간 공유</h2>
      </div>

      <div className="upload-entry-icon-wrap">
        <div className="upload-entry-icon-circle">
          <Camera size={34} />
        </div>
      </div>

      <p className="upload-entry-desc">
        결혼식 현장에서 찍은 사진들을
        <br />
        신랑신부와 함께 나눠보세요
      </p>

      <button className="upload-entry-button" onClick={goUploadPage}>
        <Camera size={18} />
        <span>사진 업로드하기</span>
      </button>
    </section>
  );
}

export function PhotoUploadPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const filesRef = useRef<UploadFileItem[]>([]);

  const [isDragging, setIsDragging] = useState(false);

  const [uploaderPhone, setUploaderPhone] = useState("");
  const [uploaderName, setUploaderName] = useState("");
  const [uploaderPassword, setUploaderPassword] = useState("");

  const [files, setFiles] = useState<UploadFileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState("");

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

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

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
      showToast("사진 또는 동영상 파일만 업로드할 수 있습니다.");
      return;
    }

    const oversizedFile = allowedFiles.find((file) => file.size > MAX_FILE_SIZE);

    if (oversizedFile) {
      showToast(`파일 크기는 개당 ${formatFileSize(MAX_FILE_SIZE)} 이하입니다.`);
      return;
    }

    if (files.length + allowedFiles.length > MAX_FILE_COUNT) {
      showToast(`한 번에 최대 ${MAX_FILE_COUNT}개까지 업로드할 수 있습니다.`);
      return;
    }

    const nextItems: UploadFileItem[] = allowedFiles.map((file) => ({
      id: `${Date.now()}-${crypto.randomUUID()}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: "waiting",
    }));

    setFiles((prev) => [...prev, ...nextItems]);
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
    uploadGroupId: string
  ) => {
    const trimmedName = uploaderName.trim();
    const trimmedPhone = uploaderPhone.trim();

    const nameKey = normalizeName(trimmedName).toLowerCase();
    const phoneKey = normalizePhone(trimmedPhone);
    const uploaderFolder = getUploaderFolderName(trimmedName, trimmedPhone);

    const ext = getFileExtension(item.file.name);
    const mediaType = getMediaType(item.file);
    const fileId = crypto.randomUUID();
    const timestamp = Date.now();
    const safeFileName = `${timestamp}-${fileId}.${ext}`;

    const originalFolderName = mediaType === "video" ? "videos" : "originals";
    const storagePath = `guest/${uploaderFolder}/${originalFolderName}/${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("wedding-photos")
      .upload(storagePath, item.file, {
        cacheControl: "31536000",
        upsert: false,
        contentType: item.file.type,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } = supabase.storage
      .from("wedding-photos")
      .getPublicUrl(storagePath);

    let thumbnailUrl: string | null = null;
    let thumbnailStoragePath: string | null = null;

    if (mediaType === "image") {
      const thumbnailBlob = await createImageThumbnail(item.file);
      const thumbnailPath = `guest/${uploaderFolder}/thumbs/${timestamp}-${fileId}.webp`;

      const { error: thumbnailUploadError } = await supabase.storage
        .from("wedding-photos")
        .upload(thumbnailPath, thumbnailBlob, {
          cacheControl: "31536000",
          upsert: false,
          contentType: "image/webp",
        });

      if (thumbnailUploadError) {
        throw thumbnailUploadError;
      }

      const { data: thumbnailPublicUrlData } = supabase.storage
        .from("wedding-photos")
        .getPublicUrl(thumbnailPath);

      thumbnailUrl = thumbnailPublicUrlData.publicUrl;
      thumbnailStoragePath = thumbnailPath;
    }

    const { error: insertError } = await supabase.from("uploaded_photos").insert({
      upload_group_id: uploadGroupId,
      uploader_name: trimmedName,
      uploader_phone: trimmedPhone || null,
      uploader_name_key: nameKey,
      uploader_phone_key: phoneKey,
      uploader_folder_key: uploaderFolder,
      uploader_password_hash: passwordHash,
      photo_url: publicUrlData.publicUrl,
      storage_path: storagePath,
      thumbnail_url: thumbnailUrl,
      thumbnail_storage_path: thumbnailStoragePath,
      media_type: mediaType,
      original_name: item.file.name,
      file_size: item.file.size,
      visible: true,
    });

    if (insertError) {
      throw insertError;
    }
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

    setUploading(true);

    setUploadProgress({
      current: 0,
      total: files.length,
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

    for (const [index, item] of files.entries()) {
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
        await uploadOneFile(item, passwordHash, uploadGroupId);

        successCount += 1;

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

        failCount += 1;

        setUploadProgress((prev) => ({
          ...prev,
          fail: prev.fail + 1,
        }));

        setFiles((prev) =>
          prev.map((fileItem) =>
            fileItem.id === item.id
              ? { ...fileItem, status: "error", errorMessage: "업로드 실패" }
              : fileItem
          )
        );
      }
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
        count: successCount,
        name: trimmedName,
        phone: trimmedPhone,
      });

      setUploaderPhone("");
      setUploaderName("");
      setUploaderPassword("");
      clearSelectedFiles();

      return;
    }

    showToast(`${successCount}개 성공, ${failCount}개 실패했습니다.`);
  };

  const uploadPercent =
    uploadProgress.total > 0
      ? Math.round((uploadProgress.current / uploadProgress.total) * 100)
      : 0;

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
        <label>사진 선택</label>

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
          <p>사진 또는 동영상을 선택하거나 드래그해서 올려주세요</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          accept="image/*,video/*"
          onChange={handleInputFiles}
          disabled={uploading}
        />

        <div className="upload-limit-guide">
          <p>• 한 번에 최대 {MAX_FILE_COUNT}개까지 업로드하실 수 있습니다</p>
          <p>• 업로드 가능한 파일 크기는 개당 {formatFileSize(MAX_FILE_SIZE)} 이하입니다</p>
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

                    {!uploading && item.status === "waiting" && (
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
        disabled={uploading || !uploaderName.trim() || files.length === 0}
      >
        {uploading ? "업로드 중..." : "사진 업로드하기"}
      </button>

      <button
        className="upload-my-photos-button"
        onClick={goMyPhotosPage}
        type="button"
        disabled={uploading}
      >
        <Search size={18} />
        <span>내가 공유한 사진 보러가기</span>
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
              💕 사진을 소중히
              <br />
              전달하고 있어요
            </h3>

            <p>
              업로드가 완료될 때까지
              <br />
              이 화면을 닫지 말아주세요.
            </p>

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
              소중한 사진 {uploadComplete.count}개를
              <br />
              공유해주셔서 감사합니다.
            </p>

            <div className="upload-complete-actions">
              <button
                type="button"
                className="upload-complete-primary"
                onClick={() => {
                  setUploadComplete(null);
                  window.location.hash = "my-photos";
                }}
              >
                내가 공유한 사진 보기
              </button>

              <button
                type="button"
                className="upload-complete-secondary"
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
  const [toast, setToast] = useState("");

  const selectedIndexRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const latestOffsetRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const animatingRef = useRef(false);
  const pendingTargetRef = useRef<SlideTarget>(null);
  const animationTimerRef = useRef<number | null>(null);

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

    if (target !== "center" && myUploads.length <= 1) {
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

  const renderViewerMedia = (item: MyUploadItem) => {
    if (item.media_type === "video") {
      return (
        <video src={item.photo_url} controls playsInline preload="metadata" />
      );
    }

    return (
      <img
        src={item.photo_url}
        alt={item.original_name || "업로드 사진"}
        loading="eager"
        decoding="async"
        draggable={false}
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
        <span>사진 업로드로 돌아가기</span>
      </button>

      <div className="upload-page-heading">
        <p className="upload-page-script">My Photos</p>
        <h2 className="upload-page-title">내가 공유한 사진</h2>
      </div>

      <p className="upload-page-main-text">
        업로드할 때 입력한 연락처와 이름으로
        <br />
        내가 공유한 사진을 다시 확인할 수 있습니다.
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
                {renderViewerMedia(myUploads[prevIndex])}
              </div>

              <div className="photo-viewer-panel">
                {renderViewerMedia(myUploads[selectedIndex])}
              </div>

              <div className="photo-viewer-panel">
                {renderViewerMedia(myUploads[nextIndex])}
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
  const [selectedUploader, setSelectedUploader] =
    useState<AdminSummaryItem | null>(null);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [toast, setToast] = useState("");

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

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1600);
  };

  const goBackInvitation = () => {
    window.location.hash = "";
  };

  const getPrevIndex = (index: number) => {
    return index === 0 ? photos.length - 1 : index - 1;
  };

  const getNextIndex = (index: number) => {
    return index === photos.length - 1 ? 0 : index + 1;
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

    if (target !== "center" && photos.length <= 1) {
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

      const rows = (data || []) as AdminSummaryItem[];

      if (rows.length === 0) {
        showToast("조회 결과가 없습니다. 비밀번호를 확인해주세요.");
      }

      setAdminPasswordHash(passwordHash);
      setSummaries(rows);
      setSelectedUploader(null);
      setPhotos([]);
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
    if (item.media_type === "video") {
      return (
        <video src={item.photo_url} controls playsInline preload="metadata" />
      );
    }

    return (
      <img
        src={item.photo_url}
        alt={item.original_name || "업로드 사진"}
        loading="eager"
        decoding="async"
        draggable={false}
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
  }, [selectedIndex, photos]);

  useEffect(() => {
    return () => {
      clearAnimationTimer();
    };
  }, []);

  const prevIndex =
    selectedIndex !== null && photos.length > 0
      ? getPrevIndex(selectedIndex)
      : null;

  const nextIndex =
    selectedIndex !== null && photos.length > 0
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

      {summaries.length > 0 && (
        <div className="admin-uploader-list">
          <p className="upload-preview-count">업로더 {summaries.length}명</p>

          {summaries.map((summary) => (
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
          <p className="upload-preview-count">업로드 파일 {photos.length}개</p>

          <div className="gallery-grid my-photos-gallery-grid">
            {photos.map((item, index) => (
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

      {toast && <div className="toast">{toast}</div>}

      {selectedIndex !== null && prevIndex !== null && nextIndex !== null && (
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

          {photos.length > 1 && (
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
                {renderViewerMedia(photos[prevIndex])}
              </div>

              <div className="photo-viewer-panel">
                {renderViewerMedia(photos[selectedIndex])}
              </div>

              <div className="photo-viewer-panel">
                {renderViewerMedia(photos[nextIndex])}
              </div>
            </div>
          </div>

          {photos.length > 1 && (
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
            {selectedIndex + 1} / {photos.length}
          </div>
        </div>
      )}

      <div className="upload-bottom-message">관리자 페이지입니다</div>
    </section>
  );
}
