// [ticket-management] Drag-and-drop Kanban board (native HTML5 DnD) with SLA bars,
// optional swimlanes (priority / assignee), hideable columns and WIP limits.
import { useMemo, useState } from "react";
import { MessageSquare, Paperclip, Pencil, Plus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { DueLabel, EscalationBadge, PersonAvatar, PriorityBadge, SlaBar } from "./TicketBits";
import { PRIORITIES, STATUSES, categoryLabel, priorityMeta, type Ticket, type TicketStatus } from "./types";

export type Swimlane = "none" | "priority" | "assignee";

export interface BoardSettings {
  hidden: TicketStatus[];
  wip: Partial<Record<TicketStatus, number>>;
  swimlane: Swimlane;
}

export const DEFAULT_BOARD: BoardSettings = { hidden: [], wip: {}, swimlane: "none" };

interface KanbanBoardProps {
  tickets: Ticket[];
  settings: BoardSettings;
  onOpen: (ticket: Ticket) => void;
  /** Opens the edit form for a ticket (the small pencil on each card). */
  onEdit: (ticket: Ticket) => void;
  /** The pencil is shown only on tickets the user is allowed to change. */
  canEdit: (ticket: Ticket) => boolean;
  onMove: (ticketId: string, status: TicketStatus) => void;
  onQuickCreate: () => void;
}

const sortTickets = (list: Ticket[]) =>
  [...list].sort(
    (a, b) =>
      b.escalationLevel - a.escalationLevel ||
      priorityMeta(a.priority).slaDays - priorityMeta(b.priority).slaDays ||
      a.dueDate.localeCompare(b.dueDate),
  );

const TicketCard = ({
  ticket,
  dragging,
  onOpen,
  onEdit,
  onDragStart,
  onDragEnd,
}: {
  ticket: Ticket;
  dragging: boolean;
  onOpen: () => void;
  /** Undefined when the user may not edit this ticket (no pencil is shown). */
  onEdit?: () => void;
  onDragStart: (event: React.DragEvent) => void;
  onDragEnd: () => void;
}) => (
  <article
    draggable
    data-ticket-id={ticket.id}
    onDragStart={onDragStart}
    onDragEnd={onDragEnd}
    onClick={onOpen}
    className={cn(
      "relative cursor-grab overflow-hidden rounded-lg border border-slate-200 bg-white p-3 pl-4 shadow-sm transition-all",
      "before:absolute before:inset-y-0 before:left-0 before:w-1",
      priorityMeta(ticket.priority).bar,
      "hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md active:cursor-grabbing",
      ticket.escalationLevel > 0 && "border-red-300",
      dragging && "opacity-40",
    )}
  >
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <span className="font-mono text-[11px] font-medium text-slate-500">{ticket.key}</span>
      <div className="flex items-center gap-1">
        <EscalationBadge level={ticket.escalationLevel} />
        <PriorityBadge priority={ticket.priority} />
        {onEdit && (
          <button
            type="button"
            title="Edit ticket"
            aria-label={`Edit ${ticket.key}`}
            draggable={false}
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
            className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        )}
      </div>
    </div>
    <p className="mb-2 line-clamp-2 text-sm font-medium leading-snug text-slate-900">{ticket.title}</p>
    <div className="mb-2 flex flex-wrap items-center gap-1">
      <span className="inline-block max-w-full truncate rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{categoryLabel(ticket)}</span>
    </div>
    <SlaBar ticket={ticket} className="mb-2" />
    <div className="flex items-center justify-between gap-2">
      <DueLabel ticket={ticket} />
      <div className="flex items-center gap-2">
        {ticket.attachments.length > 0 && (
          <span title="Documents" className="inline-flex items-center gap-0.5 text-[11px] text-slate-500">
            <Paperclip className="h-3 w-3" />
            {ticket.attachments.length}
          </span>
        )}
        {ticket.watchers.length > 0 && (
          <span title={ticket.watchers.map((p) => p.name).join(", ")} className="inline-flex items-center gap-0.5 text-[11px] text-slate-500">
            <Users className="h-3 w-3" />
            {ticket.watchers.length}
          </span>
        )}
        {ticket.commentCount > 0 && (
          <span title="Comments" className="inline-flex items-center gap-0.5 text-[11px] text-slate-500">
            <MessageSquare className="h-3 w-3" />
            {ticket.commentCount}
          </span>
        )}
        <PersonAvatar person={ticket.assignee} />
      </div>
    </div>
  </article>
);

const KanbanBoard = ({ tickets, settings, onOpen, onEdit, canEdit, onMove, onQuickCreate }: KanbanBoardProps) => {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const columns = STATUSES.filter((s) => !settings.hidden.includes(s.id));

  const lanes = useMemo(() => {
    if (settings.swimlane === "priority")
      return PRIORITIES.map((p) => ({ id: p.id, label: p.label, tickets: tickets.filter((t) => t.priority === p.id) }));
    if (settings.swimlane === "assignee") {
      const map = new Map<string, { id: string; label: string; tickets: Ticket[] }>();
      tickets.forEach((t) => {
        const key = t.assignee?.email?.toLowerCase() ?? t.assignee?.id ?? "__none__";
        if (!map.has(key)) map.set(key, { id: key, label: t.assignee?.name ?? "Unassigned", tickets: [] });
        map.get(key)!.tickets.push(t);
      });
      return [...map.values()].sort((a, b) => (a.id === "__none__" ? 1 : b.id === "__none__" ? -1 : a.label.localeCompare(b.label)));
    }
    return [{ id: "all", label: "", tickets }];
  }, [settings.swimlane, tickets]);

  const columnCount = (status: TicketStatus) => tickets.filter((t) => t.status === status).length;

  return (
    <div className="space-y-5 overflow-x-auto pb-4">
      {lanes.map((lane) => (
        <div key={lane.id} className="space-y-2">
          {settings.swimlane !== "none" && (
            <h4 className="sticky left-0 flex items-center gap-2 text-sm font-semibold text-slate-700">
              {lane.label}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{lane.tickets.length}</span>
            </h4>
          )}
          <div className="flex gap-4">
            {columns.map((column) => {
              const cellKey = `${lane.id}:${column.id}`;
              const cellTickets = sortTickets(lane.tickets.filter((t) => t.status === column.id));
              const total = columnCount(column.id);
              const limit = settings.wip[column.id];
              const overLimit = Boolean(limit && total > limit);
              const showHeader = settings.swimlane === "none" || lane === lanes[0];
              return (
                <section
                  key={column.id}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (over !== cellKey) setOver(cellKey);
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node)) setOver(null);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const id = event.dataTransfer.getData("text/plain") || dragId;
                    if (id) onMove(id, column.id);
                    setDragId(null);
                    setOver(null);
                  }}
                  className={cn(
                    "flex w-[280px] min-w-[280px] flex-col overflow-hidden rounded-xl border border-slate-200 transition-colors",
                    column.tint,
                    over === cellKey && "border-orange-400 ring-2 ring-orange-200",
                    overLimit && "border-red-400",
                  )}
                >
                  {showHeader && (
                    <header className={cn("mb-2.5 flex items-center justify-between px-3 py-3", column.header)}>
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2.5 w-2.5 rounded-full ring-2 ring-white", column.dot)} />
                        <h3 className="kanban-column-title text-sm text-slate-800">{column.label}</h3>
                        <span
                          title={limit ? `Limit ${limit}` : undefined}
                          className={cn("rounded-full px-2 py-0.5 text-xs font-medium shadow-sm", overLimit ? "bg-red-600 text-white" : "bg-white text-slate-600")}
                        >
                          {total}
                          {limit ? `/${limit}` : ""}
                        </span>
                      </div>
                      {column.id === "open" && (
                        <button type="button" onClick={onQuickCreate} className="rounded-md p-1 text-slate-700 hover:bg-white hover:text-orange-600" title="New ticket">
                          <Plus className="h-4 w-4" />
                        </button>
                      )}
                    </header>
                  )}
                  <div className={cn("flex flex-1 flex-col gap-2.5 px-2.5 pb-3", settings.swimlane === "none" ? "min-h-[420px]" : "min-h-[120px] pt-2.5", showHeader && settings.swimlane !== "none" && "pt-0")}>
                    {cellTickets.length === 0 && (
                      <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 py-6 text-xs text-slate-400">
                        Drop tickets here
                      </div>
                    )}
                    {cellTickets.map((ticket) => (
                      <TicketCard
                        key={ticket.id}
                        ticket={ticket}
                        dragging={dragId === ticket.id}
                        onOpen={() => onOpen(ticket)}
                        onEdit={canEdit(ticket) ? () => onEdit(ticket) : undefined}
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/plain", ticket.id);
                          event.dataTransfer.effectAllowed = "move";
                          setDragId(ticket.id);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setOver(null);
                        }}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default KanbanBoard;
