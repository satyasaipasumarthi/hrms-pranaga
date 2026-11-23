// [ticket-management] Table view with multi-select and bulk actions.
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, UserPlus, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import * as api from "./api";
import { ticketKeys } from "./hooks";
import PeoplePicker from "./PeoplePicker";
import { DueLabel, EscalationBadge, PersonAvatar, PriorityBadge, SlaBar, StatusPill, timeAgo } from "./TicketBits";
import { useTeamEmployees } from "./ticketDirectory";
import { PRIORITIES, STATUSES, categoryLabel, isOverdue, type Ticket, type TicketEmployee, type TicketPerson, type TicketPriority, type TicketStatus, type TicketTeam } from "./types";

interface TicketListViewProps {
  tickets: Ticket[];
  teams: TicketTeam[];
  employees: TicketEmployee[];
  isStaff: boolean;
  onOpen: (ticket: Ticket) => void;
}

const UNASSIGNED = "__unassigned__";

const BulkBar = ({
  selected,
  teams,
  employees,
  isStaff,
  onClear,
}: {
  selected: Ticket[];
  teams: TicketTeam[];
  employees: TicketEmployee[];
  isStaff: boolean;
  onClear: () => void;
}) => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [people, setPeople] = useState<TicketPerson[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ids = selected.map((t) => t.id);

  // Reassigning in bulk is only offered when all selected tickets belong to the same team.
  const teamIds = new Set(selected.map((t) => t.team?.id ?? ""));
  const sharedTeam = teamIds.size === 1 ? (teams.find((t) => t.id === [...teamIds][0]) ?? null) : null;
  const members = useTeamEmployees(sharedTeam);

  const apply = async (label: string, action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      toast({ title: `${label} · ${selected.length} ticket${selected.length > 1 ? "s" : ""}` });
      onClear();
    } catch (error) {
      toast({ title: "Bulk update failed", description: (error as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
      void queryClient.invalidateQueries({ queryKey: ticketKeys.all });
    }
  };

  return (
    <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 shadow-sm">
      <span className="text-sm font-medium text-slate-800">{selected.length} selected</span>
      <Select disabled={busy} onValueChange={(v) => void apply(`Moved to ${STATUSES.find((s) => s.id === v)?.label}`, () => api.updateTickets(ids, { status: v as TicketStatus }))}>
        <SelectTrigger className="h-8 w-[130px] bg-white text-xs"><SelectValue placeholder="Set status" /></SelectTrigger>
        <SelectContent>{STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
      </Select>
      <Select disabled={busy} onValueChange={(v) => void apply("Priority changed", () => api.updateTickets(ids, { priority: v as TicketPriority }))}>
        <SelectTrigger className="h-8 w-[130px] bg-white text-xs"><SelectValue placeholder="Set priority" /></SelectTrigger>
        <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
      </Select>
      {sharedTeam && (
        <Select
          disabled={busy || members.loading}
          onValueChange={(v) =>
            void apply("Reassigned", () => api.updateTickets(ids, { assignee: members.people.find((p) => p.id === v) ?? null }))
          }
        >
          <SelectTrigger className="h-8 w-[150px] bg-white text-xs"><SelectValue placeholder={`Assign to (${sharedTeam.name})`} /></SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
            {members.people.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      <Input
        type="date"
        disabled={busy}
        title="Set due date"
        className="h-8 w-[140px] bg-white text-xs"
        onChange={(e) =>
          e.target.value && void apply("Due date changed", () => api.updateTickets(ids, { dueDate: new Date(`${e.target.value}T23:59:59`).toISOString() }))
        }
      />
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 bg-white" disabled={busy}><UserPlus className="mr-1.5 h-3.5 w-3.5" />Add people</Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 space-y-2">
          <PeoplePicker value={people} onChange={setPeople} people={employees} />
          <Button
            size="sm"
            className="w-full"
            disabled={!people.length}
            onClick={() => void apply("People added", () => Promise.all(ids.map((id) => api.addWatchers(id, people)))).then(() => setPeople([]))}
          >
            Add to {selected.length} ticket{selected.length > 1 ? "s" : ""}
          </Button>
        </PopoverContent>
      </Popover>
      {isStaff && (
        <Button variant="outline" size="sm" className="h-8 bg-white text-red-600" disabled={busy} onClick={() => setConfirmDelete(true)}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete
        </Button>
      )}
      <Button variant="ghost" size="sm" className="ml-auto h-8" onClick={onClear}><X className="mr-1 h-3.5 w-3.5" />Clear</Button>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.length} tickets?</AlertDialogTitle>
            <AlertDialogDescription>They are permanently deleted with their comments, documents and history.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => void apply("Deleted", () => Promise.all(selected.map((t) => api.deleteTicket(t))))}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const TicketListView = ({ tickets, teams, employees, isStaff, onOpen }: TicketListViewProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selected = useMemo(() => tickets.filter((t) => selectedIds.has(t.id)), [tickets, selectedIds]);
  const allChecked = tickets.length > 0 && selected.length === tickets.length;

  const toggle = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <BulkBar selected={selected} teams={teams} employees={employees} isStaff={isStaff} onClear={() => setSelectedIds(new Set())} />
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1080px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-10 px-4 py-3">
                <Checkbox
                  checked={allChecked ? true : selected.length ? "indeterminate" : false}
                  onCheckedChange={(v) => setSelectedIds(v === true ? new Set(tickets.map((t) => t.id)) : new Set())}
                  aria-label="Select all"
                />
              </th>
              <th className="px-4 py-3 font-medium">Ticket</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Assigned to</th>
              <th className="px-4 py-3 font-medium">Deadline date</th>
              <th className="px-4 py-3 font-medium">SLA</th>
              <th className="px-4 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-slate-400">No tickets match your filters.</td>
              </tr>
            )}
            {tickets.map((ticket) => (
              <tr
                key={ticket.id}
                data-ticket-id={ticket.id}
                onClick={() => onOpen(ticket)}
                className={cn(
                  "cursor-pointer border-t border-slate-100 text-slate-700 hover:bg-orange-50/60",
                  selectedIds.has(ticket.id) && "bg-orange-50",
                )}
              >
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={selectedIds.has(ticket.id)} onCheckedChange={() => toggle(ticket.id)} aria-label={`Select ${ticket.key}`} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
                    {ticket.key}
                    <EscalationBadge level={ticket.escalationLevel} />
                  </div>
                  <div className="font-medium text-slate-900">{ticket.title}</div>
                  <div className="text-xs text-slate-400">by {ticket.raisedBy.name}</div>
                </td>
                <td className="px-4 py-3">{categoryLabel(ticket)}</td>
                <td className="px-4 py-3"><PriorityBadge priority={ticket.priority} /></td>
                <td className="px-4 py-3"><StatusPill status={ticket.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <PersonAvatar person={ticket.assignee} />
                    <span className="truncate">{ticket.assignee?.name ?? "Unassigned"}</span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    title={format(new Date(ticket.dueDate), "PPp")}
                    className={cn("text-sm", isOverdue(ticket) ? "font-semibold text-red-600" : "text-slate-700")}
                  >
                    {format(new Date(ticket.dueDate), "d MMM yyyy")}
                  </span>
                </td>
                <td className="w-40 px-4 py-3">
                  <DueLabel ticket={ticket} />
                  <SlaBar ticket={ticket} className="mt-1" />
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{timeAgo(ticket.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TicketListView;
