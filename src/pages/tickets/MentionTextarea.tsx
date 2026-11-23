// [ticket-management] Comment box with @mention autocomplete and paste-to-attach screenshots.
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "./TicketBits";
import type { TicketPerson } from "./types";

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  mentions: TicketPerson[];
  onMentionsChange: (people: TicketPerson[]) => void;
  people: TicketPerson[];
  onPasteFiles?: (files: File[]) => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
}

/** Keeps only mentions whose "@Name" is still in the text. */
export const activeMentions = (text: string, mentions: TicketPerson[]) => {
  const seen = new Set<string>();
  return mentions.filter((p) => {
    if (seen.has(p.id) || !text.includes(`@${p.name}`)) return false;
    seen.add(p.id);
    return true;
  });
};

const MentionTextarea = ({
  value,
  onChange,
  mentions,
  onMentionsChange,
  people,
  onPasteFiles,
  onSubmit,
  placeholder,
  className,
}: MentionTextareaProps) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<{ text: string; start: number } | null>(null);
  const [highlight, setHighlight] = useState(0);

  const matches = useMemo(() => {
    if (!query) return [];
    const q = query.text.toLowerCase();
    return people.filter((p) => p.name.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q)).slice(0, 6);
  }, [people, query]);

  const detect = (text: string, caret: number) => {
    const before = text.slice(0, caret);
    const match = /(^|\s)@([\w.\- ]{0,30})$/.exec(before);
    if (match && !match[2].includes("  ")) {
      setQuery({ text: match[2], start: caret - match[2].length - 1 });
      setHighlight(0);
    } else {
      setQuery(null);
    }
  };

  const pick = (person: TicketPerson) => {
    if (!query) return;
    const caret = ref.current?.selectionStart ?? value.length;
    const next = `${value.slice(0, query.start)}@${person.name} ${value.slice(caret)}`;
    onChange(next);
    onMentionsChange([...mentions.filter((m) => m.id !== person.id), person]);
    setQuery(null);
    const pos = query.start + person.name.length + 2;
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(pos, pos);
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (query && matches.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(matches[highlight]);
        return;
      }
      if (e.key === "Escape") {
        e.stopPropagation();
        setQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSubmit?.();
    }
  };

  return (
    <div className="relative flex-1">
      <Textarea
        ref={ref}
        rows={3}
        value={value}
        placeholder={placeholder}
        className={className}
        onChange={(e) => {
          onChange(e.target.value);
          detect(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
        onPaste={(e) => {
          const files = Array.from(e.clipboardData.files ?? []);
          if (files.length && onPasteFiles) {
            e.preventDefault();
            onPasteFiles(
              files.map((f) =>
                f.name && f.name !== "image.png" ? f : new File([f], `screenshot-${Date.now()}.png`, { type: f.type || "image/png" }),
              ),
            );
          }
        }}
      />
      {query && matches.length > 0 && (
        <ul className="absolute bottom-full left-0 z-50 mb-1 w-72 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {matches.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(p);
                }}
                className={cn("flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm", i === highlight ? "bg-orange-50" : "hover:bg-slate-50")}
              >
                <PersonAvatar person={p} />
                <span className="flex-1 truncate">{p.name}</span>
                {p.email && <span className="truncate text-xs text-slate-400">{p.email}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MentionTextarea;
