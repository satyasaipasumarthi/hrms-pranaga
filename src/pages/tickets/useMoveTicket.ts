// [ticket-management] Dragging a ticket to another board column changes its status.
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import * as api from "./api";
import { ticketKeys } from "./hooks";
import { canActOnTicket, statusLabel, type Ticket, type TicketPerson } from "./types";

export const useMoveTicket = (tickets: Ticket[], me: TicketPerson, isManager: boolean) => {
  const queryClient = useQueryClient();

  return async (id: string, status: Ticket["status"]) => {
    const ticket = tickets.find((t) => t.id === id);
    if (!ticket || ticket.status === status) return;
    if (!canActOnTicket(ticket, me, isManager)) {
      toast({ title: `${ticket.key} is view only`, description: "Only people on a ticket, managers, HR and admin can change it.", variant: "destructive" });
      return;
    }
    // Optimistic move so the board feels instant.
    queryClient.setQueryData<Ticket[]>(ticketKeys.all, (old) => old?.map((t) => (t.id === id ? { ...t, status } : t)));
    try {
      await api.updateTicket(id, { status });
      toast({ title: `${ticket.key} moved to ${statusLabel(status)}` });
    } catch (error) {
      toast({ title: "Could not move ticket", description: (error as Error).message, variant: "destructive" });
    } finally {
      void queryClient.invalidateQueries({ queryKey: ticketKeys.all });
    }
  };
};
