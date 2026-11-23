// [ticket-management] Remembers (in this browser) which view is open and the board settings.
import { useCallback, useState } from "react";
import { DEFAULT_BOARD, type BoardSettings } from "./KanbanBoard";

export type TicketView = "kanban" | "list" | "analytics";

const BOARD_KEY = "hrms.tickets.board";
const VIEW_KEY = "hrms.tickets.view";

const readLocal = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
};

const writeLocal = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore (private mode)
  }
};

export const useTicketPrefs = () => {
  const [view, setViewState] = useState<TicketView>(() => readLocal<{ view: TicketView }>(VIEW_KEY, { view: "kanban" }).view);
  const [board, setBoardState] = useState<BoardSettings>(() => readLocal(BOARD_KEY, DEFAULT_BOARD));

  const setView = useCallback((next: TicketView) => {
    setViewState(next);
    writeLocal(VIEW_KEY, { view: next });
  }, []);

  const setBoard = useCallback((next: BoardSettings) => {
    setBoardState(next);
    writeLocal(BOARD_KEY, next);
  }, []);

  return { view, setView, board, setBoard };
};
