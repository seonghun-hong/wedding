import { invitation } from "../data/invitation";

function toIcsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export function downloadCalendar() {
  const start = new Date(invitation.wedding.date);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Wedding Invitation//KR",
    "BEGIN:VEVENT",
    `SUMMARY:${invitation.groom.name} ♥ ${invitation.bride.name} 결혼식`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `LOCATION:${invitation.wedding.address}`,
    `DESCRIPTION:${invitation.wedding.hallName} ${invitation.wedding.hallDetail}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "wedding.ics";
  a.click();
  URL.revokeObjectURL(url);
}
