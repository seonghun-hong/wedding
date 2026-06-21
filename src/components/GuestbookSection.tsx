import { useEffect, useState } from "react";
import { supabase, hasSupabaseConfig } from "../lib/supabase";

type Comment = {
  id: string;
  name: string;
  message: string;
  created_at: string;
};

export function GuestbookSection() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadComments = async () => {
    if (!hasSupabaseConfig) {
      return;
    }

    const { data, error } = await supabase
      .from("comments")
      .select("id, name, message, created_at")
      .eq("visible", true)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      console.error("방명록 불러오기 실패:", error);
      return;
    }

    setComments(data || []);
  };

  const submit = async () => {
    const trimmedName = name.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName) {
      alert("이름을 입력해주세요.");
      return;
    }

    if (!trimmedMessage) {
      alert("축하 메시지를 입력해주세요.");
      return;
    }

    if (!hasSupabaseConfig) {
      alert("Supabase 연결 정보가 아직 설정되지 않았습니다.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("comments").insert({
      name: trimmedName,
      message: trimmedMessage,
      visible: true,
    });

    setLoading(false);

    if (error) {
      console.error("방명록 저장 실패:", error);
      alert("메시지 저장 중 오류가 발생했습니다.");
      return;
    }

    setName("");
    setMessage("");
    await loadComments();
    alert("축하 메시지가 등록되었습니다.");
  };

  useEffect(() => {
    loadComments();
  }, []);

  return (
    <section className="section guestbook">
      <h2 className="korean-title">축하 메시지</h2>

      <p className="guestbook-desc">
        신랑 신부에게 따뜻한 축하 메시지를 남겨주세요.
      </p>

      <div className="message-form">
        <input
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름"
        />

        <textarea
          value={message}
          maxLength={300}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="축하 메시지를 남겨주세요."
        />

        <button className="primary-button" onClick={submit} disabled={loading}>
          {loading ? "등록 중..." : "등록하기"}
        </button>
      </div>

      {!hasSupabaseConfig && (
        <p className="guestbook-warning">
          Supabase 연결 전이라 방명록 저장은 아직 동작하지 않습니다.
        </p>
      )}

      <div className="message-list">
        {comments.length === 0 ? (
          <p className="empty-message">아직 등록된 메시지가 없습니다.</p>
        ) : (
          comments.map((comment) => (
            <div className="message-card" key={comment.id}>
              <b>{comment.name}</b>
              <p>{comment.message}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
