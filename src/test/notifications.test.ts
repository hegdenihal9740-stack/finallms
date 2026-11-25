import { describe, expect, it } from "vitest";

import {
  groupNotificationsByDate,
  setNotificationReadState,
} from "@/campusly/notificationUtils";

describe("notification grouping", () => {
  it("uses recorded creation dates and recognizes recent relative times", () => {
    const now = new Date(2026, 0, 10, 12);
    const groups = groupNotificationsByDate(
      [
        {
          id: "today",
          kind: "result",
          read: false,
          createdAt: new Date(2026, 0, 10, 9).toISOString(),
          time: "Yesterday",
        },
        { id: "recent", kind: "course", read: true, time: "2 hours ago" },
        {
          id: "earlier",
          kind: "course",
          read: true,
          createdAt: new Date(2026, 0, 9, 9).toISOString(),
          time: "2 hours ago",
        },
        { id: "active-test", kind: "class-test", read: false, time: "Ready to take" },
      ],
      now,
    );

    expect(groups).toEqual([
      {
        title: "Today",
        notifications: expect.arrayContaining([
          expect.objectContaining({ id: "today" }),
          expect.objectContaining({ id: "recent" }),
          expect.objectContaining({ id: "active-test" }),
        ]),
      },
      {
        title: "Earlier",
        notifications: [expect.objectContaining({ id: "earlier" })],
      },
    ]);
  });
});

describe("notification read state", () => {
  it.each([
    ["class-test", "classTestNotificationReads", "test-1"],
    ["fee", "feeNotificationReads", "fee-1"],
    ["batch-session", "batchNotificationReads", "batch-1"],
  ])("can undo read state for %s notifications", (kind, readMap, id) => {
    const initialData = {
      notifications: [],
      classTestNotificationReads: {},
      feeNotificationReads: {},
      batchNotificationReads: {},
    };
    const notification = { kind, id };
    const readData = setNotificationReadState(initialData, notification, true);
    const restoredData = setNotificationReadState(readData, notification, false);

    expect(readData).toMatchObject({ [readMap]: { [id]: true } });
    expect(restoredData).toMatchObject({ [readMap]: { [id]: false } });
  });

  it("can undo read state for ordinary notifications", () => {
    const initialData = {
      notifications: [{ id: "result-1", kind: "result", read: false }],
    };
    const notification = { id: "result-1", kind: "result" };

    const readData = setNotificationReadState(initialData, notification, true);
    const restoredData = setNotificationReadState(readData, notification, false);

    expect(readData.notifications[0]?.read).toBe(true);
    expect(restoredData.notifications[0]?.read).toBe(false);
  });
});
