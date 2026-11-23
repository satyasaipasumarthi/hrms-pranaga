// [ticket-management] Comments and internal notes (table: ticket_comments).
import { supabase } from "@/lib/supabase";
import type { TicketComment, TicketPerson } from "../types";
import { uploadAttachments } from "./attachments";
import { fail } from "./shared";

export const fetchComments = async (ticketId: string): Promise<TicketComment[]> => {
  const { data, error } = await supabase.from("ticket_comments").select("*").eq("ticket_id", ticketId).order("created_at");
  if (error) fail(error, "fetch comments");
  return (data ?? []).map((row) => ({
    id: row.id,
    ticketId: row.ticket_id,
    author: { id: row.author_id, name: row.author_name, email: row.author_email ?? undefined },
    text: row.body,
    isInternal: Boolean(row.is_internal),
    mentions: (row.mentions as TicketPerson[]) ?? [],
    createdAt: row.created_at,
  }));
};

export const addComment = async (
  ticketId: string,
  body: string,
  options: { internal: boolean; mentions: TicketPerson[]; files: File[] },
  me: TicketPerson,
) => {
  const { data, error } = await supabase
    .from("ticket_comments")
    .insert({
      ticket_id: ticketId,
      author_id: me.id,
      author_name: me.name,
      author_email: me.email ?? null,
      body: body.trim() || (options.files.length ? "(attachment)" : ""),
      is_internal: options.internal,
      mentions: options.mentions.map((p) => ({ id: p.id, name: p.name, email: p.email ?? null })),
    })
    .select("id")
    .single();
  if (error) fail(error, "add comment");
  if (options.files.length) await uploadAttachments(ticketId, options.files, me, data!.id);
};
