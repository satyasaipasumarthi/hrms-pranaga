// [ticket-management] The tickets themselves (table: tickets): list, create, update, delete.
import { supabase } from "@/lib/supabase";
import type {
  Ticket,
  TicketCategory,
  TicketPerson,
  TicketPriority,
  TicketStatus,
  TicketTeamRef,
} from "../types";
import { BUCKET, toAttachment, uploadAttachments } from "./attachments";
import { addWatchers } from "./watchers";
import { fail, type Row } from "./shared";

const toTicket = (row: Row): Ticket => ({
  id: row.id,
  number: Number(row.number),
  key: `TKT-${row.number}`,
  title: row.title,
  description: row.description ?? "",
  category: row.category as TicketCategory,
  team: row.team_id
    ? { id: row.team_id, name: row.team_name ?? "Team" }
    : row.category === "IT Support" && row.team_name
      ? { id: row.team_name, name: row.team_name }
      : null,
  priority: row.priority as TicketPriority,
  status: row.status as TicketStatus,
  raisedBy: { id: row.raised_by, name: row.raised_by_name, email: row.raised_by_email ?? undefined },
  assignee: row.assignee_id
    ? { id: row.assignee_id, name: row.assignee_name ?? "Assignee", email: row.assignee_email ?? undefined }
    : null,
  watchers: ((row.ticket_watchers as Row[]) ?? []).map((w) => ({ id: w.person_id, name: w.name, email: w.email ?? undefined })),
  attachments: ((row.ticket_attachments as Row[]) ?? []).map(toAttachment).sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt)),
  commentCount: Number((row.ticket_comments as Row[] | undefined)?.[0]?.count ?? 0),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  dueDate: row.due_date,
  slaPausedAt: row.sla_paused_at ?? null,
  escalationLevel: Number(row.escalation_level ?? 0),
  reviewRequestedAt: row.review_requested_at ?? null,
  closedAt: row.closed_at ?? null,
  reopenedCount: Number(row.reopened_count ?? 0),
  rating: row.rating ?? null,
  ratingComment: row.rating_comment ?? null,
});

const TICKET_SELECT = "*, ticket_watchers(*), ticket_attachments(*), ticket_comments(count)";

const personColumns = (prefix: "assignee", person: TicketPerson | null) => ({
  [`${prefix}_id`]: person?.id ?? null,
  [`${prefix}_name`]: person?.name ?? null,
  [`${prefix}_email`]: person?.email ?? null,
});

export const fetchTickets = async (): Promise<Ticket[]> => {
  const { data, error } = await supabase.from("tickets").select(TICKET_SELECT).order("updated_at", { ascending: false });
  if (error) fail(error, "fetch tickets");
  return (data ?? []).map(toTicket);
};

export interface TicketInput {
  title: string;
  description: string;
  category: TicketCategory;
  team: TicketTeamRef | null;
  priority: TicketPriority;
  assignee: TicketPerson | null;
  watchers: TicketPerson[];
  dueDate: string;
}

export const createTicket = async (input: TicketInput, me: TicketPerson, files: File[]): Promise<Ticket> => {
  const { data, error } = await supabase
    .from("tickets")
    .insert({
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      team_id: input.category === "IT Support" ? null : input.team?.id ?? null,
      team_name: input.team?.name ?? null,
      priority: input.priority,
      raised_by: me.id,
      raised_by_name: me.name,
      raised_by_email: me.email ?? null,
      ...personColumns("assignee", input.assignee),
      due_date: input.dueDate,
    })
    .select("*")
    .single();
  if (error) fail(error, "create ticket");
  const ticket = toTicket(data!);
  if (input.watchers.length) await addWatchers(ticket.id, input.watchers);
  if (files.length) await uploadAttachments(ticket.id, files, me);
  return ticket;
};

export type TicketPatch = Partial<{
  title: string;
  description: string;
  category: TicketCategory;
  team: TicketTeamRef | null;
  priority: TicketPriority;
  status: TicketStatus;
  assignee: TicketPerson | null;
  dueDate: string;
  rating: number | null;
  ratingComment: string | null;
}>;

export const updateTicket = async (id: string, patch: TicketPatch) => {
  const row: Row = {};
  if (patch.title !== undefined) row.title = patch.title.trim();
  if (patch.description !== undefined) row.description = patch.description.trim();
  if (patch.category !== undefined) row.category = patch.category;
  if (patch.team !== undefined) {
    Object.assign(row, {
      team_id: patch.category === "IT Support" ? null : patch.team?.id ?? null,
      team_name: patch.team?.name ?? null,
    });
  }
  if (patch.priority !== undefined) row.priority = patch.priority;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.assignee !== undefined) Object.assign(row, personColumns("assignee", patch.assignee));
  if (patch.dueDate !== undefined) row.due_date = patch.dueDate;
  if (patch.rating !== undefined) row.rating = patch.rating;
  if (patch.ratingComment !== undefined) row.rating_comment = patch.ratingComment;
  const { data, error } = await supabase.from("tickets").update(row).eq("id", id).select("id");
  if (error) fail(error, "update ticket");
  if (!data?.length) throw new Error("You can only change tickets you are part of.");
};

export const updateTickets = async (ids: string[], patch: TicketPatch) => {
  // One request per ticket so triggers log activity and notify for each.
  const results = await Promise.allSettled(ids.map((id) => updateTicket(id, patch)));
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed) throw new Error(`${failed} of ${ids.length} tickets could not be updated`);
};

export const deleteTicket = async (ticket: Ticket) => {
  const paths = ticket.attachments.map((a) => a.path);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  const { error } = await supabase.from("tickets").delete().eq("id", ticket.id);
  if (error) fail(error, "delete ticket");
};
