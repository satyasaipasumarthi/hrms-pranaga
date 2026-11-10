import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import PageWrapper from "@/components/ui/PageWrapper";
import GlowButton from "@/components/ui/GlowButton";
import DatePickerField from "@/components/ui/DatePickerField";
import LeaveBalanceSummary from "@/components/LeaveBalanceSummary";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { createLeaveRequest, fetchLeaveRecords, getReadableErrorMessage, type LeaveRecord } from "@/lib/hrms-api";
import { hasModulePermission } from "@/lib/permissions";
import { toDateValue } from "@/lib/utils";
import "./LeaveApply.css";

const leaveTypes = ["Casual Leave", "Sick Leave", "Comp-off"];

// Set to today's date with time cleared to midnight
const earliestSelectableDate = new Date();
earliestSelectableDate.setHours(0, 0, 0, 0);

const LeaveApply = () => {
  const { user, permissions } = useAuth();
  const [formData, setFormData] = useState({
    type: leaveTypes[0],
    from: "",
    to: "",
    workedOn: "",
    requestedLeaveOn: "",
    reason: "",
  });

  const [myLeaves, setMyLeaves] = useState<LeaveRecord[]>([]);

  const canCreateLeave = hasModulePermission(permissions, "leave", "create");
  const isCompOff = formData.type === "Comp-off";

  const loadMyLeaves = useCallback(async () => {
    if (!user) {
      setMyLeaves([]);
      return;
    }

    try {
      setMyLeaves(await fetchLeaveRecords(user, permissions, { ownOnly: true }));
    } catch (error) {
      console.error("Failed to load leave records:", error);
      setMyLeaves([]);
    }
  }, [permissions, user]);

  useEffect(() => {
    void loadMyLeaves();
  }, [loadMyLeaves]);

  const resetForm = () => {
    setFormData({
      type: leaveTypes[0],
      from: "",
      to: "",
      workedOn: "",
      requestedLeaveOn: "",
      reason: "",
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) {
      return;
    }

    const payload = isCompOff
      ? {
          type: formData.type,
          from: formData.requestedLeaveOn,
          to: formData.requestedLeaveOn,
          reason: formData.reason,
          workedOnDate: formData.workedOn,
          requestedLeaveOnDate: formData.requestedLeaveOn,
        }
      : {
          type: formData.type,
          from: formData.from,
          to: formData.to,
          reason: formData.reason,
        };

    if (isCompOff && (!formData.workedOn || !formData.requestedLeaveOn)) {
      toast({ title: "Missing dates", description: "Pick both the worked-on date and the requested leave-on date.", variant: "destructive" });
      return;
    }

    if (!isCompOff && (!formData.from || !formData.to)) {
      toast({ title: "Missing dates", description: "Pick both a from and a to date.", variant: "destructive" });
      return;
    }

    if (!isCompOff && formData.to < formData.from) {
      toast({ title: "Invalid dates", description: "The to date must be on or after the from date.", variant: "destructive" });
      return;
    }

    try {
      await createLeaveRequest(user, payload);
      toast({ title: "Request Sent", description: "Your leave request has been submitted." });
      resetForm();
      await loadMyLeaves();
    } catch (error) {
      toast({
        title: "Error",
        description: getReadableErrorMessage(error, "Leave request could not be submitted."),
        variant: "destructive",
      });
    }
  };

  // Helper to normalize "FROM" date for "TO" minDate constraint
  const getMinToDate = () => {
    if (!formData.from) return earliestSelectableDate;
    const d = toDateValue(formData.from);
    if (!d || isNaN(d.getTime())) return earliestSelectableDate;
    d.setHours(0, 0, 0, 0);
    return d;
  };

  if (!canCreateLeave) {
    return (
      <div className="leave-apply-layout">
        <PageWrapper label="LEAVE_MANAGEMENT" title="Apply Leave">
          <div className="glass-card p-6 text-sm text-muted-foreground">
            You do not have permission to apply for leave.
          </div>
        </PageWrapper>
      </div>
    );
  }

  return (
    <div className="leave-apply-layout">
      <PageWrapper label="" title="Apply Leave">
        <div className="leave-apply-page space-y-6">
          <LeaveBalanceSummary leaves={myLeaves} />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6"
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <h3 className="font-heading font-semibold text-foreground tracking-wide">
                NEW_LEAVE_REQUEST
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground font-heading tracking-wider">
                    LEAVE_TYPE
                  </label>
                  <select
                    value={formData.type}
                    onChange={(event) =>
                      setFormData({ ...formData, type: event.target.value })
                    }
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                  >
                    {leaveTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                {isCompOff ? (
                  <>
                    <DatePickerField
                      label="WORKED_ON"
                      value={formData.workedOn}
                      onChange={(value) =>
                        setFormData({ ...formData, workedOn: value })
                      }
                      minDate={earliestSelectableDate}
                    />
                    <DatePickerField
                      label="REQUESTED_LEAVE_ON"
                      value={formData.requestedLeaveOn}
                      onChange={(value) =>
                        setFormData({ ...formData, requestedLeaveOn: value })
                      }
                      minDate={earliestSelectableDate}
                    />
                  </>
                ) : (
                  <>
                    <DatePickerField
                      label="FROM"
                      value={formData.from}
                      onChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          from: value,
                          to: prev.to && prev.to < value ? "" : prev.to,
                        }))
                      }
                      minDate={earliestSelectableDate}
                    />
                    <DatePickerField
                      label="TO"
                      value={formData.to}
                      onChange={(value) =>
                        setFormData({ ...formData, to: value })
                      }
                      minDate={getMinToDate()}
                    />
                  </>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-heading tracking-wider">
                  REASON
                </label>
                <textarea
                  required
                  value={formData.reason}
                  onChange={(event) =>
                    setFormData({ ...formData, reason: event.target.value })
                  }
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground h-20 resize-none"
                />
              </div>
              <GlowButton type="submit">Apply Leave</GlowButton>
            </form>
          </motion.div>
        </div>
      </PageWrapper>
    </div>
  );
};

export default LeaveApply;
