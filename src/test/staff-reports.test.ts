import { describe, expect, it } from "vitest";

import {
  buildStaffReportCsv,
  getMissingMarkRecords,
  getPendingRetestCount,
} from "@/campusly/staffReports";

describe("staff academic reports", () => {
  it("reports unpublished or absent marks only for completed modules", () => {
    const expectedMarks = [
      { id: "M1", module: 1, subject: "Foundations" },
      { id: "M2-T", module: 2, subject: "Python", examType: "Theory" },
      { id: "M2-P", module: 2, subject: "Python", examType: "Practical" },
      { id: "M3", module: 3, subject: "Data Science" },
    ];
    const data = {
      courses: [
        { id: 1, completed: 2, lessons: 2 },
        { id: 2, completed: 1, lessons: 1 },
        { id: 3, completed: 1, lessons: 3 },
      ],
      marks: [
        { id: "M1", module: 1, status: "Published" },
        { id: "M2-T", module: 2, examType: "Theory", status: "Pending" },
      ],
    };

    expect(getMissingMarkRecords(data, expectedMarks)).toEqual([
      {
        module: 2,
        subject: "Python",
        examType: "Theory",
        status: "Pending",
      },
      {
        module: 2,
        subject: "Python",
        examType: "Practical",
        status: "Missing",
      },
    ]);
  });

  it("counts failed class tests and assessments but excludes passed attempts", () => {
    expect(
      getPendingRetestCount({
        classTests: {
          failed: { score: 6, total: 10, status: "Failed - Retest Scheduled" },
          passed: { score: 8, total: 10, status: "Passed" },
        },
        moduleAssessments: {
          failed: { score: 20, total: 30, status: "Failed" },
          passed: { score: 27, total: 30, status: "Passed" },
        },
      }),
    ).toBe(2);
  });

  it("does not count an old failed test after a later session test passed", () => {
    expect(
      getPendingRetestCount({
        courses: [{
          id: 3,
          sessions: [
            { num: 1, done: true },
            { num: 2, done: true },
          ],
        }],
        classTests: {
          "3-1": { score: 6, total: 10, status: "Failed - Retest Scheduled" },
          "3-2": { score: 8, total: 10, status: "Passed" },
        },
        moduleAssessments: {},
      }),
    ).toBe(0);
  });

  it("quotes CSV fields and protects spreadsheet formula-like values", () => {
    const csv = buildStaffReportCsv([
      {
        studentName: "=HYPERLINK(\"https://example.test\")",
        email: "\t=1+1",
        batchName: 'Batch "A"',
        modulesCompleted: 1,
        modulesTotal: 3,
        pendingRetests: 0,
        missingMarks: 1,
        missingMarkItems: "Module 1, Theory",
        sessionsCompleted: 2,
        sessionsTotal: 4,
      },
    ]);

    expect(csv).toContain(`"'=HYPERLINK(""https://example.test"")"`);
    expect(csv).toContain(`"'\t=1+1"`);
    expect(csv).toContain(`"Batch ""A"""`);
    expect(csv).toContain(`"Module 1, Theory"`);
  });
});
