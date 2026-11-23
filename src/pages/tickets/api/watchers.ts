// [ticket-management] "Add people" on a ticket (table: ticket_watchers).
import { supabase } from "@/lib/supabase";
import type { TicketPerson } from "../types";
import { fail } from "./shared";

export const addWatchers = async (ticketId: string, people: TicketPerson[]) => {
  if (!people.length) return;
  const { error } = await supabase
    .from("ticket_watchers")
    .upsert(
      people.map((p) => ({ ticket_id: ticketId, person_id: p.id, name: p.name, email: p.email ?? null })),
      { onConflict: "ticket_id,person_id", ignoreDuplicates: true },
    );
  if (error) fail(error, "add people");
};

export const removeWatcher = async (ticketId: string, personId: string) => {
  const { error } = await supabase.from("ticket_watchers").delete().eq("ticket_id", ticketId).eq("person_id", personId);
  if (error) fail(error, "remove person");
};

export const syncWatchers = async (ticketId: string, current: TicketPerson[], next: TicketPerson[]) => {
  const before = new Set(current.map((p) => p.id));
  const after = new Set(next.map((p) => p.id));
  await addWatchers(ticketId, next.filter((p) => !before.has(p.id)));
  await Promise.all(current.filter((p) => !after.has(p.id)).map((p) => removeWatcher(ticketId, p.id)));
};
