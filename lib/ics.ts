/**
 * ICS calendar export.
 *
 * Generates a .ics file with the day's blocks as VEVENT entries,
 * so the user can import them into any calendar app for OS-level alarms.
 */


import { type CalendarDate, toISODate } from "./time";

type IcsBlock = {
  title: string;
  /** Minutes from midnight. */
  startMinute: number;
  durationMinutes: number;
  description?: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function minuteToHHMM(minute: number): string {
  const h = Math.floor(minute / 60) % 24;
  const m = minute % 60;
  return `${pad2(h)}${pad2(m)}00`;
}

function dateToIcs(date: CalendarDate): string {
  return `${date.year}${pad2(date.month)}${pad2(date.day)}`;
}

export function generateIcs(
  date: CalendarDate,
  blocks: IcsBlock[],
  timeZone: string,
): string {
  const icsDate = dateToIcs(date);

  const events = blocks.map((block, i) => {
    const start = minuteToHHMM(block.startMinute);
    const end = minuteToHHMM(block.startMinute + block.durationMinutes);
    const uid = `sadhana-${toISODate(date)}-${i}@sadhana.local`;

    return [
      "BEGIN:VEVENT",
      `DTSTART;TZID=${timeZone}:${icsDate}T${start}`,
      `DTEND;TZID=${timeZone}:${icsDate}T${end}`,
      `SUMMARY:${escapeIcs(block.title)}`,
      block.description ? `DESCRIPTION:${escapeIcs(block.description)}` : "",
      `UID:${uid}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT5M",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcs(block.title)} in 5 minutes`,
      "END:VALARM",
      "END:VEVENT",
    ]
      .filter(Boolean)
      .join("\r\n");
  });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sadhana//Dinacharya OS//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-TIMEZONE:${timeZone}`,
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}
