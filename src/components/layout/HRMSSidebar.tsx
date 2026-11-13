import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { getAccessibleNavItems } from "@/lib/permissions";

const HRMSSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { permissions, homePath } = useAuth();
  const navRef = useRef<HTMLElement>(null);
  const [markerTop, setMarkerTop] = useState<number | null>(null);

  // 1. Declare route check variable first
  const isSettingsRoute = location.pathname.startsWith("/settings");

  // 2. Initialize dropdown state with isSettingsRoute
  const [isSettingsOpen, setIsSettingsOpen] = useState(isSettingsRoute);

  const navItems = getAccessibleNavItems(permissions);

  const updateMarkerPosition = useCallback(() => {
    requestAnimationFrame(() => {
      const nav = navRef.current;
      if (!nav) return;
      const activeLink = nav.querySelector(
        '[data-active="true"]',
      ) as HTMLElement;
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

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="h-screen bg-[#FEF0E7] border-r border-[#D9D9D9] flex flex-col sticky top-0 z-30"
    >
      {/* Logo + Collapse button */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[#D9D9D9]">
        <div
          className="flex items-center gap-3 overflow-hidden cursor-pointer"
          onClick={() => navigate(homePath)}
        >
          {!collapsed && (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
              <img
                src="/pranaga-logo.png"
                alt="PraNaga Logo"
                className="w-full h-full object-contain rounded-lg mt-0.5"
                style={{ objectPosition: "center 55%" }}
              />
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
                <span className="font-heading font-semibold text-black">
                  Pra
                </span>
                <span className="font-heading font-semibold text-primary">
                  Naga
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md text-[#3B82F6] hover:bg-[#DBEAFE] transition-colors flex-shrink-0"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav
        ref={navRef}
        className="flex-1 py-4 px-2 space-y-1 overflow-y-auto relative"
      >
        {markerTop !== null && (
          <motion.div
            className="absolute left-0 w-[3px] h-6 bg-primary rounded-r-full z-10"
            animate={{ top: markerTop }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
          />
        )}
       {/*} {!collapsed && (
          <p className="section-label px-3 mb-3">MISSION_CONTROL</p>
        )}*/}
        {navItems.map((item) => {
          const isSettingsItem =
            item.label.toLowerCase() === "settings" ||
            item.path === "/settings";

          if (isSettingsItem) {
            return (
              <div key={item.path} className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    if (collapsed) setCollapsed(false);
                    setIsSettingsOpen(!isSettingsOpen);
                  }}
                  className={cn(
                    "flex items-center justify-between w-full px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                    isSettingsRoute
                      ? "bg-[#FDE5D6] text-black"
                      : "text-black hover:bg-[#FDE5D6] hover:text-black",
                  )}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <item.icon
                      className={cn(
                        "w-5 h-5 flex-shrink-0",
                        isSettingsRoute &&
                          "drop-shadow-[0_0_6px_hsl(18_100%_59%/0.5)]",
                      )}
                    />
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
                  </div>
                  {!collapsed &&
                    (isSettingsOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    ))}
                </button>

                {/* Submenu Item: Admin User under Settings module */}
                <AnimatePresence>
                  {isSettingsOpen && !collapsed && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="pl-9 pr-2 py-1 space-y-1 overflow-hidden"
                    >
                      <NavLink
                        to="/settings"
                        data-active={isSettingsRoute}
                        className={cn(
                          "block px-3 py-2 rounded-md text-sm transition-colors",
                          isSettingsRoute
                            ? "text-black font-medium bg-[#FDE5D6]"
                            : "text-black hover:text-black hover:bg-[#FDE5D6]",
                        )}
                      >
                        Admin User
                      </NavLink>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          }

          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              data-active={isActive}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                isActive
                  ? "bg-[#FDE5D6] text-black"
                  : "text-black hover:bg-[#FDE5D6] hover:text-black",
              )}
            >
              <item.icon
                className={cn(
                  "w-5 h-5 flex-shrink-0",
                  isActive && "drop-shadow-[0_0_6px_hsl(18_100%_59%/0.5)]",
                )}
              />
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
    </motion.aside>
  );
};

export default HRMSSidebar;
