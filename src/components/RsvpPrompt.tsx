import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { hasSupabaseConfig, supabase } from "../lib/supabase";

type AttendanceStatus = "attending" | "declined";
type GuestSide = "groom" | "bride" | "";
type MealOption = "yes" | "no" | "undecided";
type ShuttleOption = "yes" | "no";
type BoardingPlace = "daejeon" | "sejong" | "";

const RSVP_STORAGE_KEY = "wedding_rsvp_response";
const RSVP_DISMISS_KEY = "wedding_rsvp_dismissed_in_session";

type RsvpResponse = {
  response_token?: string;
  name: string;
  side: GuestSide | null;
  attendance_status: AttendanceStatus;
  guest_count: number;
  meal: MealOption | "no";
  shuttle_bus: ShuttleOption;
  boarding_place: string | null;
  created_at: string;
};

function createResponseToken() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getStoredResponse(): RsvpResponse | null {
  try {
    const value = localStorage.getItem(RSVP_STORAGE_KEY);
    return value ? (JSON.parse(value) as RsvpResponse) : null;
  } catch {
    return null;
  }
}

function getBoardingPlaceValue(place: string | null): BoardingPlace {
  if (place === "대전") return "daejeon";
  if (place === "세종") return "sejong";
  return "";
}

function getBoardingPlaceLabel(place: BoardingPlace) {
  if (place === "daejeon") {
    return "대전";
  }

  if (place === "sejong") {
    return "세종";
  }

  return "";
}

function getSideLabel(side: GuestSide | null) {
  if (side === "groom") {
    return "신랑측";
  }

  if (side === "bride") {
    return "신부측";
  }

  return "미선택";
}

function getMealLabel(meal: RsvpResponse["meal"]) {
  if (meal === "yes") {
    return "식사";
  }

  if (meal === "no") {
    return "식사 안 함";
  }

  return "식사 미정";
}

export function RsvpPrompt() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<AttendanceStatus | null>(null);
  const [name, setName] = useState("");
  const [side, setSide] = useState<GuestSide>("");
  const [guestCount, setGuestCount] = useState(1);
  const [meal, setMeal] = useState<MealOption>("undecided");
  const [shuttle, setShuttle] = useState<ShuttleOption>("no");
  const [boardingPlace, setBoardingPlace] = useState<BoardingPlace>("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [complete, setComplete] = useState(false);
  const [submittedResponse, setSubmittedResponse] = useState<RsvpResponse | null>(
    null
  );

  const fillForm = (response: RsvpResponse) => {
    setStatus(response.attendance_status);
    setName(response.name);
    setSide(response.side || "");
    setGuestCount(Math.max(1, response.guest_count || 1));
    setMeal(response.meal || "undecided");
    setShuttle(response.shuttle_bus || "no");
    setBoardingPlace(getBoardingPlaceValue(response.boarding_place));
    setSubmittedResponse(response);
  };

  useEffect(() => {
    const storedResponse = getStoredResponse();

    if (storedResponse) fillForm(storedResponse);

    const openRsvp = () => {
      const latestResponse = getStoredResponse();
      if (latestResponse) fillForm(latestResponse);
      setSaveError("");
      setComplete(false);
      setOpen(true);
    };

    window.addEventListener("wedding:open-rsvp", openRsvp);

    if (storedResponse || sessionStorage.getItem(RSVP_DISMISS_KEY)) {
      return () => window.removeEventListener("wedding:open-rsvp", openRsvp);
    }

    const introSection = document.querySelector(".intro-section");

    if (!introSection) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setOpen(true);
          observer.disconnect();
        }
      },
      {
        root: null,
        rootMargin: "-18% 0px -42% 0px",
        threshold: 0.2,
      }
    );

    observer.observe(introSection);

    return () => {
      observer.disconnect();
      window.removeEventListener("wedding:open-rsvp", openRsvp);
    };
  }, []);

  const closeForNow = () => {
    sessionStorage.setItem(RSVP_DISMISS_KEY, "1");
    setOpen(false);
  };

  const handleStatusChange = (nextStatus: AttendanceStatus) => {
    setStatus(nextStatus);

    if (nextStatus === "declined") {
      setShuttle("no");
      setBoardingPlace("");
      setMeal("no");
    }
  };

  const submit = async () => {
    if (!status || !name.trim()) {
      return;
    }

    const boardingPlaceText =
      status === "attending" && shuttle === "yes"
        ? getBoardingPlaceLabel(boardingPlace)
        : "";

    const previousResponse = getStoredResponse();
    const responseToken =
      previousResponse?.response_token || createResponseToken();
    const response: RsvpResponse = {
      response_token: responseToken,
      name: name.trim(),
      side: side || null,
      attendance_status: status,
      guest_count: status === "attending" ? guestCount : 0,
      meal: status === "attending" ? meal : "no",
      shuttle_bus: status === "attending" ? shuttle : "no",
      boarding_place: boardingPlaceText || null,
      created_at: new Date().toISOString(),
    };

    setSaving(true);
    setSaveError("");

    if (hasSupabaseConfig) {
      const { error } = await supabase.rpc("save_rsvp_response", {
        p_response_token: responseToken,
        p_name: response.name,
        p_side: response.side,
        p_attendance_status: response.attendance_status,
        p_guest_count: response.guest_count,
        p_meal: response.meal,
        p_shuttle_bus: response.shuttle_bus,
        p_boarding_place: response.boarding_place,
      });

      if (error) {
        console.warn("RSVP 저장 실패:", error);
        setSaving(false);
        setSaveError("답변을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
    }

    localStorage.setItem(RSVP_STORAGE_KEY, JSON.stringify(response));
    setSubmittedResponse(response);
    setSaving(false);
    setComplete(true);
  };

  const needsBoardingPlace =
    status === "attending" && shuttle === "yes" && !boardingPlace;

  const submitDisabled =
    !status || !name.trim() || needsBoardingPlace || saving;

  if (!open) {
    return null;
  }

  return (
    <div className="rsvp-prompt-overlay" role="dialog" aria-modal="true">
      <div className="rsvp-prompt-sheet">
        <button
          className="rsvp-close"
          type="button"
          onClick={closeForNow}
          aria-label="참석 여부 팝업 닫기"
        >
          <X size={18} />
        </button>

        {complete ? (
          <div className="rsvp-complete">
            <p className="rsvp-script">Thank you</p>
            <h2>소중한 답변 감사합니다</h2>
            <p>전해주신 마음까지 잘 준비하겠습니다.</p>

            {submittedResponse && (
              <div className="rsvp-summary">
                <dl>
                  <div>
                    <dt>성함</dt>
                    <dd>{submittedResponse.name}</dd>
                  </div>
                  <div>
                    <dt>구분</dt>
                    <dd>{getSideLabel(submittedResponse.side)}</dd>
                  </div>
                  <div>
                    <dt>참석</dt>
                    <dd>
                      {submittedResponse.attendance_status === "attending"
                        ? `${submittedResponse.guest_count}명 참석`
                        : "참석 어려움"}
                    </dd>
                  </div>
                  {submittedResponse.attendance_status === "attending" && (
                    <>
                      <div>
                        <dt>식사</dt>
                        <dd>{getMealLabel(submittedResponse.meal)}</dd>
                      </div>
                      <div>
                        <dt>대절버스</dt>
                        <dd>
                          {submittedResponse.shuttle_bus === "yes"
                            ? `${submittedResponse.boarding_place} 탑승`
                            : "이용 안 함"}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
              </div>
            )}

            <button className="rsvp-done-button" type="button" onClick={() => setOpen(false)}>
              확인
            </button>
            <button
              className="rsvp-edit-button"
              type="button"
              onClick={() => {
                setComplete(false);
                setSaveError("");
              }}
            >
              답변 수정하기
            </button>
          </div>
        ) : (
          <>
            <div className="rsvp-heading">
              <p className="rsvp-script">RSVP</p>
              <h2>참석 여부를 알려주세요</h2>
              <p>귀한 걸음 준비에 참고하겠습니다.</p>
            </div>

            <div className="rsvp-choice-row">
              <button
                className={status === "attending" ? "active" : ""}
                type="button"
                onClick={() => handleStatusChange("attending")}
              >
                참석할게요
              </button>
              <button
                className={status === "declined" ? "active" : ""}
                type="button"
                onClick={() => handleStatusChange("declined")}
              >
                참석이 어려워요
              </button>
            </div>

            {status && (
              <div className="rsvp-form">
                <input
                  value={name}
                  maxLength={20}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="성함"
                />

                <div className="rsvp-segmented">
                  <button
                    className={side === "groom" ? "active" : ""}
                    type="button"
                    onClick={() => setSide("groom")}
                  >
                    신랑측
                  </button>
                  <button
                    className={side === "bride" ? "active" : ""}
                    type="button"
                    onClick={() => setSide("bride")}
                  >
                    신부측
                  </button>
                </div>

                {status === "attending" && (
                  <>
                    <label className="rsvp-field-label">
                      참석 인원
                      <select
                        value={guestCount}
                        onChange={(event) =>
                          setGuestCount(Number(event.target.value))
                        }
                      >
                        {[1, 2, 3, 4, 5].map((count) => (
                          <option value={count} key={count}>
                            {count}명
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="rsvp-meal-group">
                      <span>식사 여부</span>
                      <div className="rsvp-segmented">
                        <button
                          className={meal === "yes" ? "active" : ""}
                          type="button"
                          onClick={() => setMeal("yes")}
                        >
                          식사해요
                        </button>
                        <button
                          className={meal === "no" ? "active" : ""}
                          type="button"
                          onClick={() => setMeal("no")}
                        >
                          안 해요
                        </button>
                        <button
                          className={meal === "undecided" ? "active" : ""}
                          type="button"
                          onClick={() => setMeal("undecided")}
                        >
                          미정
                        </button>
                      </div>
                    </div>

                    <div className="rsvp-meal-group">
                      <span>대절버스 탑승 여부</span>
                      <div className="rsvp-segmented">
                        <button
                          className={shuttle === "yes" ? "active" : ""}
                          type="button"
                          onClick={() => setShuttle("yes")}
                        >
                          탑승해요
                        </button>
                        <button
                          className={shuttle === "no" ? "active" : ""}
                          type="button"
                          onClick={() => {
                            setShuttle("no");
                            setBoardingPlace("");
                          }}
                        >
                          이용 안 해요
                        </button>
                      </div>
                    </div>

                    {shuttle === "yes" && (
                      <div className="rsvp-meal-group">
                        <span>탑승 장소</span>
                        <div className="rsvp-segmented boarding-place">
                          <button
                            className={boardingPlace === "daejeon" ? "active" : ""}
                            type="button"
                            onClick={() => setBoardingPlace("daejeon")}
                          >
                            대전
                          </button>
                          <button
                            className={boardingPlace === "sejong" ? "active" : ""}
                            type="button"
                            onClick={() => setBoardingPlace("sejong")}
                          >
                            세종
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="rsvp-actions">
              <button
                className="submit"
                type="button"
                onClick={submit}
                disabled={submitDisabled}
              >
                {saving ? "저장 중..." : "답변 남기기"}
              </button>
            </div>
            {saveError && <p className="rsvp-save-error">{saveError}</p>}
          </>
        )}
      </div>
    </div>
  );
}
