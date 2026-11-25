import { getRetestWindowState, isClassTestPassed } from "./classTests.ts";
import { studentBatches } from "./batches.ts";
import {
  calendarEventTiming,
  normalizeReminderPreferences,
  type ReminderPreferences,
} from "./calendarExport.ts";

type ReminderCategory = "classes" | "assignments" | "tests";

export type PortalReminderEvent = {
  id: string;
  category: ReminderCategory;
  title: string;
  body: string;
  startAt: Date;
  notifyAt: Date;
};

type ReminderRecord = Record<string, unknown>;

function stringValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function createReminder(
  category: ReminderCategory,
  id: string,
  title: string,
  body: string,
  date: string,
  time: string,
  leadMinutes: number,
  now: Date,
): PortalReminderEvent | null {
  const timing = calendarEventTiming({ date, time });
  if (!timing || timing.start.getTime() <= now.getTime()) return null;

  const scheduledAt = timing.start.getTime() - leadMinutes * 60_000;
  const notifyAt = new Date(Math.max(now.getTime() + 500, scheduledAt));
  if (notifyAt.getTime() >= timing.start.getTime()) return null;

  return { id, category, title, body, startAt: timing.start, notifyAt };
}

export function getPortalReminderEvents(
  data: ReminderRecord,
  batchStore: ReminderRecord,
  studentEmail: string,
  now = new Date(),
): PortalReminderEvent[] {
  const preferences = normalizeReminderPreferences(
    data.reminderPreferences as Partial<ReminderPreferences> | undefined,
  );
  const reminders: PortalReminderEvent[] = [];

  if (preferences.classes) {
    const assignedBatchIds = new Set(
      studentBatches(batchStore, studentEmail).map((batch) => batch.id),
    );
    const sessions = Array.isArray(batchStore.sessions) ? batchStore.sessions : [];
    for (const rawSession of sessions) {
      if (!rawSession || typeof rawSession !== "object") continue;
      const session = rawSession as ReminderRecord;
      const status = stringValue(session.status);
      if (
        !assignedBatchIds.has(stringValue(session.batchId)) ||
        (status !== "Scheduled" && status !== "Rescheduled")
      ) {
        continue;
      }

      const topic = stringValue(session.topic || session.subject) || "Class session";
      const reminder = createReminder(
        "classes",
        `class-${stringValue(session.id)}`,
        `Upcoming class: ${topic}`,
        `Your class starts at ${stringValue(session.time)}.`,
        stringValue(session.date),
        stringValue(session.time),
        preferences.leadMinutes,
        now,
      );
      if (reminder) reminders.push(reminder);
    }
  }

  if (preferences.assignments) {
    const assignments = Array.isArray(data.assignments) ? data.assignments : [];
    for (const [index, rawAssignment] of assignments.entries()) {
      if (!rawAssignment || typeof rawAssignment !== "object") continue;
      const assignment = rawAssignment as ReminderRecord;
      const status = stringValue(assignment.status).toLowerCase();
      if (["submitted", "completed", "graded"].includes(status)) continue;

      const dueAt = stringValue(assignment.dueAt || assignment.due_at);
      const dueAtParts = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(dueAt);
      const date = stringValue(
        assignment.dueDate || assignment.due_date || assignment.date || dueAtParts?.[1],
      );
      const time = stringValue(
        assignment.dueTime || assignment.due_time || assignment.time || dueAtParts?.[2],
      ) || "09:00";
      const title = stringValue(assignment.title || assignment.name) || "Assignment deadline";
      const reminder = createReminder(
        "assignments",
        `assignment-${stringValue(assignment.id) || index}`,
        `Assignment due: ${title}`,
        `Please submit by ${date} at ${time}.`,
        date,
        time,
        preferences.leadMinutes,
        now,
      );
      if (reminder) reminders.push(reminder);
    }
  }

  if (preferences.tests) {
    const classTests =
      data.classTests && typeof data.classTests === "object"
        ? (data.classTests as Record<string, ReminderRecord>)
        : {};
    for (const [key, result] of Object.entries(classTests)) {
      if (!result || isClassTestPassed(result)) continue;
      const state = getRetestWindowState(result, now);
      if (state !== "scheduled" && state !== "open") continue;

      const [moduleId, sessionId] = key.split("-");
      const target = sessionId
        ? `Module ${moduleId}, Session ${sessionId}`
        : `Module ${moduleId} assessment`;
      const date = stringValue(result.retestDate || result.retestAvailableDate);
      const time = stringValue(result.retestTime) || "09:00";
      const reminder = createReminder(
        "tests",
        `retest-${key}-${date}`,
        `Retest scheduled: ${target}`,
        `Your approved retest opens at ${time} on ${date}.`,
        date,
        time,
        preferences.leadMinutes,
        now,
      );
      if (reminder) reminders.push(reminder);
    }
  }

  return reminders.sort((first, second) => first.notifyAt.getTime() - second.notifyAt.getTime());
}
