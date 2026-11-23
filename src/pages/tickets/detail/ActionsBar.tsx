// [ticket-management] Edit and Delete icons at the right end of the ticket heading (delete asks for confirmation).
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import * as api from "../api";
import type { Ticket } from "../types";
import type { RunAction } from "./useRunAction";

interface ActionsBarProps {
  ticket: Ticket;
  canAct: boolean;
  /** Admin / HR: only they can delete. */
  isStaff: boolean;
  onEdit: () => void;
  onClose: () => void;
  run: RunAction;
}

const ActionsBar = ({ ticket, canAct, isStaff, onEdit, onClose, run }: ActionsBarProps) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!canAct && !isStaff) return null;

  return (
    <>
      <div className="flex shrink-0 items-center gap-0.5">
        {canAct && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-800" title="Edit ticket" aria-label="Edit ticket" onClick={onEdit}>
            <Pencil className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        )}
        {isStaff && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:bg-red-50 hover:text-red-600" title="Delete ticket" aria-label="Delete ticket" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        )}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {ticket.key}?</AlertDialogTitle>
            <AlertDialogDescription>The ticket, its comments, documents and history are permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => void run(() => api.deleteTicket(ticket), `${ticket.key} deleted`).then((ok) => ok && onClose())}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ActionsBar;
