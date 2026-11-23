// [ticket-management] Documents attached to the ticket itself (files attached to a comment show under that comment).
import * as api from "../api";
import { AttachmentList } from "../TicketAttachments";
import { canRemoveAttachment, type Ticket, type TicketPerson } from "../types";
import type { RunAction } from "./useRunAction";

interface DocumentsSectionProps {
  ticket: Ticket;
  me: TicketPerson;
  canAct: boolean;
  isManager: boolean;
  run: RunAction;
}

const DocumentsSection = ({ ticket, me, canAct, isManager, run }: DocumentsSectionProps) => (
  <AttachmentList
    attachments={ticket.attachments.filter((a) => !a.commentId)}
    canUpload={canAct}
    canRemove={(a) => canAct && canRemoveAttachment(a, me, isManager)}
    onUpload={async (files) => {
      await run(() => api.uploadAttachments(ticket.id, files, me), `${files.length} document${files.length > 1 ? "s" : ""} attached`);
    }}
    onRemove={(a) => void run(() => api.removeAttachment(a, me), "Document removed")}
  />
);

export default DocumentsSection;
