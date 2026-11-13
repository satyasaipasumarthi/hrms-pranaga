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

import {
  hasMinimumDataScope,
  hasModulePermission,
} from "@/lib/permissions";

import { Download, LayoutGrid, RefreshCw, RotateCcw, Search, X } from "lucide-react";

import "./Attendance.css";

// Format date from YYYY-MM-DD to MM/DD/YYYY
const formatAttendanceCardDate = (value: string) => {
  if (!value) return "";

  const datePart = value.split("T")[0];
  const [year, month, day] = datePart.split("-");

  if (!year || !month || !day) return value;

  return `${month}/${day}/${year}`;
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
    refetchAttendance,
  } = useAttendanceActions();

  // Permissions
  const canTrackOwnTime = hasModulePermission(
    permissions,
    "attendance",
    "create"
  );

  const showEmployeeColumn = hasMinimumDataScope(
    permissions,
    "attendance",
    "team"
  );

  const isOversightAttendanceView = showEmployeeColumn;

  const showPersonalTracker =
    !isOversightAttendanceView && canTrackOwnTime;

  const canViewLeave = hasModulePermission(
    permissions,
    "leave",
    "view"
  );

  const canCreateLeave = hasModulePermission(
    permissions,
    "leave",
    "create"
  );

  const showLeaveOperations = hasMinimumDataScope(
    permissions,
    "leave",
    "team"
  );

  const actionButtonClass =
    "inline-flex h-12 w-full max-w-[22rem] items-center justify-center whitespace-nowrap px-4 text-sm";

  // Today's date
  const today = getBusinessDateKey();

  const todayDate = useMemo(
    () => new Date(`${today}T12:00:00`),
    [today]
  );

  // Date filter states
  const [rangeFrom, setRangeFrom] = useState(today);
  const [rangeTo, setRangeTo] = useState(today);

  const [appliedRange, setAppliedRange] = useState({
    from: today,
    to: today,
  });

  const [isDateFilterApplied, setIsDateFilterApplied] =
    useState(false);

  // Attendance grid visibility
  const [isAttendanceGridOpen, setIsAttendanceGridOpen] =
    useState(true);

  // Check today's closed attendance record
  const todaysClosedRecord = useMemo(
    () =>
      attendanceLog.find(
        (row) =>
          row.userId === user?.id &&
          row.date === today &&
          Boolean(row.checkOut)
      ),
    [attendanceLog, today, user?.id]
  );

  const isTodayLocked = Boolean(
    todaysClosedRecord && !checkedIn
  );

  // Reset date filters for personal attendance view
  useEffect(() => {
    if (!isOversightAttendanceView) {
      setRangeFrom(today);
      setRangeTo(today);

      setAppliedRange({
        from: today,
        to: today,
      });
    }
  }, [isOversightAttendanceView, today]);

  // Column filter state for Attendance Table
  const initialColumnFilters = {
    employee: "",
    date: "",
    checkIn: "",
    checkOut: "",
    totalHours: "",
    status: "",
  };

  const [columnFilters, setColumnFilters] = useState(initialColumnFilters);

  const handleColumnFilterChange = (
    key: keyof typeof initialColumnFilters,
    value: string
  ) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearColumnFilter = (
    key: keyof typeof initialColumnFilters
  ) => {
    setColumnFilters((prev) => ({ ...prev, [key]: "" }));
  };

  const resetAllFilters = () => {
    setColumnFilters(initialColumnFilters);
  };

  const hasActiveColumnFilters = Boolean(
    columnFilters.employee ||
      columnFilters.date ||
      columnFilters.checkIn ||
      columnFilters.checkOut ||
      columnFilters.totalHours ||
      columnFilters.status
  );

  // Smart time filter matching (supports 12h, 24h, partial and minutes)
  const matchesTimeFilter = (
    actualTime: string | null,
    filterInput: string
  ) => {
    const query = filterInput.trim().toLowerCase();
    if (!query) return true;
    if (!actualTime || actualTime === "-") {
      return query === "-" || query === "none";
    }

    const actual = actualTime.trim().toLowerCase();

    // 1. Direct substring match (e.g. "06:03", "pm", "am", "06:03 pm")
    if (actual.includes(query)) return true;

    // 2. Strip leading zeros for hour matching (e.g. "6:03" matches "06:03 PM")
    const actualNoZero = actual.replace(/^0/, "");
    const queryNoZero = query.replace(/^0/, "");
    if (actualNoZero.includes(queryNoZero)) return true;

    // 3. 24-hour time to 12-hour format comparison (e.g. "18:03" matches "06:03 PM")
    const match24 = query.match(/^(\d{1,2}):(\d{2})$/);
    if (match24) {
      const h = parseInt(match24[1], 10);
      const m = match24[2];
      if (h >= 0 && h <= 23) {
        const ampm = h >= 12 ? "pm" : "am";
        const h12 = h % 12 === 0 ? 12 : h % 12;
        const h12Pad = h12.toString().padStart(2, "0");
        if (
          actual.includes(`${h12Pad}:${m} ${ampm}`) ||
          actual.includes(`${h12}:${m} ${ampm}`) ||
          actual.includes(`${h12Pad}:${m}`) ||
          actual.includes(`${h12}:${m}`)
        ) {
          return true;
        }
      }
    }

    return false;
  };

  // Filter attendance records by top date range and individual column filters
  const filteredAttendanceLog = useMemo(() => {
    return attendanceLog.filter((row) => {
      // 1. Date filter: if specific date is chosen in column filter, match that business date
      if (columnFilters.date) {
        if (row.date !== columnFilters.date) return false;
      } else if (isOversightAttendanceView && isDateFilterApplied) {
        // Otherwise, adhere to top date range if oversight view
        if (row.date < appliedRange.from || row.date > appliedRange.to) {
          return false;
        }
      }

      // 2. Employee search filter
      if (columnFilters.employee.trim()) {
        const empQuery = columnFilters.employee.trim().toLowerCase();
        const empName = (row.employeeName ?? "").toLowerCase();
        if (!empName.includes(empQuery)) return false;
      }

      // 3. Check-in time filter
      if (columnFilters.checkIn.trim()) {
        if (!matchesTimeFilter(row.checkIn, columnFilters.checkIn)) {
          return false;
        }
      }

      // 4. Check-out time filter
      if (columnFilters.checkOut.trim()) {
        if (!matchesTimeFilter(row.checkOut, columnFilters.checkOut)) {
          return false;
        }
      }

      // 5. Total hours filter
      if (columnFilters.totalHours.trim()) {
        const hoursQuery = columnFilters.totalHours.trim().toLowerCase();
        const hoursStr = (row.totalHours ?? "").toLowerCase();
        const matchDirect = hoursStr.includes(hoursQuery);
        const digitsOnly = hoursQuery.replace(/[^0-9]/g, "");
        const wholeHours = Math.floor(
          (row.totalMinutes || 0) / 60
        ).toString();
        const matchHourNumber = digitsOnly !== "" && wholeHours === digitsOnly;
        if (!matchDirect && !matchHourNumber) return false;
      }

      // 6. Status filter (Full Day, Pending, Absent, etc.)
      if (columnFilters.status) {
        if (
          (row.status ?? "").toLowerCase() !==
          columnFilters.status.toLowerCase()
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    attendanceLog,
    columnFilters,
    appliedRange,
    isOversightAttendanceView,
    isDateFilterApplied,
  ]);

  // Pagination
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
  } = usePagination(filteredAttendanceLog);

  // Apply date filter automatically when rangeFrom or rangeTo changes
  useEffect(() => {
    if (!rangeFrom || !rangeTo) {
      setIsDateFilterApplied(false);
      return;
    }
    if (rangeFrom > rangeTo) {
      toast({
        title: "Invalid Date Range",
        description: "The 'From' date cannot be later than the 'To' date.",
        variant: "destructive",
      });
      setIsDateFilterApplied(false);
      return;
    }
    const [from, to] =
      rangeFrom <= rangeTo ? [rangeFrom, rangeTo] : [rangeTo, rangeFrom];

    setAppliedRange({ from, to });
    setIsDateFilterApplied(true);
  }, [rangeFrom, rangeTo]);

  // Export attendance records
  const handleExportAttendance = async () => {
    const rowsToExport =
      hasActiveColumnFilters || isDateFilterApplied
        ? filteredAttendanceLog
        : attendanceLog;

    const fileLabel = columnFilters.date
      ? columnFilters.date
      : isDateFilterApplied
      ? `${appliedRange.from}_to_${appliedRange.to}`
      : "all";

    try {
      await exportAttendanceToExcel(
        rowsToExport,
        showEmployeeColumn,
        fileLabel
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
                  href="/applyleave"
                  target="apply-leave"
                  variant="primary"
                className="px-3 py-1.5 rounded-lg bg-[#ff9100] border border-[#ff9100] text-white hover:bg-[#ff9100] transition-colors font-medium text-xs flex items-center gap-1.5">
                  Apply Leave
                </GlowButton>
              )}

              {showLeaveOperations && (
                <GlowButton
                  href="/leaveoperations"
                  target="leave-operations"
                  variant="secondary"
                  className="inline-flex h-9 items-center justify-center px-4 text-xs bg-[#ff9100] border border-[#ff9100] text-white hover:bg-[#ff9100]">
                  Leave Operations
                </GlowButton>
              )}

              {!canCreateLeave && !showLeaveOperations && (
                <GlowButton
                  href="/leaveoperations"
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
          <div className="flex flex-col items-stretch gap-6 sm:flex-row">
            {showPersonalTracker && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card flex flex-col items-center justify-center space-y-5 p-6 sm:w-80 sm:flex-shrink-0 sm:p-8"
              >
                <p className="section-label font-bold text-black">
                  SHIFT_TIMER
                </p>

                <div className="whitespace-nowrap text-4xl font-heading font-bold tracking-widest text-black sm:text-5xl">
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
                  <p className="text-center text-xs font-semibold text-[#FF4500]">
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
                    className={`${actionButtonClass} !bg-[#FF4500] hover:!bg-[#FF8A00]`}
                  >
                    Check In
                  </GlowButton>

                  <GlowButton
                    onClick={handlePauseResume}
                    disabled={
                      !canTrackOwnTime ||
                      !checkedIn ||
                      isProcessing
                    }
                    variant="ghost"
                    className={`${actionButtonClass} border border-[#93C5FD] bg-[#DBEAFE] !text-[#3B82F6] hover:bg-[#BFDBFE] hover:!text-[#2563EB]`}
                  >
                    {isPaused ? "Resume" : "Pause"}
                  </GlowButton>

                  <GlowButton
                    onClick={handleCheckOut}
                    disabled={
                      !canTrackOwnTime ||
                      !checkedIn ||
                      isProcessing
                    }
                    variant="primary"
                    glow={false}
                    className={`${actionButtonClass} !bg-[#FF4500] hover:!bg-[#FF8A00]`}
                  >
                    Check Out
                  </GlowButton>
                </div>

                {!canTrackOwnTime && (
                  <p className="text-center text-xs text-black/70">
                    Time actions are disabled for your access scope.
                  </p>
                )}

                {isTodayLocked && canTrackOwnTime && (
                  <p className="text-center text-xs text-black/70">
                    Today's attendance is already recorded.
                    A new row will be available tomorrow.
                  </p>
                )}
              </motion.div>
            )}
          </div>

          {/* MAIN ATTENDANCE GRID */}
          {isAttendanceGridOpen ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 1 }}
              transition={{ delay: 0.1 }}
              className="glass-card attendance-grid-card mt-6 p-6 pb-8"
            >
              {/* DATE FILTERS */}
              {isOversightAttendanceView && (
                <div className="mb-5 space-y-3">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    {/* <div className="grid grid-cols-1 gap-3 sm:max-w-md sm:grid-cols-2">
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
                    </div> */}
                    {/* Calendar : From & To */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-muted-foreground">From</span>
                      <div className="scale-90 origin-left w-36">
                        <DatePickerField
                          label=""
                          value={rangeFrom}
                          onChange={(date) => {
                            setRangeFrom(date);
                          }}
                          maxDate={todayDate}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-muted-foreground">To</span>
                      <div className="scale-90 origin-left w-36">
                        <DatePickerField
                          label=""
                          value={rangeTo}
                          onChange={(date) => {
                            setRangeTo(date);
                          }}
                          maxDate={todayDate}
                        />
                      </div>
                    </div>
                  </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {hasActiveColumnFilters && (
                        <button
                          type="button"
                          onClick={resetAllFilters}
                          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-[#3B82F6] shadow-sm transition-colors hover:bg-blue-100"
                          title="Reset all filters"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Reset Filters</span>
                        </button>
                      )}

                      <button
                        type="button"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-50 hover:text-black"
                        onClick={() => void refetchAttendance()}
                        title="Fetch / Refresh attendance data"
                        aria-label="Fetch / Refresh attendance data"
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${
                            isLoading ? "animate-spin" : ""
                          }`}
                        />
                      </button>

                      <button
                        type="button"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-50 hover:text-black"
                        onClick={() => void handleExportAttendance()}
                        title="Export attendance"
                        aria-label="Export attendance"
                      >
                        <Download className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-50 hover:text-black"
                        onClick={() => setIsAttendanceGridOpen(false)}
                        title="Close attendance grid"
                        aria-label="Close attendance grid"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs font-medium text-black/80">
                    Showing {filteredAttendanceLog.length} record
                    {filteredAttendanceLog.length === 1 ? "" : "s"}{" "}
                    {columnFilters.date ? (
                      <>
                        for{" "}
                        <span className="font-bold text-[#FF4500]">
                          {formatAttendanceCardDate(columnFilters.date)}
                        </span>
                      </>
                    ) : (
                      <>
                        from{" "}
                        <span className="font-bold text-[#FF4500]">
                          {formatAttendanceCardDate(appliedRange.from)}
                        </span>{" "}
                        to{" "}
                        <span className="font-bold text-[#FF4500]">
                          {formatAttendanceCardDate(appliedRange.to)}
                        </span>
                      </>
                    )}
                    {hasActiveColumnFilters && !columnFilters.date && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        (filtered)
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* ATTENDANCE TABLE */}
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FF4500] border-t-transparent" />
                </div>
              ) : (
                <div className="overflow-x-auto pr-1">
                  <table className="attendance-table w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        {showEmployeeColumn && (
                          <th className="px-4 py-3 text-left font-heading text-xs font-bold tracking-wider text-black">
                            EMPLOYEE
                          </th>
                        )}

                        <th className="px-4 py-3 text-left font-heading text-xs font-bold tracking-wider text-black">
                          DATE
                        </th>

                        <th className="px-4 py-3 text-left font-heading text-xs font-bold tracking-wider text-black">
                          CHECK_IN
                        </th>

                        <th className="px-4 py-3 text-left font-heading text-xs font-bold tracking-wider text-black">
                          CHECK_OUT
                        </th>

                        <th className="px-4 py-3 text-left font-heading text-xs font-bold tracking-wider text-black">
                          TOTAL_HOURS
                        </th>

                        <th className="px-4 py-3 text-left font-heading text-xs font-bold tracking-wider text-black">
                          STATUS
                        </th>
                      </tr>

                      {/* FILTER ROW UNDER COLUMNS */}
                      <tr className="attendance-filter-row border-b border-slate-200 !bg-[#F8FAFD] hover:!bg-[#F8FAFD] [&>th]:!bg-[#F8FAFD] [&:hover>th]:!bg-[#F8FAFD]">
                        {showEmployeeColumn && (
                          <th className="px-4 py-2.5">
                            <div className="relative flex items-center">
                              <input
                                type="text"
                                value={columnFilters.employee}
                                onChange={(e) =>
                                  handleColumnFilterChange(
                                    "employee",
                                    e.target.value
                                  )
                                }
                                placeholder="Search employee..."
                                aria-label="Filter by employee"
                                className="w-full rounded-lg border border-[#CBD5E1] bg-white pl-2.5 pr-7 py-1 text-xs text-black placeholder:text-[#94A3B8] focus:border-[#FF4500] focus:outline-none"
                              />
                              {columnFilters.employee ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleClearColumnFilter("employee")
                                  }
                                  className="absolute right-1.5 p-0.5 text-black hover:text-[#3B82F6]"
                                  title="Clear employee search"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              ) : (
                                <Search className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-[#94A3B8]" />
                              )}
                            </div>
                          </th>
                        )}

                        {/* DATE COLUMN CALENDAR */}
                        <th className="px-4 py-2.5">
                          <div className="relative flex items-center">
                            <DatePickerField
                              value={columnFilters.date}
                              onChange={(val) =>
                                handleColumnFilterChange("date", val)
                              }
                              placeholder="Pick a date"
                              className="w-full !space-y-0"
                              buttonClassName="!h-8 w-full rounded-lg !text-xs px-2 bg-white border border-[#CBD5E1] hover:border-[#3B82F6] font-normal justify-start text-left truncate"
                              maxDate={todayDate}
                            />
                            {columnFilters.date && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleClearColumnFilter("date")
                                }
                                className="absolute right-2 z-10 p-0.5 text-black hover:text-[#3B82F6]"
                                title="Clear date filter"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </th>

                        {/* CHECK_IN TIME FIELD */}
                        <th className="px-4 py-2.5">
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              value={columnFilters.checkIn}
                              onChange={(e) =>
                                handleColumnFilterChange(
                                  "checkIn",
                                  e.target.value
                                )
                              }
                              placeholder="Enter time..."
                              aria-label="Filter by check in time"
                              className="w-full rounded-lg border border-[#CBD5E1] bg-white pl-2.5 pr-6 py-1 text-xs text-black placeholder:text-[#94A3B8] focus:border-[#FF4500] focus:outline-none"
                            />
                            {columnFilters.checkIn ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleClearColumnFilter("checkIn")
                                }
                                className="absolute right-1.5 p-0.5 text-black hover:text-[#3B82F6]"
                                title="Clear check in filter"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            ) : null}
                          </div>
                        </th>

                        {/* CHECK_OUT TIME FIELD */}
                        <th className="px-4 py-2.5">
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              value={columnFilters.checkOut}
                              onChange={(e) =>
                                handleColumnFilterChange(
                                  "checkOut",
                                  e.target.value
                                )
                              }
                              placeholder="Enter time..."
                              aria-label="Filter by check out time"
                              className="w-full rounded-lg border border-[#CBD5E1] bg-white pl-2.5 pr-6 py-1 text-xs text-black placeholder:text-[#94A3B8] focus:border-[#FF4500] focus:outline-none"
                            />
                            {columnFilters.checkOut ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleClearColumnFilter("checkOut")
                                }
                                className="absolute right-1.5 p-0.5 text-black hover:text-[#3B82F6]"
                                title="Clear check out filter"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            ) : null}
                          </div>
                        </th>

                        {/* TOTAL_HOURS COLUMN TOTAL TIME */}
                        <th className="px-4 py-2.5">
                          <div className="flex flex-col gap-1">
                            <div className="relative flex items-center">
                              <input
                                type="text"
                                value={columnFilters.totalHours}
                                onChange={(e) =>
                                  handleColumnFilterChange(
                                    "totalHours",
                                    e.target.value
                                  )
                                }
                                placeholder="Total time..."
                                aria-label="Filter by total hours"
                                className="w-full rounded-lg border border-[#CBD5E1] bg-white pl-2.5 pr-6 py-1 text-xs text-black placeholder:text-[#94A3B8] focus:border-[#FF4500] focus:outline-none"
                              />
                              {columnFilters.totalHours ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleClearColumnFilter("totalHours")
                                  }
                                  className="absolute right-1.5 p-0.5 text-black hover:text-[#3B82F6]"
                                  title="Clear total time filter"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </th>

                        {/* STATUS DROPDOWN (Full Day, Pending, Absent) */}
                        <th className="px-4 py-2.5">
                          <div className="relative flex items-center">
                            <select
                              value={columnFilters.status}
                              onChange={(e) =>
                                handleColumnFilterChange(
                                  "status",
                                  e.target.value
                                )
                              }
                              aria-label="Filter by status"
                              className="w-full truncate rounded-lg border border-[#CBD5E1] bg-white px-2 py-1 text-xs text-black focus:border-[#FF4500] focus:outline-none"
                            >
                              <option value="">Empty</option>
                              <option value="Full Day">Full Day</option>
                              <option value="Pending">Pending</option>
                              <option value="Absent">Absent</option>
                              <option value="Half Day">Half Day</option>
                            </select>
                            {columnFilters.status && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleClearColumnFilter("status")
                                }
                                className="absolute right-6 p-0.5 text-black hover:text-[#3B82F6]"
                                title="Clear status filter"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {paginatedAttendanceLog.map((row) => (
                        <tr
                          key={row.id}
                          className="attendance-row border-b border-slate-200 transition-colors duration-200 hover:!bg-[#EAF4FF] [&:hover>td]:!bg-[#EAF4FF]"
                        >
                          {showEmployeeColumn && (
                            <td className="px-4 py-3 font-semibold text-black">
                              {row.employeeName}
                            </td>
                          )}

                          <td className="px-4 py-3 font-mono text-black">
                            {formatAttendanceCardDate(row.date)}
                          </td>

                          <td className="px-4 py-3 text-black">
                            {row.checkIn ?? "-"}
                          </td>

                          <td className="px-4 py-3 text-black">
                            {row.checkOut ?? "-"}
                          </td>

                          <td className="px-4 py-3 font-medium text-black">
                            {row.totalHours}
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
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

                      {filteredAttendanceLog.length === 0 && (
                        <tr>
                          <td
                            colSpan={showEmployeeColumn ? 6 : 5}
                            className="py-12 text-center text-black/70"
                          >
                            {hasActiveColumnFilters ? (
                              <div className="flex flex-col items-center justify-center gap-2">
                                <p className="text-sm">
                                  No attendance records match your filter criteria.
                                </p>
                                <button
                                  type="button"
                                  onClick={resetAllFilters}
                                  className="text-xs font-semibold text-[#3B82F6] underline hover:text-[#2563EB]"
                                >
                                  Clear all filters
                                </button>
                              </div>
                            ) : isOversightAttendanceView ? (
                              `No attendance records are available between ${formatAttendanceCardDate(
                                appliedRange.from
                              )} and ${formatAttendanceCardDate(
                                appliedRange.to
                              )}.`
                            ) : (
                              "No attendance records are visible for your current access scope."
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>

                  </table>
                </div>
              )}

              {/* PAGINATION */}
              {!isLoading && filteredAttendanceLog.length > 0 && (
                <div className="pagination-container mt-6 border-t border-slate-200 pt-4">
                  <PaginationControls
                    currentPage={currentPage}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    pageStart={pageStart}
                    pageEnd={pageEnd}
                    totalItems={filteredAttendanceLog.length}
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
              className="mt-6 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#EAF4FF]"
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