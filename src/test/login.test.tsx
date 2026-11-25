import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Login } from "@/campusly/App";
import { DEMO_USER } from "@/campusly/data";
import { sendPasswordReset, signInWithEmail } from "@/campusly/cloudAuth";
import { DEMO_PASSWORD_KEY, hashStudentPassword } from "@/campusly/studentOnboarding";

vi.mock("@/campusly/NeuralBackground.tsx", () => ({
  default: () => null,
}));

vi.mock("@/campusly/cloudAuth", () => ({
  sendPasswordReset: vi.fn().mockResolvedValue({ error: null }),
  signInWithEmail: vi.fn().mockResolvedValue({ error: null }),
}));

afterEach(() => {
  cleanup();
  localStorage.removeItem(DEMO_PASSWORD_KEY);
  vi.restoreAllMocks();
});

describe("student login", () => {
  it("keeps the sign-in button stationary when the pointer moves", () => {
    render(<Login onLogin={vi.fn()} previewMode={false} />);

    const dock = screen.getByRole("group", { name: "Sign-in action" });
    const button = screen.getByRole("button", { name: "Sign in" });
    fireEvent.pointerMove(dock, { pointerType: "mouse", clientX: 180, clientY: 34 });
    expect(button.style.getPropertyValue("--login-cta-x")).toBe("");
    expect(dock).not.toHaveClass("is-displaced");

    fireEvent.change(screen.getByLabelText("Email address or demo registration number"), {
      target: { value: "MBD-2026-0148" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "student123" },
    });

    expect(dock).toHaveClass("is-unlocked");
    expect(dock).not.toHaveClass("is-displaced");
    fireEvent.pointerMove(dock, { pointerType: "mouse", clientX: 180, clientY: 34 });
    expect(button.style.getPropertyValue("--login-cta-x")).toBe("");
  });

  it("recovers demo sign-in when an older saved password conflicts with the default", async () => {
    const onLogin = vi.fn();
    localStorage.setItem(DEMO_PASSWORD_KEY, await hashStudentPassword("ChangedPass1!"));
    render(<Login onLogin={onLogin} previewMode={false} />);

    fireEvent.change(screen.getByLabelText("Email address or demo registration number"), {
      target: { value: DEMO_USER.email },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: DEMO_USER.password },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith({ ...DEMO_USER });
    });
    expect(localStorage.getItem(DEMO_PASSWORD_KEY)).toBeNull();
  });

  it("sends non-demo email sign-in to Supabase", async () => {
    render(<Login onLogin={vi.fn()} previewMode={false} />);

    fireEvent.change(screen.getByLabelText("Email address or demo registration number"), {
      target: { value: "student@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(signInWithEmail).toHaveBeenCalledWith("student@example.com", "password");
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps email available for password reset", async () => {
    render(<Login onLogin={vi.fn()} previewMode={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "student@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(sendPasswordReset).toHaveBeenCalledWith("student@example.com");
    expect(await screen.findByText(/If an account exists for this email/)).toHaveTextContent(
      "you’ll receive a reset link",
    );
  });
});
