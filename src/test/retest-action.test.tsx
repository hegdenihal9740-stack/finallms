import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import RetestAction from "@/campusly/RetestAction";

afterEach(() => {
  vi.useRealTimers();
});

describe("student retest action", () => {
  it("shows that staff are notified and keeps the retake disabled until approval", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 22, 12));
    render(
      <RetestAction
        result={{
          score: 6,
          total: 10,
          status: "Failed - Retest Scheduled",
          retestAvailableDate: "2026-11-23",
          retestAuthorized: false,
        }}
        isAssessment={false}
        onRetake={vi.fn()}
      />,
    );

    expect(screen.getByText("Waiting for staff approval")).toBeDisabled();
    expect(
      screen.getByText(/Your result has been recorded/),
    ).toBeInTheDocument();
  });

  it("activates a lecturer-approved retest at the start of its academic day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 22, 23, 59, 50));
    const onRetake = vi.fn();
    render(
      <RetestAction
        result={{
          score: 6,
          total: 10,
          status: "Failed - Retest Scheduled",
          retestAvailableDate: "2026-11-23",
          retestAuthorized: true,
        }}
        isAssessment={false}
        onRetake={onRetake}
      />,
    );

    expect(screen.getByRole("button", { name: /Available/ })).toBeDisabled();
    act(() => {
      vi.advanceTimersByTime(11_000);
    });

    const retakeButton = screen.getByRole("button", { name: "Retake test" });
    expect(retakeButton).toBeEnabled();
    fireEvent.click(retakeButton);
    expect(onRetake).toHaveBeenCalledOnce();
  });
});
