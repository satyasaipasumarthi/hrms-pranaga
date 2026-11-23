import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import PageWrapper from "@/components/ui/PageWrapper";
import PaginationControls, {
  usePagination,
} from "@/components/ui/PaginationControls";
import { toast } from "@/hooks/use-toast";
import {
  createDepartment,
  fetchDepartments,
  getReadableErrorMessage,
} from "@/lib/hrms-api";
import { exportTeamMembersToExcel } from "@/lib/export-team-members";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Eye, Pencil, Trash2, Plus, Search, X } from "lucide-react";
import {
  deleteDepartmentEmployee,
  fetchEmployeesByDepartment,
  updateDepartmentEmployee,
  type DepartmentEmployee,
} from "@/lib/hrms-api";
import "./Team.css";

const Team = () => {
  const [successMessage, setSuccessMessage] = useState("");

  const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [departmentOptionsError, setDepartmentOptionsError] = useState("");

  const [departmentName, setDepartmentName] = useState("");
  const [generatedDepartmentId, setGeneratedDepartmentId] = useState("");
  const [createdDepartmentId, setCreatedDepartmentId] = useState("");
  const [showAddDepartmentForm, setShowAddDepartmentForm] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [isSavingDepartment, setIsSavingDepartment] = useState(false);
  const [departmentFormError, setDepartmentFormError] = useState("");

  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [departmentEmployees, setDepartmentEmployees] = useState<
    DepartmentEmployee[]
  >([]);
  const [viewingDepartmentEmployee, setViewingDepartmentEmployee] =
    useState<DepartmentEmployee | null>(null);
  const [editingDepartmentEmployee, setEditingDepartmentEmployee] =
    useState<DepartmentEmployee | null>(null);
  const [departmentEmployeeToDelete, setDepartmentEmployeeToDelete] =
    useState<DepartmentEmployee | null>(null);
  const [loadingDepartmentEmployees, setLoadingDepartmentEmployees] =
    useState(false);
  const [departmentError, setDepartmentError] = useState("");

  // Table search & filter states
  const [idFilter, setIdFilter] = useState("");
  const [firstNameFilter, setFirstNameFilter] = useState("");
  const [lastNameFilter, setLastNameFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [deptTableFilter, setDeptTableFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");

  const filteredEmployees = useMemo(() => {
    return departmentEmployees.filter((emp) => {
      const matchesId = (emp.employee_id ?? "")
        .toLowerCase()
        .includes(idFilter.toLowerCase().trim());
      const matchesFirst = (emp.first_name ?? "")
        .toLowerCase()
        .includes(firstNameFilter.toLowerCase().trim());
      const matchesLast = (emp.last_name ?? "")
        .toLowerCase()
        .includes(lastNameFilter.toLowerCase().trim());
      const matchesEmail = (emp.personal_email ?? "")
        .toLowerCase()
        .includes(emailFilter.toLowerCase().trim());
      const matchesDept =
        !deptTableFilter ||
        (emp.department ?? "").toLowerCase() === deptTableFilter.toLowerCase();
      const matchesDesig = (emp.designation ?? "")
        .toLowerCase()
        .includes(designationFilter.toLowerCase().trim());

      return (
        matchesId &&
        matchesFirst &&
        matchesLast &&
        matchesEmail &&
        matchesDept &&
        matchesDesig
      );
    });
  }, [
    departmentEmployees,
    idFilter,
    firstNameFilter,
    lastNameFilter,
    emailFilter,
    deptTableFilter,
    designationFilter,
  ]);

  const pagination = usePagination(filteredEmployees);

  const handleDepartmentChange = async (dept: string) => {
    setSelectedDepartment(dept);
    setDepartmentEmployees([]);
    setDepartmentError("");

    if (!dept) return;

    setLoadingDepartmentEmployees(true);

    try {
      const employees = await fetchEmployeesByDepartment(dept);
      setDepartmentEmployees(employees);
    } catch (error) {
      console.error(error);
      setDepartmentError(
        "Unable to fetch employees. Please check your permissions and try again.",
      );
    } finally {
      setLoadingDepartmentEmployees(false);
    }
  };

  const handleClearDepartment = () => {
    setSelectedDepartment("");
    setDepartmentEmployees([]);
    setDepartmentError("");
  };

  const handleUpdateDepartmentEmployee = async () => {
    if (!editingDepartmentEmployee) return;

    try {
      const updatedEmployee = await updateDepartmentEmployee(
        editingDepartmentEmployee.id,
        {
          first_name: editingDepartmentEmployee.first_name.trim(),
          last_name: editingDepartmentEmployee.last_name.trim(),
          designation: editingDepartmentEmployee.designation?.trim() || null,
          personal_email:
            editingDepartmentEmployee.personal_email?.trim() || null,
          department: editingDepartmentEmployee.department?.trim() || null,
        },
      );

      setDepartmentEmployees((employees) =>
        updatedEmployee.department === selectedDepartment
          ? employees.map((employee) =>
              employee.id === updatedEmployee.id ? updatedEmployee : employee,
            )
          : employees.filter((employee) => employee.id !== updatedEmployee.id),
      );
      setEditingDepartmentEmployee(null);
      toast({
        title: "Employee updated",
        description: "Onboarding employee details were updated successfully.",
      });
    } catch (error) {
      console.error("Failed to update onboarding employee:", error);
      toast({
        title: "Update failed",
        description: getReadableErrorMessage(
          error,
          "The employee details could not be updated.",
        ),
        variant: "destructive",
      });
    }
  };

  const handleDeleteDepartmentEmployee = async () => {
    if (!departmentEmployeeToDelete) return;

    try {
      await deleteDepartmentEmployee(departmentEmployeeToDelete.id);
      setDepartmentEmployees((employees) =>
        employees.filter(
          (employee) => employee.id !== departmentEmployeeToDelete.id,
        ),
      );
      toast({
        title: "Employee deleted",
        description: "The onboarding employee record was deleted.",
      });
      setDepartmentEmployeeToDelete(null);
    } catch (error) {
      console.error("Failed to delete onboarding employee:", error);
      toast({
        title: "Delete failed",
        description: getReadableErrorMessage(
          error,
          "The employee onboarding record could not be deleted.",
        ),
        variant: "destructive",
      });
    }
  };

  const handleExportTeamMembers = async () => {
    if (!selectedDepartment || departmentEmployees.length === 0) return;

    try {
      await exportTeamMembersToExcel(
        selectedDepartment,
        departmentEmployees,
      );
    } catch (error) {
      console.error("Failed to export team members:", error);
      toast({
        title: "Export failed",
        description: getReadableErrorMessage(
          error,
          "The team members could not be exported.",
        ),
        variant: "destructive",
      });
    }
  };

  const handleCreateDepartment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = departmentName.trim();
    if (!name) {
      setDepartmentFormError("Please enter a department name.");
      return;
    }
    if (departmentOptions.some((department) => department.toLowerCase() === name.toLowerCase())) {
      setDepartmentFormError("This department already exists.");
      return;
    }

    try {
      setIsSavingDepartment(true);
      setDepartmentFormError("");
      const created = await createDepartment(name);
      setDepartmentOptions((departments) =>
        [...departments, created.department_name].sort((a, b) => a.localeCompare(b)),
      );
      setDepartmentOptionsError("");
      setLoadingDepartments(false);
      setCreatedDepartmentId(created.id);
      setGeneratedDepartmentId(created.id);
      setDepartmentName("");
      setShowAddDepartmentForm(false);
      setSuccessMessage("Department created successfully");
      setShowSuccessPopup(true);
    } catch (error) {
      console.error("Failed to create department:", error);
      toast({
        title: "Department creation failed",
        description: getReadableErrorMessage(
          error,
          "The department could not be created.",
        ),
        variant: "destructive",
      });
    } finally {
      setIsSavingDepartment(false);
    }
  };

  const handleCancelAddDepartment = () => {
    setDepartmentName("");
    setGeneratedDepartmentId("");
    setDepartmentFormError("");
    setShowAddDepartmentForm(false);
  };

  useEffect(() => {
    document.title = "Teams";

    let cancelled = false;
    fetchDepartments()
      .then((departments) => {
        if (!cancelled) setDepartmentOptions(departments);
      })
      .catch((error) => {
        console.error("Failed to load departments:", error);
        if (!cancelled) {
          setDepartmentOptionsError(
            getReadableErrorMessage(error, "Departments could not be loaded."),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDepartments(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
        title="Teams"
        action={
          <button
            type="button"
            onClick={() => {
              setDepartmentName("");
              setGeneratedDepartmentId("");
              setDepartmentFormError("");
              setShowAddDepartmentForm(true);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#ff9100] bg-[#ff9100] px-5 font-heading text-xs font-medium tracking-wider uppercase text-white shadow-sm transition-colors hover:bg-[#ff9100]"
          >
            <Plus className="h-4 w-4" />
            <span>Add Department</span>
          </button>
        }
      >
        <div className="space-y-6">
          {/* DEPARTMENT GRID */}
          <div className="space-y-3">
            <div>
              <h2 className="text-base font-bold uppercase tracking-wider text-black">
                Departments
              </h2>
             
            </div>
            {loadingDepartments ? (
              <p className="text-sm text-slate-500">Loading departments...</p>
            ) : departmentOptionsError ? (
              <p className="text-sm text-red-600">{departmentOptionsError}</p>
            ) : departmentOptions.length === 0 ? (
              <p className="text-sm text-slate-500">No departments are configured.</p>
            ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {departmentOptions.map((dept) => {
                const isSelected = selectedDepartment === dept;

                return (
                  <button
                    key={dept}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => void handleDepartmentChange(dept)}
                    className={`min-h-16 rounded-xl border px-4 py-3 text-left text-sm font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2 ${
                      isSelected
                        ? "border-[#93C5FD] bg-[#DBEAFE] text-[#3B82F6]"
                        : "border-slate-200 bg-white text-slate-700 hover:border-[#3B82F6] hover:bg-[#EFF6FF]"
                    }`}
                  >
                    {dept}
                  </button>
                );
              })}
            </div>
            )}
          </div>

          {/* ADD DEPARTMENT FORM */}
          {showAddDepartmentForm && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h2 className="text-base font-bold text-black">Add Department</h2>
                <button
                  type="button"
                  onClick={handleCancelAddDepartment}
                  className="text-slate-400 hover:text-black"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateDepartment} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-black uppercase tracking-wider">
                      Department ID
                    </label>
                    <input
                      type="text"
                      value={generatedDepartmentId}
                      placeholder="Generated automatically after saving"
                      readOnly
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs text-slate-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-black uppercase tracking-wider">
                      Department Name
                    </label>
                    <input
                      type="text"
                      value={departmentName}
                      onChange={(event) => {
                        setDepartmentName(event.target.value);
                        setDepartmentFormError("");
                      }}
                      placeholder="Enter department name"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-black focus:border-[#FF4500] focus:outline-none"
                    />
                    {departmentFormError && (
                      <p className="text-xs text-[#EF4444]">{departmentFormError}</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCancelAddDepartment}
                    className="rounded-xl border border-[#ff9100] bg-[#ff9100] px-4 py-2 text-xs font-bold text-white hover:bg-[#ff9100]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingDepartment}
                    className="rounded-xl bg-[#ff9100] px-5 py-2 text-xs font-bold text-white hover:brightness-105 disabled:opacity-50"
                  >
                    {isSavingDepartment ? "Saving..." : "Submit Department"}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* MAIN CARD CONTAINER */}
          {selectedDepartment ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="table-container w-full"
            >
              {/* Internal Header Bar: Title on Left, Download & Cross on Right */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white">
                <h3 className="text-base font-bold text-black">Team Members</h3>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleExportTeamMembers()}
                    title="Export team members"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-black"
                  >
                    <Download className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleClearDepartment}
                    title="Close"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-black"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {loadingDepartmentEmployees ? (
                <div className="flex items-center justify-center py-20">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FF4500] border-t-transparent" />
                </div>
              ) : departmentError ? (
                <p className="p-8 text-center text-sm font-semibold text-[#EF4444]">
                  {departmentError}
                </p>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      {/* Grey Heading Header */}
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
                          EMPLOYEE ID
                        </th>
                        <th className="py-3 px-3 w-[13%] font-normal text-black">
                          FIRST NAME
                        </th>
                        <th className="py-3 px-3 w-[13%] font-normal text-black">
                          LAST NAME
                        </th>
                        <th className="py-3 px-3 w-[22%] font-normal text-black">
                          EMAIL
                        </th>
                        <th className="py-3 px-3 w-[17%] font-normal text-black">
                          DEPARTMENT
                        </th>
                        <th className="py-3 px-3 w-[18%] font-normal text-black">
                          DESIGNATION
                        </th>
                      </tr>

                      {/* Filter Row */}
                      <tr className="bg-[#F8FAFD] border-b border-slate-200">
                        <th className="py-2.5 px-3"></th>

                        {/* ID Filter */}
                        <th className="py-2.5 px-3">
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              placeholder="ID..."
                              value={idFilter}
                              onChange={(e) => setIdFilter(e.target.value)}
                              className="w-full rounded-full border border-slate-300 bg-white pl-3 pr-7 py-1 text-xs text-black placeholder:text-slate-400 focus:border-[#FF4500] focus:outline-none"
                            />
                            {idFilter ? (
                              <button
                                type="button"
                                onClick={() => setIdFilter("")}
                                className="absolute right-2 p-0.5 text-slate-400 hover:text-black"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            ) : (
                              <Search className="absolute right-2.5 w-3 h-3 text-slate-400 pointer-events-none" />
                            )}
                          </div>
                        </th>

                        {/* First Name Filter */}
                        <th className="py-2.5 px-3">
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              placeholder="First..."
                              value={firstNameFilter}
                              onChange={(e) =>
                                setFirstNameFilter(e.target.value)
                              }
                              className="w-full rounded-full border border-slate-300 bg-white pl-3 pr-7 py-1 text-xs text-black placeholder:text-slate-400 focus:border-[#FF4500] focus:outline-none"
                            />
                            {firstNameFilter ? (
                              <button
                                type="button"
                                onClick={() => setFirstNameFilter("")}
                                className="absolute right-2 p-0.5 text-slate-400 hover:text-black"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            ) : (
                              <Search className="absolute right-2.5 w-3 h-3 text-slate-400 pointer-events-none" />
                            )}
                          </div>
                        </th>

                        {/* Last Name Filter */}
                        <th className="py-2.5 px-3">
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              placeholder="Last..."
                              value={lastNameFilter}
                              onChange={(e) =>
                                setLastNameFilter(e.target.value)
                              }
                              className="w-full rounded-full border border-slate-300 bg-white pl-3 pr-7 py-1 text-xs text-black placeholder:text-slate-400 focus:border-[#FF4500] focus:outline-none"
                            />
                            {lastNameFilter ? (
                              <button
                                type="button"
                                onClick={() => setLastNameFilter("")}
                                className="absolute right-2 p-0.5 text-slate-400 hover:text-black"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            ) : (
                              <Search className="absolute right-2.5 w-3 h-3 text-slate-400 pointer-events-none" />
                            )}
                          </div>
                        </th>

                        {/* Email Filter */}
                        <th className="py-2.5 px-3">
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              placeholder="Email..."
                              value={emailFilter}
                              onChange={(e) => setEmailFilter(e.target.value)}
                              className="w-full rounded-full border border-slate-300 bg-white pl-3 pr-7 py-1 text-xs text-black placeholder:text-slate-400 focus:border-[#FF4500] focus:outline-none"
                            />
                            {emailFilter ? (
                              <button
                                type="button"
                                onClick={() => setEmailFilter("")}
                                className="absolute right-2 p-0.5 text-slate-400 hover:text-black"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            ) : (
                              <Search className="absolute right-2.5 w-3 h-3 text-slate-400 pointer-events-none" />
                            )}
                          </div>
                        </th>

                        {/* Dept Filter */}
                        <th className="py-2.5 px-3">
                          <select
                            value={deptTableFilter}
                            onChange={(e) => setDeptTableFilter(e.target.value)}
                            className="w-full rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-black focus:border-[#FF4500] focus:outline-none truncate"
                          >
                            <option value="">All Depts</option>
                            {departmentOptions.map((dept) => (
                              <option key={dept} value={dept}>
                                {dept}
                              </option>
                            ))}
                          </select>
                        </th>

                        {/* Designation Filter */}
                        <th className="py-2.5 px-3">
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              placeholder="Designation..."
                              value={designationFilter}
                              onChange={(e) =>
                                setDesignationFilter(e.target.value)
                              }
                              className="w-full rounded-full border border-slate-300 bg-white pl-3 pr-7 py-1 text-xs text-black placeholder:text-slate-400 focus:border-[#FF4500] focus:outline-none"
                            />
                            {designationFilter ? (
                              <button
                                type="button"
                                onClick={() => setDesignationFilter("")}
                                className="absolute right-2 p-0.5 text-slate-400 hover:text-black"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            ) : (
                              <Search className="absolute right-2.5 w-3 h-3 text-slate-400 pointer-events-none" />
                            )}
                          </div>
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {pagination.pageItems.map((employee) => (
                        <tr
                          key={employee.id}
                          className="hover:bg-[#F8FAFC] transition-colors"
                        >
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                title="View employee"
                                onClick={() =>
                                  setViewingDepartmentEmployee(employee)
                                }
                                className="p-1 rounded-lg text-[#FF8A00] hover:bg-[#FFF5ED] transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                title="Edit employee"
                                onClick={() =>
                                  setEditingDepartmentEmployee(employee)
                                }
                                className="p-1 rounded-lg text-[#EF4444] hover:bg-red-50 transition-colors"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                title="Delete employee"
                                onClick={() =>
                                  setDepartmentEmployeeToDelete(employee)
                                }
                                className="p-1 rounded-lg text-[#3B82F6] hover:bg-blue-50 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>

                          <td className="py-3 px-3 font-medium text-xs font-normal text-black truncate">
                            {employee.employee_id || "—"}
                          </td>
                          <td className="py-3 px-3 font-normal text-black truncate">
                            {employee.first_name || "—"}
                          </td>
                          <td className="py-3 px-3 font-normal text-black truncate">
                            {employee.last_name || "—"}
                          </td>
                          <td className="py-3 px-3 font-normal text-black truncate">
                            {employee.personal_email || "—"}
                          </td>
                          <td className="py-3 px-3  font-normal text-black truncate">
                            {employee.department || "—"}
                          </td>
                          <td className="py-3 px-3">                           
                              {employee.designation || "—"}                            
                          </td>
                        </tr>
                      ))}

                      {!filteredEmployees.length && (
                        <tr>
                          <td
                            colSpan={7}
                            className="py-14 text-center text-sm font-normal text-slate-500"
                          >
                            No employees found for this department.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Controls */}
              {filteredEmployees.length > 0 && (
                <div className="pt-4 p-4 border-t border-slate-200">
                  <PaginationControls
                    currentPage={pagination.currentPage}
                    totalPages={pagination.totalPages}
                    pageSize={pagination.pageSize}
                    pageStart={pagination.pageStart}
                    pageEnd={pagination.pageEnd}
                    totalItems={filteredEmployees.length}
                    itemLabel="employees"
                    onPageSizeChange={pagination.setPageSize}
                    onPreviousPage={pagination.goToPreviousPage}
                    onNextPage={pagination.goToNextPage}
                  />
                </div>
              )}
            </motion.div>
          ) : null}
        </div>

        {/* DEPARTMENT CREATED POPUP */}
        <Dialog open={showSuccessPopup} onOpenChange={setShowSuccessPopup}>
          <DialogContent className="max-w-sm rounded-2xl border border-slate-300 bg-white text-center text-black shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-black">
                {successMessage}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                The department has been added successfully.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg bg-slate-50 p-3 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Generated department ID
              </p>
              <p className="mt-1 break-all font-mono text-sm text-slate-900">
                {createdDepartmentId}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSuccessPopup(false)}
              className="w-full mt-4 rounded-xl bg-[#3B82F6] px-4 py-2 text-xs font-bold text-white hover:brightness-105"
            >
              OK
            </button>
          </DialogContent>
        </Dialog>

        {/* VIEW ONBOARDING EMPLOYEE MODAL */}
        <Dialog
          open={!!viewingDepartmentEmployee}
          onOpenChange={(open) => {
            if (!open) setViewingDepartmentEmployee(null);
          }}
        >
          <DialogContent className="max-w-md rounded-2xl border border-slate-300 bg-white text-black shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-black">
                Employee Profile
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Overview of onboarding personnel profile details.
              </DialogDescription>
            </DialogHeader>

            {viewingDepartmentEmployee && (
              <div className="space-y-3 py-3 text-xs text-black">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="font-semibold text-slate-500">
                    Employee ID:
                  </span>
                  <span className="font-mono font-semibold text-slate-900">
                    {viewingDepartmentEmployee.employee_id || "—"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="font-semibold text-slate-500">Name:</span>
                  <span className="font-medium text-slate-900">
                    {[
                      viewingDepartmentEmployee.first_name,
                      viewingDepartmentEmployee.last_name,
                    ]
                      .filter(Boolean)
                      .join(" ") || "—"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="font-semibold text-slate-500">Email:</span>
                  <span className="font-mono text-slate-900">
                    {viewingDepartmentEmployee.personal_email || "—"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="font-semibold text-slate-500">
                    Department:
                  </span>
                  <span className="font-medium text-slate-900">
                    {viewingDepartmentEmployee.department || "—"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="font-semibold text-slate-500">
                    Designation:
                  </span>
                  <span className="capitalize text-[#FF8A00] font-bold">
                    {viewingDepartmentEmployee.designation || "—"}
                  </span>
                </div>
              </div>
            )}
            <DialogFooter>
              <button
                type="button"
                onClick={() => setViewingDepartmentEmployee(null)}
                className="w-full rounded-xl border border-slate-300 bg-white py-2 text-xs font-bold text-black hover:bg-slate-50"
              >
                Close
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* EDIT DEPARTMENT EMPLOYEE MODAL */}
        <Dialog
          open={!!editingDepartmentEmployee}
          onOpenChange={(open) => {
            if (!open) setEditingDepartmentEmployee(null);
          }}
        >
          <DialogContent className="max-w-md rounded-2xl border border-slate-300 bg-white text-black shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-black">
                Edit Employee Details
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Update personnel designation and department.
              </DialogDescription>
            </DialogHeader>

            {editingDepartmentEmployee && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-black uppercase tracking-wider">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={editingDepartmentEmployee.first_name}
                      onChange={(e) =>
                        setEditingDepartmentEmployee({
                          ...editingDepartmentEmployee,
                          first_name: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-black focus:border-[#FF4500] focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-black uppercase tracking-wider">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={editingDepartmentEmployee.last_name}
                      onChange={(e) =>
                        setEditingDepartmentEmployee({
                          ...editingDepartmentEmployee,
                          last_name: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-black focus:border-[#FF4500] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-black uppercase tracking-wider">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editingDepartmentEmployee.personal_email || ""}
                    onChange={(e) =>
                      setEditingDepartmentEmployee({
                        ...editingDepartmentEmployee,
                        personal_email: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-black focus:border-[#FF4500] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-black uppercase tracking-wider">
                    Designation
                  </label>
                  <input
                    type="text"
                    value={editingDepartmentEmployee.designation || ""}
                    onChange={(e) =>
                      setEditingDepartmentEmployee({
                        ...editingDepartmentEmployee,
                        designation: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-black focus:border-[#FF4500] focus:outline-none"
                  />
                </div>

                <DialogFooter className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingDepartmentEmployee(null)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-black hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleUpdateDepartmentEmployee()}
                    className="rounded-xl bg-[#3B82F6] px-5 py-2 text-xs font-bold text-white hover:brightness-105"
                  >
                    Save Changes
                  </button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* DELETE MODAL */}
        <Dialog
          open={!!departmentEmployeeToDelete}
          onOpenChange={(open) => {
            if (!open) setDepartmentEmployeeToDelete(null);
          }}
        >
          <DialogContent className="max-w-[420px] rounded-2xl border border-slate-300 bg-white p-6 text-black shadow-lg">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-base font-bold text-black">
                Delete Onboarding Record
              </DialogTitle>
              <DialogDescription className="text-xs leading-relaxed text-black">
                Are you sure you want to delete{" "}
                <span className="text-[#EF4444] font-bold">
                  {departmentEmployeeToDelete?.first_name}{" "}
                  {departmentEmployeeToDelete?.last_name}
                </span>
                ? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDepartmentEmployeeToDelete(null)}
                className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-600 hover:bg-blue-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteDepartmentEmployee()}
                className="rounded-xl bg-[#3B82F6] px-4 py-2 text-xs font-bold text-white shadow-sm hover:brightness-110 transition-all"
              >
                Delete
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </PageWrapper>
    </div>
  );
};

export default Team;
