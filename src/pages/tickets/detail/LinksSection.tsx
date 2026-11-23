// [ticket-management] Linked tickets: choose a type (Blocks, Cloners, Duplicate, Causes, Relates), then the ticket.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as api from "../api";
import { ticketKeys, useTicketLinks } from "../hooks";
import { StatusPill } from "../TicketBits";
import { LINK_KINDS, LINK_LABELS, type LinkKind, type Ticket, type TicketPerson } from "../types";
import LinkTicketDialog from "./LinkTicketDialog";
import SectionTitle from "./SectionTitle";
import type { RunAction } from "./useRunAction";

interface LinksSectionProps {
  ticket: Ticket;
  me: TicketPerson;
  canAct: boolean;
  /** Every other ticket that can be linked. */
  otherTickets: Ticket[];
  onOpenTicket: (id: string) => void;
  run: RunAction;
}

const LinksSection = ({ ticket, me, canAct, otherTickets, onOpenTicket, run }: LinksSectionProps) => {
  const queryClient = useQueryClient();
  const links = useTicketLinks(ticket.id);
  // The link type chosen in the dropdown; the ticket picker is open while this is set.
  const [pendingKind, setPendingKind] = useState<LinkKind | null>(null);

  const refreshLinks = () => void queryClient.invalidateQueries({ queryKey: ticketKeys.links(ticket.id) });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>Linked tickets</SectionTitle>
        {canAct && (
          // value="" keeps the dropdown showing "Linked to"; picking a type opens the ticket search.
          <Select value="" onValueChange={(v) => setPendingKind(v as LinkKind)}>
            <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="Linked to" /></SelectTrigger>
            <SelectContent>
              {LINK_KINDS.map((kind) => <SelectItem key={kind.id} value={kind.id}>{kind.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {(links.data ?? []).length === 0 ? (
        <p className="text-sm text-slate-400">No linked tickets.</p>
      ) : (
        <ul className="space-y-1.5">
          {links.data!.map((link) => (
            <li key={link.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <span className="w-28 shrink-0 text-xs text-slate-500">{LINK_LABELS[link.kind][link.outgoing ? "outgoing" : "incoming"]}</span>
              <button type="button" onClick={() => onOpenTicket(link.other.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left hover:underline">
                <span className="font-mono text-[11px] text-slate-500">{link.other.key}</span>
                <span className="truncate">{link.other.title}</span>
              </button>
              <StatusPill status={link.other.status} />
              {canAct && (
                <button
                  type="button"
                  title="Remove link"
                  onClick={() =>
                    void run(async () => {
                      await api.removeLink(link.id);
                      refreshLinks();
                    })
                  }
                  className="rounded p-0.5 text-slate-400 hover:text-red-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <LinkTicketDialog
        open={pendingKind !== null}
        kindLabel={LINK_KINDS.find((k) => k.id === pendingKind)?.label ?? ""}
        ticketKey={ticket.key}
        tickets={otherTickets}
        onClose={() => setPendingKind(null)}
        onPick={(other) => {
          const kind = pendingKind!;
          setPendingKind(null);
          void run(async () => {
            await api.addLink(ticket.id, other.id, kind, me, other.key);
            refreshLinks();
          }, `Linked to ${other.key}`);
        }}
      />
    </div>
  );
};

export default LinksSection;
