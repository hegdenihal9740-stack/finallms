import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import {
  ArrowRight,
  GraduationCap,
  CalendarCheck,
  Bell,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  CalendarDays,
  Clock3,
  NotebookPen,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import hero from "../assets/dashboard-hero.jpg";
import {
  getClassTestGrandfatheredThrough,
  getCurrentCourse,
  getProgressCourse,
  getFirstMissingClassTestForModule,
  getFeesForCourses,
  EXAM_SLOTS,
  FEES,
  DEMO_USER,
  USER,
  initialData,
} from "./data.ts";
import { studentBatches } from "./batches.ts";
import { calendarEventTiming, parseCalendarDate } from "./calendarExport.ts";
import type { PortalNotification } from "./notificationUtils.ts";
import {
  formatLocalDateKey,
  getRetestWindowState,
  isClassTestPassed,
} from "./classTests.ts";
import "./hub-dashboard.css";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type DashboardAction = {
  id: string;
  kind: string;
  icon: LucideIcon;
  title: string;
  detail: string;
  page: string;
  priority: number;
};

type DashboardData = typeof initialData;

type SparkleStyle = CSSProperties & {
  "--sparkle-x": string;
  "--sparkle-y": string;
  "--sparkle-delay": string;
};

type HubDashboardProps = {
  data: DashboardData;
  batchStore?: Parameters<typeof studentBatches>[0];
  setPage: (page: string) => void;
  onNotificationClick?: (notification: PortalNotification) => void;
  onOpenClassTest?: (test: { module: number; lesson: number; topic: string }) => void;
};

function Card({
  icon: Icon,
  title,
  sub,
  right,
  children,
  className = "",
  onClick,
  onKeyDown,
}: {
  icon: LucideIcon;
  title: string;
  sub: string;
  right?: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
}) {
  return (
    <section
      className={`hub-card ${className}`}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role={onClick ? "link" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `Open ${title.toLowerCase()} report` : undefined}
    >
      <header className="hub-card-head">
        <span className="hub-ico">
          <Icon size={14} />
        </span>
        <div>
          <h3>{title}</h3>
          <p>{sub}</p>
        </div>
        {right && <span className="hub-chip">{right}</span>}
      </header>
      {children}
    </section>
  );
}

function AttendanceChart({ records }) {
  const [selectedIndex, setSelectedIndex] = useState(records.length - 1);
  const [dragging, setDragging] = useState(false);
  const points = records.map((record, index) => {
    const attended = record.status === "Present";
    const attendedSoFar = records
      .slice(0, index + 1)
      .filter((entry) => entry.status === "Present").length;
    return {
      ...record,
      attended,
      rate: Math.round((attendedSoFar / (index + 1)) * 100),
      x: records.length === 1 ? 150 : 16 + (index / (records.length - 1)) * 268,
    };
  });
  const pointY = (rate) => 78 - (rate / 100) * 58;
  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${pointY(point.rate)}`)
    .join(" ");
  const area = points.length
    ? `${line} L${points[points.length - 1].x},86 L${points[0].x},86 Z`
    : "";
  if (!points.length) {
    return <p className="hub-attendance-empty">No attendance recorded for this module yet.</p>;
  }
  const safeSelectedIndex = Math.min(selectedIndex, points.length - 1);
  const selected = points[safeSelectedIndex];

  function selectFromPointer(event) {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !points.length) return;
    const x = ((event.clientX - bounds.left) / bounds.width) * 300;
    const index = points.reduce(
      (nearest, point, candidate) =>
        Math.abs(point.x - x) < Math.abs(points[nearest].x - x) ? candidate : nearest,
      0,
    );
    setSelectedIndex(index);
  }

  function handleKeyDown(event) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedIndex((index) =>
      Math.max(0, Math.min(points.length - 1, index + (event.key === "ArrowRight" ? 1 : -1))),
    );
  }

  return (
    <div className="hub-attendance-chart" onClick={(event) => event.stopPropagation()}>
      <svg
        className="hub-attendance-plot"
        viewBox="0 0 300 96"
        preserveAspectRatio="none"
        role="slider"
        aria-label="Attendance by class. Drag or use the arrow keys to inspect each session."
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={selected.rate}
        aria-valuetext={`${selected.date}: ${selected.attended ? "Present" : "Absent"}, running attendance ${selected.rate}%`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={(event) => {
          selectFromPointer(event);
          setDragging(true);
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (dragging) selectFromPointer(event);
        }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        <defs>
          <linearGradient id="attendanceArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--hub-accent)" stopOpacity=".25" />
            <stop offset="1" stopColor="var(--hub-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[20, 49, 78].map((y) => (
          <line key={y} x1="12" x2="288" y1={y} y2={y} className="hub-attendance-gridline" />
        ))}
        <path d={area} fill="url(#attendanceArea)" />
        <path d={line} className="hub-attendance-line" />
        {points.map((point, index) => (
          <circle
            key={`${point.date}-${index}`}
            cx={point.x}
            cy={pointY(point.rate)}
            r={index === safeSelectedIndex ? 5 : 3.5}
            className={`hub-attendance-point${point.attended ? "" : " absent"}${index === safeSelectedIndex ? " selected" : ""}`}
          />
        ))}
        {selected && (
          <line x1={selected.x} x2={selected.x} y1="12" y2="86" className="hub-attendance-cursor" />
        )}
      </svg>
      <div className="hub-attendance-detail" aria-live="polite">
        <span className={`hub-attendance-status${selected.attended ? " present" : " absent"}`}>
          <i />
          {selected.attended ? "Present" : "Absent"}
        </span>
        <span>{selected.date}</span>
        <strong>{selected.rate}% running</strong>
      </div>
      <div className="hub-attendance-axis">
        <span>{points[0].date}</span>
        <span>{points.length} {points.length === 1 ? "session" : "sessions"}</span>
        <span>{points[points.length - 1].date}</span>
      </div>
    </div>
  );
}

function MobileAttendanceVisual({ records }) {
  const recent = records.slice(-8);
  const attended = recent.filter((record) => record.status === "Present").length;
  const missed = recent.length - attended;

  return (
    <div className="hub-attendance-mobile-visual" aria-label="Recent attendance sessions">
      <div className="hub-attendance-mobile-label">
        <span>CLASS RHYTHM</span>
        <span>{attended} attended{missed ? ` · ${missed} missed` : ""}</span>
      </div>
      {recent.length ? (
        <div className="hub-attendance-session-strip">
          {recent.map((record, index) => (
            <span
              key={`${record.date}-${index}`}
              className={`hub-attendance-session${record.status === "Present" ? " present" : " absent"}`}
              title={`${record.date}: ${record.status}`}
              aria-label={`${record.date}: ${record.status}`}
            />
          ))}
        </div>
      ) : (
        <p className="hub-attendance-empty">No recent sessions to show.</p>
      )}
      <div className="hub-attendance-session-legend">
        <span><i className="present" /> Attended</span>
        <span><i className="absent" /> Missed</span>
      </div>
    </div>
  );
}

function formatActionDate(date: Date | null | undefined) {
  if (!date) return "";
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const label = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
  return dateKey === todayKey ? `Today · ${label}` : label;
}

export default function HubDashboard({
  data,
  batchStore = null,
  setPage,
  onNotificationClick = undefined,
  onOpenClassTest = undefined,
}: HubDashboardProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const sparkleTimerRef = useRef<number | undefined>(undefined);
  const [sparkleBurst, setSparkleBurst] = useState<{ id: number; x: number; y: number } | null>(null);
  useEffect(() => () => window.clearTimeout(sparkleTimerRef.current), []);
  const go = (p) => {
    setPage(p);
    window.scrollTo(0, 0);
  };
  const popHero = (event) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const heroBounds = heroRef.current?.getBoundingClientRect();
    if (heroBounds) {
      const isKeyboardActivation = event.detail === 0;
      const x = isKeyboardActivation ? heroBounds.width / 2 : event.clientX - heroBounds.left;
      const y = isKeyboardActivation ? heroBounds.height / 2 : event.clientY - heroBounds.top;
      setSparkleBurst({ id: Date.now(), x, y });
      window.clearTimeout(sparkleTimerRef.current);
      sparkleTimerRef.current = window.setTimeout(() => setSparkleBurst(null), 800);
    }
    heroRef.current?.animate(
      [
        { transform: "translateY(0) scale(1)", boxShadow: "0 0 0 0 #ffb44300" },
        { transform: "translateY(-7px) scale(1.025)", boxShadow: "0 16px 34px -12px #ffb443aa" },
        { transform: "translateY(0) scale(1)", boxShadow: "0 0 0 0 #ffb44300" },
      ],
      { duration: 460, easing: "cubic-bezier(.2,1.5,.4,1)" },
    );
  };
  const hour = new Date().getHours();
  const greet = hour < 12 ? "GOOD MORNING" : hour < 17 ? "GOOD AFTERNOON" : "GOOD EVENING";
  const timetable = data.timetable || [];
  const now = new Date();
  const currentDay = DAYS[(now.getDay() + 6) % 7];
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const exactTodayIndex = timetable.findIndex((entry) => entry.dateKey === todayKey);
  const nextScheduledIndex = timetable.findIndex(
    (entry) => entry.dateKey && entry.dateKey > todayKey,
  );
  const todayIndex =
    exactTodayIndex >= 0
      ? exactTodayIndex
      : nextScheduledIndex >= 0
        ? nextScheduledIndex
        : Math.max(0, timetable.findIndex((entry) => entry.day === currentDay));
  const [scheduleIndex, setScheduleIndex] = useState(todayIndex);
  const selectedDay = timetable[scheduleIndex] || { day: currentDay, date: "", classes: [] };
  const att = Array.isArray(data.attendance) ? data.attendance : [];
  const progressModule = getProgressCourse(data.courses || []);
  const progressPercent = progressModule?.lessons
    ? Math.max(0, Math.min(100, Math.round((progressModule.completed / progressModule.lessons) * 100)))
    : 0;
  const nextLesson = progressModule?.sessions?.find((session) => !session.done);
  const testModule = getCurrentCourse(
    data.courses,
    data.classTests || {},
    getClassTestGrandfatheredThrough(data),
    data.moduleAssessments || {},
  );
  const nextClassTest = testModule
    ? getFirstMissingClassTestForModule(testModule, data.classTests || {})
    : null;
  const nextClassTestResult = nextClassTest && testModule
    ? data.classTests?.[`${testModule.id}-${nextClassTest.num}`]
    : null;
  const nextClassTestIsRetake = Boolean(
    nextClassTestResult && !isClassTestPassed(nextClassTestResult),
  );
  const retestState = nextClassTestIsRetake
    ? getRetestWindowState(nextClassTestResult)
    : null;
  const retestMessage = retestState === "open"
    ? "Next step: take your retest today. It closes after your academic day."
    : retestState === "scheduled"
      ? `Staff authorized your retest. Next step: take it on ${formatLocalDateKey(nextClassTestResult.retestAvailableDate)}.`
      : retestState === "expired"
        ? "Next step: ask academic staff to re-authorize your retest."
        : retestState === "approval-required"
          ? nextClassTestResult.retestAvailableDate
            ? `Retest date: ${formatLocalDateKey(nextClassTestResult.retestAvailableDate)} · waiting for staff authorization.`
            : "Next step: ask academic staff to schedule and authorize your retest."
          : null;
  const nextSteps: DashboardAction[] = [];
  if (nextClassTestIsRetake && nextClassTestResult) {
    const retestDate = parseCalendarDate(nextClassTestResult.retestAvailableDate || nextClassTestResult.retestDate);
    nextSteps.push({
      id: "retest",
      kind: "retest",
      icon: ClipboardList,
      title: retestState === "open"
        ? "Retake your class test"
        : retestState === "scheduled"
          ? "Prepare for your retest"
          : retestState === "expired"
            ? "Request retest re-authorization"
            : "Retest needs staff approval",
      detail: retestDate ? formatActionDate(retestDate) : "Check your class-test status",
      page: "classtests",
      priority: 0,
    });
  }
  const assignedBatchIds = new Set(studentBatches(batchStore || { batches: [], sessions: [] }, USER.email).map((batch) => batch.id));
  const nextClass = (batchStore?.sessions || [])
    .filter((session) => assignedBatchIds.has(session.batchId) && !["Completed", "Cancelled"].includes(session.status))
    .flatMap((session) => {
      const timing = calendarEventTiming({
        date: session.date,
        time: session.time,
        durationMinutes: session.duration,
      });
      return timing && timing.end.getTime() > now.getTime() ? [{ session, timing }] : [];
    })
    .sort((a, b) => a.timing.start.getTime() - b.timing.start.getTime())[0];
  if (nextClass) {
    nextSteps.push({
      id: `class-${nextClass.session.id}`,
      kind: "class",
      icon: CalendarDays,
      title: nextClass.session.topic || nextClass.session.subject,
      detail: `Next class · ${formatActionDate(nextClass.timing.start)} · ${nextClass.session.time}`,
      page: "timetable",
      priority: 1,
    });
  }
  const examCourse = getCurrentCourse(
    data.courses || [],
    data.classTests || {},
    getClassTestGrandfatheredThrough(data),
    data.moduleAssessments || {},
  );
  const availableCourseCodes = new Set(
    (data.courses || [])
      .filter((course) => Number(course.id) <= Number(examCourse?.id || 0))
      .map((course) => course.code),
  );
  const nextExam = EXAM_SLOTS
    .filter((exam) => exam.status === "Upcoming" && availableCourseCodes.has(exam.code))
    .flatMap((exam) => {
      const timing = calendarEventTiming(exam);
      return timing && timing.start.getTime() >= now.getTime() ? [{ exam, timing }] : [];
    })
    .sort((a, b) => a.timing.start.getTime() - b.timing.start.getTime())[0];
  if (nextExam) {
    nextSteps.push({
      id: `exam-${nextExam.exam.id}`,
      kind: "exam",
      icon: NotebookPen,
      title: `${nextExam.exam.type} · ${nextExam.exam.subject}`,
      detail: `Upcoming exam · ${formatActionDate(nextExam.timing.start)} · ${nextExam.exam.time}`,
      page: "exams",
      priority: 2,
    });
  }
  const availableFees = getFeesForCourses(
    data.courses || [],
    USER.email === DEMO_USER.email ? FEES : [],
    data.classTests || {},
    getClassTestGrandfatheredThrough(data),
    data.moduleAssessments || {},
  );
  const nextFee = availableFees
    .filter((fee) => fee.status === "Pending" && fee.date && fee.date !== "—")
    .flatMap((fee) => {
      const dueDate = parseCalendarDate(fee.date);
      return dueDate ? [{ fee, dueDate }] : [];
    })
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];
  if (nextFee) {
    nextSteps.push({
      id: `fee-${nextFee.fee.id}`,
      kind: "fee",
      icon: Wallet,
      title: `Module ${nextFee.fee.module} fee due`,
      detail: `${formatActionDate(nextFee.dueDate)} · ₹${Number(nextFee.fee.amount || 0).toLocaleString("en-IN")}`,
      page: "fees",
      priority: 3,
    });
  }
  if (nextLesson) {
    nextSteps.push({
      id: "lesson",
      kind: "lesson",
      icon: BookOpen,
      title: `Continue · ${(nextLesson.topic || `Session ${nextLesson.num}`).replace(/^Session \d+: /, "")}`,
      detail: "Complete this lesson, then pass the session test with 75% to unlock the next step.",
      page: "courses",
      priority: 4,
    });
  }
  nextSteps.sort((a, b) => a.priority - b.priority);
  const moduleAttendance = progressModule
    ? att
        .filter((record) => progressModule.title?.endsWith(record.course))
        .slice()
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : [];
  const attendedCount = moduleAttendance.filter((record) => record.status === "Present").length;
  const attPct = moduleAttendance.length
    ? Math.round((attendedCount / moduleAttendance.length) * 100)
    : null;
  const notifications = Array.isArray(data.notifications) ? data.notifications : [];
  const unreadNotifications = notifications.filter((notification) => !notification.read).length;

  return (
    <div className="hub">
      <div className="hub-top">
        <div className="hub-hero" ref={heroRef}>
          <img src={hero} alt="" width={1536} height={768} />
          <button
            type="button"
            className="hub-hero-hit-area"
            aria-label="Pop the dashboard banner"
            onClick={popHero}
          />
          {sparkleBurst && (
            <span className="hub-hero-sparkles" key={sparkleBurst.id} aria-hidden="true">
              {[
                [-20, -23, 0],
                [18, -20, 0.04],
                [-29, 8, 0.08],
                [27, 9, 0.12],
                [-13, 27, 0.16],
                [14, 26, 0.2],
              ].map(([dx, dy, delay], index) => {
                const style: SparkleStyle = {
                    left: sparkleBurst.x,
                    top: sparkleBurst.y,
                    "--sparkle-x": `${dx}px`,
                    "--sparkle-y": `${dy}px`,
                    "--sparkle-delay": `${delay}s`,
                };
                return <i key={index} className="hub-hero-sparkle" style={style} />;
              })}
            </span>
          )}
          <div className="hub-hero-copy">
            <span className="hub-eyebrow">
              {greet}, {USER.name?.split(" ")[0]?.toUpperCase()}
            </span>
            <h2>
              <span>Make Today</span>
              <span>Count</span>
            </h2>
            <p>Classes, marks, fees and learning progress — all in one place.</p>
            <button className="hub-pill-btn" onClick={() => go("courses")}>
              Explore my course <ArrowRight size={14} />
            </button>
          </div>
          <div className="hub-quote">
            <GraduationCap size={18} />
            “Learn skill,
            <br />
            get job.”
          </div>
        </div>
        <div className="hub-top-side">
          <div className="hub-schedule">
            <div className="hub-sched-head">
              <strong>
                <span
                  key={selectedDay.dateKey || `${selectedDay.day}-${scheduleIndex}`}
                  className="hub-sched-date"
                >
                  {selectedDay.day}
                  {selectedDay.date ? `, ${selectedDay.date}` : ""}
                </span>
              </strong>
              <div>
                <button
                  type="button"
                  className="hub-chip dark"
                  onClick={() => setScheduleIndex(todayIndex)}
                  disabled={scheduleIndex === todayIndex}
                >
                  Today
                </button>
                <button
                  type="button"
                  aria-label="Previous day"
                  onClick={() => setScheduleIndex((index) => Math.max(0, index - 1))}
                  disabled={scheduleIndex === 0}
                >
                  <ChevronLeft size={13} />
                </button>
                <button
                  type="button"
                  aria-label="Next day"
                  onClick={() =>
                    setScheduleIndex((index) => Math.min(timetable.length - 1, index + 1))
                  }
                  disabled={scheduleIndex >= timetable.length - 1}
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
            <div className="hub-sched-times">
              {["10AM", "12PM", "2PM", "4PM"].map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
            <div
              key={selectedDay.dateKey || `${selectedDay.day}-${scheduleIndex}`}
              className="hub-sched-list"
            >
              {selectedDay.classes.map((c, i) => (
                <button
                  key={i}
                  className={`hub-event ${i === 0 ? "hot" : i === 1 ? "light" : "mint"}`}
                  onClick={() => go("timetable")}
                >
                  <strong>{c.title}</strong>
                  <span>
                    {c.time} · {c.room}
                  </span>
                </button>
              ))}
              {!selectedDay.classes.length && <p className="hub-muted">No classes scheduled.</p>}
            </div>
          </div>
          <section className="hub-class-test-card" aria-label="Next class test">
            <div className="hub-class-test-head">
              <span className="hub-class-test-icon"><ClipboardList size={15}/></span>
              <span>NEXT CLASS TEST</span>
            </div>
            {nextClassTest && testModule ? (
              <>
                <span className="hub-class-test-module">
                  MODULE {String(testModule.id).padStart(2, "0")} · SESSION {String(nextClassTest.num).padStart(2, "0")}
                </span>
                <strong className="hub-class-test-title">
                  {nextClassTest.topic.replace(/^Session \d+: /, "")}
                </strong>
                <span className="hub-class-test-caption">{retestMessage || "Ready when you are"}</span>
              </>
            ) : (
              <>
                <strong className="hub-class-test-title">No test due right now</strong>
                <span className="hub-class-test-caption">Complete a lesson to unlock your next class test.</span>
              </>
            )}
            <button
              type="button"
              className="hub-class-test-action"
              onClick={() => {
                if (nextClassTest && testModule && (!nextClassTestIsRetake || retestState === "open") && onOpenClassTest) {
                  onOpenClassTest({
                    module: testModule.id,
                    lesson: nextClassTest.num,
                    topic: nextClassTest.topic,
                  });
                } else {
                  go("classtests");
                }
              }}
            >
              {nextClassTest
                ? nextClassTestIsRetake
                  ? retestState === "open" ? "Retake Test" : "View retest status"
                  : "Start next test"
                : "View class tests"} <ArrowRight size={14}/>
            </button>
          </section>
        </div>
      </div>

      <section className="hub-next-steps" aria-label="Your next steps">
        <div className="hub-next-steps-heading">
          <div>
            <span className="hub-progress-eyebrow">YOUR DAY, MADE CLEAR</span>
            <h2>Next steps</h2>
          </div>
          <Clock3 size={19} aria-hidden="true"/>
        </div>
        {nextSteps.length ? (
          <div className="hub-next-steps-list">
            {nextSteps.slice(0, 4).map((step) => {
              const Icon = step.icon;
              return (
                <button
                  type="button"
                  className="hub-next-step"
                  key={step.id}
                  onClick={() => step.kind === "retest" ? go("classtests") : go(step.page)}
                >
                  <span className="hub-next-step-icon"><Icon size={17}/></span>
                  <span className="hub-next-step-copy">
                    <strong>{step.title}</strong>
                    <span>{step.detail}</span>
                  </span>
                  <ArrowRight size={16} aria-hidden="true"/>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="hub-card-empty">You’re all caught up. Continue learning to see your next step here.</p>
        )}
      </section>

      <section className="hub-progress-card" aria-label="Course progress">
        <div className="hub-progress-copy">
          <span className="hub-progress-eyebrow">YOUR LEARNING PATH</span>
          <strong>{progressModule?.title?.replace(/^Module \d+: /, "") || "Your course"}</strong>
          <span>
            {progressModule
              ? `${progressModule.completed} of ${progressModule.lessons} lessons complete`
              : "Your course progress will appear here."}
          </span>
        </div>
        {progressModule && (
          <div
            className="hub-progress-track"
            role="progressbar"
            aria-label={`Module ${progressModule.id} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
          >
            <span style={{ width: `${progressPercent}%` }} />
          </div>
        )}
        <div className="hub-progress-footer">
          <span>
            {nextLesson
              ? `Next: ${(nextLesson.topic || `Session ${nextLesson.num}`).replace(/^Session \d+: /, "")}`
              : progressModule
                ? "Module complete"
                : "Open your course roadmap to get started."}
          </span>
          <button type="button" className="hub-progress-action" onClick={() => go("courses")}>
            {progressModule?.completed >= progressModule?.lessons ? "View course" : "Continue learning"}
            <ArrowRight size={14} />
          </button>
        </div>
        <p className="hub-progress-unlock">
          {nextClassTestIsRetake
            ? retestState === "open"
              ? "Your approved retest is open today. Pass with at least 75% to continue."
              : "A retest needs academic staff approval before the next step unlocks."
            : nextClassTest
              ? "Pass the class test with at least 75% to unlock the next session."
              : nextLesson
                ? "Complete this lesson, then pass its class test with at least 75% to unlock the next session."
                : progressModule
                  ? "Your lessons are complete. Finish any remaining tests and module requirements to unlock what’s next."
                  : "Open your course to see the requirements for your first learning step."}
        </p>
      </section>

      <Card
        icon={Bell}
        title="Recent Notifications"
        sub="The latest updates from your learning portal"
        right={unreadNotifications ? `${unreadNotifications} unread` : "All caught up"}
        className="hub-notifications-card"
      >
        <div className="hub-notifications">
          {notifications.slice(0, 3).map((notification) => (
            <button
              type="button"
              key={notification.id}
              className={`hub-notification${notification.read ? "" : " unread"}${notification.kind === "class-test" ? " class-test-notification" : ""}`}
              onClick={() =>
                onNotificationClick ? onNotificationClick(notification) : go("notifications")
              }
            >
              <span className="hub-notification-dot" aria-hidden="true" />
              <span className="hub-notification-copy">
                <strong>{notification.title}</strong>
                <span>{notification.message}</span>
              </span>
              <time>{notification.time}</time>
            </button>
          ))}
          {!notifications.length && <p className="hub-card-empty">No notifications yet.</p>}
          <button type="button" className="hub-notifications-link" onClick={() => go("notifications")}>
            View all notifications <ArrowRight size={13} />
          </button>
        </div>
      </Card>

      <div className="hub-row two hub-attendance-row">
        <Card
          icon={CalendarCheck}
          title="Attendance"
          sub={progressModule?.title?.replace(/^Module \d+: /, "") ?? "Current module"}
          right="Current module"
          className="hub-attendance-card"
          onClick={() => go("attendance")}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
            event.preventDefault();
            go("attendance");
          }}
        >
          <div className="hub-attendance-summary">
            <div className="hub-big">
              {attPct === null ? "—" : `${attPct}%`}
              {attPct !== null && <small>{attPct >= 75 ? "↑ on track" : "↓ below 75%"}</small>}
            </div>
            <span>{attendedCount}/{moduleAttendance.length} classes attended</span>
          </div>
          <MobileAttendanceVisual records={moduleAttendance} />
          <AttendanceChart records={moduleAttendance} />
          <span className="hub-attendance-link">View attendance report <ArrowRight size={13} /></span>
        </Card>
      </div>

    </div>
  );
}
