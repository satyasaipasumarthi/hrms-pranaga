import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import PageWrapper from "@/components/ui/PageWrapper";
import GlowButton from "@/components/ui/GlowButton";
import { useAuth } from "@/hooks/useAuth";
import { useAttendanceActions } from "@/hooks/useAttendanceActions";
import { getBusinessDateKey } from "@/lib/attendance";
import { hasMinimumDataScope, hasModulePermission } from "@/lib/permissions";

const formatAttendanceCardDate = (value: string) => {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }

  return `${day}-${month}-${year}`;
};

const formatAttendanceCardWeekday = (value: string) => {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return "Attendance";
  }

  return date.toLocaleDateString("en-US", { weekday: "long" });
};

const getRecentDateCutoff = (todayValue: string, totalDays: number) => {
  const baseDate = new Date(`${todayValue}T12:00:00`);
  if (Number.isNaN(baseDate.getTime())) {
    return todayValue;
  }

  baseDate.setDate(baseDate.getDate() - Math.max(totalDays - 1, 0));
  return getBusinessDateKey(baseDate);
};

const Attendance = () => {
  const { user, permissions } = useAuth();
  const { attendanceLog, checkedIn, checkInTime, elapsed, handleCheckIn, handleCheckOut, handlePauseResume, isLoading, isPaused } =
    useAttendanceActions();

  const canTrackOwnTime = hasModulePermission(permissions, "attendance", "create");
  const showEmployeeColumn = hasMinimumDataScope(permissions, "attendance", "team");
  const isAdminAttendanceView = user?.role === "admin" && showEmployeeColumn;
  const actionButtonClass =
    "inline-flex h-12 w-full max-w-[22rem] items-center justify-center whitespace-nowrap px-4 text-sm";
  const today = getBusinessDateKey();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dateFilterValue, setDateFilterValue] = useState(today);
  const todaysClosedRecord = useMemo(
    () => attendanceLog.find((row) => row.userId === user?.id && row.date === today && Boolean(row.checkOut)),
    [attendanceLog, today, user?.id],
  );
  const isTodayLocked = Boolean(todaysClosedRecord && !checkedIn);
  const allAttendanceDateSummaries = useMemo(() => {
    const summaries = new Map<string, { date: string; checkedInCount: number }>();

    attendanceLog.forEach((row) => {
      const existing = summaries.get(row.date);
      const checkedInCount = row.checkIn ? 1 : 0;

      if (existing) {
        existing.checkedInCount += checkedInCount;
        return;
      }

      summaries.set(row.date, {
        date: row.date,
        checkedInCount,
      });
    });

    return Array.from(summaries.values()).sort((left, right) => right.date.localeCompare(left.date));
  }, [attendanceLog]);
  const attendanceDateCards = useMemo(() => {
    const cutoffDate = getRecentDateCutoff(today, 30);
    return allAttendanceDateSummaries.filter((card) => card.date >= cutoffDate);
  }, [allAttendanceDateSummaries, today]);
  const defaultSelectedDate = useMemo(
    () => allAttendanceDateSummaries.find((card) => card.date === today)?.date ?? allAttendanceDateSummaries[0]?.date ?? null,
    [allAttendanceDateSummaries, today],
  );

  useEffect(() => {
    if (!isAdminAttendanceView) {
      setSelectedDate(null);
      setDateFilterValue(today);
      return;
    }

    setSelectedDate((current) => {
      if (current) {
        return current;
      }

      return defaultSelectedDate;
    });
  }, [defaultSelectedDate, isAdminAttendanceView, today]);

  useEffect(() => {
    if (!isAdminAttendanceView) {
      return;
    }

    setDateFilterValue(selectedDate ?? defaultSelectedDate ?? today);
  }, [defaultSelectedDate, isAdminAttendanceView, selectedDate, today]);

  const visibleAttendanceLog = useMemo(() => {
    if (!isAdminAttendanceView || !selectedDate) {
      return attendanceLog;
    }

    return attendanceLog.filter((row) => row.date === selectedDate);
  }, [attendanceLog, isAdminAttendanceView, selectedDate]);
  const selectedDateSummary = useMemo(
    () => allAttendanceDateSummaries.find((card) => card.date === selectedDate) ?? null,
    [allAttendanceDateSummaries, selectedDate],
  );
  const isSelectedDateInRecentCards = useMemo(
    () => attendanceDateCards.some((card) => card.date === selectedDate),
    [attendanceDateCards, selectedDate],
  );

  const handleApplyDateFilter = () => {
    if (!dateFilterValue) {
      return;
    }

    setSelectedDate(dateFilterValue);
  };

  const handleResetDateFilter = () => {
    const nextDate = defaultSelectedDate ?? today;
    setDateFilterValue(nextDate);
    setSelectedDate(nextDate);
  };

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
          {isAdminAttendanceView && (
            <div className="mb-5 space-y-3">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="section-label text-[11px]">DATE_OVERVIEW</p>
                  <p className="text-xs text-muted-foreground">
                    Browse the last 30 days quickly, or search any older date directly.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:items-end">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="date"
                      value={dateFilterValue}
                      max={today}
                      onChange={(event) => setDateFilterValue(event.target.value)}
                      className="h-11 min-w-[12.5rem] rounded-xl border border-border/60 bg-muted/35 px-4 text-sm text-foreground outline-none transition-colors focus:border-primary/40 focus:bg-accent/25"
                    />
                    <GlowButton
                      onClick={handleApplyDateFilter}
                      variant="ghost"
                      className="inline-flex h-11 min-w-[8.5rem] items-center justify-center px-4 text-xs"
                    >
                      Filter Date
                    </GlowButton>
                    <GlowButton
                      onClick={handleResetDateFilter}
                      variant="secondary"
                      className="inline-flex h-11 min-w-[7rem] items-center justify-center px-4 text-xs"
                    >
                      Reset
                    </GlowButton>
                  </div>
                  {selectedDate && (
                    <p className="text-xs text-muted-foreground">
                      Showing {selectedDateSummary?.checkedInCount ?? 0} checked in on{" "}
                      <span className="text-foreground/80">{formatAttendanceCardDate(selectedDate)}</span>
                    </p>
                  )}
                </div>
              </div>
              {attendanceDateCards.length > 0 ? (
                <div className="attendance-date-strip flex gap-3 overflow-x-auto pb-2">
                  {attendanceDateCards.map((card) => {
                    const isSelected = card.date === selectedDate;
                    const checkedInLabel = `${card.checkedInCount} ${
                      card.checkedInCount === 1 ? "Person Checked In" : "People Checked In"
                    }`;

                    return (
                      <motion.button
                        key={card.date}
                        type="button"
                        layout
                        whileHover={{ y: -2 }}
                        onClick={() => {
                          setSelectedDate(card.date);
                          setDateFilterValue(card.date);
                        }}
                        transition={{ type: "spring", stiffness: 260, damping: 24 }}
                        className={`flex-shrink-0 rounded-2xl border text-left transition-all ${
                          isSelected
                            ? "min-w-[18rem] border-primary/45 bg-primary/12 px-5 py-4 shadow-[0_0_26px_hsl(18_100%_59%/0.18)]"
                            : "min-w-[11.5rem] border-border/60 bg-muted/35 px-4 py-3 hover:border-primary/25 hover:bg-accent/35"
                        }`}
                      >
                        <div className="flex flex-col gap-1">
                          <span className={`font-heading uppercase tracking-[0.16em] ${isSelected ? "text-[1rem] text-primary" : "text-[0.72rem] text-muted-foreground"}`}>
                            {formatAttendanceCardDate(card.date)}
                          </span>
                          <span className={`text-xs ${isSelected ? "text-foreground/85" : "text-muted-foreground"}`}>
                            {formatAttendanceCardWeekday(card.date)}
                          </span>
                          <span className={`text-sm ${isSelected ? "font-medium text-foreground" : "text-foreground/75"}`}>
                            {checkedInLabel}
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-border/60 bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
                  No attendance cards are available in the last 30 days yet. Use the date filter above to search older history.
                </div>
              )}
              {selectedDate && !isSelectedDateInRecentCards && (
                <div className="rounded-2xl border border-secondary/30 bg-secondary/10 px-4 py-3 text-sm text-foreground/80">
                  Viewing a custom date outside the recent 30-day overview:{" "}
                  <span className="font-heading text-secondary">{formatAttendanceCardDate(selectedDate)}</span>
                </div>
              )}
            </div>
          )}
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
                  {visibleAttendanceLog.map((row) => (
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
                  {!visibleAttendanceLog.length && (
                    <tr>
                      <td colSpan={showEmployeeColumn ? 6 : 5} className="py-12 text-center text-muted-foreground">
                        {isAdminAttendanceView && selectedDate
                          ? `No attendance records are available for ${formatAttendanceCardDate(selectedDate)}.`
                          : "No attendance records are visible for your current access scope."}
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
