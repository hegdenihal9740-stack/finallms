export interface PortalNotification {
  id: string | number;
  kind: string;
  read?: boolean;
  createdAt?: string;
  time?: string;
  title?: string;
  [key: string]: unknown;
}

interface NotificationData {
  notifications?: PortalNotification[];
  classTestNotificationReads?: Record<string, boolean>;
  feeNotificationReads?: Record<string, boolean>;
  batchNotificationReads?: Record<string, boolean>;
  [key: string]: unknown;
}

export function groupNotificationsByDate<T extends PortalNotification>(
  notifications: T[],
  now = new Date(),
) {
  const today: T[] = [];
  const earlier: T[] = [];

  for (const notification of notifications) {
    const timestamp = notification.createdAt ? new Date(notification.createdAt) : null;
    const timeLabel = String(notification.time || "");
    const hasValidTimestamp = timestamp && Number.isFinite(timestamp.getTime());
    const isToday =
      timestamp && hasValidTimestamp
        ? timestamp.toDateString() === now.toDateString()
        : notification.kind === "class-test" ||
          /\b(?:today|just now|\d+\s+(?:second|minute|hour)s?\s+ago)\b/i.test(timeLabel);

    (isToday ? today : earlier).push(notification);
  }

  return [
    { title: "Today" as const, notifications: today },
    { title: "Earlier" as const, notifications: earlier },
  ].filter((group) => group.notifications.length > 0);
}

export function setNotificationReadState<T extends NotificationData>(
  data: T,
  notification: PortalNotification,
  read: boolean,
) {
  const id = String(notification.id);

  if (notification.kind === "class-test") {
    return {
      ...data,
      classTestNotificationReads: { ...data.classTestNotificationReads, [id]: read },
    };
  }
  if (notification.kind === "fee") {
    return {
      ...data,
      feeNotificationReads: { ...data.feeNotificationReads, [id]: read },
    };
  }
  if (notification.kind === "batch-session") {
    return {
      ...data,
      batchNotificationReads: { ...data.batchNotificationReads, [id]: read },
    };
  }

  return {
    ...data,
    notifications: (data.notifications || []).map((item) =>
      item.id === notification.id ? { ...item, read } : item,
    ),
  };
}
