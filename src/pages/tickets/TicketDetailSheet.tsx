// [ticket-management] Side panel for one ticket. This file only puts the sections together;
// each section lives in its own file in ./detail/.
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import ClosureConfirm from "./detail/ClosureConfirm";
import DetailHeader from "./detail/DetailHeader";
import DiscussionPanel from "./detail/DiscussionPanel";
import DocumentsSection from "./detail/DocumentsSection";
import FieldsPanel from "./detail/FieldsPanel";
import LinksSection from "./detail/LinksSection";
import PeopleSection from "./detail/PeopleSection";
import SectionTitle from "./detail/SectionTitle";
import { useRunAction } from "./detail/useRunAction";
import { ticketKeys } from "./hooks";
import { canActOnTicket, canSeeInternal, type Ticket, type TicketEmployee, type TicketPerson } from "./types";

interface TicketDetailSheetProps {
  ticket: Ticket | null;
  me: TicketPerson;
  /** Admin / HR. */
  isStaff: boolean;
  /** Admin / HR / manager. */
  isManager: boolean;
  employees: TicketEmployee[];
  assigneeOptions: TicketPerson[];
  allTickets: Ticket[];
  onClose: () => void;
  onEdit: () => void;
  onOpenTicket: (id: string) => void;
}

const TicketDetailSheet = ({
  ticket,
  me,
  isStaff,
  isManager,
  employees,
  assigneeOptions,
  allTickets,
  onClose,
  onEdit,
  onOpenTicket,
}: TicketDetailSheetProps) => {
  const queryClient = useQueryClient();
  const run = useRunAction();
  const id = ticket?.id ?? null;

  // Comments / activity / links refresh live via the ticket list's realtime channel.
  useEffect(() => {
    if (!id) return;
    void queryClient.invalidateQueries({ queryKey: ticketKeys.detail(id) });
  }, [id, ticket?.updatedAt, ticket?.commentCount, queryClient]);

  if (!ticket) {
    return (
      <Dialog open={false} onOpenChange={() => onClose()}>
        <DialogContent />
      </Dialog>
    );
  }

  const canAct = canActOnTicket(ticket, me, isManager);
  const internalAllowed = canSeeInternal(ticket, me, isManager);
  const assignees =
    ticket.assignee && !assigneeOptions.some((p) => p.id === ticket.assignee!.id) ? [ticket.assignee, ...assigneeOptions] : assigneeOptions;
  const otherTickets = allTickets.filter((t) => t.id !== ticket.id);

  // key={ticket.id}: sections that keep their own typing state start fresh when another ticket is opened.
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-3xl overflow-y-auto">
        <div className="space-y-6">
          <DetailHeader ticket={ticket} canAct={canAct} isStaff={isStaff} onEdit={onEdit} onClose={onClose} run={run} />
          <ClosureConfirm key={`closure-${ticket.id}`} ticket={ticket} me={me} run={run} />
          <FieldsPanel ticket={ticket} me={me} canAct={canAct} isManager={isManager} assignees={assignees} run={run} />

          <div className="space-y-2">
            <SectionTitle>Description</SectionTitle>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{ticket.description}</p>
          </div>

          <PeopleSection key={`people-${ticket.id}`} ticket={ticket} employees={employees} canAct={canAct} run={run} />
          <DocumentsSection ticket={ticket} me={me} canAct={canAct} isManager={isManager} run={run} />
          <LinksSection
            key={`links-${ticket.id}`}
            ticket={ticket}
            me={me}
            canAct={canAct}
            otherTickets={otherTickets}
            onOpenTicket={onOpenTicket}
            run={run}
          />
          <DiscussionPanel
            key={`discussion-${ticket.id}`}
            ticket={ticket}
            me={me}
            employees={employees}
            canAct={canAct}
            internalAllowed={internalAllowed}
            isManager={isManager}
            run={run}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TicketDetailSheet;
