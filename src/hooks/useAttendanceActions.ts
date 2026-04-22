import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { getBusinessDateKey, parseAttendanceDateValue } from "@/lib/attendance";
import {
  checkInCurrentUser,
  checkOutCurrentUser,
  fetchAttendanceRecords,
  getReadableErrorMessage,
  pauseCurrentUser,
  resumeCurrentUser,
  type AttendanceRecord,
} from "@/lib/hrms-api";
import { hasMinimumDataScope, hasModulePermission } from "@/lib/permissions";

const ATTENDANCE_SYNC_EVENT = "hrms:attendance-actions-updated";

const emitAttendanceSync = (source: string) => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(ATTENDANCE_SYNC_EVENT, { detail: { source } }));
};

export const useAttendanceActions = () => {
  const { user, permissions } = useAuth();
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseStartTime, setPauseStartTime] = useState<Date | null>(null);
  const [totalPausedDurationSeconds, setTotalPausedDurationSeconds] = useState(0);
  const [elapsed, setElapsed] = useState("00:00:00");
  const [attendanceLog, setAttendanceLog] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const hookInstanceIdRef = useRef(`attendance-actions-${Math.random().toString(36).slice(2)}`);

  const canTrackOwnTime = hasModulePermission(permissions, "attendance", "create");
  const showEmployeeColumn = hasMinimumDataScope(permissions, "attendance", "team");
  const today = getBusinessDateKey();
  const todaysClosedRecord = useMemo(
    () => attendanceLog.find((row) => row.userId === user?.id && row.date === today && Boolean(row.checkOut)),
    [attendanceLog, today, user?.id],
  );
  const isTodayLocked = Boolean(todaysClosedRecord && !checkedIn);

  const resetAttendanceState = useCallback(() => {
    setCheckedIn(false);
    setCheckInTime(null);
    setIsPaused(false);
    setPauseStartTime(null);
    setTotalPausedDurationSeconds(0);
  }, []);

  const clearCheckInCache = useCallback(
    (userId: string) => {
      localStorage.removeItem(`hrms_checkin_${userId}`);
    },
    [],
  );

  const loadAttendance = useCallback(async () => {
    if (!user) {
      setAttendanceLog([]);
      resetAttendanceState();
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const rows = await fetchAttendanceRecords(user, permissions);
      setAttendanceLog(rows);

      const openShift = rows.find((row) => row.userId === user.id && row.date === today && !row.checkOut);
      const stored = localStorage.getItem(`hrms_checkin_${user.id}`);

      if (openShift) {
        const activeCheckIn = openShift.checkInIso ?? stored;
        if (!activeCheckIn) {
          resetAttendanceState();
          clearCheckInCache(user.id);
          return;
        }

        setCheckedIn(true);
        setCheckInTime(parseAttendanceDateValue(activeCheckIn));
        setIsPaused(openShift.isPaused);
        setPauseStartTime(openShift.pauseStartIso ? parseAttendanceDateValue(openShift.pauseStartIso) : null);
        setTotalPausedDurationSeconds(openShift.totalPausedDurationSeconds);
        localStorage.setItem(`hrms_checkin_${user.id}`, activeCheckIn);
      } else {
        resetAttendanceState();
        clearCheckInCache(user.id);
      }
    } catch (error) {
      console.error("Failed to load attendance:", error);
      resetAttendanceState();
      clearCheckInCache(user.id);
      setAttendanceLog([]);
      toast({
        title: "Attendance load issue",
        description: getReadableErrorMessage(error, "Unable to load attendance records."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [clearCheckInCache, permissions, resetAttendanceState, today, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    void loadAttendance();
  }, [loadAttendance, user]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleAttendanceSync = (event: Event) => {
      const source = event instanceof CustomEvent ? (event.detail as { source?: string } | undefined)?.source : undefined;
      if (source === hookInstanceIdRef.current) {
        return;
      }

      void loadAttendance();
    };

    window.addEventListener(ATTENDANCE_SYNC_EVENT, handleAttendanceSync);
    return () => window.removeEventListener(ATTENDANCE_SYNC_EVENT, handleAttendanceSync);
  }, [loadAttendance]);

  useEffect(() => {
    if (!checkInTime) {
      setElapsed("00:00:00");
      return;
    }

    const updateElapsed = (referenceTime: Date) => {
      const pausedDurationMilliseconds = Math.max(totalPausedDurationSeconds, 0) * 1000;
      const diff = Math.max(referenceTime.getTime() - checkInTime.getTime() - pausedDurationMilliseconds, 0);
      const hours = Math.floor(diff / 3600000)
        .toString()
        .padStart(2, "0");
      const minutes = Math.floor((diff % 3600000) / 60000)
        .toString()
        .padStart(2, "0");
      const seconds = Math.floor((diff % 60000) / 1000)
        .toString()
        .padStart(2, "0");
      setElapsed(`${hours}:${minutes}:${seconds}`);
    };

    if (isPaused && pauseStartTime) {
      updateElapsed(pauseStartTime);
      return;
    }

    updateElapsed(new Date());

    const timer = setInterval(() => {
      updateElapsed(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, [checkInTime, isPaused, pauseStartTime, totalPausedDurationSeconds]);

  const activeShiftDate = useMemo(() => (checkInTime ? getBusinessDateKey(checkInTime) : null), [checkInTime]);

  const syncAfterMutation = useCallback(async () => {
    await loadAttendance();
    emitAttendanceSync(hookInstanceIdRef.current);
  }, [loadAttendance]);

  const handleCheckIn = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      const checkInTimestamp = await checkInCurrentUser(user);
      setCheckedIn(true);
      setCheckInTime(parseAttendanceDateValue(checkInTimestamp));
      setIsPaused(false);
      setPauseStartTime(null);
      setTotalPausedDurationSeconds(0);
      localStorage.setItem(`hrms_checkin_${user.id}`, checkInTimestamp);
      await syncAfterMutation();
    } catch (error) {
      toast({
        title: "Check-in failed",
        description: getReadableErrorMessage(error, "Unable to complete check-in."),
        variant: "destructive",
      });
    }
  }, [syncAfterMutation, user]);

  const handleCheckOut = useCallback(async () => {
    if (!user || !activeShiftDate) {
      return;
    }

    try {
      await checkOutCurrentUser(user, activeShiftDate);
      resetAttendanceState();
      clearCheckInCache(user.id);
      await syncAfterMutation();
    } catch (error) {
      toast({
        title: "Check-out failed",
        description: getReadableErrorMessage(error, "Unable to complete check-out."),
        variant: "destructive",
      });
    }
  }, [activeShiftDate, clearCheckInCache, resetAttendanceState, syncAfterMutation, user]);

  const handlePauseResume = useCallback(async () => {
    if (!user || !activeShiftDate) {
      return;
    }

    const previousPauseState = {
      isPaused,
      pauseStartTime,
      totalPausedDurationSeconds,
    };

    try {
      if (isPaused) {
        const resumeTime = new Date();
        const additionalPausedDurationSeconds =
          pauseStartTime ? Math.max(Math.round((resumeTime.getTime() - pauseStartTime.getTime()) / 1000), 0) : 0;
        setIsPaused(false);
        setPauseStartTime(null);
        setTotalPausedDurationSeconds((current) => current + additionalPausedDurationSeconds);
        await resumeCurrentUser(user, activeShiftDate);
      } else {
        const pauseTime = new Date();
        setIsPaused(true);
        setPauseStartTime(pauseTime);
        await pauseCurrentUser(user, activeShiftDate);
      }

      await syncAfterMutation();
    } catch (error) {
      setIsPaused(previousPauseState.isPaused);
      setPauseStartTime(previousPauseState.pauseStartTime);
      setTotalPausedDurationSeconds(previousPauseState.totalPausedDurationSeconds);
      toast({
        title: isPaused ? "Resume failed" : "Pause failed",
        description: getReadableErrorMessage(error, isPaused ? "Unable to resume the shift." : "Unable to pause the shift."),
        variant: "destructive",
      });
    }
  }, [activeShiftDate, isPaused, pauseStartTime, syncAfterMutation, totalPausedDurationSeconds, user]);

  return {
    attendanceLog,
    canTrackOwnTime,
    checkInTime,
    checkedIn,
    elapsed,
    handleCheckIn,
    handleCheckOut,
    handlePauseResume,
    isLoading,
    isPaused,
    isTodayLocked,
    showEmployeeColumn,
  };
};
