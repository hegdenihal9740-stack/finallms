import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CertificateRequest from "@/campusly/CertificateRequest";

describe("certificate requests", () => {
  it("keeps the request locked until all course modules are complete", () => {
    const data = {
      courses: [
        { id: 1, completed: 2, lessons: 2 },
        { id: 2, completed: 1, lessons: 3 },
      ],
      certRequests: [],
    };
    const updateData = vi.fn();

    render(<CertificateRequest data={data} updateData={updateData} />);

    expect(screen.getByText("Complete every course module to unlock your certificate request.")).toBeInTheDocument();
    const requestButton = screen.getByRole("button", { name: "Complete course first" });
    expect(requestButton).toBeDisabled();
    fireEvent.click(requestButton);

    expect(updateData).not.toHaveBeenCalled();
  });

  it("unlocks the request when every course module is complete", () => {
    const data = {
      courses: [
        { id: 1, completed: 2, lessons: 2 },
        { id: 2, completed: 3, lessons: 3 },
      ],
      certRequests: [],
    };
    const updateData = vi.fn();

    render(<CertificateRequest data={data} updateData={updateData} />);
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    expect(screen.getByRole("status")).toHaveTextContent(/Application CA-/);
    expect(updateData).toHaveBeenCalledOnce();
    const update = updateData.mock.calls[0][0];
    expect(update(data).certRequests).toHaveLength(1);
  });

  it("keeps a second request locked while an earlier request is pending", () => {
    const data = {
      courses: [{ id: 1, completed: 2, lessons: 2 }],
      certRequests: [{ id: "CA-2026-001", status: "Pending", date: "23 Nov 2026" }],
    };

    render(<CertificateRequest data={data} updateData={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Request pending" })).toBeDisabled();
  });
});
