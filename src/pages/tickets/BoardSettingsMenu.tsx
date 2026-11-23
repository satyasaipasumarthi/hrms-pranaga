// [ticket-management] "Board" button: hide columns, set a card limit per column, group rows by priority / assignee.
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BoardSettings, Swimlane } from "./KanbanBoard";
import { STATUSES } from "./types";

const BoardSettingsMenu = ({ settings, onChange }: { settings: BoardSettings; onChange: (s: BoardSettings) => void }) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="outline" size="sm" className="h-9"><Settings2 className="mr-1.5 h-4 w-4" />Board</Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-80 space-y-4 border-slate-200 bg-white text-slate-900">
      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Group rows by</p>
        <Select value={settings.swimlane} onValueChange={(v) => onChange({ ...settings, swimlane: v as Swimlane })}>
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No swimlanes</SelectItem>
            <SelectItem value="priority">Priority</SelectItem>
            <SelectItem value="assignee">Assigned to</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Columns & card limits</p>
        {STATUSES.map((s) => (
          <div key={s.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={!settings.hidden.includes(s.id)}
              onCheckedChange={(v) =>
                onChange({ ...settings, hidden: v === true ? settings.hidden.filter((h) => h !== s.id) : [...settings.hidden, s.id] })
              }
            />
            <span className="flex-1">{s.label}</span>
            <Input
              type="number"
              min={0}
              placeholder="No limit"
              className="h-7 w-24 text-xs"
              value={settings.wip[s.id] ?? ""}
              onChange={(e) => {
                const value = Number(e.target.value);
                onChange({ ...settings, wip: { ...settings.wip, [s.id]: value > 0 ? value : undefined } });
              }}
            />
          </div>
        ))}
        <p className="text-[11px] text-slate-500">A column turns red when it has more tickets than its limit.</p>
      </div>
    </PopoverContent>
  </Popover>
);

export default BoardSettingsMenu;
