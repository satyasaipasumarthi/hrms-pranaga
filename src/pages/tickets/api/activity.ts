// [ticket-management] Activity history of a ticket (table: ticket_activity).
import { supabase } from "@/lib/supabase";
import type { TicketActivity } from "../types";
import { fail } from "./shared";

export const logActivity = async (ticketId: string, actor: string, text: string) => {
  const { error } = await supabase.from("ticket_activity").insert({ ticket_id: ticketId, actor_name: actor, text });
  if (error) console.warn("[tickets] log activity", error);
};

export const fetchActivity = async (ticketId: string): Promise<TicketActivity[]> => {
  const { data, error } = await supabase.from("ticket_activity").select("*").eq("ticket_id", ticketId).order("created_at");
  if (error) fail(error, "fetch activity");
  return (data ?? []).map((row) => ({ id: row.id, by: row.actor_name, text: row.text, at: row.created_at }));
};
