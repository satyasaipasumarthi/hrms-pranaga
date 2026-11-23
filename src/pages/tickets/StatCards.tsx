// [ticket-management] The four number cards at the top of the page. Clicking one filters the tickets.
import { useMemo } from "react";
import { AlertTriangle, ClipboardCheck, Flame, Inbox, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_FILTERS, isDone, isOverdue, isSamePerson, type Ticket, type TicketFilters, type TicketPerson } from "./types";

interface StatCardsProps {
  tickets: Ticket[];
  me: TicketPerson;
  isManager: boolean;
  loading: boolean;
  onFilter: (filters: TicketFilters) => void;
}

const StatCards = ({ tickets, me, isManager, loading, onFilter }: StatCardsProps) => {
  const stats = useMemo(() => {
    const active = tickets.filter((t) => !isDone(t));
    return {
      active: active.length,
      unassigned: active.filter((t) => !t.assignee).length,
      overdue: active.filter(isOverdue).length,
      escalated: active.filter((t) => t.escalationLevel > 0).length,
      toConfirm: tickets.filter((t) => t.status === "review" && isSamePerson(t.raisedBy, me)).length,
    };
  }, [tickets, me]);

  const cards = [
    { label: "Active tickets", value: stats.active, icon: Inbox, tone: "text-sky-600 bg-sky-50", onClick: () => onFilter(DEFAULT_FILTERS) },
    { label: "Unassigned", value: stats.unassigned, icon: UserX, tone: "text-amber-700 bg-amber-50", onClick: () => onFilter({ ...DEFAULT_FILTERS, scope: "unassigned" }) },
    { label: "Overdue", value: stats.overdue, icon: AlertTriangle, tone: "text-red-600 bg-red-50", onClick: () => onFilter({ ...DEFAULT_FILTERS, dueWithin: "overdue" }) },
    isManager
      ? { label: "Escalated", value: stats.escalated, icon: Flame, tone: "text-orange-600 bg-orange-50", onClick: () => onFilter({ ...DEFAULT_FILTERS, dueWithin: "overdue" }) }
      : { label: "Waiting for your confirmation", value: stats.toConfirm, icon: ClipboardCheck, tone: "text-green-600 bg-green-50", onClick: () => onFilter({ ...DEFAULT_FILTERS, scope: "mine" }) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <button
          key={card.label}
          type="button"
          onClick={card.onClick}
          className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-orange-300"
        >
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", card.tone)}>
            <card.icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-2xl font-semibold leading-none text-slate-900">{loading ? "–" : card.value}</p>
            <p className="mt-1 truncate text-xs text-slate-500">{card.label}</p>
          </div>
        </button>
      ))}
    </div>
  );
};

export default StatCards;
