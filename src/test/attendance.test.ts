import { describe, expect, it } from "vitest";
import {
  calculateAttendanceStatus,
  calculateDurationMinutes,
  formatWorkedDuration,
  getBusinessDateKey,
  getBusinessDateRange,
  normalizeAttendanceTimestamp,
  parseAttendanceDateValue,
} from "@/lib/attendance";

describe("attendance thresholds", () => {
  it("marks durations below 3 hours as absent", () => {
    expect(calculateAttendanceStatus(165)).toBe("Absent");
  });

  it("marks durations from 3 hours up to but not including 5 hours as half day", () => {
    expect(calculateAttendanceStatus(190)).toBe("Half Day");
    expect(calculateAttendanceStatus(290)).toBe("Half Day");
  });

  it("marks durations of 5 hours or more as full day", () => {
    expect(calculateAttendanceStatus(305)).toBe("Full Day");
  });

  it("keeps open shifts in pending status until checkout completes", () => {
    expect(calculateAttendanceStatus(120, { isOpenShift: true })).toBe("Pending");
    expect(calculateAttendanceStatus(240, { isOpenShift: true })).toBe("Pending");
    expect(calculateAttendanceStatus(320, { isOpenShift: true })).toBe("Pending");
  });

  it("formats total worked hours for the monthly log", () => {
    expect(formatWorkedDuration(185)).toBe("3h 05m");
  });

  it("derives total hours and status strictly from check-in and check-out timestamps", () => {
    const absentMinutes = calculateDurationMinutes("2026-04-05T09:00:00.000Z", "2026-04-05T11:45:00.000Z");
    const halfDayMinutes = calculateDurationMinutes("2026-04-05T09:00:00.000Z", "2026-04-05T12:10:00.000Z");
    const fullDayMinutes = calculateDurationMinutes("2026-04-05T09:00:00.000Z", "2026-04-05T14:05:00.000Z");

    expect(formatWorkedDuration(absentMinutes)).toBe("2h 45m");
    expect(calculateAttendanceStatus(absentMinutes)).toBe("Absent");
    expect(formatWorkedDuration(halfDayMinutes)).toBe("3h 10m");
    expect(calculateAttendanceStatus(halfDayMinutes)).toBe("Half Day");
    expect(formatWorkedDuration(fullDayMinutes)).toBe("5h 05m");
    expect(calculateAttendanceStatus(fullDayMinutes)).toBe("Full Day");
  });

  it("uses the India business day instead of raw UTC date boundaries", () => {
    expect(getBusinessDateKey("2026-04-15T20:00:00.000Z")).toBe("2026-04-16");
    expect(getBusinessDateKey("2026-04-16T18:29:59.000Z")).toBe("2026-04-16");
    expect(getBusinessDateKey("2026-04-16T18:30:00.000Z")).toBe("2026-04-17");
  });

  it("builds the correct UTC query range for one India business day", () => {
    const { startIso, endIso } = getBusinessDateRange("2026-04-16");

    expect(startIso).toBe("2026-04-15T18:30:00.000Z");
    expect(endIso).toBe("2026-04-16T18:30:00.000Z");
  });

  it("normalizes legacy Supabase timestamps without timezone suffixes as UTC", () => {
    expect(normalizeAttendanceTimestamp("2026-04-17 07:47:00")).toBe("2026-04-17T07:47:00Z");
    expect(parseAttendanceDateValue("2026-04-17 07:47:00").toISOString()).toBe("2026-04-17T07:47:00.000Z");
  });
});
