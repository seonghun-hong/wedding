import { useState } from "react";
import { Camera } from "lucide-react";
import { hasSupabase, supabase } from "../lib/supabase";

export function PhotoUploadSection() {
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    if (!hasSupabase || !supabase) {
      alert("사진 업로드는 Supabase 연결 후 사용할 수 있습니다. 먼저 .env를 설정해주세요.");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `wedding/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("wedding-photos").upload(path, file);

    if (uploadError) {
      setUploading(false);
      alert("사진 업로드에 실패했습니다.");
      return;
    }

    const { data } = supabase.storage.from("wedding-photos").getPublicUrl(path);

    await supabase.from("uploaded_photos").insert({
      photo_url: data.publicUrl,
      storage_path: path,
    });

    setUploading(false);
    alert("사진이 업로드되었습니다.");
  };

  return (
    <section className="section upload-section">
      <div className="camera-circle"><Camera size={34} /></div>
      <h2>소중한 순간을 공유해주세요</h2>
      <p>결혼식 현장에서 찍은 사진들을<br />신랑신부와 함께 나눠보세요</p>

      <label className="primary-button upload-label">
        <Camera size={18} />
        {uploading ? "업로드 중..." : "사진 업로드하기"}
        <input
          type="file"
          accept="image/*"
          hidden
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.currentTarget.value = "";
          }}
        />
      </label>
    </section>
  );
}
