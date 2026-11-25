import { describe, expect, it } from "vitest";

import {
  buildCalendarIcs,
  calendarEventTiming,
  filterNotificationsByPreferences,
  normalizeReminderPreferences,
  parseCalendarDate,
} from "@/campusly/calendarExport";

describe("student calendar export", () => {
  it("parses ISO dates and the exam schedule's displayed date format", () => {
    expect(parseCalendarDate("2026-11-24")?.toLocaleDateString("en-CA")).toBe("2026-11-24");
    expect(parseCalendarDate("19 Dec 2026")?.getMonth()).toBe(11);
    expect(parseCalendarDate("31 Feb 2026")).toBeNull();
  });

  it("uses explicit exam times and class durations to produce local event times", () => {
    const exam = calendarEventTiming({
      date: "19 Dec 2026",
      time: "10:00 AM – 12:00 PM",
    });
    const classSession = calendarEventTiming({
      date: "2026-11-24",
      time: "09:00",
      durationMinutes: 120,
    });

    expect(exam?.start.getHours()).toBe(10);
    expect(exam?.end.getHours()).toBe(12);
    expect(classSession?.end.getHours()).toBe(11);
  });

  it("exports escaped details and a calendar alarm at the selected lead time", () => {
    const ics = buildCalendarIcs(
      [
        {
          id: "exam-1",
          title: "Theory, Module 3",
          date: "19 Dec 2026",
          time: "10:00 AM – 12:00 PM",
          location: "Exam Hall A",
        },
      ],
      30,
      new Date("2026-11-24T05:00:00.000Z"),
    );

    expect(ics).toContain("SUMMARY:Theory\\, Module 3");
    expect(ics).toContain("DTSTART:20261219T100000");
    expect(ics).toContain("TRIGGER:-PT30M");
    expect(ics).toContain("LOCATION:Exam Hall A");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("keeps reminders enabled by default and filters notifications by category", () => {
    const preferences = normalizeReminderPreferences({ exams: false, leadMinutes: 999 });
    const visible = filterNotificationsByPreferences(
      [
        { kind: "exam", title: "Exam reminder" },
        { kind: "fee", title: "Fee reminder" },
        { kind: "class-test", title: "Test reminder" },
        { kind: "assignment", title: "Assignment reminder" },
        { kind: "custom", title: "General update" },
      ],
      preferences,
    );

    expect(preferences).toMatchObject({
      classes: true,
      assignments: true,
      exams: false,
      browserAlerts: false,
      leadMinutes: 15,
    });
    expect(visible.map((notification) => notification["title"])).toEqual([
      "Fee reminder",
      "Test reminder",
      "Assignment reminder",
      "General update",
    ]);
    expect(preferences.browserAlerts).toBe(false);
    expect(
      filterNotificationsByPreferences([{ kind: "assignment", title: "Due soon" }], {
        assignments: false,
      }),
    ).toEqual([]);
  });
});
