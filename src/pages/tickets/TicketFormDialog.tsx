// [ticket-management] Create / edit ticket dialog.
import { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { Lightbulb, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { TicketInput } from "./api";
import PeoplePicker from "./PeoplePicker";
import { FileDropZone } from "./TicketAttachments";
import { StatusPill } from "./TicketBits";
import {
  fetchTicketDepartments,
  useTeamEmployees,
} from "./ticketDirectory";
import {
  CATEGORIES,
  CATEGORY_TEAM_TYPE,
  PRIORITIES,
  TEAM_CATEGORY_LABEL,
  priorityMeta,
  type Ticket,
  type TicketCategory,
  type TicketEmployee,
  type TicketPerson,
  type TicketPriority,
  type TicketTeam,
} from "./types";

interface TicketFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket?: Ticket | null;
  /** All employees (profiles) for "Add people". Assignees come from employee_onboarding by team. */
  employees: TicketEmployee[];
  teams: TicketTeam[];
  teamsLoading: boolean;
  /** Tickets the user can see, for "similar tickets" suggestions. */
  existingTickets: Ticket[];
  /** The person raising a new ticket: not offered in "Add people". */
  currentUserId: string;
  onSubmit: (input: TicketInput, files: File[]) => Promise<void>;
  onOpenTicket: (id: string) => void;
}

const UNASSIGNED = "__unassigned__";

// <input type="date"> works with yyyy-MM-dd in local time.
const toDateInput = (iso: string) => format(new Date(iso), "yyyy-MM-dd");
const fromDateInput = (value: string) => new Date(`${value}T23:59:59`).toISOString();
const slaDate = (priority: TicketPriority) => toDateInput(addDays(new Date(), priorityMeta(priority).slaDays).toISOString());
const STOP_WORDS = new Set(["the", "a", "an", "is", "to", "for", "of", "in", "on", "and", "not", "my", "i", "with", "it", "be", "can", "please"]);
const words = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
  );

const TicketFormDialog = ({
  open,
  onOpenChange,
  ticket,
  employees,
  teams,
  teamsLoading,
  existingTickets,
  currentUserId,
  onSubmit,
  onOpenTicket,
}: TicketFormDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TicketCategory | "">("");
  const [teamId, setTeamId] = useState("");
  const [departments, setDepartments] = useState<TicketTeam[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [departmentsError, setDepartmentsError] = useState(false);
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [assigneeId, setAssigneeId] = useState(UNASSIGNED);
  const [dueDate, setDueDate] = useState("");
  const [dueTouched, setDueTouched] = useState(false);
  const [watchers, setWatchers] = useState<TicketPerson[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(ticket?.title ?? "");
    setDescription(ticket?.description ?? "");
    setCategory(ticket?.category ?? "");
    setTeamId(ticket?.team?.id ?? "");
    setPriority(ticket?.priority ?? "medium");
    setAssigneeId(ticket?.assignee?.id ?? UNASSIGNED);
    setDueDate(ticket ? toDateInput(ticket.dueDate) : slaDate("medium"));
    setDueTouched(Boolean(ticket));
    setWatchers(ticket?.watchers ?? []);
    setFiles([]);
    setSaving(false);
    setError("");
  }, [open, ticket]);

  useEffect(() => {
    if (!open || (ticket && category !== "IT Support")) return;
    let cancelled = false;
    setDepartmentsLoading(true);
    setDepartmentsError(false);
    fetchTicketDepartments()
      .then((rows) => {
        if (!cancelled) setDepartments(rows);
      })
      .catch((error) => {
        console.error("[tickets] Could not load departments", error);
        if (!cancelled) {
          setDepartments([]);
          setDepartmentsError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setDepartmentsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, ticket, category]);

  // Until the user picks a date, keep the due date in sync with the priority's SLA.
  const changePriority = (value: TicketPriority) => {
    setPriority(value);
    if (!dueTouched) setDueDate(slaDate(value));
  };

  const today = format(new Date(), "yyyy-MM-dd");

  const categoryTeams: TicketTeam[] = !category
    ? []
    : category === "IT Support"
      ? departments
      : teams.filter((team) => team.category === CATEGORY_TEAM_TYPE[category]);
  const teamOptions = categoryTeams;
  const currentTeam = teamOptions.find((team) => team.id === teamId) ?? null;

  // Assignee: employees of the chosen team from the employee_onboarding table.
  // If the category has no teams yet, anyone can be assigned.
  const teamEmployees = useTeamEmployees(open ? currentTeam : null);
  const teamMembers: TicketPerson[] = currentTeam
    ? teamEmployees.people
    : category && categoryTeams.length === 0
      ? employees
      : [];
  const assigneeOptions =
    ticket?.assignee && assigneeId === ticket.assignee.id && !teamMembers.some((p) => p.id === ticket.assignee!.id)
      ? [ticket.assignee, ...teamMembers]
      : teamMembers;

  const changeCategory = (value: TicketCategory) => {
    setCategory(value);
    setTeamId("");
    setAssigneeId(UNASSIGNED);
  };

  const changeTeam = (value: string) => {
    setTeamId(value);
    setAssigneeId(UNASSIGNED);
  };

  // "Did you mean…?": open tickets with overlapping words in the title/description.
  const similar = useMemo(() => {
    if (ticket || title.trim().length < 4) return [];
    const mine = words(`${title} ${description}`);
    if (!mine.size) return [];
    return existingTickets
      .map((t) => {
        const theirs = words(`${t.title} ${t.description}`);
        let shared = 0;
        mine.forEach((w) => theirs.has(w) && shared++);
        return { ticket: t, score: shared / Math.min(mine.size, Math.max(theirs.size, 1)) };
      })
      .filter((s) => s.score >= 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((s) => s.ticket);
  }, [ticket, title, description, existingTickets]);

  const submit = async () => {
    if (title.trim().length < 5) return setError("Please enter a title of at least 5 characters.");
    if (!description.trim()) return setError("Please describe the issue.");
    if (!category) return setError("Please choose a category.");
    if (category === "IT Support" && !currentTeam) {
  return setError("Please choose a department.");
}

if (category !== "IT Support" &&
    categoryTeams.length > 0 &&
    !currentTeam) {
  return setError("Please choose a sub category (team).");
}
    if (!dueDate) return setError("Please choose a due date.");
    if (!ticket && dueDate < today) return setError("Due date cannot be in the past.");

    setSaving(true);
    setError("");
    try {
      const assignee = assigneeOptions.find((p) => p.id === assigneeId) ?? null;
      await onSubmit(
        {
          title,
          description,
          category,
          team: currentTeam ? { id: currentTeam.id, name: currentTeam.name } : null,
          priority,
          assignee,
          watchers,
          // Keep the original timestamp if the date wasn't changed while editing.
          dueDate: ticket && toDateInput(ticket.dueDate) === dueDate ? ticket.dueDate : fromDateInput(dueDate),
        },
        files,
      );
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const assigneePlaceholder = !category
    ? "Select a category first"
    : categoryTeams.length > 0 && !currentTeam
      ? "Select a sub category first"
      : teamEmployees.loading
        ? "Loading employees…"
        : "Unassigned";

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{ticket ? `Edit ${ticket.key}` : "Raise a new ticket"}</DialogTitle>
          <DialogDescription>
            {ticket ? "Update the ticket details." : "Describe your request. The due date defaults to the priority's SLA and can be changed."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ticket-title">Title</Label>
            <Input id="ticket-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Laptop not connecting to VPN" />
          </div>

          {similar.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-amber-800">
                <Lightbulb className="h-3.5 w-3.5" />Similar tickets already exist. Is one of these your issue?
              </p>
              <ul className="space-y-1">
                {similar.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenChange(false);
                        onOpenTicket(t.id);
                      }}
                      className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-sm hover:bg-amber-100"
                    >
                      <span className="font-mono text-[11px] text-slate-500">{t.key}</span>
                      <span className="flex-1 truncate text-slate-800">{t.title}</span>
                      <StatusPill status={t.status} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ticket-desc">Description</Label>
            <Textarea id="ticket-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add details, steps tried, etc." />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {!ticket ? (
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Select
                  value={teamId || undefined}
                  onValueChange={(value) => {
                    setCategory("IT Support");
                    changeTeam(value);
                  }}
                  disabled={departmentsLoading || departmentsError || departments.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        departmentsLoading
                          ? "Loading departments..."
                          : departmentsError
                            ? "Failed to load departments"
                            : "Select a department"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {departmentsError && (
                  <p className="text-xs text-red-600">Could not load departments. Please try again later.</p>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={category || undefined} onValueChange={(value) => changeCategory(value as TicketCategory)}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {category && (
                  <div className="space-y-1.5">
                    <Label>Sub category</Label>
                    <Select
                      value={teamId || ""}
                      onValueChange={changeTeam}
                      disabled={
                        category === "IT Support"
                          ? departmentsLoading || departmentsError || departments.length === 0
                          : teamsLoading || teamOptions.length === 0
                      }
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            category === "IT Support"
                              ? departmentsLoading
                                ? "Loading departments..."
                                : departmentsError
                                  ? "Failed to load departments"
                                  : "Select a department"
                              : teamsLoading
                                ? "Loading teams..."
                                : "Select a team"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {teamOptions.map((item) => (
                          <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">
                      {category === "IT Support"
                        ? "Departments"
                        : `${TEAM_CATEGORY_LABEL[CATEGORY_TEAM_TYPE[category]]} teams`}
                    </p>
                  </div>
                )}
              </>
            )}
            <div className="space-y-1.5">
              <Label>Assigned to</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId} disabled={assigneeOptions.length === 0}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>{assigneePlaceholder}</SelectItem>
                  {assigneeOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.designation && <span className="ml-1.5 text-xs text-slate-400">· {p.designation}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentTeam && teamEmployees.error && (
                <p className="text-xs text-red-600">Could not load employees for {currentTeam.name}.</p>
              )}
              {currentTeam && !teamEmployees.loading && !teamEmployees.error && teamMembers.length === 0 && (
                <p className="text-xs text-amber-700">No onboarded employees found for {currentTeam.name}.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => changePriority(v as TicketPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", p.dot)} />
                        {p.label} · SLA {p.slaDays}d
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ticket-due">Due date</Label>
              <Input
                id="ticket-due"
                type="date"
                value={dueDate}
                min={ticket ? undefined : today}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  setDueTouched(true);
                }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Add people</Label>
            <PeoplePicker
              value={watchers}
              onChange={setWatchers}
              people={employees}
              excludeIds={[ticket?.raisedBy.id ?? currentUserId, assigneeId]}
            />
          </div>

          {!ticket && (
            <div className="space-y-1.5">
              <Label>Documents</Label>
              <FileDropZone files={files} onChange={setFiles} />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={saving} onClick={() => void submit()}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {ticket ? "Save changes" : "Create ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TicketFormDialog;
