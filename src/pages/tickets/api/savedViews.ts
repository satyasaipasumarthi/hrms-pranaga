// [ticket-management] Each user's saved filters (table: ticket_saved_views).
import { supabase } from "@/lib/supabase";
import { DEFAULT_FILTERS, type SavedView, type TicketFilters } from "../types";
import { fail } from "./shared";

export const fetchSavedViews = async (): Promise<SavedView[]> => {
  const { data, error } = await supabase.from("ticket_saved_views").select("*").order("created_at");
  if (error) fail(error, "fetch saved views");
  return (data ?? []).map((row) => ({ id: row.id, name: row.name, filters: { ...DEFAULT_FILTERS, ...(row.filters as TicketFilters) } }));
};

export const saveView = async (name: string, filters: TicketFilters) => {
  const { error } = await supabase.from("ticket_saved_views").insert({ name: name.trim(), filters });
  if (error) fail(error, "save view");
};

export const deleteView = async (id: string) => {
  const { error } = await supabase.from("ticket_saved_views").delete().eq("id", id);
  if (error) fail(error, "delete view");
};
