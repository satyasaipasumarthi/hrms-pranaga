// [ticket-management] Public entry points used by App.tsx, the sidebar and the top bar.
import { Ticket } from "lucide-react";
import type { AppModule, NavItem } from "@/lib/roles";

export const TICKETS_PATH = "/tickets";

// Not part of the role/permission tables on purpose: the prototype is visible to every
// signed-in user and can be removed without any database change.
const ticketsNavItem: NavItem = {
  label: "Tickets",
  icon: Ticket,
  path: TICKETS_PATH,
  module: "tickets" as AppModule,
};

/** Inserts the Tickets link just before Settings (or at the end). */
export const withTicketsNavItem = (items: NavItem[]): NavItem[] => {
  const settingsIndex = items.findIndex((item) => item.path === "/settings");
  if (settingsIndex === -1) return [...items, ticketsNavItem];
  return [...items.slice(0, settingsIndex), ticketsNavItem, ...items.slice(settingsIndex)];
};
