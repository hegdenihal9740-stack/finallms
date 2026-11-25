import { fireEvent, render } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import SessionQuestMap, { buildQuestLayout } from "@/campusly/SessionQuestMap";

const makeSessions = (count: number, doneCount: number) =>
  Array.from({ length: count }, (_, i) => ({
    num: i + 1,
    topic: `Session ${i + 1}: topic ${i + 1}`,
    done: i < doneCount,
  }));

it("draws the moving dashed lane line only up to the current session", () => {
  const sessions = makeSessions(6, 2);
  const { container } = render(
    <SessionQuestMap
      moduleId={1}
      sessions={sessions}
      completed={2}
      moduleState="Current"
      onOpenSession={vi.fn()}
    />,
  );

  const lane = container.querySelector(".sq-road-lane");
  const progress = container.querySelector(".sq-progress");
  const bed = container.querySelector(".sq-road-bed");

  expect(lane).not.toBeNull();
  // jsdom reports clientWidth 0, so the component falls back to its 300px floor.
  const layout = buildQuestLayout(sessions.length, 300);
  // Two completed sessions + the next session = 3 stops from the start flag.
  expect(lane?.getAttribute("d")).toBe(layout.pathTo(3));
  expect(lane?.getAttribute("d")).toBe(progress?.getAttribute("d"));
  expect(lane?.getAttribute("d")).not.toBe(bed?.getAttribute("d"));
  expect(container.querySelector(".sq-stop.is-next")).not.toBeNull();
  expect(container.querySelector(".sq-here")).toBeNull();
});

it("does not draw the lane line across the whole road when sessions are unfinished", () => {
  const sessions = makeSessions(6, 2);
  const { container } = render(
    <SessionQuestMap
      moduleId={1}
      sessions={sessions}
      completed={2}
      moduleState="Current"
      onOpenSession={vi.fn()}
    />,
  );

  const layout = buildQuestLayout(sessions.length, 300);
  const lane = container.querySelector(".sq-road-lane");
  const finishY = layout.finish.y;

  expect(lane?.getAttribute("d")).not.toContain(String(finishY));
});

it("does not mark an unstarted available module as the current location", () => {
  const sessions = makeSessions(6, 0);
  const { container } = render(
    <SessionQuestMap
      moduleId={6}
      sessions={sessions}
      completed={0}
      moduleState="Available"
      onOpenSession={vi.fn()}
    />,
  );

  expect(container.querySelector(".sq-here")).toBeNull();
  expect(container.querySelector(".sq-stop.is-next")).toBeNull();
});

it("allows previewing sessions in a future locked module without marking a current session", () => {
  const sessions = makeSessions(3, 0);
  const onOpenSession = vi.fn();
  const { container } = render(
    <SessionQuestMap
      moduleId={6}
      sessions={sessions}
      completed={0}
      moduleState="Locked"
      onOpenSession={onOpenSession}
    />,
  );

  expect(container.querySelector(".sq-here")).toBeNull();
  const firstSession = container.querySelector<HTMLButtonElement>(".sq-stop-button");
  expect(firstSession?.disabled).toBe(false);
  if (!firstSession) throw new Error("Expected the first session button");
  fireEvent.click(firstSession);
  expect(onOpenSession).toHaveBeenCalledWith(
    expect.objectContaining({ num: 1, status: "Locked" }),
  );
});
