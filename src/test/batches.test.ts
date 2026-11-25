import { describe, expect, it } from "vitest";
import {
  getNextStudentClassDate,
  getBatchSessionNotifications,
  getCalendarSessionsForDate,
  updateSessionSchedule,
} from "../campusly/batches.ts";

const session = {
  id: "S-1",
  batchId: "B-1",
  subject: "Advanced Python",
  number: 2,
  date: "2026-11-20",
  time: "09:00",
  status: "Scheduled",
};

describe("batch session rescheduling", () => {
  it("finds the student's next recurring class and can include today's class for approval", () => {
    const store = {
      batches: [
        {
          id: "B-1",
          students: ["student@example.com"],
          days: "Mon, Wed, Fri",
          startDate: "2026-11-01",
          endDate: "2026-11-30",
        },
      ],
      sessions: [{ ...session, date: "2026-11-25" }],
    };

    expect(getNextStudentClassDate(store, "student@example.com", new Date(2026, 10, 21))).toBe(
      "2026-11-23",
    );
    expect(
      getNextStudentClassDate(store, "student@example.com", new Date(2026, 10, 23), true),
    ).toBe("2026-11-23");
    expect(getNextStudentClassDate(store, "student@example.com", new Date(2026, 10, 23))).toBe(
      "2026-11-25",
    );
    expect(
      getNextStudentClassDate(
        {
          ...store,
          sessions: [...store.sessions, { ...session, date: "2026-11-23", status: "Cancelled" }],
        },
        "student@example.com",
        new Date(2026, 10, 21),
      ),
    ).toBe("2026-11-25");
  });

  it("marks a moved scheduled class as rescheduled and records its old and new slots", () => {
    const updated = updateSessionSchedule(
      session,
      { ...session, date: "2026-11-25", time: "11:00" },
      1000,
    );

    expect(updated.status).toBe("Rescheduled");
    expect(updated.rescheduleEvents).toEqual([
      {
        id: "reschedule-S-1-1000-0",
        createdAt: "1970-01-01T00:00:01.000Z",
        previousDate: "2026-11-20",
        previousTime: "09:00",
        date: "2026-11-25",
        time: "11:00",
      },
    ]);
  });

  it("notifies only the assigned student and persists read state per notification", () => {
    const updated = updateSessionSchedule(
      session,
      { ...session, date: "2026-11-25", time: "11:00" },
      1000,
    );
    const store = {
      batches: [{ id: "B-1", students: ["student@example.com"] }],
      sessions: [updated],
    };
    const [notification] = getBatchSessionNotifications(store, "STUDENT@example.com");

    expect(getBatchSessionNotifications(store, "other@example.com")).toEqual([]);
    expect(notification).toMatchObject({
      id: updated.rescheduleEvents[0].id,
      kind: "batch-session",
      title: "Class postponed",
      read: false,
    });
    expect(notification.message).toContain("Your timetable has been updated.");
    expect(
      getBatchSessionNotifications(store, "student@example.com", {
        [notification.id]: true,
      })[0].read,
    ).toBe(true);
  });

  it("moves the calendar entry to the new date and marks its previous date as postponed", () => {
    const updated = updateSessionSchedule(
      session,
      { ...session, date: "2026-11-25", time: "11:00" },
      1000,
    );

    expect(getCalendarSessionsForDate([updated], "2026-11-20")).toMatchObject({
      onDate: [],
      movedFrom: [{ id: "S-1", date: "2026-11-25" }],
    });
    expect(getCalendarSessionsForDate([updated], "2026-11-25")).toMatchObject({
      onDate: [{ id: "S-1", status: "Rescheduled" }],
      movedFrom: [],
    });
  });
});
