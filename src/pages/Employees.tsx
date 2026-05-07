import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import GlowButton from "@/components/ui/GlowButton";
import PageWrapper from "@/components/ui/PageWrapper";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  deleteUserAccess,
  fetchAssignableManagers,
  fetchVisibleEmployees,
  updateUserAccess,
  type ManagerOption,
  type ProfileRecord,
} from "@/lib/hrms-api";
import { canManageEmployees } from "@/lib/permissions";
import { assignableRoles, formatRoleLabel, normalizeRole, type AssignableRole } from "@/lib/roles";

const defaultEditForm = {
  name: "",
  email: "",
  role: "employee" as AssignableRole,
  department: "Operations",
  reportingManagerId: "",
};

const Employees = () => {
  const { user, permissions } = useAuth();
  const [employees, setEmployees] = useState<ProfileRecord[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<ProfileRecord | null>(null);
  const [editForm, setEditForm] = useState(defaultEditForm);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const canDeleteUsers = user?.role === "admin";
  const canEditUsers = user?.role === "admin";

  useEffect(() => {
    const loadEmployees = async () => {
      if (!user || !canManageEmployees(permissions)) {
        setEmployees([]);
        setManagers([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const [rows, managerRows] = await Promise.all([
          fetchVisibleEmployees(user, permissions),
          user.role === "admin" ? fetchAssignableManagers() : Promise.resolve([]),
        ]);
        setEmployees(rows);
        setManagers(managerRows);
      } catch (error) {
        console.error("Failed to load employees:", error);
        setEmployees([]);
        setManagers([]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadEmployees();
  }, [permissions, user]);

  if (!user || !canManageEmployees(permissions)) {
    return (
      <PageWrapper label="ACCESS_DENIED" title="Unauthorized">
        <div className="glass-card p-8 text-center">
          <p className="text-muted-foreground">You do not have permission to view the personnel directory.</p>
        </div>
      </PageWrapper>
    );
  }

  const loadEmployees = async () => {
    setIsLoading(true);

    try {
      const [rows, managerRows] = await Promise.all([
        fetchVisibleEmployees(user, permissions),
        user?.role === "admin" ? fetchAssignableManagers() : Promise.resolve([]),
      ]);
      setEmployees(rows);
      setManagers(managerRows);
    } catch (error) {
      console.error("Failed to load employees:", error);
      setEmployees([]);
      setManagers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const openEditDialog = (employee: ProfileRecord) => {
    const normalizedRole = normalizeRole(employee.role);

    if (!normalizedRole || normalizedRole === "admin") {
      return;
    }

    setEditingEmployee(employee);
    setEditForm({
      name: employee.name,
      email: employee.email,
      role: normalizedRole,
      department: employee.department ?? "Operations",
      reportingManagerId: employee.reporting_manager_id ?? "",
    });
  };

  const closeEditDialog = () => {
    setEditingEmployee(null);
    setEditForm(defaultEditForm);
    setIsSavingEdit(false);
  };

  const handleSaveEdit = async () => {
    if (!editingEmployee) {
      return;
    }

    setIsSavingEdit(true);

    try {
      const response = await updateUserAccess({
        userId: editingEmployee.id,
        currentEmail: editingEmployee.email,
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
        department: editForm.department,
        reportingManagerId: editForm.role === "employee" ? editForm.reportingManagerId || null : null,
      });

      await loadEmployees();
      closeEditDialog();

      toast({
        title: "User updated",
        description: response?.message ?? `${editingEmployee.name}'s details have been updated.`,
      });
    } catch (error) {
      console.error("Failed to update employee:", error);
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "The user could not be updated.",
        variant: "destructive",
      });
      setIsSavingEdit(false);
    }
  };

  const currentReportingManagerName = useMemo(
    () => managers.find((manager) => manager.id === editForm.reportingManagerId)?.name ?? null,
    [editForm.reportingManagerId, managers],
  );

  const handleDeleteEmployee = async (employee: ProfileRecord) => {
    const confirmed = window.confirm(
      `Delete ${employee.name} from the portal?\n\nThis will remove the user's portal access, auth account, and related portal records.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingEmployeeId(employee.id);

    try {
      const response = await deleteUserAccess({
        accessGrantId: null,
        email: employee.email,
        authUserId: employee.id,
      });

      await loadEmployees();

      toast({
        title: "User deleted",
        description: response?.message ?? `${employee.name} has been removed from the portal.`,
      });
    } catch (error) {
      console.error("Failed to delete employee:", error);
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "The user could not be deleted.",
        variant: "destructive",
      });
    } finally {
      setDeletingEmployeeId(null);
    }
  };

  return (
    <PageWrapper label="PERSONNEL_DIRECTORY" title="Team Overview">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-3 px-4 text-muted-foreground font-heading text-xs tracking-wider">NAME</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-heading text-xs tracking-wider">EMAIL</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-heading text-xs tracking-wider">DEPARTMENT</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-heading text-xs tracking-wider">REPORTING_MANAGER</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-heading text-xs tracking-wider">ROLE</th>
                  {canDeleteUsers && (
                    <th className="text-left py-3 px-4 text-muted-foreground font-heading text-xs tracking-wider">ACTION</th>
                  )}
                  {canEditUsers && (
                    <th className="text-left py-3 px-4 text-muted-foreground font-heading text-xs tracking-wider">EDIT</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {employees.map((employee, index) => {
                  const normalizedRole = normalizeRole(employee.role);

                  return (
                    <motion.tr
                      key={employee.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b border-border/30 hover:bg-accent/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center">
                            <span className="text-xs font-heading font-semibold text-primary">{employee.name[0]}</span>
                          </div>
                          <span className="text-foreground/90">{employee.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-foreground/70">{employee.email}</td>
                      <td className="py-3 px-4 text-foreground/70">{employee.department ?? "Unassigned"}</td>
                      <td className="py-3 px-4 text-foreground/70">{employee.reporting_manager_name ?? "Not assigned"}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs px-2 py-1 rounded-full border ${
                            normalizedRole === "admin"
                              ? "text-primary bg-primary/10 border-primary/30"
                              : normalizedRole === "manager"
                                ? "text-secondary bg-secondary/10 border-secondary/30"
                                : "text-muted-foreground bg-muted/50 border-border/50"
                          }`}
                        >
                          {normalizedRole ? formatRoleLabel(normalizedRole) : employee.role}
                        </span>
                      </td>
                      {canDeleteUsers && (
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => void handleDeleteEmployee(employee)}
                            disabled={deletingEmployeeId === employee.id || employee.id === user.id}
                            className="inline-flex h-9 min-w-[8.75rem] items-center justify-center rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-[11px] font-heading uppercase tracking-[0.16em] text-destructive transition-colors hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingEmployeeId === employee.id
                              ? "Deleting..."
                              : employee.id === user.id
                                ? "Current Admin"
                                : "Delete User"}
                          </button>
                        </td>
                      )}
                      {canEditUsers && (
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => openEditDialog(employee)}
                            disabled={normalizedRole === "admin"}
                            className="inline-flex h-9 min-w-[8.75rem] items-center justify-center rounded-lg border border-secondary/40 bg-secondary/10 px-4 py-2 text-[11px] font-heading uppercase tracking-[0.16em] text-secondary transition-colors hover:bg-secondary/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {normalizedRole === "admin" ? "Protected" : "Edit User"}
                          </button>
                        </td>
                      )}
                    </motion.tr>
                  );
                })}
                {!employees.length && (
                  <tr>
                    <td colSpan={canDeleteUsers ? (canEditUsers ? 7 : 6) : canEditUsers ? 6 : 5} className="py-12 text-center text-muted-foreground">
                      No employee records are visible for your current access scope.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <Dialog open={Boolean(editingEmployee)} onOpenChange={(open) => (!open ? closeEditDialog() : undefined)}>
        <DialogContent className="max-w-2xl border-border bg-card text-foreground">
          <DialogHeader>
            <DialogTitle className="font-heading tracking-wide">Edit User</DialogTitle>
            <DialogDescription>
              Update the selected employee, manager, or HR profile details. Admin accounts remain protected.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-heading tracking-wider">FULL_NAME</label>
              <input
                value={editForm.name}
                onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                className="w-full bg-muted border border-border rounded-lg px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                placeholder="Full name"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-heading tracking-wider">WORK_EMAIL</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))}
                className="w-full bg-muted border border-border rounded-lg px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                placeholder="name@company.com"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-heading tracking-wider">ROLE</label>
              <select
                value={editForm.role}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    role: event.target.value as AssignableRole,
                    reportingManagerId: event.target.value === "employee" ? current.reportingManagerId : "",
                  }))
                }
                className="w-full bg-muted border border-border rounded-lg px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
              >
                {assignableRoles.map((role) => (
                  <option key={role} value={role}>
                    {formatRoleLabel(role)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-heading tracking-wider">DEPARTMENT</label>
              <input
                value={editForm.department}
                onChange={(event) => setEditForm((current) => ({ ...current, department: event.target.value }))}
                className="w-full bg-muted border border-border rounded-lg px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                placeholder="Department"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-heading tracking-wider">REPORTING_MANAGER</label>
            <select
              value={editForm.role === "employee" ? editForm.reportingManagerId : ""}
              onChange={(event) => setEditForm((current) => ({ ...current, reportingManagerId: event.target.value }))}
              disabled={editForm.role !== "employee"}
              className="w-full bg-muted border border-border rounded-lg px-4 py-3 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
            >
              <option value="">No manager assigned yet</option>
              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {editForm.role === "employee"
                ? `Selected manager: ${currentReportingManagerName ?? "Not assigned"}`
                : "Reporting manager is currently applied only to employee records."}
            </p>
          </div>

          <DialogFooter>
            <GlowButton variant="ghost" onClick={closeEditDialog} disabled={isSavingEdit}>
              Cancel
            </GlowButton>
            <GlowButton onClick={handleSaveEdit} disabled={isSavingEdit}>
              {isSavingEdit ? "Saving..." : "Save Changes"}
            </GlowButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
};

export default Employees;
