// [ticket-management] Which ticket is open in the side panel. It lives in the URL (?ticket=<id>)
// so a notification can link straight to it.
import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useTeamEmployees } from "./ticketDirectory";
import { CATEGORY_TEAM_TYPE, type Ticket, type TicketPerson, type TicketTeam } from "./types";

export const useSelectedTicket = (tickets: Ticket[], teams: TicketTeam[], directory: TicketPerson[]) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("ticket");

  const openTicket = useCallback(
    (id: string | null) =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id) next.set("ticket", id);
          else next.delete("ticket");
          return next;
        },
        { replace: true },
      ),
    [setSearchParams],
  );

  const selected = tickets.find((t) => t.id === selectedId) ?? null;

  // Who the open ticket can be re-assigned to: the employees of its team.
  const selectedTeam = selected?.team
    ? teams.find((t) => t.id === selected.team!.id) ??
      (selected.category === "IT Support"
        ? { ...selected.team, category: "ItOperations" as const, subCategory: selected.team.name }
        : null)
    : null;
  const selectedTeamEmployees = useTeamEmployees(selectedTeam);
  const selectedAssignees: TicketPerson[] = selected?.team
    ? selectedTeamEmployees.people
    : selected && teams.some((t) => t.category === CATEGORY_TEAM_TYPE[selected.category])
      ? []
      : directory;

  return { selectedId, selected, selectedAssignees, openTicket };
};
