// [ticket-management] Shared by the detail-panel sections: run a change, show the result, refresh the list.
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { ticketKeys } from "../hooks";

export type RunAction = (action: () => Promise<unknown>, success?: string) => Promise<boolean>;

/** Returns a function that runs a ticket change, shows a message on success or failure, and refreshes the ticket list. */
export const useRunAction = (): RunAction => {
  const queryClient = useQueryClient();
  return useCallback(
    async (action, success) => {
      try {
        await action();
        if (success) toast({ title: success });
        void queryClient.invalidateQueries({ queryKey: ticketKeys.all });
        return true;
      } catch (error) {
        toast({ title: "Something went wrong", description: (error as Error).message, variant: "destructive" });
        return false;
      }
    },
    [queryClient],
  );
};
