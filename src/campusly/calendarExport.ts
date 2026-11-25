export type ReminderPreferences = {
  classes: boolean;
  assignments: boolean;
  exams: boolean;
  tests: boolean;
  fees: boolean;
  leadMinutes: number;
  browserAlerts: boolean;
};

type CalendarEvent = {
  id?: string | number;
  title: string;
  date: string;
  time: string;
  durationMinutes?: number;
  location?: string;
  description?: string;
  reminder?: boolean;
};

type PortalNotificationItem = {
  kind?: string;
  [key: string]: unknown;
};

export const DEFAULT_REMINDER_PREFERENCES: ReminderPreferences = {
  classes: true,
  assignments: true,
  exams: true,
  tests: true,
  fees: true,
  leadMinutes: 15,
  browserAlerts: false,
};

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const REMINDER_MINUTES = [5, 15, 30, 60];

export function normalizeReminderPreferences(
  value: Partial<ReminderPreferences> = {},
): ReminderPreferences {
  const leadMinutes = Number(value.leadMinutes);
  return {
    classes: value.classes !== false,
    assignments: value.assignments !== false,
    exams: value.exams !== false,
    tests: value.tests !== false,
    fees: value.fees !== false,
    leadMinutes: REMINDER_MINUTES.includes(leadMinutes)
      ? leadMinutes
      : DEFAULT_REMINDER_PREFERENCES.leadMinutes,
    browserAlerts: value.browserAlerts === true,
  };
}

export function filterNotificationsByPreferences(
  notifications: PortalNotificationItem[] = [],
  preferences: Partial<ReminderPreferences> = {},
) {
  const enabled = normalizeReminderPreferences(preferences);
  const categoryByKind: Record<
    string,
    keyof Pick<ReminderPreferences, "classes" | "assignments" | "tests" | "exams" | "fees">
  > = {
    "batch-session": "classes",
    assignment: "assignments",
    "class-test": "tests",
    result: "tests",
    exam: "exams",
    fee: "fees",
  };
  return notifications.filter((notification) => {
    const category = notification.kind ? categoryByKind[notification.kind] : undefined;
    return !category || enabled[category];
  });
}

export function parseCalendarDate(value: string | null | undefined): Date | null {
  const text = String(value || "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
      ? date
      : null;
  }
  const formatted = /^(\d{1,2})\s+([a-z]{3,})\s+(\d{4})$/i.exec(text);
  if (!formatted) return null;
  const dayText = formatted[1];
  const monthText = formatted[2];
  const yearText = formatted[3];
  if (!dayText || !monthText || !yearText) return null;
  const month = MONTHS[monthText.slice(0, 3).toLowerCase()];
  if (month === undefined) return null;
  const day = Number(dayText);
  const year = Number(yearText);
  const date = new Date(year, month, day);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
    ? date
    : null;
}

function parseTime(value: string): number[] | null {
  const matches: RegExpExecArray[] = [];
  const pattern = /(\d{1,2}):(\d{2})\s*(AM|PM)?/gi;
  let match;
  while ((match = pattern.exec(String(value || ""))) !== null) matches.push(match);
  if (!matches.length) return null;
  const times: number[] = [];
  for (const match of matches) {
    const hoursText = match[1];
    const minutesText = match[2];
    if (!hoursText || !minutesText) return null;
    let hours = Number(hoursText);
    const minutes = Number(minutesText);
    const meridiem = match[3]?.toUpperCase();
    if (minutes > 59 || hours > 24 || (meridiem && hours > 12)) return null;
    if (meridiem) {
      hours = (hours % 12) + (meridiem === "PM" ? 12 : 0);
    }
    if (hours > 23) return null;
    times.push(hours * 60 + minutes);
  }
  return times;
}

export function calendarEventTiming({
  date: dateValue,
  time,
  durationMinutes = 60,
}: Pick<CalendarEvent, "date" | "time" | "durationMinutes">) {
  const date = parseCalendarDate(dateValue);
  const times = parseTime(time);
  const startMinutes = times?.[0];
  if (!date || !times || startMinutes === undefined) return null;
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, startMinutes);
  const endTime = times[1];
  const endMinutes =
    endTime !== undefined
      ? endTime + (endTime < startMinutes ? 24 * 60 : 0)
      : startMinutes + Math.max(1, Number(durationMinutes) || 60);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, endMinutes);
  return { start, end };
}

function escapeText(value = "") {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function formatLocalCalendarDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    "T",
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    "00",
  ].join("");
}

export function buildCalendarIcs(events: CalendarEvent[], reminderMinutes = 15, now = new Date()) {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Skill AI//Student Portal//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const event of events) {
    const timing = calendarEventTiming(event);
    if (!timing) {
      throw new Error(
        `Could not export "${event.title || "calendar event"}": check its date and time.`,
      );
    }
    const uid = String(event.id || `${event.title}-${timing.start.getTime()}`).replace(
      /[\r\n,;]/g,
      "-",
    );
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}@skillai.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${formatLocalCalendarDate(timing.start)}`,
      `DTEND:${formatLocalCalendarDate(timing.end)}`,
      `SUMMARY:${escapeText(event.title)}`,
      `DESCRIPTION:${escapeText(event.description || "")}`,
      `LOCATION:${escapeText(event.location || "")}`,
    );
    if (REMINDER_MINUTES.includes(Number(reminderMinutes)) && event.reminder !== false) {
      lines.push(
        "BEGIN:VALARM",
        `TRIGGER:-PT${Number(reminderMinutes)}M`,
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeText(event.title)}`,
        "END:VALARM",
      );
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export function downloadCalendarIcs(
  events: CalendarEvent[],
  fileName: string,
  reminderMinutes = 15,
) {
  if (!events.length) throw new Error("There are no upcoming events to add to your calendar.");
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") {
    throw new Error("Calendar downloads are not supported in this browser.");
  }
  const blob = new Blob([buildCalendarIcs(events, reminderMinutes)], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
