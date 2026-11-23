// [ticket-management] Search box, Board / List / Analytics switch, Views / Download / Board buttons and the filters.
import { useEffect, useState } from "react";
import { BarChart3, LayoutGrid, List, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { fetchDepartmentEmployees, fetchTicketDepartments } from "./ticketDirectory";
import BoardSettingsMenu from "./BoardSettingsMenu";
import DownloadMenu from "./DownloadMenu";
import type { BoardSettings } from "./KanbanBoard";
import SavedViewsMenu from "./SavedViewsMenu";
import type { TicketView } from "./useTicketPrefs";
import {
  DEFAULT_FILTERS,
  PRIORITIES,
  type Scope,
  type Ticket,
  type TicketFilters,
  type TicketPerson,
  type TicketTeam,
} from "./types";

interface FilterBarProps {
  filters: TicketFilters;
  patchFilters: (patch: Partial<TicketFilters>) => void;
  setFilters: (filters: TicketFilters) => void;
  filtersActive: boolean;
  view: TicketView;
  setView: (view: TicketView) => void;
  board: BoardSettings;
  setBoard: (board: BoardSettings) => void;
  /** Every ticket the user can see. */
  tickets: Ticket[];
  /** Tickets matching the current filters. */
  filtered: Ticket[];
}

const FilterBar = ({
  filters,
  patchFilters,
  setFilters,
  filtersActive,
  view,
  setView,
  board,
  setBoard,
  tickets,
  filtered,
}: FilterBarProps) => {
  const [departments, setDepartments] = useState<TicketTeam[]>([]);
  const [members, setMembers] = useState<TicketPerson[]>([]);
  const [departmentsError, setDepartmentsError] = useState(false);
  const memberFilterValue = (member: TicketPerson) =>
    `${member.id}::${member.email?.trim().toLowerCase() ?? ""}`;

  useEffect(() => {
    let cancelled = false;
    fetchTicketDepartments()
      .then(async (rows) => {
        if (!cancelled) setDepartments(rows);
        const employees = await fetchDepartmentEmployees(rows.map((department) => department.name));
        if (!cancelled) {
          setMembers(employees);
        }
      })
      .catch((error) => {
        console.error("[tickets] Could not load departments or onboarding employees for filters", error);
        if (!cancelled) setDepartmentsError(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={filters.search}
          onChange={(e) => patchFilters({ search: e.target.value })}
          placeholder="Search by ID, title, person, team…"
          className="pl-9"
        />
      </div>
      <div className="flex rounded-lg border border-slate-200 p-0.5">
        {([
          ["kanban", LayoutGrid, "Board"],
          ["list", List, "List"],
          ["analytics", BarChart3, "Analytics"],
        ] as const).map(([key, Icon, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm", view === key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>
      <SavedViewsMenu filters={filters} onApply={setFilters} />
      <DownloadMenu all={tickets} filtered={filtered} filtersActive={filtersActive} />
      {view === "kanban" && <BoardSettingsMenu settings={board} onChange={setBoard} />}
    </div>

    <div className="flex flex-wrap items-center gap-2">
      <div className="flex max-w-full overflow-x-auto rounded-lg border border-slate-200 p-0.5 text-sm">
        {([
          ["all", "All"],
          ["mine", "Raised by me"],
          ["assigned", "Assigned to me"],
          ["shared", "Added to"],
          ["unassigned", "Unassigned"],
        ] as [Scope, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => patchFilters({ scope: key })}
            className={cn("whitespace-nowrap rounded-md px-3 py-1.5", filters.scope === key ? "bg-orange-500 text-white" : "text-slate-600 hover:bg-slate-100")}
          >
            {label}
          </button>
        ))}
      </div>
      <Select value={filters.priority} onValueChange={(v) => patchFilters({ priority: v })}>
        <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All priorities</SelectItem>
          {PRIORITIES.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.category} onValueChange={(v) => patchFilters({ category: v, team: "all" })}>
        <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {departments.map((department) => (
            <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {departmentsError && (
        <span className="text-xs text-red-600">Departments or members could not be loaded.</span>
      )}
      <Select value={filters.team} onValueChange={(v) => patchFilters({ team: v })}>
        <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All members</SelectItem>
          {members.map((member) => (
            <SelectItem key={member.id} value={memberFilterValue(member)}>{member.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filters.dueWithin} onValueChange={(v) => patchFilters({ dueWithin: v as TicketFilters["dueWithin"] })}>
        <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any due date</SelectItem>
          <SelectItem value="overdue">Overdue</SelectItem>
          <SelectItem value="today">Due today</SelectItem>
          <SelectItem value="week">Due this week</SelectItem>
        </SelectContent>
      </Select>
      {filtersActive && (
        <Button variant="ghost" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>Clear</Button>
      )}
      <span className="ml-auto text-xs text-slate-500">{filtered.length} of {tickets.length} tickets</span>
    </div>
  </div>
  );
};

export default FilterBar;
