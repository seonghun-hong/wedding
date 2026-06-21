import { useEffect, useMemo, useState } from "react";
import { supabase, hasSupabaseConfig } from "../lib/supabase";

type Comment = {
  id: string;
  name: string;
  message: string;
  created_at: string;
};

type PageItem = number | "...";

const PAGE_SIZE = 5;
const MESSAGE_PREVIEW_LENGTH = 70;

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

function getPaginationItems(currentPage: number, totalPages: number): PageItem[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, "...", totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
}

function getPreviewMessage(message: string) {
  if (message.length <= MESSAGE_PREVIEW_LENGTH) {
    return message;
  }

  return `${message.slice(0, MESSAGE_PREVIEW_LENGTH)}...`;
}

export function GuestbookSection() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  }, [totalCount]);

  const paginationItems = useMemo(() => {
    return getPaginationItems(page, totalPages);
  }, [page, totalPages]);

  const loadComments = async (targetPage = page) => {
    if (!hasSupabaseConfig) {
      return;
    }

    setListLoading(true);

    const from = (targetPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await supabase
      .from("comments")
      .select("id, name, message, created_at", { count: "exact" })
      .eq("visible", true)
      .order("created_at", { ascending: false })
      .range(from, to);

    setListLoading(false);

    if (error) {
      console.error("방명록 불러오기 실패:", error);
      return;
    }

    setComments(data || []);
    setTotalCount(count || 0);
    setExpandedIds([]);
  };

  const submit = async () => {
    const trimmedName = name.trim();
    const trimmedMessage = message.trim();
    const trimmedPassword = password.trim();

    if (!trimmedName) {
      alert("이름을 입력해주세요.");
      return;
    }

    if (!trimmedMessage) {
      alert("축하 메시지를 입력해주세요.");
      return;
    }

    if (!trimmedPassword) {
      alert("삭제할 때 사용할 비밀번호를 입력해주세요.");
      return;
    }

    if (trimmedPassword.length < 4) {
      alert("비밀번호는 4자리 이상 입력해주세요.");
      return;
    }

    if (!hasSupabaseConfig) {
      alert("Supabase 연결 정보가 아직 설정되지 않았습니다.");
      return;
    }

    setLoading(true);

    const passwordHash = await createPasswordHash(trimmedPassword);

    const { error } = await supabase.from("comments").insert({
      name: trimmedName,
      message: trimmedMessage,
      password_hash: passwordHash,
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
    setPassword("");

    setPage(1);
    await loadComments(1);

    alert("축하 메시지가 등록되었습니다.");
  };

  const removeComment = async (commentId: string) => {
    const inputPassword = window.prompt("댓글 작성 시 입력한 비밀번호를 입력해주세요.");

    if (!inputPassword) {
      return;
    }

    if (!hasSupabaseConfig) {
      alert("Supabase 연결 정보가 아직 설정되지 않았습니다.");
      return;
    }

    const passwordHash = await createPasswordHash(inputPassword.trim());

    const { data, error } = await supabase.rpc("hide_comment_by_password", {
      p_id: commentId,
      p_password_hash: passwordHash,
    });

    if (error) {
      console.error("댓글 삭제 실패:", error);
      alert("댓글 삭제 중 오류가 발생했습니다.");
      return;
    }

    if (!data) {
      alert("비밀번호가 일치하지 않습니다.");
      return;
    }

    const nextTotalCount = Math.max(totalCount - 1, 0);
    const nextTotalPages = Math.max(1, Math.ceil(nextTotalCount / PAGE_SIZE));
    const nextPage = Math.min(page, nextTotalPages);

    setPage(nextPage);
    await loadComments(nextPage);

    alert("댓글이 삭제되었습니다.");
  };

  const movePage = async (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) {
      return;
    }

    setPage(nextPage);
    await loadComments(nextPage);
  };

  const toggleExpand = (commentId: string) => {
    setExpandedIds((prev) => {
      if (prev.includes(commentId)) {
        return prev.filter((id) => id !== commentId);
      }

      return [...prev, commentId];
    });
  };

  useEffect(() => {
    loadComments(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="section guestbook">
      <h2 className="korean-title">축하 메시지</h2>

      <p className="guestbook-desc">
        신랑 신부에게 따뜻한 축하 메시지를 남겨주세요.
      </p>

      <div className="message-form">
        <div className="guestbook-input-row">
          <input
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
          />

          <input
            value={password}
            maxLength={20}
            type="password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
          />
        </div>

        <textarea
          value={message}
          maxLength={300}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="축하 메시지를 남겨주세요."
        />

        <p className="password-guide">
          비밀번호는 나중에 본인 댓글을 삭제할 때만 사용됩니다.
        </p>

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
        {listLoading ? (
          <p className="empty-message">메시지를 불러오는 중입니다.</p>
        ) : comments.length === 0 ? (
          <p className="empty-message">아직 등록된 메시지가 없습니다.</p>
        ) : (
          comments.map((comment) => {
            const isLongMessage = comment.message.length > MESSAGE_PREVIEW_LENGTH;
            const isExpanded = expandedIds.includes(comment.id);
            const displayMessage = isExpanded
              ? comment.message
              : getPreviewMessage(comment.message);

            return (
              <div className="message-card" key={comment.id}>
                <div className="message-card-header">
                  <div>
                    <b>{comment.name}</b>
                    <span className="message-time">
                      {formatCreatedAt(comment.created_at)}
                    </span>
                  </div>

                  <button
                    className="message-delete-button"
                    onClick={() => removeComment(comment.id)}
                  >
                    삭제
                  </button>
                </div>

                <p className="message-text">{displayMessage}</p>

                {isLongMessage && (
                  <button
                    className="message-more-button"
                    onClick={() => toggleExpand(comment.id)}
                  >
                    {isExpanded ? "접기" : "더보기"}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {totalCount > PAGE_SIZE && (
        <div className="pagination">
          <button
            className="pagination-arrow"
            onClick={() => movePage(page - 1)}
            disabled={page === 1}
          >
            이전
          </button>

          <div className="pagination-numbers">
            {paginationItems.map((item, index) =>
              item === "..." ? (
                <span className="pagination-ellipsis" key={`ellipsis-${index}`}>
                  ...
                </span>
              ) : (
                <button
                  key={item}
                  className={item === page ? "active" : ""}
                  onClick={() => movePage(item)}
                >
                  {item}
                </button>
              )
            )}
          </div>

          <button
            className="pagination-arrow"
            onClick={() => movePage(page + 1)}
            disabled={page === totalPages}
          >
            다음
          </button>
        </div>
      )}
    </section>
  );
}
