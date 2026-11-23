// [ticket-management] The comments on a ticket: author, time, internal-note label, highlighted @mentions, attached files.
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import * as api from "../api";
import { AttachmentRows, ImageGallery } from "../TicketAttachments";
import { PersonAvatar, timeAgo } from "../TicketBits";
import { canRemoveAttachment, type Ticket, type TicketAttachment, type TicketComment, type TicketPerson } from "../types";
import type { RunAction } from "./useRunAction";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Renders "@Name" of mentioned people as highlighted chips. */
const highlightMentions = (text: string, mentions: TicketPerson[]) => {
  if (!mentions.length) return text;
  const pattern = new RegExp(`(${mentions.map((m) => escapeRegex(`@${m.name}`)).join("|")})`, "g");
  return text.split(pattern).map((part, i) =>
    mentions.some((m) => part === `@${m.name}`) ? (
      <span key={i} className="rounded bg-orange-100 px-0.5 font-medium text-orange-700">{part}</span>
    ) : (
      part
    ),
  );
};

interface CommentsListProps {
  ticket: Ticket;
  comments: TicketComment[] | undefined;
  loading: boolean;
  me: TicketPerson;
  isManager: boolean;
  run: RunAction;
}

const CommentsList = ({ ticket, comments, loading, me, isManager, run }: CommentsListProps) => {
  // Files attached to a comment are shown under that comment.
  const commentAttachments = new Map<string, TicketAttachment[]>();
  ticket.attachments.forEach((a) => {
    if (a.commentId) commentAttachments.set(a.commentId, [...(commentAttachments.get(a.commentId) ?? []), a]);
  });

  return (
    <>
      {loading && <p className="text-sm text-slate-400">Loading…</p>}
      {comments?.length === 0 && <p className="text-sm text-slate-400">No comments yet.</p>}
      {comments?.map((c) => {
        const files = commentAttachments.get(c.id) ?? [];
        return (
          <div key={c.id} className="flex gap-3">
            <PersonAvatar person={c.author} size="md" />
            <div className={cn("min-w-0 flex-1 space-y-2 rounded-lg px-3 py-2", c.isInternal ? "border border-dashed border-amber-300 bg-amber-50" : "bg-slate-50")}>
              <p className="text-xs text-slate-500">
                <span className="font-medium text-slate-800">{c.author.name}</span> · {timeAgo(c.createdAt)}
                {c.isInternal && (
                  <span className="ml-2 inline-flex items-center gap-0.5 font-medium text-amber-700"><Lock className="h-3 w-3" />Internal note</span>
                )}
              </p>
              {c.text !== "(attachment)" && (
                <p className="whitespace-pre-wrap break-words text-sm text-slate-700">
                  {highlightMentions(c.text, c.mentions)}
                </p>
              )}
              {files.length > 0 && (
                <>
                  <ImageGallery attachments={files} />
                  <AttachmentRows
                    attachments={files.filter((f) => !f.type.startsWith("image/"))}
                    canRemove={(a) => canRemoveAttachment(a, me, isManager)}
                    onRemove={(a) => void run(() => api.removeAttachment(a, me))}
                  />
                </>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
};

export default CommentsList;
