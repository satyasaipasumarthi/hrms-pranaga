// [ticket-management] Loads the lists the page needs from Supabase: all employees, the teams (sub categories),
// and starts the deadline automation (warnings, escalation, auto-close).
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import type { AuthUser } from "@/lib/roles";
import * as api from "./api";
import { ticketKeys } from "./hooks";
import { fetchAllEmployees, fetchTicketTeams } from "./ticketDirectory";
import type { TicketEmployee, TicketPerson, TicketTeam } from "./types";

export const useTicketDirectory = (user: AuthUser | null, me: TicketPerson) => {
  const queryClient = useQueryClient();
  const [employees, setEmployees] = useState<TicketEmployee[]>([]);
  const [teams, setTeams] = useState<TicketTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchAllEmployees()
      .then((rows) => !cancelled && setEmployees(rows))
      .catch((error) => console.error("[tickets] employees", error));
    fetchTicketTeams()
      .then((rows) => !cancelled && setTeams(rows))
      .catch((error) => {
        console.error("[tickets] teams", error);
        if (!cancelled) toast({ title: "Could not load teams", description: "Sub categories are unavailable.", variant: "destructive" });
      })
      .finally(() => !cancelled && setTeamsLoading(false));
    void api.runAutomationThrottled().then(() => queryClient.invalidateQueries({ queryKey: ticketKeys.all }));
    return () => {
      cancelled = true;
    };
  }, [user, queryClient]);

  // Everyone, plus the signed-in user even if they are missing from the list.
  const directory = useMemo(() => {
    const map = new Map<string, TicketEmployee>();
    employees.forEach((p) => map.set(p.id, p));
    if (user && !map.has(me.id)) map.set(me.id, me);
    return [...map.values()];
  }, [employees, me, user]);

  return { directory, teams, teamsLoading };
};
