import { invitation } from "../data/invitation";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toIcsDate(date: Date) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  const second = pad(date.getSeconds());

  return `${year}${month}${day}T${hour}${minute}${second}`;
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function downloadCalendar() {
  const startDate = new Date(
    invitation.wedding.year,
    invitation.wedding.month - 1,
    invitation.wedding.day,
    invitation.wedding.hour,
    invitation.wedding.minute,
    0
  );

  const endDate = new Date(startDate);
  endDate.setHours(endDate.getHours() + 2);

  const title = `${invitation.groom.name} ♥ ${invitation.bride.name} 결혼식`;
  const location = `${invitation.wedding.venueName} ${invitation.wedding.hallName}`;
  const description = `${invitation.wedding.displayDate}\\n${invitation.wedding.address}`;

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Wedding Invitation//KR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:wedding-${invitation.wedding.year}${pad(invitation.wedding.month)}${pad(invitation.wedding.day)}@seonghun-hong.github.io`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(startDate)}`,
    `DTEND:${toIcsDate(endDate)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `LOCATION:${escapeIcsText(location)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([icsContent], {
    type: "text/calendar;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "wedding-calendar.ics";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
