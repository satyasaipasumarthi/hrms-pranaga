import { getBusinessDateKey } from "@/lib/attendance";

export const MONTHLY_LEAVE_CREDIT = 2;
export const YEARLY_LEAVE_ALLOWANCE = MONTHLY_LEAVE_CREDIT * 12;

// Comp-off is earned by working extra days, so it does not use the monthly balance.
export const BALANCE_EXEMPT_LEAVE_TYPES = ["Comp-off"];

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface LeaveBalanceInput {
  from: string;
  type: string;
  status: string;
  days: number;
}

export interface MonthlyLeaveSummary {
  month: number;
  label: string;
  carriedForward: number;
  credited: number;
  applied: number;
  approved: number;
  rejected: number;
  pending: number;
  used: number;
  closingBalance: number;
}

export interface LeaveYearTotals {
  applied: number;
  pending: number;
  approved: number;
  rejected: number;
  used: number;
}

export interface LeaveBalanceSummary {
  year: number;
  currentMonth: number;
  months: MonthlyLeaveSummary[];
  currentMonthSummary: MonthlyLeaveSummary;
  totals: LeaveYearTotals;
  creditedSoFar: number;
  bookedAhead: number;
  remaining: number;
}

const usesLeaveBalance = (leave: LeaveBalanceInput) =>
  leave.status === "Approved" && !BALANCE_EXEMPT_LEAVE_TYPES.includes(leave.type);

export const calculateLeaveBalance = (leaves: LeaveBalanceInput[], todayKey = getBusinessDateKey()): LeaveBalanceSummary => {
  const year = Number(todayKey.slice(0, 4));
  const currentMonth = Number(todayKey.slice(5, 7)) - 1;

  const leavesByMonth = monthLabels.map(() => [] as LeaveBalanceInput[]);
  leaves.forEach((leave) => {
    if (Number(leave.from.slice(0, 4)) !== year) {
      return;
    }

    const month = Number(leave.from.slice(5, 7)) - 1;
    leavesByMonth[month]?.push(leave);
  });

  let carriedForward = 0;
  const months = leavesByMonth.map<MonthlyLeaveSummary>((monthLeaves, month) => {
    const used = monthLeaves.filter(usesLeaveBalance).reduce((total, leave) => total + leave.days, 0);
    const summary: MonthlyLeaveSummary = {
      month,
      label: monthLabels[month],
      carriedForward,
      credited: MONTHLY_LEAVE_CREDIT,
      applied: monthLeaves.length,
      approved: monthLeaves.filter((leave) => leave.status === "Approved").length,
      rejected: monthLeaves.filter((leave) => leave.status === "Rejected").length,
      pending: monthLeaves.filter((leave) => leave.status === "Pending").length,
      used,
      closingBalance: carriedForward + MONTHLY_LEAVE_CREDIT - used,
    };

    carriedForward = summary.closingBalance;
    return summary;
  });

  const currentMonthSummary = months[currentMonth];
  const bookedAhead = months.slice(currentMonth + 1).reduce((total, month) => total + month.used, 0);

  const totals = months.reduce<LeaveYearTotals>(
    (sum, month) => ({
      applied: sum.applied + month.applied,
      pending: sum.pending + month.pending,
      approved: sum.approved + month.approved,
      rejected: sum.rejected + month.rejected,
      used: sum.used + month.used,
    }),
    { applied: 0, pending: 0, approved: 0, rejected: 0, used: 0 },
  );

  return {
    year,
    currentMonth,
    months,
    currentMonthSummary,
    totals,
    creditedSoFar: MONTHLY_LEAVE_CREDIT * (currentMonth + 1),
    bookedAhead,
    remaining: currentMonthSummary.closingBalance - bookedAhead,
  };
};
