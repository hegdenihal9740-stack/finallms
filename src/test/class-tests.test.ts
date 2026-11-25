import { describe, expect, it } from "vitest";

import {
  didPassClassTest,
  formatLocalDateKey,
  getRetestWindowState,
  isClassTestPassed,
  lessonTest,
  localDateKey,
  moduleAssessment,
  nextLocalDateKey,
  QUESTIONS_PER_MODULE_ASSESSMENT,
  appendTestAttemptHistory,
  nextTestAttemptNumber,
} from "@/campusly/classTests";
import {
  DEMO_USER,
  getClassTestNotifications,
  initialData,
  loadDemoData,
  setCurrentUser,
  USER,
} from "@/campusly/data";
import {
  getCurrentCourse,
  getFirstMissingClassTestForModule,
  getMissingClassTestsForModule,
  getProgressCourse,
} from "@/campusly/data";

describe("class-test pass threshold", () => {
  it("clears earlier failed results when a later session test passed", () => {
    const course = {
      id: 1,
      sessions: [
        { num: 1, done: true },
        { num: 2, done: true },
      ],
    };

    expect(
      getMissingClassTestsForModule(course, {
        "1-1": { score: 6, total: 10, status: "Failed" },
        "1-2": { score: 8, total: 10, status: "Passed" },
      }).map((session) => session.num),
    ).toEqual([]);

    expect(
      getMissingClassTestsForModule(course, {
        "1-1": { score: 8, total: 10, status: "Passed" },
        "1-2": { score: 8, total: 10, status: "Passed" },
      }),
    ).toEqual([]);

    expect(
      getMissingClassTestsForModule(course, {
        "1-1": { score: 8, total: 10, status: "Failed - Retest Required" },
        "1-2": { score: 6, total: 10, status: "Failed - Retest Required" },
      }).map((session) => session.num),
    ).toEqual([1, 2]);
    expect(isClassTestPassed({ score: 7, total: 10, status: "Passed" })).toBe(false);
  });

  it("requires a failed Session 4 retest to pass before Session 5 unlocks", () => {
    const course = {
      id: 1,
      sessions: [
        { num: 1, done: true },
        { num: 2, done: true },
        { num: 3, done: true },
        { num: 4, done: true },
        { num: 5, done: true },
      ],
    };
    const classTests = {
      "1-1": { score: 8, total: 10, status: "Passed" },
      "1-2": { score: 8, total: 10, status: "Passed" },
      "1-3": { score: 8, total: 10, status: "Passed" },
      "1-4": { score: 7, total: 10, status: "Failed" },
    };

    expect(getFirstMissingClassTestForModule(course, classTests)?.num).toBe(4);
    expect(
      getFirstMissingClassTestForModule(course, {
        ...classTests,
        "1-4": { score: 8, total: 10, status: "Passed" },
      })?.num,
    ).toBe(5);
  });

  it("keeps past module failures cleared while Module 3 remains the active course", () => {
    const courses = [
      {
        id: 1,
        completed: 2,
        lessons: 2,
        sessions: [{ num: 1, done: true }],
      },
      {
        id: 2,
        completed: 3,
        lessons: 3,
        sessions: [{ num: 1, done: true }],
      },
      {
        id: 3,
        completed: 1,
        lessons: 5,
        sessions: [{ num: 1, done: true }],
      },
    ];
    const classTests = {
      "1-1": { score: 7, total: 10, status: "Failed" },
      "2-1": { score: 8, total: 10, status: "Passed" },
    };
    const moduleAssessments = {
      1: { score: 8, total: 10 },
      2: { score: 8, total: 10 },
    };

    expect(getProgressCourse(courses)?.id).toBe(3);
    expect(getCurrentCourse(courses, classTests, 2, moduleAssessments)?.id).toBe(3);
  });

  it("allows Module 7 progress based on the recorded course position", () => {
    const courses = Array.from({ length: 7 }, (_, index) => ({
      id: index + 1,
      completed: index < 6 ? 1 : 0,
      lessons: 1,
      sessions: [{ num: 1, done: index < 6 }],
    }));

    expect(getProgressCourse(courses)?.id).toBe(7);
    expect(getCurrentCourse(courses, {}, 6, {})?.id).toBe(7);
  });

  it("fails scores below 75 percent and passes scores at or above 75 percent", () => {
    expect(didPassClassTest(7, 10)).toBe(false);
    expect(didPassClassTest(3, 4)).toBe(true);
    expect(didPassClassTest(4, 4)).toBe(true);
  });

  it("opens an authorized retest only on its scheduled local date", () => {
    const tomorrow = new Date(2026, 10, 22);
    const retest = {
      status: "Failed - Retest Required",
      score: 6,
      total: 10,
      retestAvailableDate: localDateKey(tomorrow),
      retestAuthorized: true,
    };

    expect(getRetestWindowState(retest, new Date(2026, 10, 21))).toBe("scheduled");
    expect(getRetestWindowState(retest, tomorrow)).toBe("open");
    expect(getRetestWindowState(retest, new Date(2026, 10, 23))).toBe("expired");
    expect(getRetestWindowState({ ...retest, retestAuthorized: false }, tomorrow)).toBe(
      "approval-required",
    );
    expect(nextLocalDateKey(new Date(2026, 10, 21))).toBe(localDateKey(tomorrow));
  });

  it("uses the same academic-day authorization window for module-assessment retakes", () => {
    const tomorrow = new Date(2026, 10, 22);
    const failedAssessment = {
      score: 20,
      total: 30,
      status: "Failed",
      retestAvailableDate: localDateKey(tomorrow),
      retestAuthorized: false,
    };

    expect(getRetestWindowState(failedAssessment, tomorrow)).toBe("approval-required");
    expect(getRetestWindowState({ ...failedAssessment, retestAuthorized: true }, tomorrow)).toBe(
      "open",
    );
    expect(
      getRetestWindowState({ ...failedAssessment, retestAuthorized: true }, new Date(2026, 10, 23)),
    ).toBe("expired");
  });

  it("announces the scheduled date and lecturer authorization for a retest", () => {
    const date = nextLocalDateKey();
    const [notification] = getClassTestNotifications({
      courses: [
        {
          id: 1,
          title: "Module 1: Foundations",
          completed: 1,
          lessons: 1,
          sessions: [{ num: 1, done: true, topic: "Session 1: Introduction" }],
        },
      ],
      classTests: {
        "1-1": {
          score: 6,
          total: 10,
          status: "Failed - Retest Required",
          retestAvailableDate: date,
          retestAuthorized: true,
        },
      },
    });

    expect(notification.title).toBe("Retest scheduled: Session 1");
    expect(notification.message).toContain(formatLocalDateKey(date));
    expect(notification.message).toContain("academic staff authorized");
  });

  it("notifies the student that a failed attempt is awaiting staff approval", () => {
    const date = nextLocalDateKey();
    const [notification] = getClassTestNotifications({
      courses: [
        {
          id: 1,
          title: "Module 1: Foundations",
          completed: 1,
          lessons: 1,
          sessions: [{ num: 1, done: true, topic: "Session 1: Introduction" }],
        },
      ],
      classTests: {
        "1-1": {
          score: 6,
          total: 10,
          status: "Failed - Retest Scheduled",
          retestAvailableDate: date,
          retestAuthorized: false,
        },
      },
    });

    expect(notification.title).toBe("Retest awaiting academic staff approval: Session 1");
    expect(notification.message).toContain("Academic staff approval is required");
    expect(notification.message).toContain(formatLocalDateKey(date));
  });

  it("uses a different question order when given a retest seed", () => {
    expect(lessonTest(1, 1, 123).map((question) => question.q)).not.toEqual(
      lessonTest(1, 1).map((question) => question.q),
    );
  });

  it("preserves the original and retest scores in attempt history", () => {
    const firstAttempt = {
      score: 6,
      total: 10,
      status: "Failed",
      attempts: 1,
      date: "01 Nov 2026",
    };
    const retest = {
      score: 8,
      total: 10,
      status: "Passed",
      attempts: 2,
      date: "02 Nov 2026",
    };

    expect(appendTestAttemptHistory(firstAttempt, retest)).toEqual([
      { attempt: 1, score: 6, total: 10, status: "Failed", date: "01 Nov 2026" },
      { attempt: 2, score: 8, total: 10, status: "Passed", date: "02 Nov 2026" },
    ]);
  });

  it("counts a retry when a saved result has no attempt metadata", () => {
    expect(nextTestAttemptNumber({ score: 6, total: 10, status: "Failed" })).toBe(2);
    expect(nextTestAttemptNumber({ attempts: 2 })).toBe(3);
    expect(nextTestAttemptNumber(null)).toBe(1);
  });

  it("does not pass a test with no questions", () => {
    expect(didPassClassTest(0, 0)).toBe(false);
  });

  it("builds a 30-question assessment distributed across a 40-session module", () => {
    const course = {
      id: 2,
      sessions: Array.from({ length: 40 }, (_, index) => ({ num: index + 1 })),
    };
    const assessment = moduleAssessment(course);

    expect(assessment).toHaveLength(QUESTIONS_PER_MODULE_ASSESSMENT);
    expect(new Set(assessment.map((question) => question.lessonNum)).size).toBe(30);
    expect(assessment[0].lessonNum).toBe(1);
    expect(assessment.at(-1).lessonNum).toBe(39);
    expect(moduleAssessment(course)).toEqual(assessment);
  });

  it("covers every session when a module has fewer than 30 sessions", () => {
    const course = {
      id: 2,
      sessions: [{ num: 1 }, { num: 2 }, { num: 3 }],
    };
    const assessment = moduleAssessment(course);

    expect(assessment).toHaveLength(30);
    for (const session of course.sessions) {
      const lessonQuestions = assessment.filter((question) => question.lessonNum === session.num);
      expect(lessonQuestions).toHaveLength(10);
      expect(lessonQuestions.map(({ q, options, answer }) => ({ q, options, answer }))).toEqual(
        lessonTest(course.id, session.num).map(({ q, options, answer }) => ({
          q,
          options,
          answer,
        })),
      );
    }
  });

  it("migrates the seeded demo assessment score to the new question total", () => {
    const previousUser = { ...USER };
    const previousData = localStorage.getItem("campusly-demo-data");
    const storedData = structuredClone(initialData);
    storedData.moduleAssessments = {
      2: {
        score: 180,
        total: 200,
        status: "Passed",
        attempts: 1,
        date: "16 Nov 2026",
      },
    };

    try {
      setCurrentUser(DEMO_USER);
      localStorage.setItem("campusly-demo-data", JSON.stringify(storedData));

      expect(loadDemoData().moduleAssessments[2]).toMatchObject({
        score: 27,
        total: 30,
        status: "Passed",
      });
    } finally {
      setCurrentUser(previousUser);
      if (previousData === null) {
        localStorage.removeItem("campusly-demo-data");
      } else {
        localStorage.setItem("campusly-demo-data", previousData);
      }
    }
  });

  it("keeps the demo Session 1 test cleared when the student has progressed to Session 7", () => {
    const previousUser = { ...USER };
    const previousData = localStorage.getItem("campusly-demo-data");
    const storedData = structuredClone(initialData);
    storedData.classTests = {};

    try {
      setCurrentUser(DEMO_USER);
      localStorage.setItem("campusly-demo-data", JSON.stringify(storedData));

      const data = loadDemoData();
      const moduleThree = data.courses.find((course) => course.id === 3);

      expect(data.classTests["3-1"].status).toBe("Passed");
      expect(data.classTests["3-7"].status).toBe("Failed - Retest Scheduled");
      expect(getFirstMissingClassTestForModule(moduleThree, data.classTests)?.num).toBe(7);
    } finally {
      setCurrentUser(previousUser);
      if (previousData === null) {
        localStorage.removeItem("campusly-demo-data");
      } else {
        localStorage.setItem("campusly-demo-data", previousData);
      }
    }
  });
});
