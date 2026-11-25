import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { formatLocalDateKey, getRetestWindowState } from "./classTests.ts";

export default function RetestAction({ result, isAssessment, onRetake, onRequestAuthorization }) {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const now = new Date();
    const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = window.setTimeout(
      () => setToday(new Date()),
      Math.max(100, nextDay.getTime() - now.getTime()),
    );
    return () => window.clearTimeout(timer);
  }, [today]);

  const state = getRetestWindowState(result, today);
  const date = result.retestAvailableDate || result.retestDate;
  const dateLabel = date ? formatLocalDateKey(date) : null;
  const waitingForReauthorization = state === "expired" && result.retestApprovalRequested;
  const title =
    state === "open"
      ? "Retest approved · available today"
      : state === "scheduled"
        ? `Retest approved · available ${dateLabel}`
        : state === "expired"
          ? waitingForReauthorization
            ? "Re-authorization requested"
            : "Retest window expired"
          : "Waiting for academic staff approval";
  const detail =
    state === "open"
      ? "Complete your retest today. You need at least 75% to pass."
      : state === "scheduled"
        ? "Your lecturer has approved this retest. The button will be available on the scheduled academic day."
        : state === "expired"
          ? waitingForReauthorization
            ? "Your re-authorization request is in the academic staff queue. The retest button will activate after approval."
            : "Request lecturer re-authorization to open a new retest window."
          : dateLabel
            ? `Your result has been recorded. Academic staff can approve your retest for ${dateLabel}; you'll receive a portal notification when it's approved.`
            : "Your result has been recorded. Academic staff must schedule and approve your retest; you'll receive a portal notification when it's approved.";
  const action =
    state === "open" ? (
      <button className="primary-button" type="button" onClick={onRetake}>
        {isAssessment ? "Retake assessment" : "Retake test"}
      </button>
    ) : state === "expired" && !waitingForReauthorization && onRequestAuthorization ? (
      <button className="secondary-button" type="button" onClick={onRequestAuthorization}>
        Request re-authorization
      </button>
    ) : (
      <button className="secondary-button" type="button" disabled>
        {state === "scheduled"
          ? `Available ${dateLabel}`
          : waitingForReauthorization
            ? "Request sent"
            : "Waiting for staff approval"}
      </button>
    );

  return (
    <section className="notice-card retest-action-card" aria-live="polite">
      <Clock3 size={19} />
      <div className="retest-action-copy">
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      {action}
    </section>
  );
}
