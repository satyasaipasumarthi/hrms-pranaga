// [ticket-management] Top of the detail panel: ticket number, badges, title with the Edit / Delete icons at its
// right end, who raised it, and the view-only notice.
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EscalationBadge, PriorityBadge, timeAgo } from "../TicketBits";
import { categoryLabel, type Ticket } from "../types";
import ActionsBar from "./ActionsBar";
import type { RunAction } from "./useRunAction";

interface DetailHeaderProps {
  ticket: Ticket;
  canAct: boolean;
  /** Admin / HR: only they can delete. */
  isStaff: boolean;
  onEdit: () => void;
  onClose: () => void;
  run: RunAction;
}

const DetailHeader = ({ ticket, canAct, isStaff, onEdit, onClose, run }: DetailHeaderProps) => (
  <>
    <SheetHeader className="space-y-2 text-left">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-slate-500">{ticket.key}</span>
        <PriorityBadge priority={ticket.priority} />
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{categoryLabel(ticket)}</span>
        <EscalationBadge level={ticket.escalationLevel} />
      </div>
      {/* pr-8 leaves room for the panel's own close (X) button at the far right. */}
      <div className="flex items-start justify-between gap-3 pr-8">
        <SheetTitle className="text-xl leading-snug">{ticket.title}</SheetTitle>
        <ActionsBar key={ticket.id} ticket={ticket} canAct={canAct} isStaff={isStaff} onEdit={onEdit} onClose={onClose} run={run} />
      </div>
      <SheetDescription>
        Raised by {ticket.raisedBy.name} · {timeAgo(ticket.createdAt)}
        {ticket.reopenedCount > 0 && ` · reopened ${ticket.reopenedCount}×`}
      </SheetDescription>
    </SheetHeader>

    {!canAct && (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        You can view this ticket. Only the people on it, managers, HR and admin can change it.
      </div>
    )}
  </>
);

export default DetailHeader;
