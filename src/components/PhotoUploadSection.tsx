import { useState } from "react";
import { Camera } from "lucide-react";
import { supabase, hasSupabaseConfig } from "../lib/supabase";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_FILE_COUNT = 10;

type UploadStatus = "waiting" | "uploading" | "success" | "error";

type UploadFileItem = {
  file: File;
  status: UploadStatus;
  errorMessage?: string;
};

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

function formatFileSize(size: number) {
  const mb = size / 1024 / 1024;
  return `${mb.toFixed(1)}MB`;
}

function getPhoneLast4(phone: string) {
  const onlyNumbers = phone.replace(/\D/g, "");

  if (!onlyNumbers) {
    return "no_phone";
  }

  return onlyNumbers.slice(-4);
}

/**
 * Supabase Storage 경로에는 한글을 넣지 않는 게 안전함.
 * 그래서 폴더명은 user_5721 같은 형태로 저장.
 * 실제 이름과 전체 전화번호는 uploaded_photos 테이블에 저장.
 */
function getUploaderFolderName(phone: string) {
  const phoneLast4 = getPhoneLast4(phone);
  return `user_${phoneLast4}`;
}

export function PhotoUploadSection() {
  const [uploaderName, setUploaderName] = useState("");
  const [uploaderPhone, setUploaderPhone] = useState("");
  const [files, setFiles] = useState<UploadFileItem[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleSelectFiles = (selectedFiles: FileList | null) => {
    if (!selectedFiles) {
      return;
    }

    const nextFiles = Array.from(selectedFiles);

    if (nextFiles.length > MAX_FILE_COUNT) {
      alert(`한 번에 최대 ${MAX_FILE_COUNT}개까지 업로드할 수 있습니다.`);
      return;
    }

    const invalidFile = nextFiles.find((file) => !isAllowedFile(file));

    if (invalidFile) {
      alert("사진 또는 동영상 파일만 업로드할 수 있습니다.");
      return;
    }

    const oversizedFile = nextFiles.find((file) => file.size > MAX_FILE_SIZE);

    if (oversizedFile) {
      alert(`파일 1개당 ${formatFileSize(MAX_FILE_SIZE)} 이하만 업로드할 수 있습니다.`);
      return;
    }

    setFiles(
      nextFiles.map((file) => ({
        file,
        status: "waiting",
      }))
    );
  };

  const uploadOneFile = async (item: UploadFileItem) => {
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
    const trimmedName = uploaderName.trim();

    if (!hasSupabaseConfig) {
      alert("Supabase 연결 정보가 아직 설정되지 않았습니다.");
      return;
    }

    if (!trimmedName) {
      alert("이름을 입력해주세요.");
      return;
    }

    if (files.length === 0) {
      alert("업로드할 사진 또는 동영상을 선택해주세요.");
      return;
    }

    setUploading(true);

    let successCount = 0;
    let failCount = 0;

    for (let index = 0; index < files.length; index += 1) {
      setFiles((prev) =>
        prev.map((item, itemIndex) =>
          itemIndex === index
            ? { ...item, status: "uploading", errorMessage: undefined }
            : item
        )
      );

      try {
        await uploadOneFile(files[index]);

        successCount += 1;

        setFiles((prev) =>
          prev.map((item, itemIndex) =>
            itemIndex === index ? { ...item, status: "success" } : item
          )
        );
      } catch (error) {
        console.error("파일 업로드 실패:", error);

        failCount += 1;

        setFiles((prev) =>
          prev.map((item, itemIndex) =>
            itemIndex === index
              ? {
                  ...item,
                  status: "error",
                  errorMessage: "업로드 실패",
                }
              : item
          )
        );
      }
    }

    setUploading(false);

    if (failCount === 0) {
      alert(`${successCount}개 파일이 업로드되었습니다. 소중한 사진과 영상 감사합니다.`);

      setUploaderName("");
      setUploaderPhone("");
      setFiles([]);

      const fileInput = document.getElementById("wedding-media-input") as HTMLInputElement | null;

      if (fileInput) {
        fileInput.value = "";
      }

      return;
    }

    alert(`${successCount}개 성공, ${failCount}개 실패했습니다.`);
  };

  return (
    <section className="section upload-section">
      <div className="camera-circle">
        <Camera size={34} />
      </div>

      <h2>소중한 순간을 공유해주세요</h2>

      <p>
        결혼식 현장에서 찍은 사진과 영상을<br />
        신랑신부와 함께 나눠주세요.
      </p>

      <div className="photo-upload-form">
        <input
          value={uploaderName}
          maxLength={20}
          onChange={(e) => setUploaderName(e.target.value)}
          placeholder="이름"
        />

        <input
          value={uploaderPhone}
          maxLength={20}
          onChange={(e) => setUploaderPhone(e.target.value)}
          placeholder="연락처 선택 입력"
        />

        <label className="photo-file-label" htmlFor="wedding-media-input">
          사진 / 동영상 선택하기
        </label>

        <input
          id="wedding-media-input"
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          disabled={uploading}
          onChange={(e) => handleSelectFiles(e.target.files)}
        />

        {files.length > 0 && (
          <div className="selected-file-list">
            {files.map((item, index) => {
              const mediaType = getMediaType(item.file);

              return (
                <div className="selected-file-item" key={`${item.file.name}-${index}`}>
                  <div>
                    <strong>{item.file.name}</strong>
                    <span>
                      {mediaType === "video" ? "동영상" : "사진"} ·{" "}
                      {formatFileSize(item.file.size)}
                    </span>
                  </div>

                  <em className={`upload-status ${item.status}`}>
                    {item.status === "waiting" && "대기"}
                    {item.status === "uploading" && "업로드 중"}
                    {item.status === "success" && "완료"}
                    {item.status === "error" && "실패"}
                  </em>
                </div>
              );
            })}
          </div>
        )}

        {!hasSupabaseConfig && (
          <p className="guestbook-warning">
            Supabase 연결 전이라 사진/동영상 업로드는 아직 동작하지 않습니다.
          </p>
        )}

        <button
          className="primary-button upload-submit-button"
          onClick={uploadFiles}
          disabled={uploading}
        >
          {uploading ? "업로드 중..." : "업로드하기"}
        </button>
      </div>
    </section>
  );
}
