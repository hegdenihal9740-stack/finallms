import { describe, expect, it } from "vitest";

import { getPortalReminderEvents } from "@/campusly/reminderUtils";

describe("browser reminder scheduling", () => {
  const now = new Date(2026, 10, 24, 8, 0);
  const batchStore = {
    batches: [{ id: "batch-1", students: ["student@example.test"] }],
    sessions: [
      {
        id: "class-1",
        batchId: "batch-1",
        status: "Scheduled",
        date: "2026-11-25",
        time: "10:00",
        topic: "Data analysis",
      },
      {
        id: "class-other",
        batchId: "other-batch",
        status: "Scheduled",
        date: "2026-11-25",
        time: "11:00",
        topic: "Unassigned class",
      },
    ],
  };

  it("schedules assigned classes, assignment deadlines, and authorized retests at the chosen lead time", () => {
    const reminders = getPortalReminderEvents(
      {
        reminderPreferences: {
          classes: true,
          assignments: true,
          tests: true,
          leadMinutes: 15,
        },
        assignments: [
          {
            id: "assignment-1",
            title: "Data project",
            dueDate: "2026-11-26",
            dueTime: "14:00",
            status: "Open",
          },
        ],
        classTests: {
          "2-3": {
            score: 5,
            total: 10,
            status: "Failed",
            retestAuthorized: true,
            retestAvailableDate: "2026-11-27",
          },
          "2-4": {
            score: 5,
            total: 10,
            status: "Failed",
            retestAuthorized: false,
            retestAvailableDate: "2026-11-27",
          },
        },
      },
      batchStore,
      "student@example.test",
      now,
    );

    expect(reminders.map(({ category }) => category)).toEqual([
      "classes",
      "assignments",
      "tests",
    ]);
    expect(reminders[0].title).toBe("Upcoming class: Data analysis");
    expect(reminders[0].notifyAt).toEqual(new Date(2026, 10, 25, 9, 45));
    expect(reminders[1].notifyAt).toEqual(new Date(2026, 10, 26, 13, 45));
    expect(reminders[2].notifyAt).toEqual(new Date(2026, 10, 27, 8, 45));
  });

  it("does not schedule categories a student has disabled", () => {
    const reminders = getPortalReminderEvents(
      {
        reminderPreferences: {
          classes: false,
          assignments: false,
          tests: false,
        },
        assignments: [{ id: "assignment-1", dueDate: "2026-11-26", title: "Data project" }],
        classTests: {
          "2-3": {
            score: 5,
            total: 10,
            status: "Failed",
            retestAuthorized: true,
            retestAvailableDate: "2026-11-27",
          },
        },
      },
      batchStore,
      "student@example.test",
      now,
    );

    expect(reminders).toEqual([]);
  });
});
