// [ticket-management] Main Ticket Management page. It only puts the pieces together:
//   data      -> hooks.ts, useTicketDirectory.ts (+ api/ for Supabase)
//   rules     -> useTicketFilters.ts, useSelectedTicket.ts, useMoveTicket.ts, useSaveTicket.ts
//   screens   -> StatCards, FilterBar, KanbanBoard, TicketListView, AnalyticsView, TicketFormDialog, TicketDetailSheet
import { useCallback, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import PageWrapper from "@/components/ui/PageWrapper";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import AnalyticsView from "./AnalyticsView";
import FilterBar from "./FilterBar";
import { useTicketList } from "./hooks";
import KanbanBoard from "./KanbanBoard";
import StatCards from "./StatCards";
import TicketDetailSheet from "./TicketDetailSheet";
import TicketFormDialog from "./TicketFormDialog";
import TicketListView from "./TicketListView";
import { useMoveTicket } from "./useMoveTicket";
import { useSaveTicket } from "./useSaveTicket";
import { useSelectedTicket } from "./useSelectedTicket";
import { useTicketDirectory } from "./useTicketDirectory";
import { useTicketFilters } from "./useTicketFilters";
import { useTicketPrefs } from "./useTicketPrefs";
import { canActOnTicket, type Ticket, type TicketPerson } from "./types";
import "./Tickets.css";

const TicketsPage = () => {
  const { user } = useAuth();

  const me: TicketPerson = useMemo(
    () => ({ id: user?.id ?? "me", name: user?.name || user?.email || "Me", email: user?.email ?? undefined }),
    [user],
  );
  const isStaff = user?.role === "admin" || user?.role === "hr";
  const isManager = isStaff || user?.role === "manager";

  // Data
  const ticketsQuery = useTicketList(Boolean(user));
  const tickets = useMemo(() => ticketsQuery.data ?? [], [ticketsQuery.data]);
  const { directory, teams, teamsLoading } = useTicketDirectory(user, me);

  // Screen state
  const { view, setView, board, setBoard } = useTicketPrefs();
  const { filters, setFilters, patchFilters, filtered, ordered, filtersActive } = useTicketFilters(tickets, me);
  const { selected, selectedAssignees, openTicket } = useSelectedTicket(tickets, teams, directory);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Ticket | null>(null);

  const newTicket = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);

  // Actions
  const moveTicket = useMoveTicket(tickets, me, isManager);
  const saveTicket = useSaveTicket(me);

  const setupError = ticketsQuery.error as Error | null;

  return (
    <div className="tickets-light min-h-full">
      <PageWrapper
        label=""
        title="Ticket Management"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={newTicket}>
              <Plus className="mr-1.5 h-4 w-4" />New ticket
            </Button>
          </div>
        }
      >
        {setupError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-medium">Tickets could not be loaded.</p>
            <p className="mt-1">{setupError.message}</p>
          </div>
        )}

        <StatCards tickets={tickets} me={me} isManager={isManager} loading={ticketsQuery.isLoading} onFilter={setFilters} />

        <FilterBar
          filters={filters}
          patchFilters={patchFilters}
          setFilters={setFilters}
          filtersActive={filtersActive}
          view={view}
          setView={setView}
          board={board}
          setBoard={setBoard}
          tickets={tickets}
          filtered={filtered}
        />

        {ticketsQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-xl bg-slate-100" />)}
          </div>
        ) : view === "kanban" ? (
          <KanbanBoard
            tickets={filtered}
            settings={board}
            onOpen={(t) => openTicket(t.id)}
            onEdit={(t) => {
              setEditing(t);
              setFormOpen(true);
            }}
            canEdit={(t) => canActOnTicket(t, me, isManager)}
            onQuickCreate={newTicket}
            onMove={(id, status) => void moveTicket(id, status)}
          />
        ) : view === "list" ? (
          <TicketListView tickets={ordered} teams={teams} employees={directory} isStaff={isStaff} onOpen={(t) => openTicket(t.id)} />
        ) : (
          <AnalyticsView tickets={filtered} />
        )}
      </PageWrapper>

      <TicketFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        ticket={editing}
        employees={directory}
        teams={teams}
        teamsLoading={teamsLoading}
        existingTickets={tickets}
        currentUserId={me.id}
        onOpenTicket={openTicket}
        onSubmit={(input, files) => saveTicket(editing, input, files)}
      />

      <TicketDetailSheet
        ticket={selected}
        me={me}
        isStaff={isStaff}
        isManager={isManager}
        employees={directory}
        assigneeOptions={selectedAssignees}
        allTickets={tickets}
        onClose={() => openTicket(null)}
        onOpenTicket={openTicket}
        onEdit={() => {
          setEditing(selected);
          setFormOpen(true);
        }}
      />
    </div>
  );
};

export default TicketsPage;
