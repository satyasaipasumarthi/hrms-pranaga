import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, LogOut } from "lucide-react";
import GlowButton from "@/components/ui/GlowButton";
import NotificationBell from "@/components/layout/NotificationBell";
import { useAttendanceActions } from "@/hooks/useAttendanceActions";
import { useAuth } from "@/hooks/useAuth";
import { formatRoleLabel } from "@/lib/roles";
import { cn } from "@/lib/utils";

const Topbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    canTrackOwnTime,
    checkedIn,
    elapsed,
    handleCheckIn,
    handleCheckOut,
    handlePauseResume,
    isPaused,
    isProcessing,
    isTodayLocked,
  } = useAttendanceActions();

  const currentTime = new Date();
  const hour = currentTime.getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const roleBadge = user?.role ? formatRoleLabel(user.role) : "Employee";

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="h-16 border-b border-[#D9D9D9] bg-[#FEF0E7] backdrop-blur-lg flex items-center justify-between px-6 sticky top-0 z-20">
      <div>
        <p className="text-black font-heading font-semibold">
          {greeting},{" "}
          <span className="text-primary">{user?.name ?? "User"}</span>
        </p>
        
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span className="font-heading tracking-wider">{elapsed}</span>
        </div>

        <div className="flex items-center justify-center gap-2">
          <GlowButton
            onClick={handleCheckIn}
            disabled={
              !canTrackOwnTime || checkedIn || isTodayLocked || isProcessing
            }
            variant="primary"
            glow={false}
            className="h-10 min-w-[6.75rem] px-4 py-0 text-xs whitespace-nowrap !bg-[#FF4500] hover:!bg-[#FF8A00]"
          >
            Check In
          </GlowButton>

          <GlowButton
            onClick={handlePauseResume}
            disabled={!canTrackOwnTime || !checkedIn || isProcessing}
            variant="ghost"
            className="h-10 min-w-[7.5rem] border border-[#E87532] bg-transparent px-4 py-0 text-xs font-semibold !text-black whitespace-nowrap hover:bg-[#FDE5D6] hover:!text-black"
          >
            {isPaused ? "Resume" : "Pause"}
          </GlowButton>

          <GlowButton
            onClick={handleCheckOut}
            disabled={!canTrackOwnTime || !checkedIn || isProcessing}
            variant="primary"
            glow={false}
            className="h-10 min-w-[7.25rem] px-4 py-0 text-xs whitespace-nowrap !bg-[#FF4500] hover:!bg-[#FF8A00]"
          >
            Check Out
          </GlowButton>
        </div>

        <NotificationBell />

        <span className="text-xs font-heading tracking-wider uppercase px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
          {roleBadge}
        </span>

        {/* User Avatar Circle and Overview Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-expanded={dropdownOpen}
            aria-haspopup="menu"
            className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all focus:outline-none"
          >
            <span className="text-sm font-heading font-semibold text-primary">
              {user?.name?.[0]?.toUpperCase() ?? "U"}
            </span>
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -6 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-60 rounded-xl border border-border bg-popover/95 backdrop-blur-md p-2 shadow-xl z-50 text-popover-foreground"
              >
                {/* User Overview Section */}
                <div className="px-3 py-2.5 border-b border-border/50">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {user?.name ?? "User"}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                    {roleBadge}
                  </p>
                </div>

                {/* Actions */}
                <div className="pt-1.5">
                  <button
                    onClick={handleLogout}
                    className={cn(
                      "flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer",
                      "text-secondary hover:bg-secondary/10",
                    )}
                  >
                    <LogOut className="w-4 h-4 flex-shrink-0" />
                    <span>Logout</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
