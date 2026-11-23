// [ticket-management] Status, Assigned to, Priority, Due date and the deadline (SLA) bar.
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import * as api from "../api";
import { DueLabel, SlaBar } from "../TicketBits";
import {
  PRIORITIES,
  STATUSES,
  isDone,
  isSamePerson,
  slaProgress,
  type Ticket,
  type TicketPerson,
  type TicketPriority,
  type TicketStatus,
} from "../types";
import SectionTitle from "./SectionTitle";
import type { RunAction } from "./useRunAction";

const UNASSIGNED = "__unassigned__";

interface FieldsPanelProps {
  ticket: Ticket;
  me: TicketPerson;
  canAct: boolean;
  isManager: boolean;
  /** People the ticket can be assigned to (the chosen team's employees). */
  assignees: TicketPerson[];
  run: RunAction;
}

const FieldsPanel = ({ ticket, me, canAct, isManager, assignees, run }: FieldsPanelProps) => {
  const used = slaProgress(ticket);

  return (
    <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
      <div className="space-y-1.5">
        <SectionTitle>Status</SectionTitle>
        <Select value={ticket.status} disabled={!canAct} onValueChange={(v) => void run(() => api.updateTicket(ticket.id, { status: v as TicketStatus }))}>
          <SelectTrigger className="h-9 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <span className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", s.dot)} />{s.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <SectionTitle>Assigned to</SectionTitle>
        <Select
          value={ticket.assignee?.id ?? UNASSIGNED}
          disabled={!isManager && !isSamePerson(ticket.assignee, me)}
          onValueChange={(v) => void run(() => api.updateTicket(ticket.id, { assignee: assignees.find((p) => p.id === v) ?? null }))}
        >
          <SelectTrigger className="h-9 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
            {assignees.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <SectionTitle>Priority</SectionTitle>
        <Select value={ticket.priority} disabled={!canAct} onValueChange={(v) => void run(() => api.updateTicket(ticket.id, { priority: v as TicketPriority }))}>
          <SelectTrigger className="h-9 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PRIORITIES.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", p.dot)} />{p.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <SectionTitle>Due date</SectionTitle>
        <Input
          type="date"
          disabled={!canAct}
          className="h-9 bg-white"
          value={format(new Date(ticket.dueDate), "yyyy-MM-dd")}
          onChange={(e) =>
            e.target.value && void run(() => api.updateTicket(ticket.id, { dueDate: new Date(`${e.target.value}T23:59:59`).toISOString() }))
          }
        />
      </div>
      {!isDone(ticket) && (
        <div className="space-y-1.5 sm:col-span-2">
          <div className="flex items-center justify-between">
            <SectionTitle>SLA</SectionTitle>
            <DueLabel ticket={ticket} />
          </div>
          <SlaBar ticket={ticket} className="h-2" />
          <p className="text-xs text-slate-500">
            {Math.min(999, Math.round(used * 100))}% of the time used · due {format(new Date(ticket.dueDate), "d MMM yyyy, p")}
            {ticket.status === "on_hold" && " · paused while On Hold"}
          </p>
        </div>
      )}
    </div>
  );
};

export default FieldsPanel;
