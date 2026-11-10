import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import PaginationControls, {
  usePagination,
} from "@/components/ui/PaginationControls";
import PageWrapper from "@/components/ui/PageWrapper";
import GlowButton from "@/components/ui/GlowButton";
import DatePickerField from "@/components/ui/DatePickerField";
import { useAuth } from "@/hooks/useAuth";
import { useAttendanceActions } from "@/hooks/useAttendanceActions";
import { toast } from "@/hooks/use-toast";
import { getBusinessDateKey } from "@/lib/attendance";
import { exportAttendanceToExcel } from "@/lib/export-attendance";
import { hasMinimumDataScope, hasModulePermission } from "@/lib/permissions";
import { Download, LayoutGrid, X } from "lucide-react";
import "./Attendance.css";

const formatAttendanceCardDate = (value: string) => {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }

  return `${day}-${month}-${year}`;
};

const Attendance = () => {
  const { user, permissions } = useAuth();
  const {
    attendanceLog,
    checkedIn,
    checkInTime,
    elapsed,
    handleCheckIn,
    handleCheckOut,
    handlePauseResume,
    isLoading,
    isPaused,
    isProcessing,
  } = useAttendanceActions();

  const canTrackOwnTime = hasModulePermission(
    permissions,
    "attendance",
    "create",
  );
  const showEmployeeColumn = hasMinimumDataScope(
    permissions,
    "attendance",
    "team",
  );
  const isOversightAttendanceView = showEmployeeColumn;
  const showPersonalTracker = !isOversightAttendanceView && canTrackOwnTime;
  const canViewLeave = hasModulePermission(permissions, "leave", "view");
  const canCreateLeave = hasModulePermission(permissions, "leave", "create");
  const showLeaveOperations = hasMinimumDataScope(permissions, "leave", "team");

  const actionButtonClass =
    "inline-flex h-12 w-full max-w-[22rem] items-center justify-center whitespace-nowrap px-4 text-sm";
  const today = getBusinessDateKey();
  const todayDate = useMemo(() => new Date(`${today}T12:00:00`), [today]);

  const [rangeFrom, setRangeFrom] = useState(today);
  const [rangeTo, setRangeTo] = useState(today);
  const [appliedRange, setAppliedRange] = useState({ from: today, to: today });
  const [isDateFilterApplied, setIsDateFilterApplied] = useState(false);
  const [isAttendanceGridOpen, setIsAttendanceGridOpen] = useState(true);

  const todaysClosedRecord = useMemo(
    () =>
      attendanceLog.find(
        (row) =>
          row.userId === user?.id &&
          row.date === today &&
          Boolean(row.checkOut),
      ),
    [attendanceLog, today, user?.id],
  );
  const isTodayLocked = Boolean(todaysClosedRecord && !checkedIn);

  useEffect(() => {
    if (!isOversightAttendanceView) {
      setRangeFrom(today);
      setRangeTo(today);
      setAppliedRange({ from: today, to: today });
    }
  }, [isOversightAttendanceView, today]);

  const visibleAttendanceLog = useMemo(() => {
    if (!isOversightAttendanceView) {
      return attendanceLog;
    }

    return attendanceLog.filter(
      (row) => row.date >= appliedRange.from && row.date <= appliedRange.to,
    );
  }, [attendanceLog, appliedRange, isOversightAttendanceView]);

  const {
    currentPage,
    pageSize,
    setPageSize,
    totalPages,
    pageItems: paginatedAttendanceLog,
    pageStart,
    pageEnd,
    goToPreviousPage,
    goToNextPage,
  } = usePagination(visibleAttendanceLog);

  const handleApplyDateFilter = () => {
    if (!rangeFrom || !rangeTo) {
      return;
    }

    const [from, to] =
      rangeFrom <= rangeTo ? [rangeFrom, rangeTo] : [rangeTo, rangeFrom];
    setAppliedRange({ from, to });
    setIsDateFilterApplied(true);
  };

  const handleExportAttendance = async () => {
    const rowsToExport = isDateFilterApplied
      ? visibleAttendanceLog
      : attendanceLog;
    const fileLabel = isDateFilterApplied
      ? `${appliedRange.from}_to_${appliedRange.to}`
      : "all";

    try {
      await exportAttendanceToExcel(
        rowsToExport,
        showEmployeeColumn,
        fileLabel,
      );
    } catch (error) {
      console.error("Failed to export attendance:", error);
      toast({
        title: "Export failed",
        description: "The attendance records could not be exported.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="dashboard-light-override min-h-screen w-full">
      <PageWrapper
        title="Attendance"
        action={
          canViewLeave && (
            <div className="flex flex-wrap gap-3">
              {canCreateLeave && (
                <GlowButton
                  href="/leave/apply"
                  target="apply-leave"
                  variant="primary"
                  className="inline-flex h-11 items-center justify-center px-6 text-sm"
                 
                >
                  Apply Leave
                </GlowButton>
              )}
              {showLeaveOperations && (
                <GlowButton
                  href="/leave/operations"
                  target="leave-operations"
                  variant="secondary"
                  className="inline-flex h-11 items-center justify-center px-6 text-sm"
                 
                >
                  Leave Operations
                </GlowButton>
              )}
              {!canCreateLeave && !showLeaveOperations && (
                <GlowButton
                  href="/leave/operations"
                  target="leave-operations"
                  variant="secondary"
                  className="inline-flex h-11 items-center justify-center px-6 text-sm"
                 
                >
                  View Leave
                </GlowButton>
              )}
            </div>
          )
        }
      >
        <div className="w-full pb-16">
        <div className="flex flex-col sm:flex-row gap-6 items-stretch">
          {showPersonalTracker && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card p-6 sm:p-8 flex flex-col items-center justify-center space-y-5 sm:w-80 sm:flex-shrink-0"
            >
              <p className="section-label font-bold text-black">SHIFT_TIMER</p>
              <div className="text-4xl sm:text-5xl font-heading font-bold text-black tracking-widest whitespace-nowrap">
                {elapsed}
              </div>
              {checkInTime && (
                <p className="text-sm text-black/80">
                  Checked in at{" "}
                  {checkInTime.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
              {checkedIn && isPaused && (
                <p className="text-xs text-[#FF4500] font-semibold text-center">
                  Status: Paused
                </p>
              )}
              <div className="flex w-full flex-col items-center justify-center gap-4">
                <GlowButton
                  onClick={handleCheckIn}
                  disabled={
                    !canTrackOwnTime ||
                    checkedIn ||
                    isTodayLocked ||
                    isProcessing
                  }
                  variant="primary"
                  glow={false}
                  className={actionButtonClass}
                 
                >
                  Check In
                </GlowButton>
                <GlowButton
                  onClick={handlePauseResume}
                  disabled={!canTrackOwnTime || !checkedIn || isProcessing}
                  variant="ghost"
                  className={actionButtonClass}
                 
                >
                  {isPaused ? "Resume" : "Pause"}
                </GlowButton>
                <GlowButton
                  onClick={handleCheckOut}
                  disabled={!canTrackOwnTime || !checkedIn || isProcessing}
                  variant="primary"
                  glow={false}
                  className={actionButtonClass}
                 
                >
                  Check Out
                </GlowButton>
              </div>
              {!canTrackOwnTime && (
                <p className="text-xs text-black/70 text-center">
                  Time actions are disabled for your access scope.
                </p>
              )}
              {isTodayLocked && canTrackOwnTime && (
                <p className="text-xs text-black/70 text-center">
                  Today&apos;s attendance is already recorded. A new row will be
                  available tomorrow.
                </p>
              )}
            </motion.div>
          )}
        </div>

        {/* Main Attendance Card with generous padding bottom */}
        {isAttendanceGridOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card attendance-grid-card p-6 mt-6 pb-8"
          >
          {isOversightAttendanceView && (
            <div className="mb-5 space-y-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:max-w-md">
                  <DatePickerField
                    label="FROM"
                    value={rangeFrom}
                    onChange={setRangeFrom}
                    maxDate={todayDate}
                  />
                  <DatePickerField
                    label="TO"
                    value={rangeTo}
                    onChange={setRangeTo}
                    maxDate={todayDate}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleApplyDateFilter}
                    className="inline-flex h-10 min-w-[8.5rem] items-center justify-center rounded-lg bg-[#FF4500] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#FF8A00] transition-colors"
                  >
                    Filter Date
                  </button>
                  <button
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-black transition-colors"
                    onClick={() => void handleExportAttendance()}
                    title="Export attendance"
                    aria-label="Export attendance"
                  >
                    <Download className="h-4 w-4" />
                    
                  </button>
                   <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-black transition-colors"
                    onClick={() => setIsAttendanceGridOpen(false)}
                    title="Close attendance grid"
                    aria-label="Close attendance grid"
                  >
                   <X className="h-4 w-4" />
                   </button>
                </div>
              </div>
              <p className="text-xs text-black/80 font-medium">
                Showing {visibleAttendanceLog.length} record
                {visibleAttendanceLog.length === 1 ? "" : "s"} from{" "}
                <span className="font-bold text-[#FF4500]">
                  {formatAttendanceCardDate(appliedRange.from)}
                </span>{" "}
                to{" "}
                <span className="font-bold text-[#FF4500]">
                  {formatAttendanceCardDate(appliedRange.to)}
                </span>
              </p>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-[#FF4500] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto pr-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#FF8A00]">
                    {showEmployeeColumn && (
                      <th className="text-left py-3 px-4 text-black font-heading text-xs tracking-wider font-bold">
                        EMPLOYEE
                      </th>
                    )}
                    <th className="text-left py-3 px-4 text-black font-heading text-xs tracking-wider font-bold">
                      DATE
                    </th>
                    <th className="text-left py-3 px-4 text-black font-heading text-xs tracking-wider font-bold">
                      CHECK_IN
                    </th>
                    <th className="text-left py-3 px-4 text-black font-heading text-xs tracking-wider font-bold">
                      CHECK_OUT
                    </th>
                    <th className="text-left py-3 px-4 text-black font-heading text-xs tracking-wider font-bold">
                      TOTAL_HOURS
                    </th>
                    <th className="text-left py-3 px-4 text-black font-heading text-xs tracking-wider font-bold">
                      STATUS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAttendanceLog.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-[#FF8A00]/20 hover:bg-[#FFF5ED] transition-colors"
                    >
                      {showEmployeeColumn && (
                        <td className="py-3 px-4 font-semibold text-black">
                          {row.employeeName}
                        </td>
                      )}
                      <td className="py-3 px-4 font-mono text-black">
                        {row.date}
                      </td>
                      <td className="py-3 px-4 text-black">
                        {row.checkIn ?? "-"}
                      </td>
                      <td className="py-3 px-4 text-black">
                        {row.checkOut ?? "-"}
                      </td>
                      <td className="py-3 px-4 text-black font-medium">
                        {row.totalHours}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                            row.status === "Full Day"
                              ? "border-green-600 bg-green-50 text-green-700"
                              : row.status === "Half Day" ||
                                  row.status === "Pending"
                                ? "border-[#FF8A00] bg-[#FFF5ED] text-[#FF4500]"
                                : "border-red-600 bg-red-50 text-red-700"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!visibleAttendanceLog.length && (
                    <tr>
                      <td
                        colSpan={showEmployeeColumn ? 6 : 5}
                        className="py-12 text-center text-black/70"
                      >
                        {isOversightAttendanceView
                          ? `No attendance records are available between ${formatAttendanceCardDate(appliedRange.from)} and ${formatAttendanceCardDate(appliedRange.to)}.`
                          : "No attendance records are visible for your current access scope."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Container with clear spacing and top border */}
          {!isLoading && visibleAttendanceLog.length > 0 && (
            <div className="mt-6 pt-4 border-t border-[#FF8A00]/30 pagination-container">
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                pageStart={pageStart}
                pageEnd={pageEnd}
                totalItems={visibleAttendanceLog.length}
                onPageSizeChange={setPageSize}
                onPreviousPage={goToPreviousPage}
                onNextPage={goToNextPage}
              />
            </div>
          )}
          </motion.div>
        ) : (
          <button
            type="button"
            onClick={() => setIsAttendanceGridOpen(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-lg border border-[#FF8A00] bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#FFF5ED]"
          >
            <LayoutGrid className="h-4 w-4" />
            Show attendance grid
          </button>
        )}
        </div>
      </PageWrapper>
    </div>
  );
};

export default Attendance;
