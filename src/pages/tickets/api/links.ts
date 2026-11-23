// [ticket-management] Links between tickets: Blocks, Cloners, Duplicate, Causes, Relates (table: ticket_links).
import { supabase } from "@/lib/supabase";
import { LINK_LABELS, type LinkKind, type TicketLink, type TicketPerson, type TicketStatus } from "../types";
import { logActivity } from "./activity";
import { fail, type Row } from "./shared";

export const fetchLinks = async (ticketId: string): Promise<TicketLink[]> => {
  const { data, error } = await supabase
    .from("ticket_links")
    .select(
      "id, kind, ticket_id, linked_ticket_id, a:tickets!ticket_links_ticket_id_fkey(id, number, title, status), b:tickets!ticket_links_linked_ticket_id_fkey(id, number, title, status)",
    )
    .or(`ticket_id.eq.${ticketId},linked_ticket_id.eq.${ticketId}`);
  if (error) fail(error, "fetch links");
  return (data ?? []).flatMap((row: Row) => {
    const outgoing = row.ticket_id === ticketId;
    const other = outgoing ? row.b : row.a;
    if (!other) return [];
    return [
      {
        id: row.id,
        kind: row.kind as LinkKind,
        outgoing,
        other: { id: other.id, key: `TKT-${other.number}`, title: other.title, status: other.status as TicketStatus },
      },
    ];
  });
};

export const addLink = async (ticketId: string, otherId: string, kind: LinkKind, me: TicketPerson, otherKey: string) => {
  const { error } = await supabase.from("ticket_links").insert({ ticket_id: ticketId, linked_ticket_id: otherId, kind });
  if (error) fail(error, "link tickets");
  await logActivity(ticketId, me.name, `added a link: ${LINK_LABELS[kind].outgoing.toLowerCase()} ${otherKey}`);
};

export const removeLink = async (linkId: string) => {
  const { error } = await supabase.from("ticket_links").delete().eq("id", linkId);
  if (error) fail(error, "remove link");
};

