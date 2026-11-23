import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Bell, CalendarOff, LogIn, LogOut, Star, Ticket, type LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { TICKETS_PATH } from "@/pages/tickets"; // [ticket-management]
import { subscribeTicketNotifications } from "@/pages/tickets/liveNotifications"; // [ticket-management]
import {
  fetchNotifications,
  formatNotificationTime,
  markTicketNotificationsSeen,
  type NotificationItem,
  type NotificationKind,
} from "@/lib/notifications";

const KIND_STYLES: Record<NotificationKind, { icon: LucideIcon; color: string; background: string }> = {
  "check-in": { icon: LogIn, color: "#16A34A", background: "#DCFCE7" },
  "check-out": { icon: LogOut, color: "#E87532", background: "#FDE5D6" },
  leave: { icon: CalendarOff, color: "#3B82F6", background: "#DBEAFE" },
  kudos: { icon: Star, color: "#A779F5", background: "#EFE5FE" },
  ticket: { icon: Ticket, color: "#E87532", background: "#FDE5D6" },
};

const lastSeenKey = (userId: string) => `hrms.notifications.lastSeen.${userId}`;

const readLastSeen = (userId: string) => {
  try {
    return Number(localStorage.getItem(lastSeenKey(userId))) || 0;
  } catch {
    return 0;
  }
};

const writeLastSeen = (userId: string, timestamp: number) => {
  try {
    localStorage.setItem(lastSeenKey(userId), String(timestamp));
  } catch {
    // Storage can be unavailable (private mode); the unread dot just stays on.
  }
};

const NotificationBell = () => {
  const { user, permissions } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSeen, setLastSeen] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const userId = user?.id ?? null;

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setItems([]);
      return [];
    }

    setIsLoading(true);
    try {
      const next = await fetchNotifications(user, permissions);
      setItems(next);
      return next;
    } finally {
      setIsLoading(false);
    }
  }, [permissions, user]);

  // Load once up front so the unread dot is accurate before the bell is opened.
  useEffect(() => {
    setLastSeen(userId ? readLastSeen(userId) : 0);
    void loadNotifications();
  }, [loadNotifications, userId]);

  // Refresh every minute so teammates' check-ins show up without reopening the page.
  useEffect(() => {
    if (!userId) return;
    const timer = setInterval(() => void loadNotifications(), 60_000);
    return () => clearInterval(timer);
  }, [loadNotifications, userId]);

  // [ticket-management] New ticket alerts arrive instantly.
  const email = user?.email;
  useEffect(() => {
    if (!email) return;
    return subscribeTicketNotifications(email, (n) => {
      toast({ title: n.title, description: n.body ?? undefined });
      void loadNotifications();
    });
  }, [email, loadNotifications]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  // Items newer than this were unread when the panel was opened.
  const [unreadCutoff, setUnreadCutoff] = useState(0);

  const handleToggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }

    setUnreadCutoff(lastSeen);
    setOpen(true);

    const latest = await loadNotifications();
    void markTicketNotificationsSeen(latest); // [ticket-management]
    if (userId) {
      const seenAt = Math.max(Date.now(), latest[0]?.timestamp ?? 0);
      writeLastSeen(userId, seenAt);
      setLastSeen(seenAt);
    }
  };

  const hasUnread = items.some((item) => item.timestamp > lastSeen);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => void handleToggle()}
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative p-2 rounded-lg hover:bg-secondary/10 transition-colors"
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        {hasUnread && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Notifications"
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-[#E7EDF5] bg-white shadow-xl z-50"
          >
            <div className="flex items-center justify-between border-b border-[#E7EDF5] px-4 py-3">
              <h3 className="font-heading text-sm font-semibold text-[#14264F]">
                Notifications
              </h3>
              {items.length > 0 && (
                <span className="text-xs text-[#71829B]">
                  Latest {items.length}
                </span>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {isLoading && items.length === 0 ? (
                <div className="flex items-center justify-center py-10">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : items.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-[#71829B]">
                  No notifications yet.
                </p>
              ) : (
                <ul className="divide-y divide-[#E7EDF5]">
                  {items.map((item) => {
                    const style = KIND_STYLES[item.kind];
                    const Icon = style.icon;
                    const isUnread = item.timestamp > unreadCutoff;

                    const openTicket = item.ticketId
                      ? () => {
                          setOpen(false);
                          navigate(`${TICKETS_PATH}?ticket=${item.ticketId}`);
                        }
                      : undefined;

                    return (
                      <li
                        key={item.id}
                        onClick={openTicket}
                        onKeyDown={openTicket ? (event) => event.key === "Enter" && openTicket() : undefined}
                        tabIndex={openTicket ? 0 : undefined}
                        role={openTicket ? "button" : undefined}
                        className={`flex gap-3 px-4 py-3 ${isUnread ? "bg-[#FFF8F3]" : ""} ${openTicket ? "cursor-pointer hover:bg-[#FFF3EA]" : ""}`}
                      >
                        <span
                          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: style.background, color: style.color }}
                        >
                          <Icon className="h-4 w-4" />
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-[#52647D]">
                            {item.actor ? (
                              <>
                                <span className="font-semibold text-[#14264F]">{item.actor}</span> {item.message}
                              </>
                            ) : (
                              <span className="font-semibold text-[#14264F]">{item.message}</span>
                            )}
                          </p>
                          {item.detail && (
                            <p className="mt-0.5 truncate text-xs text-[#71829B]" title={item.detail}>
                              {item.detail}
                            </p>
                          )}
                          <p className="mt-1 text-[11px] text-[#71829B]">
                            {formatNotificationTime(item.timestamp)}
                          </p>
                        </div>

                        {isUnread && (
                          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;
