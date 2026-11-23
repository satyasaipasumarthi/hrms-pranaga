// [ticket-management] Small shared presentational pieces.
import { format, formatDistanceToNowStrict } from "date-fns";
import { AlertTriangle, CalendarClock, Flame, PauseCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isDone,
  isOverdue,
  priorityMeta,
  slaProgress,
  STATUSES,
  type Ticket,
  type TicketPerson,
  type TicketPriority,
  type TicketStatus,
} from "./types";

const avatarPalette = [
  "bg-orange-100 text-orange-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-800",
];

const initials = (name: string) =>
  name
    .replace(/\(.*\)/, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

export const PersonAvatar = ({ person, size = "sm" }: { person: TicketPerson | null; size?: "sm" | "md" }) => {
  const dims = size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";
  if (!person)
    return (
      <span
        title="Unassigned"
        className={cn("inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400", dims)}
      >
        ?
      </span>
    );
  const hash = [...(person.email ?? person.id)].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return (
    <span
      title={person.name}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", dims, avatarPalette[hash % avatarPalette.length])}
    >
      {initials(person.name)}
    </span>
  );
};

export const PriorityBadge = ({ priority }: { priority: TicketPriority }) => {
  const meta = priorityMeta(priority);
  return (
    <span
      title={`${meta.label}: ${meta.description}`}
      className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold", meta.badge)}
    >
      {meta.label}
    </span>
  );
};

export const StatusPill = ({ status }: { status: TicketStatus }) => {
  const meta = STATUSES.find((s) => s.id === status)!;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700">
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
};

export const DueLabel = ({ ticket }: { ticket: Ticket }) => {
  const overdue = isOverdue(ticket);
  const due = new Date(ticket.dueDate);
  if (ticket.status === "on_hold")
    return (
      <span title="SLA paused while on hold" className="inline-flex items-center gap-1 text-[11px] text-orange-600">
        <PauseCircle className="h-3 w-3" />SLA paused
      </span>
    );
  return (
    <span
      title={format(due, "PPp")}
      className={cn("inline-flex items-center gap-1 whitespace-nowrap text-[11px]", overdue ? "font-semibold text-red-600" : "text-slate-500")}
    >
      {overdue ? <AlertTriangle className="h-3 w-3" /> : <CalendarClock className="h-3 w-3" />}
      {isDone(ticket)
        ? format(due, "d MMM")
        : overdue
          ? `Overdue ${formatDistanceToNowStrict(due)}`
          : `Due in ${formatDistanceToNowStrict(due)}`}
    </span>
  );
};

/** Thin SLA bar: green < 50%, yellow < 75%, orange < 100%, red when overdue. */
export const SlaBar = ({ ticket, className }: { ticket: Ticket; className?: string }) => {
  if (isDone(ticket)) return null;
  const used = slaProgress(ticket);
  const tone = used >= 1 ? "bg-red-500" : used >= 0.75 ? "bg-orange-500" : used >= 0.5 ? "bg-yellow-400" : "bg-green-500";
  return (
    <div
      className={cn("h-1 w-full overflow-hidden rounded-full bg-slate-100", className)}
      title={`${Math.min(999, Math.round(used * 100))}% of SLA time used${ticket.status === "on_hold" ? " (paused)" : ""}`}
    >
      <div className={cn("h-full rounded-full transition-all", tone, ticket.status === "on_hold" && "opacity-50")} style={{ width: `${Math.min(100, used * 100)}%` }} />
    </div>
  );
};

export const EscalationBadge = ({ level }: { level: number }) =>
  level > 0 ? (
    <span
      title={`Escalated (level ${level})`}
      className="inline-flex items-center gap-0.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white"
    >
      <Flame className="h-3 w-3" />L{level}
    </span>
  ) : null;

export const Stars = ({ value, size = "h-4 w-4" }: { value: number; size?: string }) => (
  <span className="inline-flex" title={`${value}/5`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <svg key={n} viewBox="0 0 20 20" className={cn(size, n <= Math.round(value) ? "fill-amber-400" : "fill-slate-200")}>
        <path d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 14.9l-5.3 2.7 1-5.8L1.5 7.7l5.9-.9z" />
      </svg>
    ))}
  </span>
);

export const timeAgo = (iso: string) => `${formatDistanceToNowStrict(new Date(iso))} ago`;
