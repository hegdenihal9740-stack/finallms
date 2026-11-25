import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminPortal } from "@/campusly/BatchSystem";
import { localDateKey } from "@/campusly/classTests";

beforeEach(() => {
  localStorage.clear();
});

describe("admin retest and class reports", () => {
  it("filters retests across students and records staff authorization", () => {
    localStorage.setItem(
      "campusly-demo-data",
      JSON.stringify({
        classTests: {
          "3-7": {
            score: 6,
            total: 10,
            status: "Failed - Retest Scheduled",
            retestAvailableDate: localDateKey(),
            retestAuthorized: false,
            retestApprovalRequested: true,
          },
        },
        moduleAssessments: {},
        notifications: [],
      }),
    );
    render(<AdminPortal user={{ name: "Academic Staff" }} onLogout={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Re-exams" }));

    expect(screen.getAllByText("Nihal Hegde")).toHaveLength(2);
    expect(screen.getByText("Student request received")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Retest status"), {
      target: { value: "open" },
    });
    expect(screen.getByText("No class-test retests match these filters.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Retest status"), {
      target: { value: "all" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Authorize today" }));

    expect(screen.getByRole("button", { name: "Authorized" })).toBeInTheDocument();
    expect(
      JSON.parse(localStorage.getItem("campusly-demo-data") || "{}").classTests["3-7"]
        .retestAuthorized,
    ).toBe(true);
  });

  it("filters class reports to completed modules with missing marks", () => {
    localStorage.setItem(
      "campusly-demo-data",
      JSON.stringify({
        courses: [{ id: 1, completed: 1, lessons: 1 }],
        marks: [],
        classTests: {},
        moduleAssessments: {},
        notifications: [],
      }),
    );
    render(<AdminPortal user={{ name: "Academic Staff" }} onLogout={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Reports" }));
    fireEvent.change(screen.getByLabelText("Needs attention"), {
      target: { value: "missing-marks" },
    });

    expect(screen.getByText("Module 1 · Module Final")).toBeInTheDocument();
    expect(screen.getByText("Nihal Hegde")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export filtered CSV" })).toBeEnabled();
  });
});
