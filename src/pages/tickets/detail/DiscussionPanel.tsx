// [ticket-management] Bottom of the detail panel: "Comments" and "Activity" tabs.
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTicketActivity, useTicketComments } from "../hooks";
import type { Ticket, TicketEmployee, TicketPerson } from "../types";
import ActivityTimeline from "./ActivityTimeline";
import CommentComposer from "./CommentComposer";
import CommentsList from "./CommentsList";
import type { RunAction } from "./useRunAction";

interface DiscussionPanelProps {
  ticket: Ticket;
  me: TicketPerson;
  employees: TicketEmployee[];
  canAct: boolean;
  internalAllowed: boolean;
  isManager: boolean;
  run: RunAction;
}

const DiscussionPanel = ({ ticket, me, employees, canAct, internalAllowed, isManager, run }: DiscussionPanelProps) => {
  const comments = useTicketComments(ticket.id);
  const activity = useTicketActivity(ticket.id);
  const [tab, setTab] = useState<"comments" | "activity">("comments");

  return (
    <div>
      <div className="mb-3 flex gap-4 border-b border-slate-200 text-sm">
        {(["comments", "activity"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn("-mb-px border-b-2 pb-2 capitalize", tab === key ? "border-orange-500 font-medium text-slate-900" : "border-transparent text-slate-500")}
          >
            {key} ({key === "comments" ? (comments.data?.length ?? ticket.commentCount) : (activity.data?.length ?? 0)})
          </button>
        ))}
      </div>

      {/* Kept mounted (just hidden) on the Activity tab so a half-written comment is not lost. */}
      <div className={cn("space-y-4", tab !== "comments" && "hidden")}>
        <CommentsList ticket={ticket} comments={comments.data} loading={comments.isLoading} me={me} isManager={isManager} run={run} />
        {canAct ? (
          <CommentComposer ticket={ticket} me={me} employees={employees} internalAllowed={internalAllowed} run={run} />
        ) : (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
            View only: you are not on this ticket, so you can't comment on it.
          </p>
        )}
      </div>

      {tab === "activity" && <ActivityTimeline entries={activity.data ?? []} />}
    </div>
  );
};

export default DiscussionPanel;
