// [ticket-management] The search / filter state of the page and the resulting list of tickets.
import { useCallback, useMemo, useState } from "react";
import { endOfDay, endOfWeek } from "date-fns";
import {
  DEFAULT_FILTERS,
  isDone,
  isOverdue,
  isSamePerson,
  priorityMeta,
  type Ticket,
  type TicketFilters,
  type TicketPerson,
} from "./types";

const matchesMemberFilter = (ticket: Ticket, value: string) => {
  const separator = value.indexOf("::");
  const memberId = separator < 0 ? value : value.slice(0, separator);
  const memberEmail = separator < 0 ? "" : value.slice(separator + 2).trim().toLowerCase();

  return (
    ticket.assignee?.id === memberId ||
    Boolean(memberEmail && ticket.assignee?.email?.trim().toLowerCase() === memberEmail) ||
    ticket.team?.id === value
  );
};

export const useTicketFilters = (tickets: Ticket[], me: TicketPerson) => {
  const [filters, setFilters] = useState<TicketFilters>(DEFAULT_FILTERS);
  const patchFilters = useCallback((patch: Partial<TicketFilters>) => setFilters((f) => ({ ...f, ...patch })), []);

  const filtered = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    const dueLimit =
      filters.dueWithin === "today" ? endOfDay(new Date()).getTime() : filters.dueWithin === "week" ? endOfWeek(new Date(), { weekStartsOn: 1 }).getTime() : null;
    return tickets.filter((t) => {
      if (filters.priority !== "all" && t.priority !== filters.priority) return false;
      if (
        filters.category !== "all" &&
        t.team?.id !== filters.category &&
        t.team?.name !== filters.category
      ) return false;
      if (filters.team !== "all" && !matchesMemberFilter(t, filters.team)) return false;
      if (filters.scope === "mine" && !isSamePerson(t.raisedBy, me)) return false;
      if (filters.scope === "assigned" && !isSamePerson(t.assignee, me)) return false;
      if (filters.scope === "shared" && !t.watchers.some((p) => isSamePerson(p, me))) return false;
      if (filters.scope === "unassigned" && t.assignee) return false;
      if (filters.dueWithin === "overdue" && !isOverdue(t)) return false;
      if (dueLimit && (isDone(t) || new Date(t.dueDate).getTime() > dueLimit)) return false;
      if (!term) return true;
      return [t.key, t.title, t.description, t.raisedBy.name, t.assignee?.name ?? "", t.team?.name ?? ""].some((v) => v.toLowerCase().includes(term));
    });
  }, [tickets, filters, me]);

  // Most urgent first (also the order of the J / K keyboard navigation).
  const ordered = useMemo(
    () =>
      [...filtered].sort(
        (a, b) =>
          Number(isDone(a)) - Number(isDone(b)) ||
          b.escalationLevel - a.escalationLevel ||
          priorityMeta(a.priority).slaDays - priorityMeta(b.priority).slaDays ||
          a.dueDate.localeCompare(b.dueDate),
      ),
    [filtered],
  );

  const filtersActive = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  return { filters, setFilters, patchFilters, filtered, ordered, filtersActive };
};
