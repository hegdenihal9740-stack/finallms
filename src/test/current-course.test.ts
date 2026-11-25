import { describe, expect, it } from "vitest";

import {
  getClassTestGrandfatheredThrough,
  getCurrentCourse,
  getFirstMissingClassTestForModule,
  initialData,
} from "@/campusly/data";

describe("current course selection", () => {
  it("selects the student's in-progress module", () => {
    expect(getCurrentCourse(initialData.courses)?.id).toBe(3);
  });

  it("falls back to the latest module after all modules are complete", () => {
    const completedCourses = initialData.courses.map((course) => ({
      ...course,
      completed: course.lessons,
    }));

    expect(getCurrentCourse(completedCourses)?.id).toBe(10);
  });

  it("handles a student with no courses", () => {
    expect(getCurrentCourse([])).toBeNull();
  });

  it("does not block the next module on a completed module's test results", () => {
    const courses = [
      {
        id: 1,
        completed: 2,
        lessons: 2,
        sessions: [
          { num: 1, done: true },
          { num: 2, done: true },
        ],
      },
      {
        id: 2,
        completed: 1,
        lessons: 1,
        sessions: [{ num: 1, done: true }],
      },
    ];

    expect(getCurrentCourse(courses, {}, 0)?.id).toBe(2);
    expect(
      getCurrentCourse(
        courses,
        {
          "1-1": { score: 8, total: 10, status: "Failed - Retest Required" },
          "1-2": { score: 8, total: 10, status: "Passed" },
        },
        0,
      )?.id,
    ).toBe(2);
    expect(
      getCurrentCourse(
        courses,
        {
          "1-1": { score: 8, total: 10, status: "Passed" },
          "1-2": { score: 8, total: 10, status: "Passed" },
        },
        0,
      )?.id,
    ).toBe(2);
  });

  it("grandfathers modules completed before test progression was enabled", () => {
    const grandfatheredThroughModule = getClassTestGrandfatheredThrough({
      courses: initialData.courses,
    });

    expect(grandfatheredThroughModule).toBe(2);
    expect(getCurrentCourse(initialData.courses, {}, grandfatheredThroughModule)?.id).toBe(3);
  });

  it("does not block on a recorded failure in a grandfathered module", () => {
    const courses = [
      {
        id: 1,
        completed: 1,
        lessons: 1,
        sessions: [
          { num: 1, done: true },
          { num: 2, done: false },
        ],
      },
      {
        id: 2,
        completed: 0,
        lessons: 1,
        sessions: [{ num: 1, done: false }],
      },
    ];

    expect(
      getCurrentCourse(
        courses,
        { "1-1": { score: 6, total: 10, status: "Failed - Retest Required" } },
        1,
      )?.id,
    ).toBe(2);
    expect(getCurrentCourse(courses, {}, 1)?.id).toBe(2);
  });

  it("holds progression until the completed module assessment is passed", () => {
    const courses = [
      { id: 1, completed: 2, lessons: 2, sessions: [] },
      { id: 2, completed: 0, lessons: 2, sessions: [] },
    ];

    expect(getCurrentCourse(courses, {}, 0, {})?.id).toBe(1);
    expect(getCurrentCourse(courses, {}, 0, { 1: { score: 2, total: 4 } })?.id).toBe(1);
    expect(getCurrentCourse(courses, {}, 0, { 1: { score: 3, total: 4 } })?.id).toBe(2);
  });

  it("unlocks completed-session tests in order after each submission", () => {
    const course = {
      id: 3,
      sessions: [
        { num: 1, done: true },
        { num: 2, done: true },
        { num: 3, done: true },
        { num: 4, done: false },
      ],
    };

    expect(getFirstMissingClassTestForModule(course, {})?.num).toBe(1);
    expect(
      getFirstMissingClassTestForModule(course, {
        "3-1": { score: 8, total: 10, status: "Failed - Retest Required" },
      })?.num,
    ).toBe(1);
    expect(
      getFirstMissingClassTestForModule(course, {
        "3-1": { score: 8, total: 10, status: "Passed" },
        "3-2": { score: 8, total: 10, status: "Passed" },
      })?.num,
    ).toBe(3);
  });
});
