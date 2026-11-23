import type { AuthUser } from "@/lib/roles";
import { parseAttendanceDateValue } from "@/lib/attendance";
import type { PermissionMap } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";
import { fetchNotifications as fetchTicketNotifications, markNotificationsRead as markTicketNotificationsRead } from "@/pages/tickets/api"; // [ticket-management]
import type { TicketNotification } from "@/pages/tickets/types"; // [ticket-management]
import {
  fetchAttendanceRecords,
  fetchLeaveRecords,
  fetchPersonalKudos,
  fetchWallOfFameKudos,
  type AttendanceRecord,
  type KudosRecord,
  type LeaveRecord,
} from "@/lib/hrms-api";

export type NotificationKind = "check-in" | "check-out" | "leave" | "kudos" | "ticket";

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
  /** Ticket notifications only: the ticket to open and the row to mark as read. */
  ticketId?: string | null;
  ticketNotificationId?: string;
  ticketRead?: boolean;
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

interface TeamAttendanceRow {
  id: string;
  user_id: string;
  name: string;
  check_in: string | null;
  check_out: string | null;
}

const formatWorked = (from: number, to: number) => {
  const minutes = Math.max(0, Math.round((to - from) / 60000));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
};

/**
 * Everyone's check-ins and check-outs (team_attendance_feed RPC, see supabase/team-attendance-feed.sql).
 * Returns null when the function is not installed yet so the caller can fall back to the permission-scoped list.
 */
const fetchTeamAttendanceRows = async (): Promise<TeamAttendanceRow[] | null> => {
  const { data, error } = await supabase.rpc("team_attendance_feed", { days_back: 7 });
  if (error) {
    console.warn("team_attendance_feed unavailable, showing only the attendance you have access to:", error.message);
    return null;
  }
  return (data ?? []) as TeamAttendanceRow[];
};

const buildTeamAttendanceItems = (rows: TeamAttendanceRow[]): NotificationItem[] => {
  const items: NotificationItem[] = [];
  rows.forEach((row) => {
    const checkedInAt = toTimestamp(row.check_in);
    const checkedOutAt = toTimestamp(row.check_out);
    if (checkedInAt !== null) {
      items.push({ id: `check-in-${row.id}`, kind: "check-in", actor: row.name, message: "checked in", detail: null, timestamp: checkedInAt });
    }
    if (checkedOutAt !== null) {
      items.push({
        id: `check-out-${row.id}`,
        kind: "check-out",
        actor: row.name,
        message: "checked out",
        detail: checkedInAt !== null ? `Worked ${formatWorked(checkedInAt, checkedOutAt)}` : null,
        timestamp: checkedOutAt,
      });
    }
  });
  return items;
};

// [ticket-management] Ticket alerts (assigned, mentioned, raised, deadline, escalation...) share this bell.
const MAX_TICKET_NOTIFICATIONS = 20;

const toTicketItems = (rows: TicketNotification[]): NotificationItem[] =>
  rows.slice(0, MAX_TICKET_NOTIFICATIONS).flatMap((row) => {
    const timestamp = toTimestamp(row.createdAt);
    if (timestamp === null) return [];
    return [
      {
        id: `ticket-${row.id}`,
        kind: "ticket" as const,
        actor: "",
        message: row.title,
        detail: row.body,
        timestamp,
        ticketId: row.ticketId,
        ticketNotificationId: row.id,
        ticketRead: Boolean(row.readAt),
      },
    ];
  });

/** Marks the ticket notifications in the list as read in the database (the unread dot uses timestamps). */
export const markTicketNotificationsSeen = async (items: NotificationItem[]) => {
  const ids = items.filter((item) => item.ticketNotificationId && !item.ticketRead).map((item) => item.ticketNotificationId!);
  if (!ids.length) return;
  await markTicketNotificationsRead(ids).catch((error) => console.error("Failed to mark ticket notifications read:", error));
};

/**
 * Loads everything the bell shows. Each source is fetched independently so one
 * failing (or forbidden) module does not hide the others.
 */
export const fetchNotifications = async (
  user: AuthUser,
  permissions: PermissionMap,
): Promise<NotificationItem[]> => {
  const [teamAttendance, leaves, kudos, ticketRows] = await Promise.all([
    fetchTeamAttendanceRows().catch((error) => {
      console.error("Failed to load team attendance:", error);
      return null;
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
    fetchTicketNotifications().catch((error) => {
      console.error("Failed to load ticket notifications:", error);
      return [] as TicketNotification[];
    }), // [ticket-management]
  ]);

  // Everyone's check-ins when the feed is installed, otherwise only what this role may read.
  const attendance = teamAttendance
    ? ([] as AttendanceRecord[])
    : await fetchAttendanceRecords(user, permissions).catch((error) => {
        console.error("Failed to load attendance notifications:", error);
        return [] as AttendanceRecord[];
      });

  const others = [...buildNotifications(attendance, leaves, kudos), ...(teamAttendance ? buildTeamAttendanceItems(teamAttendance) : [])]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_NOTIFICATIONS);

  return [...others, ...toTicketItems(ticketRows)].sort((a, b) => b.timestamp - a.timestamp);
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
