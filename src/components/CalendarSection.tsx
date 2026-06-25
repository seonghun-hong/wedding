import { useEffect, useMemo, useState } from "react";
import { invitation } from "../data/invitation";
import { asset } from "../lib/path";

function getRemain() {
  const target = new Date(invitation.wedding.date).getTime();
  const now = Date.now();
  const diff = Math.max(target - now, 0);

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    min: Math.floor((diff / (1000 * 60)) % 60),
    sec: Math.floor((diff / 1000) % 60),
  };
}

function getCalendarDays(year: number, month: number) {
  const first = new Date(year, month - 1, 1).getDay();
  const lastDate = new Date(year, month, 0).getDate();

  return [
    ...Array.from({ length: first }, () => null),
    ...Array.from({ length: lastDate }, (_, i) => i + 1),
  ];
}

export function CalendarSection() {
  const [remain, setRemain] = useState(getRemain());

  const days = useMemo(
    () => getCalendarDays(invitation.wedding.year, invitation.wedding.month),
    []
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRemain(getRemain());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section className="section calendar-section" id="calendar">
      <div className="calendar-heading">
        <p className="calendar-script">Calendar</p>
        <h2 className="calendar-title">캘린더</h2>
      </div>

      <div className="calendar-card">
        <img
          src={asset("/images/calendar.jpg")}
          alt="달력 배경"
          className="calendar-bg"
        />

        <div className="calendar-overlay" />

        <div className="calendar-inner">
          <h3>
            {invitation.wedding.year}년 {invitation.wedding.month}월
          </h3>

          <div className="week-row">
            {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="date-grid">
            {days.map((day, index) => (
              <span
                key={`${day ?? "empty"}-${index}`}
                className={day === invitation.wedding.day ? "target-day" : ""}
              >
                {day ?? ""}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="countdown" aria-label="결혼식까지 남은 시간">
        <CountItem label="DAYS" value={remain.days} type="days" />
        <span className="colon">:</span>
        <CountItem label="HOUR" value={remain.hours} />
        <span className="colon">:</span>
        <CountItem label="MIN" value={remain.min} />
        <span className="colon">:</span>
        <CountItem label="SEC" value={remain.sec} />
      </div>

      <p className="dday">
        {invitation.groom.name}, {invitation.bride.name}의 결혼식이{" "}
        <b>{remain.days}일</b> 남았습니다.
      </p>
    </section>
  );
}

function CountItem({
  label,
  value,
  type,
}: {
  label: string;
  value: number;
  type?: "days";
}) {
  const displayValue =
    type === "days" ? String(value) : String(value).padStart(2, "0");

  return (
    <div className="count-item">
      <p>{label}</p>
      <strong className={type === "days" ? "count-value days" : "count-value"}>
        {displayValue}
      </strong>
    </div>
  );
}
