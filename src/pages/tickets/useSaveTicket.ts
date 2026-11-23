// [ticket-management] What happens when the create / edit form is saved.
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import * as api from "./api";
import type { TicketInput } from "./api";
import { ticketKeys } from "./hooks";
import type { Ticket, TicketPerson } from "./types";

export const useSaveTicket = (me: TicketPerson) => {
  const queryClient = useQueryClient();

  /** Updates `editing` when given, otherwise creates a new ticket. */
  return async (editing: Ticket | null, input: TicketInput, files: File[]) => {
    if (editing) {
      await api.updateTicket(editing.id, {
        title: input.title,
        description: input.description,
        category: input.category,
        team: input.team,
        priority: input.priority,
        assignee: input.assignee,
        dueDate: input.dueDate,
      });
      await api.syncWatchers(editing.id, editing.watchers, input.watchers);
      toast({ title: `${editing.key} updated` });
    } else {
      const created = await api.createTicket(input, me, files);
      toast({
        title: `${created.key} created`,
        description: input.assignee ? `Assigned to ${input.assignee.name}` : created.title,
      });
    }
    void queryClient.invalidateQueries({ queryKey: ticketKeys.all });
  };
};
