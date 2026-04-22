import GlowButton from "@/components/ui/GlowButton";
import { useAttendanceActions } from "@/hooks/useAttendanceActions";
import { Bell, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { formatRoleLabel } from "@/lib/roles";

const Topbar = () => {
  const [time, setTime] = useState(new Date());
  const { user } = useAuth();
  const { canTrackOwnTime, checkedIn, handleCheckIn, handleCheckOut, handlePauseResume, isPaused, isTodayLocked } =
    useAttendanceActions();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hour = time.getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const roleBadge = user?.role ? formatRoleLabel(user.role) : "Employee";

  return (
    <header className="h-16 border-b border-border bg-card/40 backdrop-blur-lg flex items-center justify-between px-6 sticky top-0 z-20">
      <div>
        <p className="text-foreground font-heading font-semibold">
          {greeting}, <span className="text-primary">{user?.name ?? "User"}</span>
        </p>
        <p className="text-xs text-muted-foreground">HRMS_COMMAND_CENTER</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span className="font-heading tracking-wider">
            {time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>

        <div className="flex items-center justify-center gap-2">
          <GlowButton
            onClick={handleCheckIn}
            disabled={!canTrackOwnTime || checkedIn || isTodayLocked}
            variant="primary"
            className="h-10 min-w-[6.75rem] px-4 py-0 text-xs whitespace-nowrap"
          >
            Check In
          </GlowButton>
          <GlowButton
            onClick={handlePauseResume}
            disabled={!canTrackOwnTime || !checkedIn}
            variant="ghost"
            className="h-10 min-w-[7.5rem] border border-primary/20 bg-accent/20 px-4 py-0 text-xs text-foreground whitespace-nowrap hover:bg-accent/40"
          >
            {isPaused ? "Resume" : "Pause"}
          </GlowButton>
          <GlowButton
            onClick={handleCheckOut}
            disabled={!canTrackOwnTime || !checkedIn}
            variant="secondary"
            className="h-10 min-w-[7.25rem] px-4 py-0 text-xs whitespace-nowrap"
          >
            Check Out
          </GlowButton>
        </div>

        <button className="relative p-2 rounded-lg hover:bg-accent transition-colors">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
        </button>

        <span className="text-xs font-heading tracking-wider uppercase px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
          {roleBadge}
        </span>

        <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
          <span className="text-sm font-heading font-semibold text-primary">{user?.name?.[0] ?? "U"}</span>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
