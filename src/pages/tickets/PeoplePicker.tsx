// [ticket-management] Multi-select for "Add people" (works like CC on an email).
import { useState } from "react";
import { Check, UserPlus, X } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "./TicketBits";
import type { TicketPerson } from "./types";

interface PeoplePickerProps {
  value: TicketPerson[];
  onChange: (people: TicketPerson[]) => void;
  people: TicketPerson[];
  /** People who can't be picked (e.g. the ticket raiser). */
  excludeIds?: string[];
}

const PeoplePicker = ({ value, onChange, people, excludeIds = [] }: PeoplePickerProps) => {
  const [open, setOpen] = useState(false);
  const selected = new Set(value.map((p) => p.id));
  const options = people.filter((p) => !excludeIds.includes(p.id));

  const toggle = (person: TicketPerson) =>
    onChange(selected.has(person.id) ? value.filter((p) => p.id !== person.id) : [...value, person]);

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 text-left text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {value.length === 0 && (
              <span className="flex items-center gap-1.5 px-1 text-muted-foreground">
                <UserPlus className="h-4 w-4" />Add employees to this ticket
              </span>
            )}
            {value.map((person) => (
              <span key={person.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-0.5 pr-1.5 text-xs text-slate-700">
                <PersonAvatar person={person} />
                {person.name}
                <span
                  role="button"
                  tabIndex={0}
                  title={`Remove ${person.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(person);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      toggle(person);
                    }
                  }}
                  className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-red-600"
                >
                  <X className="h-3 w-3" />
                </span>
              </span>
            ))}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" onWheel={(e) => e.stopPropagation()}>
          <Command>
            <CommandInput placeholder="Search employees…" />
            <CommandList>
              <CommandEmpty>No employees found.</CommandEmpty>
              <CommandGroup>
                {options.map((person) => (
                  <CommandItem key={person.id} value={`${person.name} ${person.id}`} onSelect={() => toggle(person)}>
                    <Check className={cn("mr-2 h-4 w-4", selected.has(person.id) ? "opacity-100" : "opacity-0")} />
                    <PersonAvatar person={person} />
                    <span className="ml-2 truncate">{person.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default PeoplePicker;
