import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Feedback from "@/campusly/Feedback";
import { initialData } from "@/campusly/data";

vi.mock("@/components/auth-provider", () => ({
  useCloudAuth: () => ({ user: null }),
}));

describe("student feedback", () => {
  it("shows course feedback without a course-shift option", () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <Feedback data={{ ...initialData, feedback: [] }} updateData={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("heading", { name: "Course Feedback" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Share your course feedback" })).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /course shift/i })).not.toBeInTheDocument();
  });
});
