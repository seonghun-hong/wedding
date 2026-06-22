import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { supabase, hasSupabaseConfig } from "../lib/supabase";

type GuestbookAdminItem = {
  id: string;
  name: string | null;
  message: string | null;
  visible: boolean;
  created_at: string;
};

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

export function AdminGuestbookPage() {
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPasswordHash, setAdminPasswordHash] = useState("");
  const [messages, setMessages] = useState<GuestbookAdminItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [includeHidden, setIncludeHidden] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState("");

  const visibleCount = messages.filter((item) => item.visible).length;
  const hiddenCount = messages.filter((item) => !item.visible).length;

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1600);
  };

  const goBackAdmin = () => {
    window.location.hash = "admin";
  };

  const loadMessages = async () => {
    if (!hasSupabaseConfig) {
      showToast("Supabase 연결 정보가 없습니다.");
      return;
    }

    const trimmedPassword = adminPassword.trim();

    if (!trimmedPassword && !adminPasswordHash) {
      showToast("관리자 비밀번호를 입력해주세요.");
      return;
    }

    setLoading(true);

    try {
      const passwordHash =
        adminPasswordHash || (await createPasswordHash(trimmedPassword));

      const { data, error } = await supabase.rpc(
        "get_guestbook_admin_messages",
        {
          p_admin_password_hash: passwordHash,
          p_include_hidden: includeHidden,
        }
      );

      if (error) {
        console.error("방명록 관리자 조회 실패:", error);
        showToast("방명록을 불러오지 못했습니다.");
        return;
      }

      setAdminPasswordHash(passwordHash);
      setMessages((data || []) as GuestbookAdminItem[]);
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(messages.map((item) => item.id)));
  };

  const clearSelected = () => {
    setSelectedIds(new Set());
  };

  const updateVisibility = async (visible: boolean) => {
    if (!adminPasswordHash) {
      showToast("관리자 조회를 먼저 해주세요.");
      return;
    }

    if (selectedIds.size === 0) {
      showToast("선택된 방명록이 없습니다.");
      return;
    }

    setUpdating(true);

    try {
      const { data, error } = await supabase.rpc(
        "update_guestbook_visibility",
        {
          p_admin_password_hash: adminPasswordHash,
          p_ids: Array.from(selectedIds),
          p_visible: visible,
        }
      );

      if (error) {
        console.error("방명록 상태 변경 실패:", error);
        showToast("상태를 변경하지 못했습니다.");
        return;
      }

      showToast(`${data || 0}개 처리되었습니다.`);
      await loadMessages();
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    if (!adminPasswordHash) {
      return;
    }

    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeHidden]);

  return (
    <section className="section admin-guestbook-page-section">
      <button className="upload-back-button" onClick={goBackAdmin}>
        <ChevronLeft size={18} />
        <span>사진 관리자 돌아가기</span>
      </button>

      <div className="upload-page-emoji">💌</div>

      <h2 className="upload-page-title">방명록 관리자</h2>

      <div className="upload-page-divider" />

      <p className="upload-page-main-text">
        하객들이 남긴 방명록을
        <br />
        확인하고 숨김 처리할 수 있습니다.
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
        onClick={loadMessages}
        disabled={loading}
      >
        {loading ? "불러오는 중..." : "방명록 조회"}
      </button>

      {messages.length > 0 && (
        <>
          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <span>전체</span>
              <strong>{messages.length}</strong>
            </div>

            <div className="admin-stat-card">
              <span>표시</span>
              <strong>{visibleCount}</strong>
            </div>

            <div className="admin-stat-card">
              <span>숨김</span>
              <strong>{hiddenCount}</strong>
            </div>

            <div className="admin-stat-card">
              <span>선택</span>
              <strong>{selectedIds.size}</strong>
            </div>
          </div>

          <div className="guestbook-admin-toolbar">
            <label className="guestbook-hidden-toggle">
              <input
                type="checkbox"
                checked={includeHidden}
                onChange={(e) => setIncludeHidden(e.target.checked)}
              />
              <span>숨김 포함 보기</span>
            </label>

            <div className="guestbook-admin-actions">
              <button type="button" onClick={selectAll}>
                전체 선택
              </button>

              <button type="button" onClick={clearSelected}>
                선택 해제
              </button>

              <button
                type="button"
                onClick={() => updateVisibility(false)}
                disabled={updating || selectedIds.size === 0}
              >
                선택 숨김
              </button>

              <button
                type="button"
                onClick={() => updateVisibility(true)}
                disabled={updating || selectedIds.size === 0}
              >
                선택 복구
              </button>
            </div>
          </div>

          <div className="guestbook-admin-list">
            {messages.map((item) => {
              const checked = selectedIds.has(item.id);

              return (
                <div
                  className={`guestbook-admin-card ${
                    !item.visible ? "hidden-item" : ""
                  } ${checked ? "selected" : ""}`}
                  key={item.id}
                >
                  <label className="guestbook-admin-check">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelected(item.id)}
                    />
                    <span />
                  </label>

                  <div className="guestbook-admin-content">
                    <div className="guestbook-admin-head">
                      <strong>{item.name || "이름 없음"}</strong>
                      <em>{item.visible ? "표시중" : "숨김"}</em>
                    </div>

                    <p>{item.message || ""}</p>

                    <small>{formatCreatedAt(item.created_at)}</small>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!loading && adminPasswordHash && messages.length === 0 && (
        <p className="upload-lookup-empty">
          조회된 방명록이 없습니다.
        </p>
      )}

      {toast && <div className="toast">{toast}</div>}

      <div className="upload-bottom-message">방명록 관리자 페이지입니다</div>
    </section>
  );
}