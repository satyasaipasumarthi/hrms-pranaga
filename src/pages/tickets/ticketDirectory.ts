// [ticket-management] Reads teams and employees from Supabase for the ticket form.
import { useEffect, useState } from "react";
import { fetchTeams } from "@/lib/hrms-api";
import { supabase } from "@/lib/supabase";
import type { TicketEmployee, TicketPerson, TicketTeam } from "./types";

export const fetchTicketTeams = async (): Promise<TicketTeam[]> => {
  const rows = await fetchTeams();
  return rows
    .map((row) => ({ id: row.id, name: row.team_name, category: row.category, subCategory: row.sub_category }))
    .sort((a, b) => a.name.localeCompare(b.name));
};


export const fetchTicketDepartments = async (): Promise<TicketTeam[]> => {
  const { data, error } = await supabase
    .from("departments")
    .select("department_name")
    .not("department_name", "is", null)
    .order("department_name", { ascending: true });

  if (error) {
    console.error("[tickets] Failed to fetch departments:", error);
    throw error;
  }

  const seen = new Set<string>();
  return (data ?? [])
    .filter((row) => row.department_name?.trim())
    .filter((row) => {
      const name = row.department_name.trim();
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    })
    .map((row) => ({
      id: row.department_name.trim(),
      name: row.department_name.trim(),
      category: "ItOperations",
      subCategory: row.department_name.trim(),
    }));
};

/**
 * Every employee (for "Add people" and @mentions). Uses the ticket_directory() RPC so that
 * employees, whose profile access is limited by RLS, still see the full list.
 */
export const fetchAllEmployees = async (): Promise<TicketEmployee[]> => {
  const rpc = await supabase.rpc("ticket_directory");
  const rows =
    rpc.error || !rpc.data
      ? (await supabase.from("profiles").select("id, name, email, role").order("name")).data ?? []
      : rpc.data;
  if (rpc.error) console.warn("[tickets] ticket_directory RPC unavailable, using profiles", rpc.error);
  return (rows as { id: string; name: string | null; email: string | null; role: string | null }[]).map((row) => ({
    id: row.id,
    name: row.name || row.email || "Unnamed employee",
    email: row.email ?? undefined,
    role: row.role ?? undefined,
  }));
};

// Team sub categories (Teams page) that are spelled differently from onboarding departments.
const DEPARTMENT_ALIASES: Record<string, string> = {
  "Artificial Intelligence / Machine Learning": "AI",
};

/**
 * employee_onboarding has no team column, only `department`, so a team is matched to
 * departments by its sub category, its name, and (for HR teams) "HR".
 */
export const departmentsForTeam = (team: TicketTeam) => {
  const names = [team.subCategory, team.name, team.category === "Hr" ? "HR" : null]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => DEPARTMENT_ALIASES[value.trim()] ?? value.trim());
  return [...new Set(names)];
};

/** Employees from the onboarding table who belong to the team's department. */
export const fetchTeamEmployees = async (team: TicketTeam): Promise<TicketPerson[]> => {
  return fetchDepartmentEmployees(departmentsForTeam(team));
};

/** Employees from the onboarding table who belong to the requested departments. */
export const fetchDepartmentEmployees = async (departments: string[]): Promise<TicketPerson[]> => {
  if (!departments.length) return [];

  const rpc = await supabase.rpc("ticket_team_employees", { departments });
  if (!rpc.error && rpc.data) {
    return (rpc.data as { id: string; name: string; email: string | null; designation: string | null }[]).map((row) => ({
      id: row.id,
      name: row.name?.trim() || "Unnamed employee",
      email: row.email ?? undefined,
      designation: row.designation ?? undefined,
    }));
  }
  if (rpc.error) console.warn("[tickets] ticket_team_employees RPC unavailable, querying employee_onboarding", rpc.error);

  const { data, error } = await supabase
    .from("employee_onboarding")
    .select("id, first_name, last_name, business_email, personal_email, designation, department")
    .in("department", departments)
    .order("first_name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "Unnamed employee",
    email: ((row.business_email as string | null) || (row.personal_email as string | null)) ?? undefined,
    designation: (row.designation as string | null) ?? undefined,
  }));
};

const teamCache = new Map<string, Promise<TicketPerson[]>>();

/** Loads (and caches) the onboarding employees for a team. */
export const useTeamEmployees = (team: TicketTeam | null) => {
  const [state, setState] = useState<{ teamId: string | null; people: TicketPerson[]; loading: boolean; error: boolean }>({
    teamId: null,
    people: [],
    loading: false,
    error: false,
  });

useEffect(() => {
  if (!team) {
    setState({
      teamId: null,
      people: [],
      loading: false,
      error: false,
    });
    return;
  }

  const departmentName = team.name;

  let cancelled = false;

  setState({
    teamId: departmentName,
    people: [],
    loading: true,
    error: false,
  });

  if (!teamCache.has(departmentName)) {
    teamCache.set(
      departmentName,
      fetchTeamEmployees(team)
    );
  }

  teamCache
    .get(departmentName)!
    .then((people) => {
      if (!cancelled) {
        setState({
          teamId: departmentName,
          people,
          loading: false,
          error: false,
        });
      }
    })
    .catch((error) => {
      console.error(
        "Tickets: could not load department employees",
        error
      );

      teamCache.delete(departmentName);

      if (!cancelled) {
        setState({
          teamId: departmentName,
          people: [],
          loading: false,
          error: true,
        });
      }
    });

  return () => {
    cancelled = true;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [team?.name]);

return state;
};
