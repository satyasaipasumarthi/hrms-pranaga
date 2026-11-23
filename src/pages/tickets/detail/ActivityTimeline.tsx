// [ticket-management] The "Activity" tab: everything that happened to the ticket, newest first.
import { format } from "date-fns";
import { timeAgo } from "../TicketBits";
import type { TicketActivity } from "../types";

const ActivityTimeline = ({ entries }: { entries: TicketActivity[] }) => (
  <ol className="relative space-y-4 border-l border-slate-200 pl-4">
    {[...entries].reverse().map((a) => (
      <li key={a.id} className="relative text-sm">
        <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-orange-400" />
        <p className="text-slate-700"><span className="font-medium text-slate-900">{a.by}</span> {a.text}</p>
        <p className="text-xs text-slate-400" title={format(new Date(a.at), "PPpp")}>{timeAgo(a.at)}</p>
      </li>
    ))}
  </ol>
);

export default ActivityTimeline;
