import { isClassTestPassed } from "./classTests.ts";
import { isClassTestFailureClearedByProgress } from "./data.ts";

export function getMissingMarkRecords(data, expectedMarks = []) {
  const completedModules = new Set(
    (data?.courses || [])
      .filter(
        (course) =>
          Number(course.lessons) > 0 &&
          Number(course.completed || 0) >= Number(course.lessons),
      )
      .map((course) => Number(course.id)),
  );
  const studentMarks = data?.marks || [];

  return expectedMarks
    .filter((mark) => completedModules.has(Number(mark.module)))
    .flatMap((expected) => {
      const actual =
        studentMarks.find((mark) => mark.id === expected.id) ??
        studentMarks.find(
          (mark) =>
            Number(mark.module) === Number(expected.module) &&
            (mark.examType || "") === (expected.examType || ""),
        );
      if (actual?.status === "Published") return [];
      return [{
        module: Number(expected.module),
        subject: expected.subject,
        examType: expected.examType || "Module Final",
        status: actual?.status || "Missing",
      }];
    });
}

export function getPendingRetestCount(data) {
  const classTestCount = Object.entries(data?.classTests || {}).filter(
    ([key, result]) => {
      const [module, lesson] = key.split("-");
      const course = data?.courses?.find((item) => Number(item.id) === Number(module));
      return (
        !isClassTestPassed(result) &&
        !isClassTestFailureClearedByProgress(course, lesson, data?.classTests)
      );
    },
  ).length;
  const assessmentCount = Object.values(data?.moduleAssessments || {}).filter(
    (result) => !isClassTestPassed(result),
  ).length;
  return classTestCount + assessmentCount;
}

export function getStaffAcademicSummary(data, expectedMarks = []) {
  const courses = data?.courses || [];
  return {
    hasRecord: Boolean(data),
    modulesCompleted: courses.filter(
      (course) =>
        Number(course.lessons) > 0 &&
        Number(course.completed || 0) >= Number(course.lessons),
    ).length,
    modulesTotal: courses.length,
    pendingRetests: getPendingRetestCount(data),
    missingMarkRecords: getMissingMarkRecords(data, expectedMarks),
  };
}

export function buildStaffReportCsv(rows) {
  const headers = [
    "Student",
    "Email",
    "Batch",
    "Modules completed",
    "Modules total",
    "Pending retests",
    "Missing marks",
    "Missing mark items",
    "Academic record",
    "Sessions completed",
    "Sessions total",
  ];
  const cell = (value) => {
    let text = String(value ?? "");
    let firstContentIndex = 0;
    while (firstContentIndex < text.length && text.charCodeAt(firstContentIndex) <= 0x20) {
      firstContentIndex += 1;
    }
    const firstContentCharacter = text[firstContentIndex];
    if (firstContentCharacter && "=+-@".includes(firstContentCharacter)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const values = rows.map((row) => [
    row.studentName,
    row.email,
    row.batchName,
    row.modulesCompleted,
    row.modulesTotal,
    row.pendingRetests,
    row.missingMarks,
    row.missingMarkItems,
    row.academicRecord,
    row.sessionsCompleted,
    row.sessionsTotal,
  ]);
  return `\uFEFF${[headers, ...values].map((row) => row.map(cell).join(",")).join("\r\n")}`;
}
