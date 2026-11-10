import { describe, expect, it } from "vitest";
import { calculateLeaveBalance } from "@/lib/leave-balance";

describe("leave balance", () => {
  it("credits two leaves in January", () => {
    const summary = calculateLeaveBalance([], "2026-01-15");

    expect(summary.currentMonthSummary.carriedForward).toBe(0);
    expect(summary.remaining).toBe(2);
  });

  it("carries unused leaves forward so December shows 22 carried plus 2 new", () => {
    const summary = calculateLeaveBalance([], "2026-12-05");

    expect(summary.currentMonthSummary.carriedForward).toBe(22);
    expect(summary.currentMonthSummary.credited).toBe(2);
    expect(summary.remaining).toBe(24);
  });

  it("deducts only approved non comp-off days", () => {
    const summary = calculateLeaveBalance(
      [
        { from: "2026-02-10", type: "Casual Leave", status: "Approved", days: 2 },
        { from: "2026-02-20", type: "Sick Leave", status: "Rejected", days: 1 },
        { from: "2026-03-03", type: "Sick Leave", status: "Pending", days: 1 },
        { from: "2026-03-09", type: "Comp-off", status: "Approved", days: 1 },
      ],
      "2026-03-15",
    );

    expect(summary.months[1]).toMatchObject({ applied: 2, approved: 1, rejected: 1, used: 2, closingBalance: 2 });
    expect(summary.currentMonthSummary).toMatchObject({ carriedForward: 2, applied: 2, approved: 1, pending: 1, used: 0 });
    expect(summary.remaining).toBe(4);
    expect(summary.creditedSoFar).toBe(6);
    expect(summary.totals).toEqual({ applied: 4, pending: 1, approved: 2, rejected: 1, used: 2 });
  });

  it("gives 24 leaves over a full year", () => {
    const summary = calculateLeaveBalance([], "2026-06-10");

    expect(summary.months.reduce((total, month) => total + month.credited, 0)).toBe(24);
    expect(summary.months[11].closingBalance).toBe(24);
  });

  it("resets the balance at the start of a new year", () => {
    const summary = calculateLeaveBalance(
      [{ from: "2025-12-01", type: "Casual Leave", status: "Approved", days: 3 }],
      "2026-01-10",
    );

    expect(summary.remaining).toBe(2);
  });

  it("subtracts approved leave already booked for later months", () => {
    const summary = calculateLeaveBalance(
      [{ from: "2026-06-01", type: "Casual Leave", status: "Approved", days: 3 }],
      "2026-04-10",
    );

    expect(summary.currentMonthSummary.closingBalance).toBe(8);
    expect(summary.bookedAhead).toBe(3);
    expect(summary.remaining).toBe(5);
  });
});
