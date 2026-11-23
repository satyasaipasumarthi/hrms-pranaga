// [ticket-management] "Download" button: export tickets to Excel / CSV for a date range.
import { useMemo, useState } from "react";
import { endOfDay, format, startOfDay, startOfMonth, endOfMonth, subDays, subMonths } from "date-fns";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { exportTicketsCsv, exportTicketsExcel } from "./exporters";
import type { Ticket } from "./types";

type DateField = "createdAt" | "dueDate" | "closedAt";

const FIELD_LABEL: Record<DateField, string> = {
  createdAt: "Created date",
  dueDate: "Due date",
  closedAt: "Closed date",
};

const iso = (date: Date) => format(date, "yyyy-MM-dd");

const PRESETS: { label: string; range: () => [string, string] | null }[] = [
  { label: "Today", range: () => [iso(new Date()), iso(new Date())] },
  { label: "Last 7 days", range: () => [iso(subDays(new Date(), 6)), iso(new Date())] },
  { label: "Last 30 days", range: () => [iso(subDays(new Date(), 29)), iso(new Date())] },
  { label: "This month", range: () => [iso(startOfMonth(new Date())), iso(endOfMonth(new Date()))] },
  { label: "Last month", range: () => [iso(startOfMonth(subMonths(new Date(), 1))), iso(endOfMonth(subMonths(new Date(), 1)))] },
  { label: "All time", range: () => null },
];

/** File-name part describing the range, e.g. "2026-11-01_to_2026-11-15". */
const rangeSuffix = (from: string, to: string) =>
  from && to ? `${from}_to_${to}` : from ? `from_${from}` : to ? `until_${to}` : iso(new Date());

interface DownloadMenuProps {
  /** Every ticket the user can see. */
  all: Ticket[];
  /** Tickets matching the filters currently set on the page. */
  filtered: Ticket[];
  filtersActive: boolean;
}

const DownloadMenu = ({ all, filtered, filtersActive }: DownloadMenuProps) => {
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<DateField>("createdAt");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [useFilters, setUseFilters] = useState(true);
  const [busy, setBusy] = useState<"xlsx" | "csv" | null>(null);

  const invalidRange = Boolean(from && to && from > to);

  const selection = useMemo(() => {
    const source = filtersActive && useFilters ? filtered : all;
    if (!from && !to) return source;
    const start = from ? startOfDay(new Date(`${from}T00:00:00`)).getTime() : -Infinity;
    const end = to ? endOfDay(new Date(`${to}T00:00:00`)).getTime() : Infinity;
    return source.filter((ticket) => {
      const value = ticket[field];
      if (!value) return false;
      const time = new Date(value).getTime();
      return time >= start && time <= end;
    });
  }, [all, filtered, filtersActive, useFilters, from, to, field]);

  const activePreset = PRESETS.find((p) => {
    const range = p.range();
    return range ? range[0] === from && range[1] === to : !from && !to;
  })?.label;

  const download = async (kind: "xlsx" | "csv") => {
    if (!selection.length || invalidRange) return;
    setBusy(kind);
    try {
      const suffix = rangeSuffix(from, to);
      if (kind === "xlsx") await exportTicketsExcel(selection, suffix);
      else exportTicketsCsv(selection, suffix);
      toast({ title: `Downloaded ${selection.length} ticket${selection.length > 1 ? "s" : ""}`, description: kind === "xlsx" ? "Excel file" : "CSV file" });
      setOpen(false);
    } catch (error) {
      toast({ title: "Download failed", description: (error as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9"><Download className="mr-1.5 h-4 w-4" />Download</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] space-y-4 border-slate-200 bg-white text-slate-900">
        <div>
          <p className="text-sm font-semibold">Download tickets</p>
          <p className="text-xs text-slate-500">Choose a date range, then Excel or CSV.</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Filter by</Label>
          <Select value={field} onValueChange={(v) => setField(v as DateField)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(FIELD_LABEL) as DateField[]).map((key) => <SelectItem key={key} value={key}>{FIELD_LABEL[key]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                const range = preset.range();
                setFrom(range?.[0] ?? "");
                setTo(range?.[1] ?? "");
              }}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs",
                activePreset === preset.label ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-200 text-slate-600 hover:bg-slate-50",
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="dl-from" className="text-xs">From</Label>
            <Input id="dl-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dl-to" className="text-xs">To</Label>
            <Input id="dl-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="h-9" />
          </div>
        </div>
        {invalidRange && <p className="text-xs text-red-600">"From" is after "To". Please fix the dates.</p>}
        {field === "closedAt" && (from || to) && (
          <p className="text-xs text-slate-500">Only tickets that have been closed are included.</p>
        )}

        {filtersActive && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <Checkbox checked={useFilters} onCheckedChange={(v) => setUseFilters(v === true)} />
            Only tickets matching my current filters
          </label>
        )}

        <p className={cn("rounded-lg px-3 py-2 text-sm", selection.length ? "bg-slate-50 text-slate-700" : "bg-amber-50 text-amber-800")}>
          {selection.length
            ? `${selection.length} ticket${selection.length > 1 ? "s" : ""} will be downloaded`
            : "No tickets in this range."}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <Button disabled={!selection.length || invalidRange || busy !== null} onClick={() => void download("xlsx")}>
            {busy === "xlsx" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-1.5 h-4 w-4" />}Excel
          </Button>
          <Button variant="outline" disabled={!selection.length || invalidRange || busy !== null} onClick={() => void download("csv")}>
            {busy === "csv" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileText className="mr-1.5 h-4 w-4" />}CSV
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DownloadMenu;
