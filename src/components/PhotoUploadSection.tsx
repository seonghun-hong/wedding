import { useState } from "react";
import { Camera } from "lucide-react";
import { supabase, hasSupabaseConfig } from "../lib/supabase";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() || "jpg";
}

function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

export function PhotoUploadSection() {
  const [uploaderName, setUploaderName] = useState("");
  const [uploaderPhone, setUploaderPhone] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const uploadPhoto = async () => {
    const trimmedName = uploaderName.trim();
    const trimmedPhone = uploaderPhone.trim();

    if (!hasSupabaseConfig) {
      alert("Supabase 연결 정보가 아직 설정되지 않았습니다.");
      return;
    }

    if (!trimmedName) {
      alert("이름을 입력해주세요.");
      return;
    }

    if (!selectedFile) {
      alert("업로드할 사진을 선택해주세요.");
      return;
    }

    if (!isImageFile(selectedFile)) {
      alert("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      alert("사진 용량은 10MB 이하만 업로드할 수 있습니다.");
      return;
    }

    setUploading(true);

    const ext = getFileExtension(selectedFile.name);
    const safeFileName = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const storagePath = `guest/${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("wedding-photos")
      .upload(storagePath, selectedFile, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("사진 업로드 실패:", uploadError);
      alert("사진 업로드 중 오류가 발생했습니다.");
      setUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("wedding-photos")
      .getPublicUrl(storagePath);

    const { error: insertError } = await supabase.from("uploaded_photos").insert({
      uploader_name: trimmedName,
      uploader_phone: trimmedPhone || null,
      photo_url: publicUrlData.publicUrl,
      storage_path: storagePath,
      visible: true,
    });

    setUploading(false);

    if (insertError) {
      console.error("사진 정보 저장 실패:", insertError);
      alert("사진 정보 저장 중 오류가 발생했습니다.");
      return;
    }

    setUploaderName("");
    setUploaderPhone("");
    setSelectedFile(null);

    const fileInput = document.getElementById("wedding-photo-input") as HTMLInputElement | null;
    if (fileInput) {
      fileInput.value = "";
    }

    alert("사진이 업로드되었습니다. 소중한 사진 감사합니다.");
  };

  return (
    <section className="section upload-section">
      <div className="camera-circle">
        <Camera size={34} />
      </div>

      <h2>소중한 순간을 공유해주세요</h2>

      <p>
        결혼식 현장에서 찍은 사진들을<br />
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

        <label className="photo-file-label" htmlFor="wedding-photo-input">
          {selectedFile ? selectedFile.name : "사진 선택하기"}
        </label>

        <input
          id="wedding-photo-input"
          type="file"
          accept="image/*"
          hidden
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            setSelectedFile(file);
          }}
        />

        {selectedFile && (
          <p className="photo-selected-text">
            선택된 사진: {selectedFile.name}
          </p>
        )}

        {!hasSupabaseConfig && (
          <p className="guestbook-warning">
            Supabase 연결 전이라 사진 업로드는 아직 동작하지 않습니다.
          </p>
        )}

        <button
          className="primary-button upload-submit-button"
          onClick={uploadPhoto}
          disabled={uploading}
        >
          {uploading ? "업로드 중..." : "사진 업로드하기"}
        </button>
      </div>
    </section>
  );
}
