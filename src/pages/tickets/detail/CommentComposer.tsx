// [ticket-management] Box to write a comment: @mentions, pasted screenshots, attached files, internal-note switch.
import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import * as api from "../api";
import { ticketKeys } from "../hooks";
import MentionTextarea, { activeMentions } from "../MentionTextarea";
import { acceptFiles, StagedFiles } from "../TicketAttachments";
import { isSamePerson, type Ticket, type TicketEmployee, type TicketPerson } from "../types";
import type { RunAction } from "./useRunAction";

interface CommentComposerProps {
  ticket: Ticket;
  me: TicketPerson;
  employees: TicketEmployee[];
  /** True when the user may write internal notes (admin / HR / manager, assigned person, added people). */
  internalAllowed: boolean;
  run: RunAction;
}

const CommentComposer = ({ ticket, me, employees, internalAllowed, run }: CommentComposerProps) => {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [mentions, setMentions] = useState<TicketPerson[]>([]);
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [internal, setInternal] = useState(false);
  const [posting, setPosting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const mentionable = useMemo(() => employees.filter((p) => !isSamePerson(p, me)), [employees, me]);

  const postComment = async () => {
    if (!comment.trim() && !commentFiles.length) return;
    setPosting(true);
    const ok = await run(() =>
      api.addComment(ticket.id, comment, { internal: internal && internalAllowed, mentions: activeMentions(comment, mentions), files: commentFiles }, me),
    );
    setPosting(false);
    if (ok) {
      setComment("");
      setMentions([]);
      setCommentFiles([]);
      void queryClient.invalidateQueries({ queryKey: ticketKeys.comments(ticket.id) });
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-2">
      <MentionTextarea
        value={comment}
        onChange={setComment}
        mentions={mentions}
        onMentionsChange={setMentions}
        people={mentionable}
        onPasteFiles={(files) => setCommentFiles((prev) => [...prev, ...acceptFiles(files)])}
        onSubmit={() => void postComment()}
        placeholder={internal ? "Internal note: not visible to the requester…" : "Write a comment… Type @ to mention, paste screenshots with Ctrl+V"}
        className={cn("border-0 shadow-none focus-visible:ring-0", internal && "bg-amber-50")}
      />
      <StagedFiles files={commentFiles} onChange={setCommentFiles} />
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => fileInput.current?.click()} title="Attach files">
          <Paperclip className="h-4 w-4" />
        </Button>
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            setCommentFiles((prev) => [...prev, ...acceptFiles(e.target.files)]);
            e.target.value = "";
          }}
        />
        {internalAllowed && (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
            <Switch checked={internal} onCheckedChange={setInternal} />
            <Lock className="h-3 w-3" />Internal note
          </label>
        )}
        <span className="ml-auto hidden text-[11px] text-slate-400 sm:inline">Ctrl+Enter to send</span>
        <Button size="sm" disabled={posting || (!comment.trim() && !commentFiles.length)} onClick={() => void postComment()}>
          <Send className="mr-1.5 h-3.5 w-3.5" />{posting ? "Sending…" : internal ? "Add note" : "Comment"}
        </Button>
      </div>
    </div>
  );
};

export default CommentComposer;
