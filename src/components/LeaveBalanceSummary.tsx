import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  calculateLeaveBalance,
  MONTHLY_LEAVE_CREDIT,
  YEARLY_LEAVE_ALLOWANCE,
  type LeaveBalanceInput,
} from "@/lib/leave-balance";

interface LeaveBalanceSummaryProps {
  leaves: LeaveBalanceInput[];
}

const headingClass = "text-left py-3 px-4 text-muted-foreground font-heading text-xs tracking-wider";
const cellClass = "py-3 px-4";

const LeaveBalanceSummary = ({ leaves }: LeaveBalanceSummaryProps) => {
  const summary = useMemo(() => calculateLeaveBalance(leaves), [leaves]);
  const { currentMonth, currentMonthSummary, totals, remaining, bookedAhead, year } = summary;

  const cards = [
    { label: "YEARLY_LEAVES", value: YEARLY_LEAVE_ALLOWANCE, note: `${MONTHLY_LEAVE_CREDIT} credited every month` },
    { label: "PENDING", value: totals.pending, note: "Waiting for approval" },
    { label: "APPROVED", value: totals.approved, note: `${totals.used} leave day${totals.used === 1 ? "" : "s"} used` },
    { label: "REJECTED", value: totals.rejected, note: "Not deducted" },
    {
      label: "REMAINING",
      value: remaining,
      note: `${currentMonthSummary.carriedForward} carried + ${MONTHLY_LEAVE_CREDIT} this month${
        currentMonthSummary.used ? ` - ${currentMonthSummary.used} used` : ""
      }${bookedAhead ? ` - ${bookedAhead} booked ahead` : ""}`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
            className="glass-card p-5 space-y-1"
          >
            <p className="text-xs text-muted-foreground font-heading tracking-wider">{card.label}</p>
            <p className="text-3xl font-heading font-bold text-foreground">{card.value}</p>
            <p className="text-xs text-muted-foreground">{card.note}</p>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="glass-card p-6">
        <h3 className="font-heading font-semibold text-foreground mb-1 tracking-wide">LEAVE_BALANCE_{year}</h3>
        <p className="text-xs text-muted-foreground mb-4">
          {MONTHLY_LEAVE_CREDIT} leaves are added every month ({YEARLY_LEAVE_ALLOWANCE} a year). Unused leaves carry forward to the
          next month and reset in January. Only approved leaves are deducted; comp-off is not deducted.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className={headingClass}>MONTH</th>
                <th className={headingClass}>CARRIED_FORWARD</th>
                <th className={headingClass}>CREDITED</th>
                <th className={headingClass}>PENDING</th>
                <th className={headingClass}>APPROVED</th>
                <th className={headingClass}>REJECTED</th>
                <th className={headingClass}>DAYS_USED</th>
                <th className={headingClass}>REMAINING</th>
              </tr>
            </thead>
            <tbody>
              {summary.months.map((month) => {
                const isCurrent = month.month === currentMonth;
                const isUpcoming = month.month > currentMonth;
                return (
                  <tr
                    key={month.month}
                    className={`border-b border-border/30 ${isCurrent ? "bg-accent/30" : ""} ${isUpcoming ? "opacity-50" : ""}`}
                  >
                    <td className={`${cellClass} text-foreground/80`}>
                      {month.label}
                      {isCurrent && <span className="ml-2 text-xs text-primary">(current)</span>}
                    </td>
                    <td className={`${cellClass} text-foreground/80`}>{month.carriedForward}</td>
                    <td className={`${cellClass} text-foreground/80`}>+{month.credited}</td>
                    <td className={`${cellClass} text-foreground/80`}>{month.pending}</td>
                    <td className={`${cellClass} text-foreground/80`}>{month.approved}</td>
                    <td className={`${cellClass} text-foreground/80`}>{month.rejected}</td>
                    <td className={`${cellClass} text-foreground/80`}>{month.used ? `-${month.used}` : 0}</td>
                    <td className={`${cellClass} text-foreground font-semibold`}>{month.closingBalance}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border/50 font-semibold">
                <td className={`${cellClass} text-foreground`}>TOTAL</td>
                <td className={`${cellClass} text-foreground/80`}>-</td>
                <td className={`${cellClass} text-foreground`}>{YEARLY_LEAVE_ALLOWANCE}</td>
                <td className={`${cellClass} text-foreground`}>{totals.pending}</td>
                <td className={`${cellClass} text-foreground`}>{totals.approved}</td>
                <td className={`${cellClass} text-foreground`}>{totals.rejected}</td>
                <td className={`${cellClass} text-foreground`}>{totals.used}</td>
                <td className={`${cellClass} text-foreground`}>{YEARLY_LEAVE_ALLOWANCE - totals.used}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Upcoming months are faded. REMAINING on a row is what is left at the end of that month.
        </p>
      </motion.div>
    </div>
  );
};

export default LeaveBalanceSummary;
