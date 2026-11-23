// [ticket-management] "Views" button: save the current filters under a name and re-apply them later.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bookmark, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { deleteView, saveView } from "./api";
import { ticketKeys, useSavedViews } from "./hooks";
import type { TicketFilters } from "./types";

const SavedViewsMenu = ({ filters, onApply }: { filters: TicketFilters; onApply: (filters: TicketFilters) => void }) => {
  const queryClient = useQueryClient();
  const views = useSavedViews();
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    try {
      await saveView(name, filters);
      setName("");
      toast({ title: `View "${name.trim()}" saved` });
      void queryClient.invalidateQueries({ queryKey: ticketKeys.views });
    } catch (error) {
      toast({ title: "Could not save view", description: (error as Error).message, variant: "destructive" });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9"><Bookmark className="mr-1.5 h-4 w-4" />Views</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3 border-slate-200 bg-white text-slate-900">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Saved views</p>
        {views.data?.length === 0 && <p className="text-sm text-slate-400">Save your current filters as a view.</p>}
        <ul className="space-y-1">
          {views.data?.map((v) => (
            <li key={v.id} className="flex items-center gap-1">
              <button
                type="button"
                className="flex-1 truncate rounded px-2 py-1.5 text-left text-sm hover:bg-slate-100"
                onClick={() => {
                  onApply(v.filters);
                  setOpen(false);
                }}
              >
                {v.name}
              </button>
              <button
                type="button"
                title="Delete view"
                className="rounded p-1 text-slate-400 hover:text-red-600"
                onClick={() => void deleteView(v.id).then(() => queryClient.invalidateQueries({ queryKey: ticketKeys.views }))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2 border-t border-slate-100 pt-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void save()}
            placeholder="e.g. Highest priority due this week"
            className="h-8 text-sm"
          />
          <Button size="sm" className="h-8" disabled={!name.trim()} onClick={() => void save()}>Save</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default SavedViewsMenu;
