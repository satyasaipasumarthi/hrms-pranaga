// [ticket-management] "People added" on a ticket: show them, add more, remove them.
import { useState } from "react";
import { UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as api from "../api";
import PeoplePicker from "../PeoplePicker";
import { PersonAvatar } from "../TicketBits";
import type { Ticket, TicketEmployee } from "../types";
import SectionTitle from "./SectionTitle";
import type { RunAction } from "./useRunAction";

interface PeopleSectionProps {
  ticket: Ticket;
  employees: TicketEmployee[];
  canAct: boolean;
  run: RunAction;
}

const PeopleSection = ({ ticket, employees, canAct, run }: PeopleSectionProps) => {
  const [addingPeople, setAddingPeople] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <SectionTitle>People added ({ticket.watchers.length})</SectionTitle>
        {canAct && (
          <Button variant="ghost" size="sm" onClick={() => setAddingPeople((v) => !v)}>
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />{addingPeople ? "Done" : "Add people"}
          </Button>
        )}
      </div>
      {addingPeople && (
        <PeoplePicker
          value={ticket.watchers}
          onChange={(next) => void run(() => api.syncWatchers(ticket.id, ticket.watchers, next))}
          people={employees}
          excludeIds={[ticket.raisedBy.id, ticket.assignee?.id ?? ""]}
        />
      )}
      {!addingPeople &&
        (ticket.watchers.length === 0 ? (
          <p className="text-sm text-slate-400">Only the requester and the person it is assigned to are on this ticket.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {ticket.watchers.map((person) => (
              <span key={person.id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-0.5 pl-0.5 pr-1.5 text-xs text-slate-700">
                <PersonAvatar person={person} />
                {person.name}
                {canAct && (
                  <button
                    type="button"
                    title={`Remove ${person.name}`}
                    onClick={() => void run(() => api.removeWatcher(ticket.id, person.id))}
                    className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        ))}
    </div>
  );
};

export default PeopleSection;
