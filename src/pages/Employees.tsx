import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Download,
  Eye,
  LayoutGrid,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import PageWrapper from "@/components/ui/PageWrapper";
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
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  deleteDepartmentEmployee,
  deleteUserAccess,
  fetchOnboardingEmployees,
  fetchOnboardingEmployeeById,
  updateOnboardingEmployee,
  type OnboardingEmployeeRecord,
} from "@/lib/hrms-api";
import { canManageEmployees } from "@/lib/permissions";
import { exportEmployeesToExcel } from "@/lib/export-employees";
import {
  assignableRoles,
  formatRoleLabel,
  normalizeRole,
  type AssignableRole,
} from "@/lib/roles";
import "./Employees.css";

const ROLE_TYPE_OPTIONS = [
  "FullTime",
  "Internship",
  "Contract",
  "Freelance",
  "PartTime",
];

const normalizeRoleType = (val: string | null | undefined): string => {
  if (!val) return "";
  const cleaned = val.replace(/[-\s]/g, "").toLowerCase();
  const match = ROLE_TYPE_OPTIONS.find(
    (opt) => opt.toLowerCase() === cleaned,
  );
  return match ?? val;
};

const DEFAULT_DEPARTMENTS = [
  "Operations",
  "IT Operations",
  "Web Development",
  "Artificial Intelligence / Machine Learning",
  "Cyber Security",
  "Human Resources",
  "Quality Assurance",
];

const defaultEditForm = {
  employeeId: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  designation: "",
  department: "Operations",
  roleType: "",
  dateOfBirth: "",
};

const initialFilters = {
  employeeId: "",
  firstName: "",
  lastName: "",
  email: "",
  department: "",
  designation: "",
};

const Employees = () => {
  const { user, permissions } = useAuth();
  const [employees, setEmployees] = useState<OnboardingEmployeeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEmployeeGridOpen, setIsEmployeeGridOpen] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Live filter state
  const [filters, setFilters] = useState(initialFilters);

  // Dialog & Action States
  const [viewingEmployee, setViewingEmployee] =
    useState<OnboardingEmployeeRecord | null>(null);
  const [editingEmployee, setEditingEmployee] =
    useState<OnboardingEmployeeRecord | null>(null);
  const [deletingEmployee, setDeletingEmployee] =
    useState<OnboardingEmployeeRecord | null>(null);

  const [isDeleting, setIsDeleting] = useState(false);
  const [editForm, setEditForm] = useState(defaultEditForm);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const canDeleteUsers = user?.role === "admin";
  const canEditUsers = user?.role === "admin" || user?.role === "hr";

  const loadEmployees = useCallback(async () => {
    if (!user || !canManageEmployees(permissions)) {
      setEmployees([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const rows = await fetchOnboardingEmployees();
      setEmployees(rows);
    } catch (error) {
      console.error("Failed to load employees:", error);
      setEmployees([]);
    } finally {
      setIsLoading(false);
    }
  }, [permissions, user]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  const departmentOptions = useMemo(() => {
    const list = new Set(DEFAULT_DEPARTMENTS);
    employees.forEach((emp) => {
      if (emp.department) list.add(emp.department);
    });
    return Array.from(list);
  }, [employees]);

  const handleFilterChange = (
    key: keyof typeof initialFilters,
    value: string,
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearColumn = (key: keyof typeof initialFilters) => {
    setFilters((prev) => ({ ...prev, [key]: "" }));
  };

  const resetAllFilters = () => {
    setFilters(initialFilters);
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const matchesEmpId = (employee.employee_id ?? "")
        .toString()
        .toLowerCase()
        .includes(filters.employeeId.toLowerCase().trim());

      const matchesFirstName = (employee.first_name ?? "")
        .toLowerCase()
        .includes(filters.firstName.toLowerCase().trim());

      const matchesLastName = (employee.last_name ?? "")
        .toLowerCase()
        .includes(filters.lastName.toLowerCase().trim());

      const matchesEmail = (employee.personal_email ?? "")
        .toLowerCase()
        .includes(filters.email.toLowerCase().trim());

      const matchesDept =
        !filters.department ||
        (employee.department ?? "").toLowerCase() ===
          filters.department.toLowerCase();

      const matchesDesignation = (employee.designation ?? "")
        .toLowerCase()
        .includes(filters.designation.toLowerCase().trim());

      return (
        matchesEmpId &&
        matchesFirstName &&
        matchesLastName &&
        matchesEmail &&
        matchesDept &&
        matchesDesignation
      );
    });
  }, [employees, filters]);

  const pagination = usePagination(filteredEmployees);

  const hasActiveFilters = Boolean(
    filters.employeeId ||
    filters.firstName ||
    filters.lastName ||
    filters.email ||
    filters.department ||
    filters.designation,
  );

  const handleExportEmployees = async () => {
    if (filteredEmployees.length === 0 || isExporting) return;

    setIsExporting(true);
    try {
      await exportEmployeesToExcel(
        filteredEmployees,
        hasActiveFilters ? "filtered" : "all",
      );
    } catch (error) {
      console.error("Failed to export employees:", error);
      toast({
        title: "Export failed",
        description:
          error instanceof Error
            ? error.message
            : "Employee details could not be exported.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (!user || !canManageEmployees(permissions)) {
    return (
      <div
        className="dashboard-light-override min-h-screen w-full"
        style={{
          backgroundColor: "#FFFFFF",
          color: "#000000",
          colorScheme: "light",
        }}
      >
        <PageWrapper label="" title="Unauthorized">
          <div className="rounded-2xl border border-[#CBD5E1] bg-white p-8 text-center shadow-sm">
            <p className="font-bold text-black">
              You do not have permission to view the personnel directory.
            </p>
          </div>
        </PageWrapper>
      </div>
    );
  }

  const openEditDialog = async (employee: OnboardingEmployeeRecord) => {
    setEditingEmployee(employee);
    setEditForm({
      employeeId: employee.employee_id ?? "",
      firstName: employee.first_name ?? "",
      lastName: employee.last_name ?? "",
      email: employee.personal_email ?? "",
      phone: employee.phone ?? "",
      designation: employee.designation ?? "",
      department: employee.department ?? "Operations",
      roleType: normalizeRoleType(employee.role_type),
      dateOfBirth: employee.date_of_birth ?? "",
    });

    try {
      const freshData = await fetchOnboardingEmployeeById(employee.id);
      if (freshData) {
        setEditForm({
          employeeId: freshData.employee_id ?? "",
          firstName: freshData.first_name ?? "",
          lastName: freshData.last_name ?? "",
          email: freshData.personal_email ?? "",
          phone: freshData.phone ?? "",
          designation: freshData.designation ?? "",
          department: freshData.department ?? "Operations",
          roleType: normalizeRoleType(freshData.role_type),
          dateOfBirth: freshData.date_of_birth ?? "",
        });
      }
    } catch (err) {
      console.warn("Could not fetch fresh employee details:", err);
    }
  };

  const closeEditDialog = () => {
    setEditingEmployee(null);
    setEditForm(defaultEditForm);
    setIsSavingEdit(false);
  };

  const handleSaveEdit = async () => {
    if (!editingEmployee) return;

    if (
      !editForm.firstName.trim() ||
      !editForm.lastName.trim() ||
      !editForm.email.trim()
    ) {
      toast({
        title: "Required fields missing",
        description: "First name, last name, and email are required.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingEdit(true);

    try {
      const updated = await updateOnboardingEmployee(editingEmployee.id, {
        employee_id: editForm.employeeId.trim() || null,
        first_name: editForm.firstName.trim(),
        last_name: editForm.lastName.trim(),
        personal_email: editForm.email.trim().toLowerCase(),
        phone: editForm.phone.trim() || null,
        department: editForm.department.trim() || null,
        designation: editForm.designation.trim() || null,
        role_type: editForm.roleType.trim() || null,
        date_of_birth: editForm.dateOfBirth.trim() || null,
      });

      await loadEmployees();
      closeEditDialog();

      toast({
        title: "Employee updated",
        description: `${updated.first_name} ${updated.last_name}'s details have been saved.`,
      });
    } catch (error) {
      console.error("Failed to update employee:", error);
      toast({
        title: "Update failed",
        description:
          error instanceof Error
            ? error.message
            : "The employee could not be updated.",
        variant: "destructive",
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingEmployee) return;

    setIsDeleting(true);

    try {
      await deleteDepartmentEmployee(deletingEmployee.id);
      if (deletingEmployee.personal_email) {
        try {
          await deleteUserAccess({
            accessGrantId: null,
            email: deletingEmployee.personal_email,
            authUserId: null,
          });
        } catch {
          // Ignore if no portal auth account
        }
      }

      await loadEmployees();

      toast({
        title: "Employee deleted",
        description: `${deletingEmployee.first_name} ${deletingEmployee.last_name} has been removed.`,
      });
      setDeletingEmployee(null);
    } catch (error) {
      console.error("Failed to delete employee:", error);
      toast({
        title: "Delete failed",
        description:
          error instanceof Error
            ? error.message
            : "The employee could not be deleted.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="dashboard-light-override min-h-screen w-full pb-16"
      style={{
        backgroundColor: "#FFFFFF",
        color: "#000000",
        colorScheme: "light",
      }}
    >
      

      <PageWrapper     
          label=""
  title="Employees"
  action={
    <button
      type="button"
      onClick={() => (window.location.href = "/employees/new")}
      className="add-employee-btn"
    >
      <Plus className="add-employee-icon" />
      <span>Add Employee</span>
    </button>
  }

      >
        <div className="space-y-6">
          {/* Main Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-[#CBD5E1] bg-white p-5 shadow-sm"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-black">Employee Directory</h2>
              <div className="flex items-center gap-2">
                {isEmployeeGridOpen && (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleExportEmployees()}
                      disabled={isLoading || isExporting || filteredEmployees.length === 0}
                      title="Export filtered employees"
                      aria-label="Export filtered employees"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEmployeeGridOpen(false)}
                      title="Close employee grid"
                      aria-label="Close employee grid"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-black"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                )}
                {!isEmployeeGridOpen && (
                  <button
                    type="button"
                    onClick={() => setIsEmployeeGridOpen(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#FF8A00] bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#FFF5ED]"
                  >
                    <LayoutGrid className="h-4 w-4" />
                    Show employee grid
                  </button>
                )}
              </div>
            </div>
            {isEmployeeGridOpen && (isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FF4500] border-t-transparent" />
              </div>
            ) : (
              <div className="table-container w-full overflow-x-auto">
                <table className="w-full table-fixed text-left text-sm">
                  <thead>
                    <tr
                      className="text-xs uppercase tracking-wider"
                      style={{
                        backgroundColor: "#d9d7d7",
                        fontFamily: "Arial, Helvetica, sans-serif",
                      }}
                    >
                      <th className="py-3 px-3 w-[90px] font-normal text-black">
                        ACTION
                      </th>
                      <th className="py-3 px-3 w-[11%] font-normal text-black">
                        Empolyee ID
                      </th>
                      <th className="py-3 px-3 w-[13%] font-normal text-black">
                        First Name
                      </th>
                      <th className="py-3 px-3 w-[13%] font-normal text-black">
                        Last Name
                      </th>
                      <th className="py-3 px-3 w-[22%] font-normal text-black">
                        Email
                      </th>
                      <th className="py-3 px-3 w-[17%] font-normal text-black">
                        Department
                      </th>
                      <th className="py-3 px-3 w-[18%] font-normal text-black">
                        Designation
                      </th>
                    </tr>

                    {/* Filter Inputs Row */}
                    <tr className="bg-[#F8FAFD]">
                      <th className="py-2.5 px-3">
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={resetAllFilters}
                            title="Reset all filters"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#FF4500] hover:underline transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reset</span>
                          </button>
                        )}
                      </th>

                      {/* Employee ID Search */}
                      <th className="py-2.5 px-3">
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            value={filters.employeeId}
                            onChange={(e) =>
                              handleFilterChange("employeeId", e.target.value)
                            }
                            placeholder="ID..."
                            className="w-full rounded-lg border border-[#CBD5E1] bg-white pl-2.5 pr-6 py-1 text-xs text-black placeholder:text-[#94A3B8] focus:border-[#FF4500] focus:outline-none"
                          />
                          {filters.employeeId ? (
                            <button
                              type="button"
                              onClick={() => handleClearColumn("employeeId")}
                              className="absolute right-1.5 p-0.5 text-black hover:text-[#FF4500]"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          ) : (
                            <Search className="absolute right-2 w-3 h-3 text-[#94A3B8] pointer-events-none" />
                          )}
                        </div>
                      </th>

                      {/* First Name Search */}
                      <th className="py-2.5 px-3">
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            value={filters.firstName}
                            onChange={(e) =>
                              handleFilterChange("firstName", e.target.value)
                            }
                            placeholder="First..."
                            className="w-full rounded-lg border border-[#CBD5E1] bg-white pl-2.5 pr-6 py-1 text-xs text-black placeholder:text-[#94A3B8] focus:border-[#FF4500] focus:outline-none"
                          />
                          {filters.firstName ? (
                            <button
                              type="button"
                              onClick={() => handleClearColumn("firstName")}
                              className="absolute right-1.5 p-0.5 text-black hover:text-[#FF4500]"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          ) : (
                            <Search className="absolute right-2 w-3 h-3 text-[#94A3B8] pointer-events-none" />
                          )}
                        </div>
                      </th>

                      {/* Last Name Search */}
                      <th className="py-2.5 px-3">
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            value={filters.lastName}
                            onChange={(e) =>
                              handleFilterChange("lastName", e.target.value)
                            }
                            placeholder="Last..."
                            className="w-full rounded-lg border border-[#CBD5E1] bg-white pl-2.5 pr-6 py-1 text-xs text-black placeholder:text-[#94A3B8] focus:border-[#FF4500] focus:outline-none"
                          />
                          {filters.lastName ? (
                            <button
                              type="button"
                              onClick={() => handleClearColumn("lastName")}
                              className="absolute right-1.5 p-0.5 text-black hover:text-[#FF4500]"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          ) : (
                            <Search className="absolute right-2 w-3 h-3 text-[#94A3B8] pointer-events-none" />
                          )}
                        </div>
                      </th>

                      {/* Email Search */}
                      <th className="py-2.5 px-3">
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            value={filters.email}
                            onChange={(e) =>
                              handleFilterChange("email", e.target.value)
                            }
                            placeholder="Email..."
                            className="w-full rounded-lg border border-[#CBD5E1] bg-white pl-2.5 pr-6 py-1 text-xs text-black placeholder:text-[#94A3B8] focus:border-[#FF4500] focus:outline-none"
                          />
                          {filters.email ? (
                            <button
                              type="button"
                              onClick={() => handleClearColumn("email")}
                              className="absolute right-1.5 p-0.5 text-black hover:text-[#FF4500]"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          ) : (
                            <Search className="absolute right-2 w-3 h-3 text-[#94A3B8] pointer-events-none" />
                          )}
                        </div>
                      </th>

                      {/* Department Select */}
                      <th className="py-2.5 px-3">
                        <div className="relative flex items-center">
                          <select
                            value={filters.department}
                            onChange={(e) =>
                              handleFilterChange("department", e.target.value)
                            }
                            className="w-full rounded-lg border border-[#CBD5E1] bg-white px-2 py-1 text-xs text-black focus:border-[#FF4500] focus:outline-none truncate"
                          >
                            <option value="">All Depts</option>
                            {departmentOptions.map((dept) => (
                              <option key={dept} value={dept}>
                                {dept}
                              </option>
                            ))}
                          </select>
                          {filters.department && (
                            <button
                              type="button"
                              onClick={() => handleClearColumn("department")}
                              className="absolute right-6 p-0.5 text-black hover:text-[#FF4500]"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </th>

                      {/* Designation Search */}
                      <th className="py-2.5 px-3">
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            value={filters.designation}
                            onChange={(e) =>
                              handleFilterChange("designation", e.target.value)
                            }
                            placeholder="Designation..."
                            className="w-full rounded-lg border border-[#CBD5E1] bg-white pl-2.5 pr-6 py-1 text-xs text-black placeholder:text-[#94A3B8] focus:border-[#FF4500] focus:outline-none"
                          />
                          {filters.designation ? (
                            <button
                              type="button"
                              onClick={() => handleClearColumn("designation")}
                              className="absolute right-1.5 p-0.5 text-black hover:text-[#FF4500]"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          ) : (
                            <Search className="absolute right-2 w-3 h-3 text-[#94A3B8] pointer-events-none" />
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {pagination.pageItems.map((employee, index) => {
                      const isCurrentAdmin =
                        Boolean(user?.email) &&
                        employee.personal_email?.toLowerCase() ===
                          user.email.toLowerCase();

                      return (
                        <motion.tr
                          key={employee.id}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className="hover:bg-[#F8FAFC]"
                        >
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                title="View Employee"
                                onClick={() => setViewingEmployee(employee)}
                                className="p-1 rounded-lg text-[#FF8A00] hover:bg-[#FFF5ED] transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {canEditUsers && (
                                <button
                                  type="button"
                                  title="Edit Employee"
                                  onClick={() => openEditDialog(employee)}
                                  className="p-1 rounded-lg text-[#3B82F6] hover:bg-blue-50 transition-colors"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                              )}

                              {canDeleteUsers && (
                                <button
                                  type="button"
                                  title={
                                    isCurrentAdmin
                                      ? "Cannot delete active session"
                                      : "Delete Employee"
                                  }
                                  onClick={() => setDeletingEmployee(employee)}
                                  disabled={isCurrentAdmin}
                                  className="p-1 rounded-lg text-[#EF4444] hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>

                          <td
                            className="py-3 px-3 text-xs font-normal text-black text-center truncate"
                            title={employee.employee_id ?? "—"}
                          >
                            {employee.employee_id ?? "—"}
                          </td>
                          <td
                            className="py-3 px-3 font-normal text-black truncate"
                            title={employee.first_name}
                          >
                            {employee.first_name}
                          </td>
                          <td
                            className="py-3 px-3 font-normal text-black truncate"
                            title={employee.last_name}
                          >
                            {employee.last_name}
                          </td>
                          <td
                            className="py-3 px-3 text-xs font-normal text-black truncate"
                            title={employee.personal_email ?? "—"}
                          >
                            {employee.personal_email ?? "—"}
                          </td>
                          <td
                            className="py-3 px-3 text-xs font-normal text-black truncate"
                            title={employee.department ?? "Unassigned"}
                          >
                            {employee.department ?? "Unassigned"}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className="designation-text"
                              title={employee.designation ?? "Employee"}
                            >
                              {employee.designation ?? "Employee"}
                            </span>
                          </td>
                        </motion.tr>
                      );
                    })}

                    {!filteredEmployees.length && (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-14 text-center text-sm font-normal text-slate-500"
                        >
                          No matching employee records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))}

            {/* Pagination Controls */}
            {isEmployeeGridOpen && filteredEmployees.length > 0 && (
              <div className="pt-4 mt-3 w-full">
                <PaginationControls
                  currentPage={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  pageSize={pagination.pageSize}
                  pageStart={pagination.pageStart}
                  pageEnd={pagination.pageEnd}
                  totalItems={filteredEmployees.length}
                  onPageSizeChange={pagination.setPageSize}
                  onPreviousPage={pagination.goToPreviousPage}
                  onNextPage={pagination.goToNextPage}
                />
              </div>
            )}
          </motion.div>
        </div>

        {/* Delete Modal Dialog */}
        <Dialog
          open={Boolean(deletingEmployee)}
          onOpenChange={(open) =>
            !open && !isDeleting ? setDeletingEmployee(null) : undefined
          }
        >
          <DialogContent className="max-w-[420px] rounded-2xl border border-[#CBD5E1] bg-white p-6 text-black shadow-lg">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-base font-bold text-black">
                Delete User
              </DialogTitle>
              <DialogDescription className="text-xs leading-relaxed text-black">
                Are you sure you want to delete{" "}
                <span className="text-[#EF4444] font-bold">
                  {deletingEmployee?.first_name ?? "this employee"}
                </span>
                ? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingEmployee(null)}
                disabled={isDeleting}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-black hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                disabled={isDeleting}
                className="rounded-xl bg-[#EF4444] px-4 py-2 text-xs font-bold text-white shadow-sm hover:brightness-110 transition-all disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Modal Dialog */}
        <Dialog
          open={Boolean(viewingEmployee)}
          onOpenChange={(open) =>
            !open ? setViewingEmployee(null) : undefined
          }
        >
          <DialogContent className="max-w-md rounded-2xl border border-[#CBD5E1] bg-white p-6 text-black shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-black">
                Employee Profile
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Overview of personnel profile details and permissions.
              </DialogDescription>
            </DialogHeader>

            {viewingEmployee && (
              <div className="space-y-3 py-3 text-xs text-black">
                <div className="flex justify-between border-b border-[#E2E8F0] pb-2">
                  <span className="font-semibold text-slate-500">Name:</span>
                  <span className="font-medium text-slate-900">
                    {viewingEmployee.first_name} {viewingEmployee.last_name}
                  </span>
                </div>
                <div className="flex justify-between border-b border-[#E2E8F0] pb-2">
                  <span className="font-semibold text-slate-500">Email:</span>
                  <span className="font-medium text-slate-900">
                    {viewingEmployee.personal_email ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-[#E2E8F0] pb-2">
                  <span className="font-semibold text-slate-500">Mobile Number:</span>
                  <span className="font-mono text-slate-900">
                    {viewingEmployee.phone ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-[#E2E8F0] pb-2">
                  <span className="font-semibold text-slate-500">Role Type:</span>
                  <span className="font-medium text-slate-900">
                    {viewingEmployee.role_type ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-[#E2E8F0] pb-2">
                  <span className="font-semibold text-slate-500">Date of Birth:</span>
                  <span className="font-medium text-slate-900">
                    {viewingEmployee.date_of_birth ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-[#E2E8F0] pb-2">
                  <span className="font-semibold text-slate-500">
                    Department:
                  </span>
                  <span className="font-medium text-slate-900">
                    {viewingEmployee.department ?? "Unassigned"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-[#E2E8F0] pb-2">
                  <span className="font-semibold text-slate-500">Role:</span>
                 
                    {viewingEmployee.designation ?? "—"}
                  
                </div>
              </div>
            )}

            <DialogFooter>
              <button
                type="button"
                onClick={() => setViewingEmployee(null)}
                className="w-full rounded-xl border border-slate-300 bg-white py-2 text-xs font-bold text-black hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Modal Dialog */}
        <Dialog
          open={Boolean(editingEmployee)}
          onOpenChange={(open) => (!open ? closeEditDialog() : undefined)}
        >
          <DialogContent className="max-w-xl rounded-2xl border border-[#CBD5E1] bg-white p-6 text-black shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-black">
                Edit Employee
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Update employee details, role type, designation, and department.
              </DialogDescription>
            </DialogHeader>

            <form
              className="space-y-4 pt-2"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSaveEdit();
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-black uppercase tracking-wider">
                    Employee ID
                  </label>
                  <input
                    value={editForm.employeeId}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        employeeId: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs text-black focus:border-[#3B82F6] focus:outline-none"
                    placeholder="e.g. PSIE004"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-black uppercase tracking-wider">
                    Work Email
                  </label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs text-black focus:border-[#3B82F6] focus:outline-none"
                    placeholder="name@company.com"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-black uppercase tracking-wider">
                    First Name
                  </label>
                  <input
                    value={editForm.firstName}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        firstName: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs text-black focus:border-[#3B82F6] focus:outline-none"
                    placeholder="First name"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-black uppercase tracking-wider">
                    Last Name
                  </label>
                  <input
                    value={editForm.lastName}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        lastName: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs text-black focus:border-[#3B82F6] focus:outline-none"
                    placeholder="Last name"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-black uppercase tracking-wider">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs text-black focus:border-[#3B82F6] focus:outline-none"
                    placeholder="e.g. 9876543210"
                    maxLength={15}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-black uppercase tracking-wider">
                    Role Type
                  </label>
                  <select
                    value={editForm.roleType}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        roleType: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs text-black focus:border-[#3B82F6] focus:outline-none"
                  >
                    <option value="">Select Role Type</option>
                    {ROLE_TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-black uppercase tracking-wider">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={editForm.dateOfBirth}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        dateOfBirth: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs text-black focus:border-[#3B82F6] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-black uppercase tracking-wider">
                    Department
                  </label>
                  <select
                    value={editForm.department}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        department: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs text-black focus:border-[#3B82F6] focus:outline-none"
                  >
                    {departmentOptions.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[11px] font-bold text-black uppercase tracking-wider">
                    Designation
                  </label>
                  <input
                    value={editForm.designation}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        designation: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs text-black focus:border-[#3B82F6] focus:outline-none"
                    placeholder="Job title / designation"
                  />
                </div>
              </div>

              <DialogFooter className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={closeEditDialog}
                  disabled={isSavingEdit}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-black hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="rounded-xl bg-[#3B82F6] px-5 py-2 text-xs font-bold text-white shadow-sm hover:brightness-110 disabled:opacity-50"
                >
                  {isSavingEdit ? "Saving..." : "Save Changes"}
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageWrapper>
    </div>
  );
};

export default Employees;
