import type { AuthUser } from "@/lib/roles";
import { parseAttendanceDateValue } from "@/lib/attendance";
import type { PermissionMap } from "@/lib/permissions";
import {
  fetchAttendanceRecords,
  fetchLeaveRecords,
  fetchPersonalKudos,
  fetchWallOfFameKudos,
  type AttendanceRecord,
  type KudosRecord,
  type LeaveRecord,
} from "@/lib/hrms-api";

export type NotificationKind = "check-in" | "check-out" | "leave" | "kudos";

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  /** Person the notification is about. */
  actor: string;
  /** What happened, written to follow the actor's name. */
  message: string;
  /** Extra line such as leave dates or the kudos message. */
  detail: string | null;
  /** Epoch milliseconds of the event, used for sorting and unread state. */
  timestamp: number;
}

export const MAX_NOTIFICATIONS = 30;

// Database timestamps can arrive without a timezone suffix and are UTC, so they
// must go through the shared parser; plain `new Date()` would read them as local
// time and shift them by the UTC offset.
const toTimestamp = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = parseAttendanceDateValue(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

export const buildNotifications = (
  attendance: AttendanceRecord[],
  leaves: LeaveRecord[],
  kudos: KudosRecord[],
): NotificationItem[] => {
  const items: NotificationItem[] = [];

  attendance.forEach((record) => {
    const checkedInAt = toTimestamp(record.checkInIso);
    if (checkedInAt !== null) {
      items.push({
        id: `check-in-${record.id}`,
        kind: "check-in",
        actor: record.employeeName,
        message: "checked in",
        detail: null,
        timestamp: checkedInAt,
      });
    }

    const checkedOutAt = toTimestamp(record.checkOutIso);
    if (checkedOutAt !== null) {
      items.push({
        id: `check-out-${record.id}`,
        kind: "check-out",
        actor: record.employeeName,
        message: "checked out",
        detail: record.totalHours ? `Worked ${record.totalHours}` : null,
        timestamp: checkedOutAt,
      });
    }
  });

  leaves.forEach((record) => {
    // Older rows may lack created_at; fall back to the leave start date.
    const appliedAt = toTimestamp(record.createdAt) ?? toTimestamp(record.from);
    if (appliedAt === null) return;

    const dates =
      record.from === record.to ? record.from : `${record.from} to ${record.to}`;

    items.push({
      id: `leave-${record.id}`,
      kind: "leave",
      actor: record.employeeName,
      message: `applied for ${record.type}`,
      detail: `${dates} · ${record.status}`,
      timestamp: appliedAt,
    });
  });

  kudos.forEach((record) => {
    const receivedAt = toTimestamp(record.createdAt);
    if (receivedAt === null) return;

    items.push({
      id: `kudos-${record.id}`,
      kind: "kudos",
      actor: record.toName,
      message: `received appreciation from ${record.fromName}`,
      detail: record.message ? `"${record.message}"` : null,
      timestamp: receivedAt,
    });
  });

  return items
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_NOTIFICATIONS);
};

/**
 * Loads everything the bell shows. Each source is fetched independently so one
 * failing (or forbidden) module does not hide the others.
 */
export const fetchNotifications = async (
  user: AuthUser,
  permissions: PermissionMap,
): Promise<NotificationItem[]> => {
  const [attendance, leaves, kudos] = await Promise.all([
    fetchAttendanceRecords(user, permissions).catch((error) => {
      console.error("Failed to load attendance notifications:", error);
      return [] as AttendanceRecord[];
    }),
    fetchLeaveRecords(user, permissions).catch((error) => {
      console.error("Failed to load leave notifications:", error);
      return [] as LeaveRecord[];
    }),
    fetchWallOfFameKudos()
      .catch(() => fetchPersonalKudos(user))
      .catch((error) => {
        console.error("Failed to load kudos notifications:", error);
        return [] as KudosRecord[];
      }),
  ]);

  return buildNotifications(attendance, leaves, kudos);
};

/** Shows the actual clock time of the event, e.g. "Today, 10:42 AM". */
export const formatNotificationTime = (timestamp: number, now = Date.now()) => {
  const eventDate = new Date(timestamp);
  const time = eventDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const dayDifference = Math.round(
    (startOfDay(new Date(now)) - startOfDay(eventDate)) / 86400000,
  );

  if (dayDifference === 0) return `Today, ${time}`;
  if (dayDifference === 1) return `Yesterday, ${time}`;

  const day = eventDate.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    ...(eventDate.getFullYear() === new Date(now).getFullYear() ? {} : { year: "numeric" }),
  });
  return `${day}, ${time}`;
};
