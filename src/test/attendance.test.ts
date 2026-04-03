import { describe, expect, it } from "vitest";
import { calculateAttendanceStatus, formatWorkedDuration } from "@/lib/attendance";

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

  it("keeps open shifts in pending status", () => {
    expect(calculateAttendanceStatus(320, { isOpenShift: true })).toBe("Pending");
  });

  it("formats total worked hours for the monthly log", () => {
    expect(formatWorkedDuration(185)).toBe("3h 05m");
  });
});
