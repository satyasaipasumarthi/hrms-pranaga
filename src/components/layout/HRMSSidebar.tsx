import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { getAccessibleNavItems } from "@/lib/permissions";

const HRMSSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, permissions, homePath } = useAuth();
  const navRef = useRef<HTMLElement>(null);
  const [markerTop, setMarkerTop] = useState<number | null>(null);

  const navItems = getAccessibleNavItems(permissions);

  const updateMarkerPosition = useCallback(() => {
    requestAnimationFrame(() => {
      const nav = navRef.current;
      if (!nav) return;
      const activeLink = nav.querySelector('[data-active="true"]') as HTMLElement;
      if (activeLink) {
        const navRect = nav.getBoundingClientRect();
        const linkRect = activeLink.getBoundingClientRect();
        setMarkerTop(linkRect.top - navRect.top + linkRect.height / 2 - 12);
      } else {
        setMarkerTop(null);
      }
    });
  }, []);

  useEffect(() => {
    updateMarkerPosition();
  }, [location.pathname, collapsed, updateMarkerPosition]);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="h-screen bg-sidebar border-r border-sidebar-border flex flex-col sticky top-0 z-30"
    >
      {/* Logo + Collapse button */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3 overflow-hidden cursor-pointer" onClick={() => navigate(homePath)}>
          {!collapsed && (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
              <img src="/brand-logo.svg" alt="PraNaga Logo" className="w-full h-full object-contain rounded-lg mt-0.5" style={{ objectPosition: 'center 55%' }} />
            </div>
          )}
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden whitespace-nowrap"
              >
                <span className="font-heading font-semibold text-foreground">Pra</span>
                <span className="font-heading font-semibold text-primary">Naga</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md text-sidebar-foreground hover:bg-sidebar-accent transition-colors flex-shrink-0"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav ref={navRef} className="flex-1 py-4 px-2 space-y-1 overflow-y-auto relative">
        {markerTop !== null && (
          <motion.div
            className="absolute left-0 w-[3px] h-6 bg-primary rounded-r-full z-10"
            animate={{ top: markerTop }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
          />
        )}
        {!collapsed && (
          <p className="section-label px-3 mb-3">MISSION_CONTROL</p>
        )}
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              data-active={isActive}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive && "drop-shadow-[0_0_6px_hsl(18_100%_59%/0.5)]")} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-sm font-medium overflow-hidden whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </NavLink>
          );
        })}
      </nav>

      {/* Logout button */}
      <div className="px-2 py-4 border-t border-sidebar-border">
        <button
          onClick={handleLogout}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 w-full",
            "text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive"
          )}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="text-sm font-medium overflow-hidden whitespace-nowrap"
              >
                Logout
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
};

export default HRMSSidebar;
