export const ADMIN_USER = {
  name: "Admin Team",
  email: "admin@skillai.demo",
  password: "admin123",
  role: "admin",
  studentId: "ADMIN",
  program: "Administration",
};

export const BATCH_STORAGE_KEY = "portal-batches";
export const BATCH_STORE_CHANGE_EVENT = "portal-batches-updated";
export const SESSION_STATUSES = ["Scheduled", "Completed", "Cancelled", "Rescheduled"];
export const CLASS_TIME_SLOTS = ["09:00", "11:00", "14:00"];
export const CLASS_DURATION_MINUTES = 120;

const normalizeClassTime = (time) => {
  const [hours, minutes] = String(time || "").split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return CLASS_TIME_SLOTS[0];
  const targetMinutes = hours * 60 + minutes;
  return CLASS_TIME_SLOTS.reduce((closest, slot) => {
    const [slotHours, slotMinutes] = slot.split(":").map(Number);
    const [closestHours, closestMinutes] = closest.split(":").map(Number);
    return Math.abs(targetMinutes - (slotHours * 60 + slotMinutes)) < Math.abs(targetMinutes - (closestHours * 60 + closestMinutes))
      ? slot
      : closest;
  }, CLASS_TIME_SLOTS[0]);
};

const normalizeSchedule = (schedule) => ({
  ...schedule,
  batches: schedule.batches.map((batch) => ({
    ...batch,
    time: normalizeClassTime(batch.time),
    duration: CLASS_DURATION_MINUTES,
  })),
  sessions: (Array.isArray(schedule.sessions) ? schedule.sessions : []).map((session) => ({
    ...session,
    time: normalizeClassTime(session.time),
    duration: CLASS_DURATION_MINUTES,
  })),
});

const seed = {
  batches: [
    {
      id: "B-01",
      name: "MBD Oct 2026 — Morning",
      course: "Master's in AI Big Data & Advance MLOps",
      startDate: "2026-10-01",
      endDate: "2027-09-30",
      days: "Mon, Wed, Fri",
      time: "09:00",
      duration: CLASS_DURATION_MINUTES,
      mode: "Classroom",
      room: "Lab 01",
      mentor: "Rahul Shetty",
      capacity: 30,
      students: ["student@skillai.demo"],
    },
    {
      id: "B-02",
      name: "MBD Oct 2026 — Weekend",
      course: "Master's in AI Big Data & Advance MLOps",
      startDate: "2026-10-03",
      endDate: "2027-10-02",
      days: "Sat, Sun",
      time: "11:00",
      duration: CLASS_DURATION_MINUTES,
      mode: "Online",
      room: "Zoom",
      mentor: "Meera Nair",
      capacity: 40,
      students: [],
    },
  ],
  sessions: [
    [
      "B-01",
      "Advanced Python & Database Foundation",
      1,
      "2026-10-19",
      "09:00",
      "Python OOP refresher",
      "Completed",
    ],
    [
      "B-01",
      "Advanced Python & Database Foundation",
      2,
      "2026-10-21",
      "09:00",
      "SQL joins & indexing",
      "Completed",
    ],
    [
      "B-01",
      "Advanced Python & Database Foundation",
      3,
      "2026-10-23",
      "09:00",
      "MongoDB basics",
      "Completed",
    ],
    [
      "B-01",
      "ML, Data Science & Data Visualization",
      1,
      "2026-10-26",
      "14:00",
      "Intro to Pandas",
      "Completed",
    ],
    [
      "B-01",
      "Advanced Python & Database Foundation",
      4,
      "2026-10-28",
      "09:00",
      "Query tuning",
      "Scheduled",
    ],
    [
      "B-01",
      "ML, Data Science & Data Visualization",
      2,
      "2026-10-30",
      "14:00",
      "EDA with Seaborn",
      "Scheduled",
    ],
    [
      "B-01",
      "Advanced Python & Database Foundation",
      5,
      "2026-11-02",
      "09:00",
      "Database project review",
      "Rescheduled",
    ],
    [
      "B-01",
      "ML, Data Science & Data Visualization",
      3,
      "2026-11-04",
      "14:00",
      "Statistics for ML",
      "Scheduled",
    ],
    [
      "B-02",
      "Advanced Python & Database Foundation",
      1,
      "2026-10-24",
      "11:00",
      "Python OOP refresher",
      "Completed",
    ],
    [
      "B-02",
      "Advanced Python & Database Foundation",
      2,
      "2026-10-31",
      "11:00",
      "SQL joins & indexing",
      "Scheduled",
    ],
  ].map(([batchId, subject, number, date, time, topic, status], i) => ({
    id: `S-${i + 1}`,
    batchId,
    subject,
    number,
    date,
    time,
    duration: CLASS_DURATION_MINUTES,
    topic,
    status,
    trainer: "",
  })),
};

export function loadBatches() {
  try {
    const d = JSON.parse(localStorage.getItem(BATCH_STORAGE_KEY) || "null");
    if (Array.isArray(d?.batches)) {
      const normalized = normalizeSchedule(d);
      if (JSON.stringify(normalized) !== JSON.stringify(d)) {
        localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(normalized));
      }
      return normalized;
    }
  } catch {
    /* ignore */
  }
  return structuredClone(seed);
}
export function saveBatches(d) {
  localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(d));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(BATCH_STORE_CHANGE_EVENT));
  }
}
export function resetBatches() {
  localStorage.removeItem(BATCH_STORAGE_KEY);
  return structuredClone(seed);
}

export function updateSessionSchedule(previous, next, now = Date.now()) {
  const scheduleChanged = previous.date !== next.date || previous.time !== next.time;
  const status =
    scheduleChanged &&
    (previous.status === "Scheduled" || previous.status === "Rescheduled") &&
    next.status === "Scheduled"
      ? "Rescheduled"
      : next.status;
  const events = Array.isArray(previous.rescheduleEvents) ? previous.rescheduleEvents : [];
  const shouldNotify =
    status === "Rescheduled" && (previous.status !== "Rescheduled" || scheduleChanged);
  const rescheduleEvents = shouldNotify
    ? [
        ...events,
        {
          id: `reschedule-${previous.id}-${now}-${events.length}`,
          createdAt: new Date(now).toISOString(),
          previousDate: previous.date,
          previousTime: previous.time,
          date: next.date,
          time: next.time,
        },
      ]
    : events;

  return { ...next, status, rescheduleEvents };
}

export function getBatchSessionNotifications(store, email, readState = {}) {
  const normalizedEmail = String(email || "").toLowerCase();
  return store.sessions
    .flatMap((session) => {
      const batch = store.batches.find((item) => item.id === session.batchId);
      if (!batch?.students.some((student) => student.toLowerCase() === normalizedEmail)) {
        return [];
      }

      return (session.rescheduleEvents || []).map((event) => {
        const moved = event.previousDate !== event.date || event.previousTime !== event.time;
        const message = moved
          ? `${session.subject}, session ${session.number}, moved from ${fmtDate(event.previousDate)} at ${fmtTime(event.previousTime)} to ${fmtDate(event.date)} at ${fmtTime(event.time)}. Your timetable has been updated.`
          : `${session.subject}, session ${session.number}, was marked as postponed. Its calendar slot is currently ${fmtDate(event.date)} at ${fmtTime(event.time)}.`;

        return {
          id: event.id,
          kind: "batch-session",
          title: "Class postponed",
          message,
          createdAt: event.createdAt,
          time: new Date(event.createdAt).toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
          }),
          read: readState[event.id] === true,
        };
      });
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function getCalendarSessionsForDate(sessions, date) {
  return {
    onDate: sessions.filter((session) => session.date === date),
    movedFrom: sessions.filter(
      (session) =>
        session.status === "Rescheduled" &&
        date !== session.date &&
        (session.rescheduleEvents || []).some((event) => event.previousDate === date),
    ),
  };
}

export function studentBatches(store, email) {
  const e = String(email || "").toLowerCase();
  return store.batches.filter((b) => b.students.map((s) => s.toLowerCase()).includes(e));
}

export function getNextStudentClassDate(store, email, fromDate = new Date(), includeToday = false) {
  const schedule = store || { batches: [], sessions: [] };
  const batches = studentBatches(schedule, email);
  if (!batches.length) return null;

  const today = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const firstSearchDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + (includeToday ? 0 : 1),
  );
  const dateKey = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const firstSearchKey = dateKey(firstSearchDate);
  const candidates = [];

  for (const batch of batches) {
    const sessions = (schedule.sessions || []).filter((session) => session.batchId === batch.id);
    for (const session of sessions) {
      if (
        session.date >= firstSearchKey &&
        (session.status === "Scheduled" || session.status === "Rescheduled")
      ) {
        candidates.push(session.date);
      }
    }

    if (!batch.startDate || !batch.endDate || !batch.days) continue;
    const batchStart = new Date(`${batch.startDate}T00:00:00`);
    const batchEnd = new Date(`${batch.endDate}T00:00:00`);
    if (Number.isNaN(batchStart.getTime()) || Number.isNaN(batchEnd.getTime())) continue;

    const searchStart = firstSearchDate > batchStart ? firstSearchDate : batchStart;
    const scheduledDays = new Set(batch.days.split(",").map((day) => day.trim()));
    for (let offset = 0; offset < 7; offset += 1) {
      const date = new Date(
        searchStart.getFullYear(),
        searchStart.getMonth(),
        searchStart.getDate() + offset,
      );
      if (date > batchEnd) break;
      const candidate = dateKey(date);
      const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
      if (!scheduledDays.has(weekday)) continue;
      const blocked = sessions.some(
        (session) =>
          (session.date === candidate &&
            (session.status === "Completed" || session.status === "Cancelled")) ||
          (session.status === "Rescheduled" &&
            (session.rescheduleEvents || []).some((event) => event.previousDate === candidate)),
      );
      if (blocked) continue;
      candidates.push(candidate);
      break;
    }
  }

  return candidates.sort()[0] || null;
}

export function batchStats(store, batchId) {
  const s = store.sessions.filter((x) => x.batchId === batchId);
  const done = s.filter((x) => x.status === "Completed").length;
  return {
    total: s.length,
    done,
    upcoming: s.filter((x) => x.status === "Scheduled" || x.status === "Rescheduled").length,
    pct: s.length ? Math.round((done / s.length) * 100) : 0,
  };
}
export const fmtDate = (d) =>
  d
    ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(
        new Date(d + "T00:00"),
      )
    : "—";
export const fmtTime = (t) => {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  return `${String(((h + 11) % 12) + 1).padStart(2, "0")}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};
export const endTime = (t, mins) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const x = h * 60 + m + Number(mins || 0);
  return fmtTime(`${Math.floor(x / 60) % 24}:${x % 60}`);
};
