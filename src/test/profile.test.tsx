import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StudentProfile from "@/campusly/Profile";
import { DEMO_USER, setCurrentUser } from "@/campusly/data";
import { DEMO_PASSWORD_KEY, verifyStudentPassword } from "@/campusly/studentOnboarding";

const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, String(value)),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
};

beforeEach(() => {
  storage.clear();
  vi.stubGlobal("localStorage", localStorageMock);
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("isSecureContext", true);
  setCurrentUser({ ...DEMO_USER });
});

afterEach(() => {
  cleanup();
  storage.clear();
  setCurrentUser({ ...DEMO_USER });
  vi.unstubAllGlobals();
});

describe("student profile settings", () => {
  it("saves per-category portal reminder preferences without calendar alarms", () => {
    const updateData = vi.fn();
    render(<StudentProfile data={{}} updateData={updateData} />);

    fireEvent.click(screen.getByRole("tab", { name: /reminders/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Exam reminders" }));

    expect(updateData).toHaveBeenCalledTimes(1);
    const update = updateData.mock.calls[0][0];
    expect(update({})).toMatchObject({
      reminderPreferences: {
        classes: true,
        assignments: true,
        exams: false,
        tests: true,
        fees: true,
        leadMinutes: 15,
        browserAlerts: false,
      },
    });
    expect(screen.queryByLabelText("Calendar alarm")).not.toBeInTheDocument();
    expect(screen.getByText(/Assignment alerts will appear when your institute connects its assignment feed/)).toBeInTheDocument();
    expect(screen.getByLabelText("Remind me before an event")).toHaveValue("15");
  });

  it("requests browser notification permission before enabling browser alerts", async () => {
    const requestPermission = vi.fn().mockResolvedValue("granted");
    const updateData = vi.fn();
    vi.stubGlobal("Notification", { permission: "default", requestPermission });
    render(<StudentProfile data={{}} updateData={updateData} />);

    fireEvent.click(screen.getByRole("tab", { name: /reminders/i }));
    fireEvent.click(screen.getByRole("button", { name: "Enable browser alerts" }));

    await waitFor(() => expect(requestPermission).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(updateData).toHaveBeenCalledTimes(1));
    expect(updateData.mock.calls[0][0]({})).toMatchObject({
      reminderPreferences: { browserAlerts: true },
    });
  });

  it("allows students to update and save their personal information", async () => {
    render(<StudentProfile updateData={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit information" }));
    fireEvent.change(screen.getByLabelText("Phone Number"), {
      target: { value: "+91 9876543210" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save information" }));

    await waitFor(() => {
      const savedProfile = JSON.parse(localStorage.getItem("campusly-demo-profile") || "{}");
      expect(savedProfile.phone).toBe("+91 9876543210");
    });
  });

  it("changes the demo password only after verifying the current password", async () => {
    render(<StudentProfile />);
    fireEvent.click(screen.getByRole("tab", { name: /security/i }));
    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "incorrect-password" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("Your current password is incorrect.")).toBeInTheDocument();
    expect(localStorage.getItem(DEMO_PASSWORD_KEY)).toBeNull();

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: DEMO_USER.password },
    });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));

    await waitFor(async () => {
      const savedHash = localStorage.getItem(DEMO_PASSWORD_KEY);
      expect(savedHash).not.toBeNull();
      expect(await verifyStudentPassword("StrongPass1!", savedHash!)).toBe(true);
    });
    expect(await screen.findByText("Your password has been changed.")).toBeInTheDocument();
  });
});
