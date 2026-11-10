
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Download,
  Eye,
  Pencil,
  Trash2,
  Search,
  X,
} from "lucide-react";

import PageWrapper from "@/components/ui/PageWrapper";
import GlowButton from "@/components/ui/GlowButton";
import PaginationControls, {
  usePagination,
} from "@/components/ui/PaginationControls";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

import {
  deleteLeaveRequest,
  fetchLeaveRecords,
  getReadableErrorMessage,
  updateLeaveStatus,
  type LeaveRecord,
} from "@/lib/hrms-api";

import {
  exportLeaveBalancesToExcel,
  exportLeavesToExcel,
} from "@/lib/export-leaves";

import {
  calculateLeaveBalance,
  MONTHLY_LEAVE_CREDIT,
  YEARLY_LEAVE_ALLOWANCE,
} from "@/lib/leave-balance";

import { hasModulePermission } from "@/lib/permissions";
import "./LeaveOperations.css";

const statusEmoji: Record<string, string> = {
  Pending: "🕒",
  Approved: "✅",
  Rejected: "🚫",
};

const inputClass =
  "w-full min-w-[100px] h-9 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-800 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-200";

const LeaveOperations = () => {
  const { user, permissions } = useAuth();

  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [viewingLeave, setViewingLeave] =
    useState<LeaveRecord | null>(null);

  const [editingLeave, setEditingLeave] =
    useState<LeaveRecord | null>(null);

  const [deletingLeave, setDeletingLeave] =
    useState<LeaveRecord | null>(null);

  const [isDeleting, setIsDeleting] = useState(false);

  // Individual column filters
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [daysFilter, setDaysFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const canApproveLeave = hasModulePermission(
    permissions,
    "leave",
    "approve"
  );

  const canDeleteLeave = hasModulePermission(
    permissions,
    "leave",
    "delete"
  );

  // Fetch leave records
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

  // Available leave types
  const leaveTypes = useMemo(
    () => [...new Set(leaves.map((leave) => leave.type))].sort(),
    [leaves]
  );

  // Filter leave records
  const filteredLeaves = useMemo(() => {
    return leaves.filter((leave) => {
      const employeeMatch = leave.employeeName
        .toLowerCase()
        .includes(employeeFilter.toLowerCase());

      const typeMatch =
        !typeFilter || leave.type === typeFilter;

      const fromMatch =
        !fromFilter || leave.from === fromFilter;

      const toMatch =
        !toFilter || leave.to === toFilter;

      const daysMatch =
        !daysFilter ||
        String(leave.days).includes(daysFilter);

      const statusMatch =
        !statusFilter || leave.status === statusFilter;

      return (
        employeeMatch &&
        typeMatch &&
        fromMatch &&
        toMatch &&
        daysMatch &&
        statusMatch
      );
    });
  }, [
    leaves,
    employeeFilter,
    typeFilter,
    fromFilter,
    toFilter,
    daysFilter,
    statusFilter,
  ]);

  // Clear all filters
  const clearFilters = () => {
    setEmployeeFilter("");
    setTypeFilter("");
    setFromFilter("");
    setToFilter("");
    setDaysFilter("");
    setStatusFilter("");
  };

  const hasActiveFilters = Boolean(
    employeeFilter ||
    typeFilter ||
    fromFilter ||
    toFilter ||
    daysFilter ||
    statusFilter
  );

  // Summary cards
  const balances = useMemo(
    () => [
      {
        type: "Pending",
        total: leaves.length || 1,
        count: leaves.filter(
          (leave) => leave.status === "Pending"
        ).length,
      },
      {
        type: "Approved",
        total: leaves.length || 1,
        count: leaves.filter(
          (leave) => leave.status === "Approved"
        ).length,
      },
      {
        type: "Rejected",
        total: leaves.length || 1,
        count: leaves.filter(
          (leave) => leave.status === "Rejected"
        ).length,
      },
    ],
    [leaves]
  );

  // Employee leave balances
  const employeeBalances = useMemo(() => {
    const leavesByEmployee = new Map<string, LeaveRecord[]>();

    leaves.forEach((leave) => {
      leavesByEmployee.set(leave.userId, [
        ...(leavesByEmployee.get(leave.userId) ?? []),
        leave,
      ]);
    });

    return Array.from(leavesByEmployee.values())
      .map((employeeLeaves) => ({
        userId: employeeLeaves[0].userId,
        employeeName: employeeLeaves[0].employeeName,
        ...calculateLeaveBalance(employeeLeaves),
      }))
      .sort((a, b) =>
        a.employeeName.localeCompare(b.employeeName)
      );
  }, [leaves]);

  // Export leave requests
  const handleExportLeaves = async () => {
    try {
      await exportLeavesToExcel(filteredLeaves, "filtered");
    } catch (error) {
      console.error("Failed to export leaves:", error);

      toast({
        title: "Export failed",
        description: "The leave records could not be exported.",
        variant: "destructive",
      });
    }
  };

  // Export employee balances
  const handleExportBalances = async () => {
    try {
      await exportLeaveBalancesToExcel(
        employeeBalances,
        employeeBalances[0].year
      );
    } catch (error) {
      toast({
        title: "Export failed",
        description: "The leave balances could not be exported.",
        variant: "destructive",
      });
    }
  };

  // Pagination
  const leavePagination = usePagination(filteredLeaves);
  const balancePagination = usePagination(employeeBalances);

  const viewingEmployeeBalance = viewingLeave
    ? employeeBalances.find(
        (balance) => balance.userId === viewingLeave.userId
      ) ?? null
    : null;

  // Edit dialog decision
  const handleDecision = async (
    leaveId: string,
    status: "Approved" | "Rejected"
  ) => {
    if (!user) return;

    try {
      await updateLeaveStatus(leaveId, user.id, status);

      toast({
        title: `Leave ${status}`,
        description: `The request has been ${status.toLowerCase()}.`,
      });

      setEditingLeave(null);
      await loadLeaves();
    } catch (error) {
      toast({
        title: "Action failed",
        description: getReadableErrorMessage(
          error,
          "Leave status could not be updated."
        ),
        variant: "destructive",
      });
    }
  };

  // Delete request
  const handleDelete = async () => {
    if (!deletingLeave) return;

    setIsDeleting(true);

    try {
      await deleteLeaveRequest(deletingLeave.id);

      toast({
        title: "Leave Deleted",
        description: "The leave request has been removed.",
      });

      setDeletingLeave(null);
      await loadLeaves();
    } catch (error) {
      toast({
        title: "Delete failed",
        description: getReadableErrorMessage(
          error,
          "Leave request could not be deleted."
        ),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const columnCount = 7;

  return (
    <div className="leave-operations-layout">
      <PageWrapper title="Leave Operations">

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-5 space-y-2"
          >
            <p className="text-sm text-muted-foreground font-heading tracking-wider">
              TOTAL_REQUESTS
            </p>

            <span className="block text-3xl font-heading font-bold text-foreground">
              {leaves.length}
            </span>

            <p className="text-xs text-muted-foreground">
              All leave requests you can see
            </p>
          </motion.div>

          {balances.map((balance, index) => (
            <motion.div
              key={balance.type}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (index + 1) * 0.1 }}
              className="glass-card p-5 space-y-2"
            >
              <p className="text-sm text-muted-foreground font-heading tracking-wider">
                {balance.type.toUpperCase()}
              </p>

              <div className="flex items-end gap-1">
                <span className="text-3xl font-heading font-bold text-foreground">
                  {balance.count}
                </span>

                <span className="text-sm text-muted-foreground mb-1">
                  of {leaves.length} requests
                </span>
              </div>

              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${
                      (balance.count / balance.total) * 100
                    }%`,
                  }}
                  transition={{ duration: 0.8 }}
                  className="h-full rounded-full bg-primary"
                />
              </div>
            </motion.div>
          ))}
        </div>

        {/* LEAVE OPERATIONS TABLE */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card p-6"
        >

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">

            <h3 className="font-heading font-semibold text-foreground tracking-wide">
              LEAVE_OPERATIONS
            </h3>

            <div className="flex items-center gap-3">

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100"
                >
                  <X className="h-3 w-3" />
                  Clear Filters
                </button>
              )}

              <button
                type="button"
                onClick={() => void handleExportLeaves()}
                disabled={isLoading || filteredLeaves.length === 0}
                title="Export leave requests"
                aria-label="Export leave requests"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#FF8A00] bg-white text-black transition-colors hover:bg-[#FF4500] hover:text-white disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
              </button>

            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                {/* TABLE HEADINGS */}
                <thead>
                  <tr className="border-b border-border/50 bg-slate-100">

                    <th className="text-left py-3 px-4 text-gray-600 font-heading text-xs tracking-wider">
                      ACTION
                    </th>

                    <th className="text-left py-3 px-4 text-gray-600 font-heading text-xs tracking-wider">
                      EMPLOYEE
                    </th>

                    <th className="text-left py-3 px-4 text-gray-600 font-heading text-xs tracking-wider">
                      TYPE
                    </th>

                    <th className="text-left py-3 px-4 text-gray-600 font-heading text-xs tracking-wider">
                      FROM
                    </th>

                    <th className="text-left py-3 px-4 text-gray-600 font-heading text-xs tracking-wider">
                      TO
                    </th>

                    <th className="text-left py-3 px-4 text-gray-600 font-heading text-xs tracking-wider">
                      DAYS
                    </th>

                    <th className="text-left py-3 px-4 text-gray-600 font-heading text-xs tracking-wider">
                      STATUS
                    </th>

                  </tr>

                  {/* FILTER ROW */}
                  <tr className="border-b border-gray-200 bg-white">

                    {/* ACTION - No filter */}
                    <th className="px-2 py-2">
                      <span className="text-xs text-gray-400">
                        --
                      </span>
                    </th>

                    {/* EMPLOYEE FILTER */}
                    <th className="px-2 py-2">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />

                        <input
                          type="text"
                          value={employeeFilter}
                          onChange={(e) =>
                            setEmployeeFilter(e.target.value)
                          }
                          placeholder="Search employee"
                          aria-label="Filter by employee"
                          className={`${inputClass} pl-7`}
                        />
                      </div>
                    </th>

                    {/* TYPE FILTER */}
                    <th className="px-2 py-2">
                      <select
                        value={typeFilter}
                        onChange={(e) =>
                          setTypeFilter(e.target.value)
                        }
                        aria-label="Filter by leave type"
                        className={inputClass}
                      >
                        <option value="">All Types</option>

                        {leaveTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </th>

                    {/* FROM DATE FILTER */}
                    <th className="px-2 py-2">
                      <input
                        type="date"
                        value={fromFilter}
                        onChange={(e) =>
                          setFromFilter(e.target.value)
                        }
                        aria-label="Filter by start date"
                        title="Filter by From date"
                        className={inputClass}
                      />
                    </th>

                    {/* TO DATE FILTER */}
                    <th className="px-2 py-2">
                      <input
                        type="date"
                        value={toFilter}
                        onChange={(e) =>
                          setToFilter(e.target.value)
                        }
                        aria-label="Filter by end date"
                        title="Filter by To date"
                        className={inputClass}
                      />
                    </th>

                    {/* DAYS FILTER */}
                    <th className="px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        value={daysFilter}
                        onChange={(e) =>
                          setDaysFilter(e.target.value)
                        }
                        placeholder="Days"
                        aria-label="Filter by days"
                        className={inputClass}
                      />
                    </th>

                    {/* STATUS FILTER */}
                    <th className="px-2 py-2">
                      <select
                        value={statusFilter}
                        onChange={(e) =>
                          setStatusFilter(e.target.value)
                        }
                        aria-label="Filter by status"
                        className={inputClass}
                      >
                        <option value="">All</option>
                        <option value="Pending">Pending</option>
                        <option value="Approved">Approved</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </th>

                  </tr>
                </thead>

                {/* TABLE BODY */}
                <tbody>

                  {leavePagination.pageItems.map((leave) => (

                    <tr
                      key={leave.id}
                      className="border-b border-border/30 hover:bg-accent/30 transition-colors"
                    >

                      {/* ACTION BUTTONS */}
                      <td className="py-3 px-4">
                        <div className="flex gap-3">

                          <button
                            type="button"
                            title="View"
                            aria-label="View"
                            onClick={() =>
                              setViewingLeave(leave)
                            }
                            className="rounded-lg p-1 text-[#FF8A00] transition-colors hover:bg-[#FFF5ED]"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {canApproveLeave && (
                            <button
                              type="button"
                              title="Edit"
                              aria-label="Edit"
                              onClick={() =>
                                setEditingLeave(leave)
                              }
                              className="rounded-lg p-1 text-[#3B82F6] transition-colors hover:bg-blue-50"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}

                          {canDeleteLeave && (
                            <button
                              type="button"
                              title="Delete"
                              aria-label="Delete"
                              onClick={() =>
                                setDeletingLeave(leave)
                              }
                              className="rounded-lg p-1 text-[#EF4444] transition-colors hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}

                        </div>
                      </td>

                      {/* EMPLOYEE */}
                      <td className="py-3 px-4 text-foreground/80">
                        {leave.employeeName}
                      </td>

                      {/* TYPE */}
                      <td className="py-3 px-4 text-foreground/80">
                        {leave.type}
                      </td>

                      {/* FROM */}
                      <td className="py-3 px-4 text-foreground/80">
                        {leave.from}
                      </td>

                      {/* TO */}
                      <td className="py-3 px-4 text-foreground/80">
                        {leave.to}
                      </td>

                      {/* DAYS */}
                      <td className="py-3 px-4 text-foreground/80">
                        {leave.days}
                      </td>

                      {/* STATUS */}
                      <td className="py-3 px-4">
                        <span
                          title={leave.status}
                          aria-label={leave.status}
                          className="inline-flex items-center text-sm text-foreground/80"
                        >
                          {statusEmoji[leave.status] ?? leave.status}
                        </span>
                      </td>

                    </tr>
                  ))}

                  {/* NO RECORDS */}
                  {filteredLeaves.length === 0 && (
                    <tr>
                      <td
                        colSpan={columnCount}
                        className="py-12 text-center text-muted-foreground"
                      >
                        {hasActiveFilters
                          ? "No matching leave records found. Try changing your filters."
                          : "No leave records are visible for your current access scope."}
                      </td>
                    </tr>
                  )}

                </tbody>
              </table>

              {/* PAGINATION */}
              {filteredLeaves.length > 0 && (
                <PaginationControls
                  currentPage={leavePagination.currentPage}
                  totalPages={leavePagination.totalPages}
                  pageSize={leavePagination.pageSize}
                  pageStart={leavePagination.pageStart}
                  pageEnd={leavePagination.pageEnd}
                  totalItems={filteredLeaves.length}
                  itemLabel="requests"
                  onPageSizeChange={leavePagination.setPageSize}
                  onPreviousPage={leavePagination.goToPreviousPage}
                  onNextPage={leavePagination.goToNextPage}
                />
              )}

            </div>
          )}
        </motion.div>

        {/* LEAVE BALANCE TABLE */}
        {!isLoading && employeeBalances.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card p-6"
          >

            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">

              <h3 className="font-heading font-semibold text-foreground tracking-wide">
                LEAVE_BALANCE_{employeeBalances[0].year}
              </h3>

              <button
                type="button"
                onClick={() => void handleExportBalances()}
                title="Export leave balances"
                aria-label="Export leave balances"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#FF8A00] bg-white text-black hover:bg-[#FF4500] hover:text-white"
              >
                <Download className="h-4 w-4" />
              </button>

            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Each employee gets {MONTHLY_LEAVE_CREDIT} leaves every
              month ({YEARLY_LEAVE_ALLOWANCE} a year). Unused leaves
              carry forward to the next month. Only approved leaves
              are deducted.
            </p>

            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                <thead>
                  <tr className="border-b border-border/50">

                    {[
                      "EMPLOYEE",
                      "CREDITED_SO_FAR",
                      "PENDING",
                      "APPROVED",
                      "REJECTED",
                      "DAYS_USED",
                      "REMAINING",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="text-left py-3 px-4 text-muted-foreground font-heading text-xs tracking-wider"
                      >
                        {heading}
                      </th>
                    ))}

                  </tr>
                </thead>

                <tbody>
                  {balancePagination.pageItems.map((balance) => (
                    <tr
                      key={balance.userId}
                      className="border-b border-border/30 hover:bg-accent/30"
                    >
                      <td className="py-3 px-4">
                        {balance.employeeName}
                      </td>

                      <td className="py-3 px-4">
                        {balance.creditedSoFar}
                      </td>

                      <td className="py-3 px-4">
                        {balance.totals.pending}
                      </td>

                      <td className="py-3 px-4">
                        {balance.totals.approved}
                      </td>

                      <td className="py-3 px-4">
                        {balance.totals.rejected}
                      </td>

                      <td className="py-3 px-4">
                        {balance.totals.used}
                      </td>

                      <td className="py-3 px-4 font-semibold">
                        {balance.remaining}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <PaginationControls
                currentPage={balancePagination.currentPage}
                totalPages={balancePagination.totalPages}
                pageSize={balancePagination.pageSize}
                pageStart={balancePagination.pageStart}
                pageEnd={balancePagination.pageEnd}
                totalItems={employeeBalances.length}
                itemLabel="employees"
                onPageSizeChange={balancePagination.setPageSize}
                onPreviousPage={balancePagination.goToPreviousPage}
                onNextPage={balancePagination.goToNextPage}
              />

            </div>
          </motion.div>
        )}

        {/* VIEW LEAVE DIALOG */}
        <Dialog
          open={Boolean(viewingLeave)}
          onOpenChange={(open) =>
            !open && setViewingLeave(null)
          }
        >
          <DialogContent className="border-gray-200 bg-white text-gray-900">

            <DialogHeader>
              <DialogTitle>Leave Request</DialogTitle>
              <DialogDescription className="text-gray-600">
                {viewingLeave?.employeeName}
              </DialogDescription>
            </DialogHeader>

            {viewingLeave && (
              <div className="space-y-3 text-sm">

                <div className="grid grid-cols-2 gap-3">

                  <div>
                    <p className="text-xs text-gray-500">TYPE</p>
                    <p>{viewingLeave.type}</p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">STATUS</p>
                    <p>
                      {statusEmoji[viewingLeave.status]}{" "}
                      {viewingLeave.status}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">FROM</p>
                    <p>{viewingLeave.from}</p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">TO</p>
                    <p>{viewingLeave.to}</p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">DAYS</p>
                    <p>{viewingLeave.days}</p>
                  </div>

                  {viewingLeave.type === "Comp-off" &&
                    viewingLeave.workedOnDate && (
                      <div>
                        <p className="text-xs text-gray-500">
                          WORKED_ON
                        </p>
                        <p>{viewingLeave.workedOnDate}</p>
                      </div>
                    )}

                  {viewingLeave.type === "Comp-off" &&
                    viewingLeave.requestedLeaveOnDate && (
                      <div>
                        <p className="text-xs text-gray-500">
                          REQUESTED_LEAVE_ON
                        </p>
                        <p>{viewingLeave.requestedLeaveOnDate}</p>
                      </div>
                    )}

                </div>

                <div>
                  <p className="text-xs text-gray-500">REASON</p>
                  <p className="whitespace-pre-wrap">
                    {viewingLeave.reason || "No reason provided."}
                  </p>
                </div>

                {viewingEmployeeBalance && (
                  <div className="border-t border-border/50 pt-3">

                    <p className="mb-2 text-xs text-gray-500">
                      LEAVE_SUMMARY_{viewingEmployeeBalance.year}
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">

                      {[
                        {
                          label: "TOTAL_APPLIED",
                          value: viewingEmployeeBalance.totals.applied,
                        },
                        {
                          label: "PENDING",
                          value: viewingEmployeeBalance.totals.pending,
                        },
                        {
                          label: "APPROVED",
                          value: viewingEmployeeBalance.totals.approved,
                        },
                        {
                          label: "REJECTED",
                          value: viewingEmployeeBalance.totals.rejected,
                        },
                        {
                          label: "DAYS_USED",
                          value: viewingEmployeeBalance.totals.used,
                        },
                        {
                          label: "REMAINING",
                          value: viewingEmployeeBalance.remaining,
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-lg border border-border/50 p-3"
                        >
                          <p className="text-xs text-gray-500">
                            {item.label}
                          </p>
                          <p className="text-2xl font-heading font-bold">
                            {item.value}
                          </p>
                        </div>
                      ))}

                    </div>
                  </div>
                )}

              </div>
            )}

          </DialogContent>
        </Dialog>

        {/* EDIT STATUS DIALOG */}
        <Dialog
          open={Boolean(editingLeave)}
          onOpenChange={(open) =>
            !open && setEditingLeave(null)
          }
        >
          <DialogContent className="border-gray-200 bg-white text-gray-900">

            <DialogHeader>
              <DialogTitle>Edit Leave Status</DialogTitle>
              <DialogDescription className="text-gray-600">
                {editingLeave?.employeeName} · {editingLeave?.type}
                {" · "}
                {editingLeave?.from} to {editingLeave?.to}
              </DialogDescription>
            </DialogHeader>

            <p className="text-sm text-gray-600">
              Current status:{" "}
              {editingLeave
                ? statusEmoji[editingLeave.status] ?? ""
                : ""}
              {" "}
              {editingLeave?.status}
            </p>

            <DialogFooter>

              <GlowButton
                variant="secondary"
                onClick={() =>
                  editingLeave &&
                  handleDecision(editingLeave.id, "Rejected")
                }
                className="inline-flex h-10 items-center justify-center px-5 text-xs"
              >
                Reject
              </GlowButton>

              <GlowButton
                variant="primary"
                onClick={() =>
                  editingLeave &&
                  handleDecision(editingLeave.id, "Approved")
                }
                className="inline-flex h-10 items-center justify-center px-5 text-xs"
              >
                Approve
              </GlowButton>

            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DELETE CONFIRMATION */}
        <AlertDialog
          open={Boolean(deletingLeave)}
          onOpenChange={(open) =>
            !open && setDeletingLeave(null)
          }
        >
          <AlertDialogContent>

            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete this leave request?
              </AlertDialogTitle>

              <AlertDialogDescription>
                This removes {deletingLeave?.employeeName}&apos;s{" "}
                {deletingLeave?.type} request (
                {deletingLeave?.from} to {deletingLeave?.to})
                from the leave list.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>

              <AlertDialogCancel disabled={isDeleting}>
                Cancel
              </AlertDialogCancel>

              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>

            </AlertDialogFooter>

          </AlertDialogContent>
        </AlertDialog>

      </PageWrapper>
    </div>
  );
};

export default LeaveOperations;
