import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn, toDateValue, toISODate } from "@/lib/utils";

interface DatePickerFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  minDate?: Date;
  maxDate?: Date;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
}

const DatePickerField = ({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  placeholder = "Pick a date",
  className,
  buttonClassName,
}: DatePickerFieldProps) => {
  const [open, setOpen] = useState(false);
  const selected = toDateValue(value);

  return (
    <div className={cn("space-y-2", className)}>
      {label && <label className="text-xs text-muted-foreground font-heading tracking-wider">{label}</label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-11 w-full items-center gap-2 rounded-xl border border-border/60 bg-muted/35 px-4 text-sm text-foreground outline-none transition-colors focus:border-primary/40 focus:bg-accent/25",
              buttonClassName,
            )}
          >
            <CalendarIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <span className={selected ? "text-foreground" : "text-muted-foreground"}>
              {selected ? format(selected, "dd MMM yyyy") : placeholder}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? minDate ?? maxDate}
            onSelect={(date) => {
              if (date) {
                onChange(toISODate(date));
                setOpen(false);
              }
            }}
            disabled={(date) => (minDate ? date < minDate : false) || (maxDate ? date > maxDate : false)}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default DatePickerField;
