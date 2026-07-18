import { useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { hasSupabaseConfig, supabase } from "../lib/supabase";

type RsvpItem = {
  id?: string;
  name: string | null;
  side: "groom" | "bride" | null;
  attendance_status: "attending" | "declined";
  guest_count: number | null;
  meal: "yes" | "no" | "undecided" | null;
  shuttle_bus: "yes" | "no" | null;
  boarding_place: string | null;
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
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getSideLabel(side: RsvpItem["side"]) {
  if (side === "groom") {
    return "신랑측";
  }

  if (side === "bride") {
    return "신부측";
  }

  return "미선택";
}

function getMealLabel(meal: RsvpItem["meal"]) {
  if (meal === "yes") {
    return "식사";
  }

  if (meal === "no") {
    return "식사 안 함";
  }

  return "식사 미정";
}

export function AdminRsvpPage() {
  const [adminPassword, setAdminPassword] = useState("");
  const [items, setItems] = useState<RsvpItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1600);
  };

  const goBackAdmin = () => {
    window.location.hash = "admin";
  };

  const loadRsvps = async () => {
    if (!hasSupabaseConfig) {
      showToast("Supabase 연결 정보가 없습니다.");
      return;
    }

    if (!adminPassword.trim()) {
      showToast("관리자 비밀번호를 입력해주세요.");
      return;
    }

    setLoading(true);

    try {
      const passwordHash = await createPasswordHash(adminPassword.trim());
      const { data, error } = await supabase.rpc("get_rsvps_admin", {
        p_admin_password_hash: passwordHash,
      });

      if (error) {
        console.error("참석여부 조회 실패:", error);
        showToast("참석여부 응답을 불러오지 못했습니다.");
        return;
      }

      setItems((data || []) as RsvpItem[]);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const attending = items.filter(
      (item) => item.attendance_status === "attending"
    );
    const declined = items.filter(
      (item) => item.attendance_status === "declined"
    );
    const shuttleUsers = attending.filter((item) => item.shuttle_bus === "yes");

    return {
      totalResponses: items.length,
      attendingCount: attending.length,
      declinedCount: declined.length,
      totalGuests: attending.reduce(
        (sum, item) => sum + Number(item.guest_count || 0),
        0
      ),
      mealYes: attending
        .filter((item) => item.meal === "yes")
        .reduce((sum, item) => sum + Number(item.guest_count || 0), 0),
      shuttleCount: shuttleUsers.reduce(
        (sum, item) => sum + Number(item.guest_count || 0),
        0
      ),
      daejeonCount: shuttleUsers
        .filter((item) => item.boarding_place === "대전")
        .reduce((sum, item) => sum + Number(item.guest_count || 0), 0),
      sejongCount: shuttleUsers
        .filter((item) => item.boarding_place === "세종")
        .reduce((sum, item) => sum + Number(item.guest_count || 0), 0),
    };
  }, [items]);

  return (
    <section className="section admin-photos-page-section">
      <button className="upload-back-button" onClick={goBackAdmin}>
        <ChevronLeft size={18} />
        <span>사진 관리자 돌아가기</span>
      </button>

      <div className="upload-page-heading">
        <p className="upload-page-script">RSVP</p>
        <h2 className="upload-page-title">참석여부 관리자</h2>
      </div>

      <p className="upload-page-main-text">
        하객분들이 남긴 참석 여부와
        <br />
        식사 및 대절버스 인원을 확인합니다.
      </p>

      <div className="upload-form-group">
        <label>관리자 비밀번호</label>
        <input
          type="password"
          value={adminPassword}
          onChange={(event) => setAdminPassword(event.target.value)}
          placeholder="관리자 비밀번호"
        />
      </div>

      <button
        className="upload-submit-main-button"
        type="button"
        onClick={loadRsvps}
        disabled={loading}
      >
        {loading ? "불러오는 중..." : "참석여부 조회"}
      </button>

      {items.length > 0 && (
        <>
          <div className="admin-stats-grid rsvp-admin-stats">
            <div className="admin-stat-card">
              <span>응답</span>
              <strong>{stats.totalResponses}</strong>
            </div>
            <div className="admin-stat-card">
              <span>참석 인원</span>
              <strong>{stats.totalGuests}</strong>
            </div>
            <div className="admin-stat-card">
              <span>불참</span>
              <strong>{stats.declinedCount}</strong>
            </div>
            <div className="admin-stat-card">
              <span>식사</span>
              <strong>{stats.mealYes}</strong>
            </div>
            <div className="admin-stat-card">
              <span>대절버스</span>
              <strong>{stats.shuttleCount}</strong>
            </div>
            <div className="admin-stat-card">
              <span>대전 탑승</span>
              <strong>{stats.daejeonCount}</strong>
            </div>
            <div className="admin-stat-card">
              <span>세종 탑승</span>
              <strong>{stats.sejongCount}</strong>
            </div>
            <div className="admin-stat-card">
              <span>참석 응답</span>
              <strong>{stats.attendingCount}</strong>
            </div>
          </div>

          <div className="rsvp-admin-list">
            {items.map((item, index) => {
              const attending = item.attendance_status === "attending";

              return (
                <div className="rsvp-admin-card" key={item.id || index}>
                  <div className="rsvp-admin-card-head">
                    <strong>{item.name || "이름 없음"}</strong>
                    <em>{attending ? "참석" : "불참"}</em>
                  </div>

                  <dl>
                    <div>
                      <dt>구분</dt>
                      <dd>{getSideLabel(item.side)}</dd>
                    </div>
                    <div>
                      <dt>인원</dt>
                      <dd>{attending ? `${item.guest_count || 0}명` : "-"}</dd>
                    </div>
                    <div>
                      <dt>식사</dt>
                      <dd>{attending ? getMealLabel(item.meal) : "-"}</dd>
                    </div>
                    <div>
                      <dt>대절버스</dt>
                      <dd>
                        {attending && item.shuttle_bus === "yes"
                          ? `${item.boarding_place || "미선택"} 탑승`
                          : "이용 안 함"}
                      </dd>
                    </div>
                    <div>
                      <dt>응답 시간</dt>
                      <dd>{formatCreatedAt(item.created_at)}</dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>
        </>
      )}

      {loaded && items.length === 0 && (
        <p className="upload-lookup-empty">아직 등록된 참석여부 응답이 없습니다.</p>
      )}

      {toast && <div className="toast">{toast}</div>}
    </section>
  );
}
