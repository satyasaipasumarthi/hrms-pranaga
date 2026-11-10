import { downloadExcel } from "@/lib/export-excel";
import type { LeaveRecord } from "@/lib/hrms-api";

export const exportLeavesToExcel = (leaves: LeaveRecord[], fileLabel: string) =>
  downloadExcel(
    `leaves_${fileLabel}.xlsx`,
    "Leaves",
    [
      { header: "Employee", key: "employee", width: 28 },
      { header: "Type", key: "type", width: 18 },
      { header: "From", key: "from", width: 14 },
      { header: "To", key: "to", width: 14 },
      { header: "Days", key: "days", width: 8 },
      { header: "Status", key: "status", width: 14 },
      { header: "Reason", key: "reason", width: 40 },
    ],
    leaves.map((leave) => ({
      employee: leave.employeeName,
      type: leave.type,
      from: leave.from,
      to: leave.to,
      days: leave.days,
      status: leave.status,
      reason: leave.reason ?? "",
    })),
  );

interface LeaveBalanceExportRow {
  employeeName: string;
  creditedSoFar: number;
  remaining: number;
  totals: { pending: number; approved: number; rejected: number; used: number };
}

export const exportLeaveBalancesToExcel = (balances: LeaveBalanceExportRow[], year: number) =>
  downloadExcel(
    `leave_balance_${year}.xlsx`,
    "Leave Balance",
    [
      { header: "Employee", key: "employee", width: 28 },
      { header: "Credited So Far", key: "credited", width: 16 },
      { header: "Pending", key: "pending", width: 10 },
      { header: "Approved", key: "approved", width: 10 },
      { header: "Rejected", key: "rejected", width: 10 },
      { header: "Days Used", key: "used", width: 12 },
      { header: "Remaining", key: "remaining", width: 12 },
    ],
    balances.map((balance) => ({
      employee: balance.employeeName,
      credited: balance.creditedSoFar,
      pending: balance.totals.pending,
      approved: balance.totals.approved,
      rejected: balance.totals.rejected,
      used: balance.totals.used,
      remaining: balance.remaining,
    })),
  );
