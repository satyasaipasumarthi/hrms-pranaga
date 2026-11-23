// [ticket-management] Ticket management module.
// Everything for this feature lives in src/pages/tickets/ (+ supabase/ticket-management.sql).

export type TicketStatus = "open" | "in_progress" | "on_hold" | "review" | "closed";
export type TicketPriority = "highest" | "high" | "medium" | "low" | "lowest";
export type LinkKind = "blocks" | "clones" | "duplicate" | "causes" | "relates";
/** Team categories as stored in the Supabase `teams` table. */
export type TeamCategory = "ItOperations" | "Hr" | "Board";

export type TicketCategory = "IT Support" | "HR Query" | "Payroll" | "Leave & Attendance" | "Facilities" | "Access Request";

export interface TicketPerson {
  id: string;
  name: string;
  /** Used to match onboarding employees to the logged-in user (their ids differ). */
  email?: string;
  designation?: string;
}


/** A ticket subcategory option: either a Teams-page team or a department. */
export interface TicketTeam {
  /** For departments, this is the department_name; for teams, the teams.id UUID. */
  id: string;
  name: string;
  category: TeamCategory;
  subCategory: string | null;
}

export type TicketTeamRef = Pick<TicketTeam, "id" | "name">;


/** Employee from Supabase profiles (for "Add people" and @mentions). */
export interface TicketEmployee extends TicketPerson {
  role?: string;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  author: TicketPerson;
  text: string;
  isInternal: boolean;
  mentions: TicketPerson[];
  createdAt: string;
}

export interface TicketActivity {
  id: string;
  by: string;
  text: string;
  at: string;
}

export interface TicketAttachment {
  id: string;
  ticketId: string;
  commentId: string | null;
  path: string;
  name: string;
  size: number;
  type: string;
  uploadedBy: TicketPerson;
  uploadedAt: string;
}

export interface TicketLink {
  id: string;
  kind: LinkKind;
  /** The other ticket. */
  other: { id: string; key: string; title: string; status: TicketStatus };
  /** True when this ticket is the `ticket_id` side of the link. */
  outgoing: boolean;
}

export interface Ticket {
  id: string;
  number: number;
  /** Human readable id, e.g. TKT-1001. */
  key: string;
  title: string;
  description: string;
  category: TicketCategory;
  /** Sub category: the team that handles the ticket. */
  team: TicketTeamRef | null;
  priority: TicketPriority;
  status: TicketStatus;
  raisedBy: TicketPerson;
  assignee: TicketPerson | null;
  /** "Add people": extra employees who can see and follow the ticket (like CC). */
  watchers: TicketPerson[];
  attachments: TicketAttachment[];
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  dueDate: string;
  slaPausedAt: string | null;
  escalationLevel: number;
  reviewRequestedAt: string | null;
  closedAt: string | null;
  reopenedCount: number;
  rating: number | null;
  ratingComment: string | null;
}

export interface TicketNotification {
  id: string;
  ticketId: string | null;
  kind: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
}

export type Scope = "all" | "mine" | "assigned" | "shared" | "unassigned";

export interface TicketFilters {
  search: string;
  priority: string;
  category: string;
  team: string;
  scope: Scope;
  dueWithin: "any" | "overdue" | "today" | "week";
}

export const DEFAULT_FILTERS: TicketFilters = { search: "", priority: "all", category: "all", team: "all", scope: "all", dueWithin: "any" };

export interface SavedView {
  id: string;
  name: string;
  filters: TicketFilters;
}

// Column / tab colours. `header` is the solid tab colour, `tint` the lighter column body.
export const STATUSES: { id: TicketStatus; label: string; dot: string; header: string; tint: string; hex: string }[] = [
  { id: "open", label: "Open", dot: "bg-red-500", header: "bg-[#FFB3B3]", tint: "bg-[#FFB3B3]/25", hex: "#F87171" },
  { id: "in_progress", label: "In Progress", dot: "bg-yellow-500", header: "bg-[#FFE699]", tint: "bg-[#FFE699]/30", hex: "#EAB308" },
  { id: "on_hold", label: "On Hold", dot: "bg-orange-500", header: "bg-[#F8CBAD]", tint: "bg-[#F8CBAD]/30", hex: "#F97316" },
  { id: "review", label: "Review", dot: "bg-sky-500", header: "bg-[#94DCF8]", tint: "bg-[#94DCF8]/30", hex: "#0EA5E9" },
  { id: "closed", label: "Closed", dot: "bg-green-500", header: "bg-[#B5E6A2]", tint: "bg-[#B5E6A2]/30", hex: "#22C55E" },
];

/** Most urgent first. `slaDays` is the default deadline for a new ticket and also the sort order (smaller = more urgent). */
export const PRIORITIES: {
  id: TicketPriority;
  label: string;
  description: string;
  badge: string;
  bar: string;
  dot: string;
  hex: string;
  slaDays: number;
}[] = [
  { id: "highest", label: "Highest", description: "The problem will block progress.", badge: "bg-red-200 text-red-900 border-red-700", bar: "before:bg-red-800", dot: "bg-red-800", hex: "#991B1B", slaDays: 1 },
  { id: "high", label: "High", description: "Serious problem that could block progress.", badge: "bg-orange-100 text-orange-700 border-orange-300", bar: "before:bg-orange-500", dot: "bg-orange-500", hex: "#F97316", slaDays: 2 },
  { id: "medium", label: "Medium", description: "Has the potential to affect progress.", badge: "bg-yellow-100 text-yellow-800 border-yellow-300", bar: "before:bg-yellow-400", dot: "bg-yellow-400", hex: "#FACC15", slaDays: 4 },
  { id: "low", label: "Low", description: "Minor problem or easily worked around.", badge: "bg-slate-200 text-slate-700 border-slate-400", bar: "before:bg-slate-500", dot: "bg-slate-500", hex: "#64748B", slaDays: 7 },
  { id: "lowest", label: "Lowest", description: "Trivial problem with little or no impact on progress.", badge: "bg-slate-100 text-slate-500 border-slate-200", bar: "before:bg-slate-300", dot: "bg-slate-300", hex: "#CBD5E1", slaDays: 10 },
];

export const CATEGORIES: TicketCategory[] = [
  "IT Support",
  "HR Query",
  "Payroll",
  "Leave & Attendance",
  "Facilities",
  "Access Request",
];

/** Which Teams-page category each ticket category is routed to. */
export const CATEGORY_TEAM_TYPE: Record<TicketCategory, TeamCategory> = {
  "IT Support": "ItOperations",
  "Access Request": "ItOperations",
  "HR Query": "Hr",
  Payroll: "Hr",
  "Leave & Attendance": "Hr",
  Facilities: "Hr",
};

export const TEAM_CATEGORY_LABEL: Record<TeamCategory, string> = {
  ItOperations: "IT Operations",
  Hr: "HR Operations",
  Board: "Board",
};

/** The link types offered in the "Linked to" dropdown, in this order. */
export const LINK_KINDS: { id: LinkKind; label: string }[] = [
  { id: "blocks", label: "Blocks" },
  { id: "clones", label: "Cloners" },
  { id: "duplicate", label: "Duplicate" },
  { id: "causes", label: "Causes" },
  { id: "relates", label: "Relates" },
];

/** How a link reads from each side, e.g. TKT-1 "Blocks" TKT-2, and TKT-2 "Is blocked by" TKT-1. */
export const LINK_LABELS: Record<LinkKind, { outgoing: string; incoming: string }> = {
  blocks: { outgoing: "Blocks", incoming: "Is blocked by" },
  clones: { outgoing: "Clones", incoming: "Is cloned by" },
  duplicate: { outgoing: "Duplicates", incoming: "Is duplicated by" },
  causes: { outgoing: "Causes", incoming: "Is caused by" },
  relates: { outgoing: "Relates to", incoming: "Relates to" },
};

export const categoryLabel = (ticket: Pick<Ticket, "category" | "team">) =>
  ticket.team ? `${ticket.category} · ${ticket.team.name}` : ticket.category;

export const statusLabel = (status: TicketStatus) => STATUSES.find((s) => s.id === status)?.label ?? status;
export const priorityMeta = (priority: TicketPriority) => PRIORITIES.find((p) => p.id === priority) ?? PRIORITIES.find((p) => p.id === "medium")!;

/** Review and Closed tickets no longer count against the SLA. */
export const isDone = (ticket: Pick<Ticket, "status">) => ticket.status === "review" || ticket.status === "closed";

export const isOverdue = (ticket: Ticket) =>
  !isDone(ticket) && ticket.status !== "on_hold" && new Date(ticket.dueDate).getTime() < Date.now();

/**
 * Share of the SLA window used (0–1+). While On Hold the clock is paused at the moment it was paused.
 */
export const slaProgress = (ticket: Ticket, now = Date.now()) => {
  const start = new Date(ticket.createdAt).getTime();
  const due = new Date(ticket.dueDate).getTime();
  const at = ticket.slaPausedAt ? new Date(ticket.slaPausedAt).getTime() : now;
  if (due <= start) return 1;
  return Math.max(0, (at - start) / (due - start));
};

export const isSamePerson = (person: TicketPerson | null | undefined, me: TicketPerson) =>
  Boolean(
    person &&
      (person.id === me.id || (person.email && me.email && person.email.toLowerCase() === me.email.toLowerCase())),
  );

/** Internal notes: admin / HR / managers, the person it is assigned to, and people added to it. */
export const canSeeInternal = (ticket: Ticket, me: TicketPerson, isManager: boolean) =>
  isManager || isSamePerson(ticket.assignee, me) || ticket.watchers.some((p) => isSamePerson(p, me));

/** Everyone can view every ticket, but only managers, HR, admin and the people on a ticket can change it. */
export const canActOnTicket = (ticket: Ticket, me: TicketPerson, isManager: boolean) =>
  canSeeInternal(ticket, me, isManager) || isSamePerson(ticket.raisedBy, me);

/** Admin / HR / managers can remove any file; everyone else only the files they uploaded themselves. */
export const canRemoveAttachment = (attachment: TicketAttachment, me: TicketPerson, isManager: boolean) =>
  isManager || isSamePerson(attachment.uploadedBy, me);

export const formatBytes = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
