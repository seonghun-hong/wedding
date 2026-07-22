import { invitation } from "../data/invitation";

function toIcsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function downloadCalendar() {
  const start = new Date(invitation.wedding.date);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Wedding Invitation//KR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:wedding-${invitation.wedding.year}${String(invitation.wedding.month).padStart(2, "0")}${String(invitation.wedding.day).padStart(2, "0")}@seonghun-hong.github.io`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `SUMMARY:${escapeIcsText(`${invitation.groom.name} ♥ ${invitation.bride.name} 결혼식`)}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `LOCATION:${escapeIcsText(invitation.wedding.address)}`,
    `DESCRIPTION:${escapeIcsText(`${invitation.wedding.hallName} ${invitation.wedding.hallDetail}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "성훈-지연-결혼식.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
