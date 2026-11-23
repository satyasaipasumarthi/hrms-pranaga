// [ticket-management] Ticket alerts shown in the notification bell (table: ticket_notifications).
import { supabase } from "@/lib/supabase";
import type { TicketNotification } from "../types";
import { fail } from "./shared";

export const fetchNotifications = async (): Promise<TicketNotification[]> => {
  const { data, error } = await supabase
    .from("ticket_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) fail(error, "fetch notifications");
  return (data ?? []).map((row) => ({
    id: row.id,
    ticketId: row.ticket_id ?? null,
    kind: row.kind,
    title: row.title,
    body: row.body ?? null,
    readAt: row.read_at ?? null,
    createdAt: row.created_at,
  }));
};

export const markNotificationsRead = async (ids: string[]) => {
  if (!ids.length) return;
  const { error } = await supabase.from("ticket_notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
  if (error) fail(error, "mark notifications read");
};
