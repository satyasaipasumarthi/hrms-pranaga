// [ticket-management] Live "new ticket notification" push, used by the shared notification bell.
import { supabase } from "@/lib/supabase";

/** Calls `onNew` whenever a notification row is inserted for this e-mail. Returns an unsubscribe function. */
export const subscribeTicketNotifications = (email: string, onNew: (n: { title: string; body: string | null }) => void) => {
  const channel = supabase
    .channel(`ticket-bell-${email.toLowerCase()}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "ticket_notifications", filter: `recipient_email=eq.${email.toLowerCase()}` },
      (payload) => {
        const row = payload.new as { title?: string; body?: string | null };
        onNew({ title: row.title ?? "New ticket notification", body: row.body ?? null });
      },
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
};
