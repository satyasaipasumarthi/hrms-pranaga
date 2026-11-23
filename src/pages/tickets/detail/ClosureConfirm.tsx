// [ticket-management] "Is your issue solved?" for the person who raised a ticket in Review (close + star rating, or reopen),
// and the rating shown on a closed ticket.
import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import * as api from "../api";
import { Stars } from "../TicketBits";
import { isSamePerson, type Ticket, type TicketPerson } from "../types";
import type { RunAction } from "./useRunAction";

interface ClosureConfirmProps {
  ticket: Ticket;
  me: TicketPerson;
  run: RunAction;
}

const ClosureConfirm = ({ ticket, me, run }: ClosureConfirmProps) => {
  const [review, setReview] = useState<"idle" | "rate" | "reopen">("idle");
  const [rating, setRating] = useState(0);
  const [ratingNote, setRatingNote] = useState("");
  const [reopenReason, setReopenReason] = useState("");

  const isRequester = isSamePerson(ticket.raisedBy, me);

  const confirmSolved = async () => {
    if (!rating) return toast({ title: "Please pick a rating", variant: "destructive" });
    const ok = await run(
      () => api.updateTicket(ticket.id, { status: "closed", rating, ratingComment: ratingNote.trim() || null }),
      "Thanks! Ticket closed.",
    );
    if (ok) setReview("idle");
  };

  const reopen = async () => {
    if (!reopenReason.trim()) return toast({ title: "Please tell us what is still wrong", variant: "destructive" });
    const ok = await run(async () => {
      await api.addComment(ticket.id, `Reopened: ${reopenReason}`, { internal: false, mentions: [], files: [] }, me);
      await api.updateTicket(ticket.id, { status: "in_progress" });
    }, "Ticket reopened");
    if (ok) setReview("idle");
  };

  return (
    <>
      {ticket.status === "review" && isRequester && (
        <div className="rounded-xl border border-green-300 bg-green-50 p-4">
          {review === "idle" && (
            <>
              <p className="text-sm font-medium text-green-900">Is your issue solved?</p>
              <p className="mt-0.5 text-xs text-green-800">If you don't reply, the ticket closes automatically after 3 days.</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setReview("rate")}>
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />Yes, close it
                </Button>
                <Button size="sm" variant="outline" onClick={() => setReview("reopen")}>
                  <XCircle className="mr-1.5 h-4 w-4" />No, still a problem
                </Button>
              </div>
            </>
          )}
          {review === "rate" && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-green-900">How was the support?</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setRating(n)} title={`${n} star${n > 1 ? "s" : ""}`}>
                    <svg viewBox="0 0 20 20" className={cn("h-7 w-7 transition-transform hover:scale-110", n <= rating ? "fill-amber-400" : "fill-slate-300")}>
                      <path d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 14.9l-5.3 2.7 1-5.8L1.5 7.7l5.9-.9z" />
                    </svg>
                  </button>
                ))}
              </div>
              <Textarea rows={2} value={ratingNote} onChange={(e) => setRatingNote(e.target.value)} placeholder="Anything to add? (optional)" className="bg-white" />
              <div className="flex gap-2">
                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => void confirmSolved()}>Close ticket</Button>
                <Button size="sm" variant="ghost" onClick={() => setReview("idle")}>Back</Button>
              </div>
            </div>
          )}
          {review === "reopen" && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-green-900">What is still wrong?</p>
              <Textarea rows={2} value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} className="bg-white" />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void reopen()}>Reopen ticket</Button>
                <Button size="sm" variant="ghost" onClick={() => setReview("idle")}>Back</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {ticket.status === "closed" && ticket.rating && (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <Stars value={ticket.rating} />
          <span className="text-slate-600">{ticket.ratingComment || "Rated by the requester"}</span>
        </div>
      )}
    </>
  );
};

export default ClosureConfirm;
