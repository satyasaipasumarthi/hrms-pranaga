import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import PageWrapper from "@/components/ui/PageWrapper";
import GlowButton from "@/components/ui/GlowButton";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { createLeaveRequest, fetchLeaveRecords, getReadableErrorMessage, updateLeaveStatus, type LeaveRecord } from "@/lib/hrms-api";
import { getModulePermission, hasMinimumDataScope, hasModulePermission } from "@/lib/permissions";

const leaveTypes = ["Casual Leave", "Sick Leave", "Earned Leave", "Compensatory Off"];

const baseBalances = [
  { type: "Casual Leave", total: 12, used: 0, remaining: 12 },
  { type: "Sick Leave", total: 10, used: 0, remaining: 10 },
  { type: "Earned Leave", total: 15, used: 0, remaining: 15 },
];

const Leave = () => {
  const { user, permissions } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({
    type: leaveTypes[0],
    from: "",
    to: "",
    reason: "",
  });

  const leavePermission = getModulePermission(permissions, "leave");
  const canCreateLeave = hasModulePermission(permissions, "leave", "create");
  const canApproveLeave = hasModulePermission(permissions, "leave", "approve");
  const showEmployeeColumn = hasMinimumDataScope(permissions, "leave", "team");

  const loadLeaves = useCallback(async () => {
    if (!user) {
      setLeaves([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const rows = await fetchLeaveRecords(user, permissions);
      setLeaves(rows);
    } catch (error) {
      console.error("Failed to load leave records:", error);
      setLeaves([]);
    } finally {
      setIsLoading(false);
    }
  }, [permissions, user]);

  useEffect(() => {
    void loadLeaves();
  }, [loadLeaves]);

  const balances = useMemo(() => {
    if (leavePermission.dataScope !== "own") {
      return [
        { type: "Pending", total: leaves.length || 1, used: leaves.filter((leave) => leave.status === "Pending").length, remaining: leaves.filter((leave) => leave.status === "Pending").length },
        { type: "Approved", total: leaves.length || 1, used: leaves.filter((leave) => leave.status === "Approved").length, remaining: leaves.filter((leave) => leave.status === "Approved").length },
        { type: "Rejected", total: leaves.length || 1, used: leaves.filter((leave) => leave.status === "Rejected").length, remaining: leaves.filter((leave) => leave.status === "Rejected").length },
      ];
    }

    const nextBalances = baseBalances.map((balance) => ({ ...balance }));
    leaves
      .filter((leave) => leave.status === "Approved")
      .forEach((leave) => {
        const target = nextBalances.find((balance) => balance.type === leave.type);
        if (target) {
          target.used += leave.days;
          target.remaining = Math.max(target.total - target.used, 0);
        }
      });

    return nextBalances;
  }, [leavePermission.dataScope, leaves]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) {
      return;
    }

    try {
      await createLeaveRequest(user, formData);
      toast({ title: "Request Sent", description: "Your leave request has been submitted." });
      setShowForm(false);
      setFormData({
        type: leaveTypes[0],
        from: "",
        to: "",
        reason: "",
      });
      await loadLeaves();
    } catch (error) {
      toast({
        title: "Error",
        description: getReadableErrorMessage(error, "Leave request could not be submitted."),
        variant: "destructive",
      });
    }
  };

  const handleDecision = async (leaveId: string, status: "Approved" | "Rejected") => {
    if (!user) {
      return;
    }

    try {
      await updateLeaveStatus(leaveId, user.id, status);
      toast({ title: `Leave ${status}`, description: `The request has been ${status.toLowerCase()}.` });
      await loadLeaves();
    } catch (error) {
      toast({
        title: "Action failed",
        description: getReadableErrorMessage(error, "Leave status could not be updated."),
        variant: "destructive",
      });
    }
  };

  return (
    <PageWrapper label="LEAVE_MANAGEMENT" title="Leave Portal">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {balances.map((balance, index) => (
          <motion.div
            key={balance.type}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="glass-card p-5 space-y-2"
          >
            <p className="text-sm text-muted-foreground font-heading tracking-wider">{balance.type.toUpperCase()}</p>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-heading font-bold text-foreground">{balance.remaining}</span>
              <span className="text-sm text-muted-foreground mb-1">/ {balance.total}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(balance.remaining / balance.total) * 100}%` }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="h-full rounded-full bg-primary"
              />
            </div>
          </motion.div>
        ))}
      </div>

      {canCreateLeave && (
        <div className="flex gap-3">
          <GlowButton onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "Apply Leave"}</GlowButton>
        </div>
      )}

      {showForm && canCreateLeave && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="glass-card p-6"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="font-heading font-semibold text-foreground tracking-wide">NEW_LEAVE_REQUEST</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-heading tracking-wider">LEAVE_TYPE</label>
                <select
                  value={formData.type}
                  onChange={(event) => setFormData({ ...formData, type: event.target.value })}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                >
                  {leaveTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-heading tracking-wider">FROM</label>
                <input
                  type="date"
                  required
                  value={formData.from}
                  onChange={(event) => setFormData({ ...formData, from: event.target.value })}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-heading tracking-wider">TO</label>
                <input
                  type="date"
                  required
                  value={formData.to}
                  onChange={(event) => setFormData({ ...formData, to: event.target.value })}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-heading tracking-wider">REASON</label>
              <textarea
                required
                value={formData.reason}
                onChange={(event) => setFormData({ ...formData, reason: event.target.value })}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground h-20 resize-none"
              />
            </div>
            <GlowButton type="submit">Submit Request</GlowButton>
          </form>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="glass-card p-6">
        <h3 className="font-heading font-semibold text-foreground mb-4 tracking-wide">
          {showEmployeeColumn ? "LEAVE_OPERATIONS" : "LEAVE_HISTORY"}
        </h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  {showEmployeeColumn && (
                    <th className="text-left py-3 px-4 text-muted-foreground font-heading text-xs tracking-wider">EMPLOYEE</th>
                  )}
                  <th className="text-left py-3 px-4 text-muted-foreground font-heading text-xs tracking-wider">TYPE</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-heading text-xs tracking-wider">FROM</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-heading text-xs tracking-wider">TO</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-heading text-xs tracking-wider">DAYS</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-heading text-xs tracking-wider">STATUS</th>
                  {canApproveLeave && (
                    <th className="text-left py-3 px-4 text-muted-foreground font-heading text-xs tracking-wider">ACTION</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {leaves.map((leave) => (
                  <tr key={leave.id} className="border-b border-border/30 hover:bg-accent/30 transition-colors">
                    {showEmployeeColumn && <td className="py-3 px-4 text-foreground/80">{leave.employeeName}</td>}
                    <td className="py-3 px-4 text-foreground/80">{leave.type}</td>
                    <td className="py-3 px-4 text-foreground/80">{leave.from}</td>
                    <td className="py-3 px-4 text-foreground/80">{leave.to}</td>
                    <td className="py-3 px-4 text-foreground/80">{leave.days}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs px-2 py-1 rounded-full border ${
                          leave.status === "Approved"
                            ? "status-approved"
                            : leave.status === "Pending"
                              ? "status-pending"
                              : "status-rejected"
                        }`}
                      >
                        {leave.status}
                      </span>
                    </td>
                    {canApproveLeave && (
                      <td className="py-3 px-4">
                        {leave.status === "Pending" ? (
                          <div className="flex gap-2">
                            <GlowButton variant="ghost" className="px-3 py-2" onClick={() => handleDecision(leave.id, "Approved")}>
                              Approve
                            </GlowButton>
                            <GlowButton variant="ghost" className="px-3 py-2" onClick={() => handleDecision(leave.id, "Rejected")}>
                              Reject
                            </GlowButton>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Resolved</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {!leaves.length && (
                  <tr>
                    <td colSpan={canApproveLeave ? (showEmployeeColumn ? 7 : 6) : showEmployeeColumn ? 6 : 5} className="py-12 text-center text-muted-foreground">
                      No leave records are visible for your current access scope.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </PageWrapper>
  );
};

export default Leave;
