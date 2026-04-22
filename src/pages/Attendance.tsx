import { useMemo } from "react";
import { motion } from "framer-motion";
import PageWrapper from "@/components/ui/PageWrapper";
import GlowButton from "@/components/ui/GlowButton";
import { useAuth } from "@/hooks/useAuth";
import { useAttendanceActions } from "@/hooks/useAttendanceActions";
import { getBusinessDateKey } from "@/lib/attendance";
import { hasMinimumDataScope, hasModulePermission } from "@/lib/permissions";

const Attendance = () => {
  const { user, permissions } = useAuth();
  const { attendanceLog, checkedIn, checkInTime, elapsed, handleCheckIn, handleCheckOut, handlePauseResume, isLoading, isPaused } =
    useAttendanceActions();

  const canTrackOwnTime = hasModulePermission(permissions, "attendance", "create");
  const showEmployeeColumn = hasMinimumDataScope(permissions, "attendance", "team");
  const actionButtonClass =
    "inline-flex h-12 w-full max-w-[22rem] items-center justify-center whitespace-nowrap px-4 text-sm";
  const today = getBusinessDateKey();
  const todaysClosedRecord = useMemo(
    () => attendanceLog.find((row) => row.userId === user?.id && row.date === today && Boolean(row.checkOut)),
    [attendanceLog, today, user?.id],
  );
  const isTodayLocked = Boolean(todaysClosedRecord && !checkedIn);

  return (
    <PageWrapper label="ATTENDANCE_LOG" title="Attendance Tracker">
      <div className="flex flex-col lg:flex-row gap-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-6 sm:p-8 flex flex-col items-center justify-center space-y-5 lg:w-80 lg:flex-shrink-0"
        >
          <p className="section-label">SHIFT_TIMER</p>
          <div className="text-4xl sm:text-5xl font-heading font-bold text-foreground tracking-widest whitespace-nowrap">
            {elapsed}
          </div>
          {checkInTime && (
            <p className="text-sm text-muted-foreground">
              Checked in at {checkInTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
          {checkedIn && isPaused && (
            <p className="text-xs text-muted-foreground text-center">Status: Paused</p>
          )}
          <div className="flex w-full flex-col items-center justify-center gap-4">
            <GlowButton
              onClick={handleCheckIn}
              disabled={!canTrackOwnTime || checkedIn || isTodayLocked}
              variant="primary"
              className={actionButtonClass}
            >
              Check In
            </GlowButton>
            <GlowButton
              onClick={handlePauseResume}
              disabled={!canTrackOwnTime || !checkedIn}
              variant="ghost"
              className={actionButtonClass}
            >
              {isPaused ? "Resume" : "Pause"}
            </GlowButton>
            <GlowButton
              onClick={handleCheckOut}
              disabled={!canTrackOwnTime || !checkedIn}
              variant="secondary"
              className={actionButtonClass}
            >
              Check Out
            </GlowButton>
          </div>
          {!canTrackOwnTime && <p className="text-xs text-muted-foreground text-center">Time actions are disabled for your access scope.</p>}
          {isTodayLocked && canTrackOwnTime && (
            <p className="text-xs text-muted-foreground text-center">
              Today&apos;s attendance is already recorded. A new row will be available tomorrow.
            </p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6 flex-1 min-w-0"
        >
          <h3 className="font-heading font-semibold text-foreground mb-4 tracking-wide">
            {showEmployeeColumn ? "ATTENDANCE_SCOPE" : "MONTHLY_LOG"}
          </h3>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="max-h-[34rem] overflow-x-auto overflow-y-auto pr-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    {showEmployeeColumn && (
                      <th className="text-left py-3 px-4 text-muted-foreground font-heading text-xs tracking-wider">EMPLOYEE</th>
                    )}
                    <th className="text-left py-3 px-4 text-muted-foreground font-heading text-xs tracking-wider">DATE</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-heading text-xs tracking-wider">CHECK_IN</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-heading text-xs tracking-wider">CHECK_OUT</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-heading text-xs tracking-wider">TOTAL_HOURS</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-heading text-xs tracking-wider">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceLog.map((row) => (
                    <tr key={row.id} className="border-b border-border/30 hover:bg-accent/30 transition-colors">
                      {showEmployeeColumn && <td className="py-3 px-4 text-foreground/80">{row.employeeName}</td>}
                      <td className="py-3 px-4 text-foreground/80">{row.date}</td>
                      <td className="py-3 px-4 text-foreground/80">{row.checkIn ?? "-"}</td>
                      <td className="py-3 px-4 text-foreground/80">{row.checkOut ?? "-"}</td>
                      <td className="py-3 px-4 text-foreground/80">{row.totalHours}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs px-2 py-1 rounded-full border ${
                            row.status === "Full Day"
                              ? "status-approved"
                              : row.status === "Half Day" || row.status === "Pending"
                                ? "status-pending"
                                : "status-rejected"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!attendanceLog.length && (
                    <tr>
                      <td colSpan={showEmployeeColumn ? 6 : 5} className="py-12 text-center text-muted-foreground">
                        No attendance records are visible for your current access scope.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </PageWrapper>
  );
};

export default Attendance;
