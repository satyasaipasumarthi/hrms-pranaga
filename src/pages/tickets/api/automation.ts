// [ticket-management] Deadline warnings, escalation and auto-close (function: run_ticket_automation).
import { supabase } from "@/lib/supabase";

const AUTOMATION_KEY = "hrms.tickets.automationRanAt";

/** Runs SLA warnings / escalation / auto-close at most every 5 minutes per browser. */
export const runAutomationThrottled = async () => {
  try {
    const last = Number(sessionStorage.getItem(AUTOMATION_KEY)) || 0;
    if (Date.now() - last < 5 * 60_000) return;
    sessionStorage.setItem(AUTOMATION_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable: just run it.
  }
  const { error } = await supabase.rpc("run_ticket_automation");
  if (error) console.warn("[tickets] automation", error);
};
