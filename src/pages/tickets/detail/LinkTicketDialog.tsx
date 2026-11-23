// [ticket-management] Pop-up with a search box to pick the ticket to link to (opened after choosing a link type).
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusPill } from "../TicketBits";
import type { Ticket } from "../types";

interface LinkTicketDialogProps {
  open: boolean;
  /** Name of the chosen link type, e.g. "Blocks". */
  kindLabel: string;
  ticketKey: string;
  /** The tickets that can be picked. */
  tickets: Ticket[];
  onPick: (ticket: Ticket) => void;
  onClose: () => void;
}

const LinkTicketDialog = ({ open, kindLabel, ticketKey, tickets, onPick, onClose }: LinkTicketDialogProps) => (
  <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
    <DialogContent className="gap-0 p-0 sm:max-w-lg">
      <DialogHeader className="px-4 pb-3 pt-4 text-left">
        <DialogTitle>Linked to · {kindLabel}</DialogTitle>
        <DialogDescription>Choose the ticket to link with {ticketKey}.</DialogDescription>
      </DialogHeader>
      <Command className="border-t border-slate-100">
        <CommandInput placeholder="Search by ticket number or title…" />
        <CommandList className="max-h-72">
          <CommandEmpty>No tickets found.</CommandEmpty>
          <CommandGroup>
            {tickets.map((t) => (
              <CommandItem key={t.id} value={`${t.key} ${t.title}`} onSelect={() => onPick(t)}>
                <span className="mr-2 font-mono text-[11px] text-slate-500">{t.key}</span>
                <span className="flex-1 truncate">{t.title}</span>
                <StatusPill status={t.status} />
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </DialogContent>
  </Dialog>
);

export default LinkTicketDialog;
