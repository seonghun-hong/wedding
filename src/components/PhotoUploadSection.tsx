import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import { Camera, ChevronLeft, Plus, Search, X } from "lucide-react";
import { supabase, hasSupabaseConfig } from "../lib/supabase";

const MAX_FILE_COUNT = 100;
const MAX_FILE_SIZE = 500 * 1024 * 1024;

type UploadStatus = "waiting" | "uploading" | "success" | "error";

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
  media_type: string | null;
  original_name: string | null;
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

function getUploaderFolderName(phone: string) {
  const last4 = getPhoneLast4(phone);

  if (!last4) {
    return "user_no_phone";
  }

  return `user_${last4}`;
}

async function createPasswordHash(password: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
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
      <div className="upload-entry-top-line" />

      <div className="upload-entry-icon-wrap">
        <div className="upload-entry-icon-circle">
          <Camera size={34} />
        </div>
      </div>

      <h2 className="upload-entry-title">소중한 순간을 공유해주세요</h2>

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

  const [isDragging, setIsDragging] = useState(false);

  const [uploaderPhone, setUploaderPhone] = useState("");
  const [uploaderName, setUploaderName] = useState("");
  const [uploaderPassword, setUploaderPassword] = useState("");

  const [files, setFiles] = useState<UploadFileItem[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    return () => {
      files.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, [files]);

  const goBackInvitation = () => {
    window.location.hash = "";
  };

  const goMyPhotosPage = () => {
    window.location.hash = "my-photos";
  };

  const addFiles = (selectedFiles: File[]) => {
    const allowedFiles = selectedFiles.filter(isAllowedFile);

    if (allowedFiles.length !== selectedFiles.length) {
      alert("사진 또는 동영상 파일만 업로드할 수 있습니다.");
      return;
    }

    const oversizedFile = allowedFiles.find((file) => file.size > MAX_FILE_SIZE);

    if (oversizedFile) {
      alert(`업로드 가능한 파일 크기는 개당 ${formatFileSize(MAX_FILE_SIZE)} 이하입니다.`);
      return;
    }

    if (files.length + allowedFiles.length > MAX_FILE_COUNT) {
      alert(`한 번에 최대 ${MAX_FILE_COUNT}개까지 업로드할 수 있습니다.`);
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

  const uploadOneFile = async (item: UploadFileItem, passwordHash: string | null) => {
    const trimmedName = uploaderName.trim();
    const trimmedPhone = uploaderPhone.trim();

    const ext = getFileExtension(item.file.name);
    const mediaType = getMediaType(item.file);
    const folderName = mediaType === "video" ? "videos" : "images";
    const uploaderFolder = getUploaderFolderName(trimmedPhone);
    const safeFileName = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const storagePath = `guest/${uploaderFolder}/${folderName}/${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("wedding-photos")
      .upload(storagePath, item.file, {
        cacheControl: "3600",
        upsert: false,
        contentType: item.file.type,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } = supabase.storage
      .from("wedding-photos")
      .getPublicUrl(storagePath);

    const { error: insertError } = await supabase.from("uploaded_photos").insert({
      uploader_name: trimmedName,
      uploader_phone: trimmedPhone || null,
      uploader_password_hash: passwordHash,
      photo_url: publicUrlData.publicUrl,
      storage_path: storagePath,
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
      alert("Supabase 연결 정보가 아직 설정되지 않았습니다.");
      return;
    }

    const trimmedName = uploaderName.trim();
    const trimmedPassword = uploaderPassword.trim();

    if (!trimmedName) {
      alert("이름을 입력해주세요.");
      return;
    }

    if (files.length === 0) {
      alert("업로드할 사진 또는 동영상을 선택해주세요.");
      return;
    }

    setUploading(true);

    let passwordHash: string | null = null;

    if (trimmedPassword) {
      passwordHash = await createPasswordHash(trimmedPassword);
    } else {
      const fallbackPassword = getFallbackPassword(uploaderPhone);

      if (fallbackPassword) {
        passwordHash = await createPasswordHash(fallbackPassword);
      }
    }

    let successCount = 0;
    let failCount = 0;

    for (const item of files) {
      setFiles((prev) =>
        prev.map((fileItem) =>
          fileItem.id === item.id
            ? { ...fileItem, status: "uploading", errorMessage: undefined }
            : fileItem
        )
      );

      try {
        await uploadOneFile(item, passwordHash);

        successCount += 1;

        setFiles((prev) =>
          prev.map((fileItem) =>
            fileItem.id === item.id ? { ...fileItem, status: "success" } : fileItem
          )
        );
      } catch (error) {
        console.error("파일 업로드 실패:", error);

        failCount += 1;

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
      alert(`${successCount}개 파일 업로드가 완료되었습니다.`);

      setUploaderPhone("");
      setUploaderName("");
      setUploaderPassword("");
      clearSelectedFiles();

      return;
    }

    alert(`${successCount}개 성공, ${failCount}개 실패했습니다.`);
  };

  return (
    <section className="section upload-page-section">
      <button className="upload-back-button" onClick={goBackInvitation}>
        <ChevronLeft size={18} />
        <span>청첩장보러 가기</span>
      </button>

      <div className="upload-page-emoji">📸</div>

      <h2 className="upload-page-title">스냅 작가가 되어주세요!</h2>

      <div className="upload-page-divider" />

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
          placeholder="이름"
        />
      </div>

      <div className="upload-form-group">
        <label>연락처 <span>(선택사항)</span>
	</label>
        <input
          value={uploaderPhone}
          onChange={(e) => setUploaderPhone(e.target.value)}
          placeholder="01012345678"
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
        />
      </div>

      <div className="upload-form-group">
        <label>사진 선택</label>

        <div
          className={`upload-dropzone ${isDragging ? "dragging" : ""}`}
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
          }}
          onDrop={handleDrop}
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
          <p>• 한 번에 최대 100개까지 업로드하실 수 있습니다</p>
          <p>• 업로드 가능한 파일 크기는 개당 500MB 이하입니다</p>
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
                      <img src={item.previewUrl} alt={item.file.name} />
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
      >
        <Search size={18} />
        <span>내가 공유한 사진 보러가기</span>
      </button>

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

  const goBackUpload = () => {
    window.location.hash = "upload";
  };

  const goBackInvitation = () => {
    window.location.hash = "";
  };

  const loadMyUploads = async () => {
    if (!hasSupabaseConfig) {
      alert("Supabase 연결 정보가 아직 설정되지 않았습니다.");
      return;
    }

    const trimmedPhone = lookupPhone.trim();
    const trimmedName = lookupName.trim();
    const trimmedPassword = lookupPassword.trim();

    if (!trimmedPhone) {
      alert("연락처를 입력해주세요.");
      return;
    }

    if (!trimmedName) {
      alert("이름을 입력해주세요.");
      return;
    }

    let passwordToUse = trimmedPassword;

    if (!passwordToUse) {
      passwordToUse = getFallbackPassword(trimmedPhone);
    }

    if (!passwordToUse) {
      alert("비밀번호를 입력하거나 연락처 뒷자리 4자리를 확인해주세요.");
      return;
    }

    setLoadingMyUploads(true);
    setSearched(true);

    try {
      const passwordHash = await createPasswordHash(passwordToUse);

      const { data, error } = await supabase.rpc("get_my_uploaded_photos", {
        p_phone: trimmedPhone,
        p_name: trimmedName,
        p_password_hash: passwordHash,
      });

      if (error) {
        console.error("내 업로드 조회 실패:", error);
        alert("내가 공유한 사진을 불러오지 못했습니다.");
        setLoadingMyUploads(false);
        return;
      }

      setMyUploads((data || []) as MyUploadItem[]);
    } finally {
      setLoadingMyUploads(false);
    }
  };

  return (
    <section className="section my-photos-page-section">
      <button className="upload-back-button" onClick={goBackUpload}>
        <ChevronLeft size={18} />
        <span>사진 업로드로 돌아가기</span>
      </button>

      <div className="upload-page-emoji">🖼️</div>

      <h2 className="upload-page-title">내가 공유한 사진</h2>

      <div className="upload-page-divider" />

      <p className="upload-page-main-text">
        업로드할 때 입력한 연락처와 이름으로
        <br />
        내가 공유한 사진을 다시 확인할 수 있습니다.
        <br />
        비밀번호를 설정하지 않았다면 연락처 뒷자리 4자리를 입력해주세요.
      </p>

      <div className="upload-form-group">
        <label>연락처</label>
        <input
          value={lookupPhone}
          onChange={(e) => setLookupPhone(e.target.value)}
          placeholder="01012345678"
        />
      </div>

      <div className="upload-form-group">
        <label>이름</label>
        <input
          value={lookupName}
          onChange={(e) => setLookupName(e.target.value)}
          placeholder="홍길동"
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
        <div className="my-photos-result-section">
          <p className="upload-preview-count">
            내가 공유한 파일 {myUploads.length}개
          </p>

          <div className="my-photos-grid">
            {myUploads.map((item) => (
              <a
                className="my-photo-card"
                key={item.id}
                href={item.photo_url}
                target="_blank"
                rel="noreferrer"
              >
                <div className="my-photo-thumb">
                  {item.media_type === "video" ? (
                    <video src={item.photo_url} muted playsInline preload="metadata" />
                  ) : (
                    <img src={item.photo_url} alt={item.original_name || "업로드 사진"} />
                  )}
                </div>

                <div className="my-photo-meta">
                  <strong>{item.original_name || "파일"}</strong>
                  <span>{formatCreatedAt(item.created_at)}</span>
                </div>
              </a>
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

      <div className="upload-bottom-message">
        소중한 순간을 함께해 주셔서 감사합니다
      </div>
    </section>
  );
}