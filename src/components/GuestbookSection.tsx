import { useEffect, useState } from "react";
import { hasSupabase, supabase } from "../lib/supabase";

type GuestMessage = {
  id: string;
  name: string;
  message: string;
  created_at: string;
};

const sampleMessages: GuestMessage[] = [
  { id: "1", name: "진수", message: "정말 축하드립니다! 두 분의 앞날에 행복만 가득하길 바라요. 오늘 정말 아름다운 결혼식이었어요.", created_at: "" },
  { id: "2", name: "유진", message: "스위리 평생 행복해야해💕", created_at: "" },
  { id: "3", name: "이예진", message: "영지 정장님 결혼축하드려요🥹💕", created_at: "" },
  { id: "4", name: "민수", message: "결혼 축하드려요! 평생 행복하세요!", created_at: "" },
];

export function GuestbookSection() {
  const [messages, setMessages] = useState<GuestMessage[]>(sampleMessages);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadMessages = async () => {
    if (!hasSupabase || !supabase) return;

    const { data, error } = await supabase
      .from("comments")
      .select("id,name,message,created_at")
      .eq("visible", true)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) setMessages(data);
  };

  const submit = async () => {
    if (!name.trim() || !message.trim()) {
      alert("이름과 축하 메시지를 입력해주세요.");
      return;
    }

    if (!hasSupabase || !supabase) {
      const newMessage = {
        id: crypto.randomUUID(),
        name: name.trim(),
        message: message.trim(),
        created_at: new Date().toISOString(),
      };
      setMessages([newMessage, ...messages]);
      setName("");
      setMessage("");
      alert("현재는 Supabase 미연결 상태라 화면에만 임시 추가됩니다.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("comments").insert({
      name: name.trim(),
      message: message.trim(),
    });
    setLoading(false);

    if (error) {
      alert("메시지 저장 중 오류가 발생했습니다.");
      return;
    }

    setName("");
    setMessage("");
    await loadMessages();
  };

  useEffect(() => {
    loadMessages();
  }, []);

  return (
    <section className="section guestbook-section">
      <h2 className="korean-title">축하 메시지</h2>

      <div className="guest-form">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" />
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="축하 메시지를 남겨주세요." />
        <button className="primary-button" type="button" onClick={submit} disabled={loading}>
          {loading ? "등록 중..." : "등록하기"}
        </button>
      </div>

      <div className="message-list">
        {messages.map((item) => (
          <article className="message-card" key={item.id}>
            <b>{item.name}</b>
            <p>{item.message}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
