import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
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
  createAdminUser,
  deleteAdminUsers,
  fetchUserCreationRecords,
  fetchDepartments,
  fetchShifts,
  updateUserCreationRecord,
  type UserCreationRecord,
} from "@/lib/hrms-api";
import { canManageSettings } from "@/lib/permissions";
import {
  appRoles,
  formatRoleLabel,
  normalizeRole,
  type AppRole,
} from "@/lib/roles";
import {
  Eye,
  EyeOff,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Search,
  X,
} from "lucide-react";
import "./Settings.css";

const inputClass =
  "w-full bg-white border border-[#CBD5E1] rounded-lg px-3.5 py-2 text-xs text-black focus:outline-none focus:border-[#FF4500] focus:ring-1 focus:ring-[#FF4500]/30 transition-all";
const labelClass =
  "text-[11px] font-bold text-black font-heading tracking-wider uppercase";
const emptyForm = {
  username: "",
  firstName: "",
  lastName: "",
  email: "",
  role: "" as AppRole | "",
  department: "",
  shift: "",
  password: "",
};

const Settings = () => {
  const { user, permissions } = useAuth();
  const canManageUsers =
    canManageSettings(permissions) &&
    ["admin", "hr"].includes(user?.role ?? "");

  const [admins, setAdmins] = useState<UserCreationRecord[]>([]);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(true);
  const [departments, setDepartments] = useState<string[]>([]);
  const [shifts, setShifts] = useState<string[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [adminToEdit, setAdminToEdit] = useState<UserCreationRecord | null>(
    null,
  );
  const [adminToView, setAdminToView] = useState<UserCreationRecord | null>(
    null,
  );
  const [adminToDelete, setAdminToDelete] = useState<UserCreationRecord | null>(
    null,
  );
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  // search filters
  const [nameFilter, setNameFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  const filteredAdmins = admins.filter((admin) => {
    const matchesName = (admin.name ?? "")
      .toLowerCase()
      .includes(nameFilter.toLowerCase().trim());
    const matchesEmail = (admin.email ?? "")
      .toLowerCase()
      .includes(emailFilter.toLowerCase().trim());
    const matchesDepartment =
      departmentFilter === "all" || admin.department === departmentFilter;
    const matchesRole = roleFilter === "all" || admin.role === roleFilter;

    return matchesName && matchesEmail && matchesDepartment && matchesRole;
  });

  const loadAdminData = useCallback(async () => {
    if (!user || !["admin", "hr"].includes(user.role)) {
      setAdmins([]);
      setIsLoadingAdmins(false);
      return;
    }

    setIsLoadingAdmins(true);
    try {
      const [adminRows, departmentOptions, shiftOptions] = await Promise.all([
        fetchUserCreationRecords(),
        fetchDepartments(),
        fetchShifts(),
      ]);

      setAdmins(adminRows);
      setDepartments(departmentOptions);
      setShifts(shiftOptions);
    } catch (error) {
      console.error("Failed to load admin users:", error);
      toast({
        title: "Admin data unavailable",
        description:
          error instanceof Error
            ? error.message
            : "Could not load admin users.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAdmins(false);
    }
  }, [user]);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

  const resetForm = () => {
    setForm(emptyForm);
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.role) {
      toast({
        title: "Permission group required",
        description: "Select a permission group before creating the user.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await createAdminUser({
        username: form.username,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        role: form.role,
        department: form.department || null,
        shift: form.shift || null,
      });

      await loadAdminData();
      resetForm();
      setIsCreateOpen(false);
      setIsSuccessOpen(true);
    } catch (error) {
      console.error("Failed to create admin user:", error);
      toast({
        title: "Create failed",
        description:
          error instanceof Error
            ? error.message
            : "The admin user could not be created.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!adminToEdit) {
      return;
    }
    if (!form.role) {
      toast({
        title: "Permission group required",
        description: "Select a permission group before saving the user.",
        variant: "destructive",
      });
      return;
    }

    setIsUpdatingUser(true);
    try {
      const response = await updateUserCreationRecord({
        userId: adminToEdit.id,
        username: form.username,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        role: form.role,
        department: form.department || null,
        shift: form.shift || null,
      });

      setAdminToEdit(null);
      await loadAdminData();
      toast({ title: "User updated", description: response.message });
    } catch (error) {
      console.error("Failed to update user:", error);
      toast({
        title: "Update failed",
        description:
          error instanceof Error
            ? error.message
            : "The user could not be updated.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const generatePassword = () => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleDeleteUser = async () => {
    if (!adminToDelete) {
      return;
    }

    if (adminToDelete.id === user?.id) {
      toast({
        title: "Cannot delete your account",
        description: "You cannot delete your own account.",
        variant: "destructive",
      });
      setAdminToDelete(null);
      return;
    }

    setIsDeletingUser(true);
    try {
      await deleteAdminUsers([
        { id: adminToDelete.id, email: adminToDelete.email },
      ]);
      setAdminToDelete(null);
      await loadAdminData();
      toast({
        title: "User deleted",
        description: `${adminToDelete.name} has been deleted.`,
      });
    } catch (error) {
      console.error("Failed to delete user:", error);
      toast({
        title: "Delete failed",
        description:
          error instanceof Error
            ? error.message
            : "The user could not be deleted.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingUser(false);
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
        title="Users"
        action={
          <button
      type="button"
      onClick={() => {
        setForm(emptyForm);
        setIsCreateOpen(true);
      }}
      className="settings-add-user-btn"
    >
      <Plus />
      <span>Add User</span>
    </button>
        }
      >
        {canManageUsers && (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="table-container w-full overflow-hidden"
            >
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    {/* Top Grey Heading Header (Matches Image 1 / 3) */}
                    <tr
                      className="text-xs uppercase tracking-wider"
                      style={{
                        backgroundColor: "#d9d7d7",
                        fontFamily: "Arial, Helvetica, sans-serif",
                      }}
                    >
                      <th className="py-3.5 px-4 w-[110px] font-normal text-black">
                        ACTION
                      </th>
                      <th className="py-3.5 px-4 font-normal text-black">
                       FIRSTNAME
                      </th>
                       <th className="py-3.5 px-4 font-normal text-black">
                        LASTNAME
                      </th>
                      <th className="py-3.5 px-4 font-normal text-black">
                        EMAIL
                      </th>
                      <th className="py-3.5 px-4 font-normal text-black">
                        DEPARTMENT
                      </th>
                      <th className="py-3.5 px-4 font-normal text-black">
                        SHIFT
                      </th>
                      <th className="py-3.5 px-4 font-normal text-black">
                        ROLE
                      </th>
                    </tr>

                    {/* Filter Inputs Row (Rounded pill inputs) */}
                    <tr className="bg-[#F8FAFD] border-b border-slate-200">
                      <th className="py-2.5 px-4"></th>

                      {/* Name Filter */}
                       <th className="py-2.5 px-4">
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            placeholder="Filter name..."
                            value={nameFilter}
                            onChange={(e) => setNameFilter(e.target.value)}
                            className="w-full rounded-full border border-slate-300 bg-white pl-3 pr-7 py-1 text-xs text-black placeholder:text-slate-400 focus:border-[#FF4500] focus:outline-none"
                          />
                          {nameFilter ? (
                            <button
                              type="button"
                              onClick={() => setNameFilter("")}
                              className="absolute right-2 p-0.5 text-slate-400 hover:text-black"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          ) : (
                            <Search className="absolute right-2.5 w-3 h-3 text-slate-400 pointer-events-none" />
                          )}
                        </div>
                      </th>
                      <th className="py-2.5 px-4">
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            placeholder="Filter name..."
                            value={nameFilter}
                            onChange={(e) => setNameFilter(e.target.value)}
                            className="w-full rounded-full border border-slate-300 bg-white pl-3 pr-7 py-1 text-xs text-black placeholder:text-slate-400 focus:border-[#FF4500] focus:outline-none"
                          />
                          {nameFilter ? (
                            <button
                              type="button"
                              onClick={() => setNameFilter("")}
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
                      <th className="py-2.5 px-4">
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            placeholder="Filter email..."
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

                      {/* Department Filter */}
                      <th className="py-2.5 px-4">
                        <select
                          value={departmentFilter}
                          onChange={(e) => setDepartmentFilter(e.target.value)}
                          className="w-full rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-black focus:border-[#FF4500] focus:outline-none"
                        >
                          <option value="all">All Depts</option>
                          {departments.map((dept) => (
                            <option key={dept} value={dept}>
                              {dept}
                            </option>
                          ))}
                        </select>
                      </th>

                      {/* Shift Spacer */}
                      <th className="py-2.5 px-4"></th>

                      {/* Role Filter */}
                      <th className="py-2.5 px-4">
                        <select
                          value={roleFilter}
                          onChange={(e) => setRoleFilter(e.target.value)}
                          className="w-full rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-black focus:border-[#FF4500] focus:outline-none"
                        >
                          <option value="all">All Roles</option>
                          {appRoles.map((role) => (
                            <option key={role} value={role}>
                              {formatRoleLabel(role)}
                            </option>
                          ))}
                        </select>
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredAdmins.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-[#F8FAFC] transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setAdminToView(item)}
                              className="p-1 rounded-lg text-[#FF8A00] hover:bg-[#FFF5ED] transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setIsCreateOpen(false);
                                const nameParts = (item.name || "").split(" ");
                                const firstName = nameParts[0] || "";
                                const lastName =
                                  nameParts.slice(1).join(" ") || "";

                                setForm({
                                  username: item.username || "",
                                  firstName: firstName,
                                  lastName: lastName,
                                  email: item.email || "",
                                  role: (item.role as AppRole) || "admin",
                                  department: item.department || "",
                                  shift: item.shift || "",
                                  password: "",
                                });

                                setAdminToEdit(item);
                              }}
                              className="p-1 rounded-lg text-[#3B82F6] hover:bg-blue-50 transition-colors"
                              title="Edit User"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setAdminToDelete(item)}
                              className="p-1 rounded-lg text-[#EF4444] hover:bg-red-50 transition-colors"
                              title="Delete User"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>

                        <td className="py-3 px-4 font-normal text-black text-left truncate">
                          {item.firstName}
                        </td>
                        <td className="py-3 px-4 font-normal text-black text-left truncate">
                          {item.lastName}
                        </td>
                        

                        <td className="py-3 px-4 text-xs font-normal text-black truncate">
                          {item.email}
                        </td>
                        <td className="py-3 px-4 text-xs font-normal text-black text-left truncate">
                          {item.department ?? "—"}
                        </td>
                        <td className="py-3 px-4 text-xs font-normal text-black">
                          {item.shift ?? "—"}
                        </td>
                        <td className="py-3 px-4 text-left text-xs font-normal text-black">
                          <span>
                            {formatRoleLabel(
                              normalizeRole(item.role) ?? "admin",
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {isLoadingAdmins && (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-12 text-center text-sm font-normal text-slate-500"
                        >
                          Loading user records...
                        </td>
                      </tr>
                    )}
                    {!isLoadingAdmins && !filteredAdmins.length && (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-12 text-center text-sm font-normal text-slate-500"
                        >
                          No user records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        )}

        {/* VIEW MODAL */}
        {adminToView && (
          <Dialog
            open={!!adminToView}
            onOpenChange={() => setAdminToView(null)}
          >
            <DialogContent className="max-w-md rounded-2xl border border-slate-300 bg-white text-black shadow-lg">
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-black">
                  User Details
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  User account profile and permissions.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-200">
                  <span className="font-semibold text-slate-500">ID:</span>
                  <span className="font-mono text-slate-900 font-semibold">
                    {adminToView.id ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-200">
                  <span className="font-semibold text-slate-500">
                    Username:
                  </span>
                  <span className="text-slate-900 font-semibold">
                    {adminToView.username ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-200">
                  <span className="font-semibold text-slate-500">Name:</span>
                  <span className="text-slate-900 font-medium">
                    {adminToView.name ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-200">
                  <span className="font-semibold text-slate-500">Email:</span>
                  <span className="font-mono text-slate-900">
                    {adminToView.email ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-200">
                  <span className="font-semibold text-slate-500">
                    Department:
                  </span>
                  <span className="text-slate-900 font-medium">
                    {adminToView.department ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-200">
                  <span className="font-semibold text-slate-500">Shift:</span>
                  <span className="text-slate-900 font-medium">
                    {adminToView.shift ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="font-semibold text-slate-500">
                    Permission Group:
                  </span>
                  <span className="text-[#FF4500] font-bold">
                    {normalizeRole(adminToView.role)
                      ? formatRoleLabel(normalizeRole(adminToView.role)!)
                      : "—"}
                  </span>
                </div>
              </div>
              <DialogFooter>
                <button
                  type="button"
                  onClick={() => setAdminToView(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-black hover:bg-slate-50"
                >
                  Close
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* EDIT MODAL */}
        {adminToEdit && (
          <Dialog
            open={Boolean(adminToEdit)}
            onOpenChange={(open) => {
              if (!open && !isUpdatingUser) {
                setAdminToEdit(null);
                resetForm();
              }
            }}
          >
            <DialogContent className="max-w-2xl rounded-2xl border border-slate-300 bg-white text-black shadow-lg">
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-black">
                  Edit User
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Update the user's account details.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleUpdateUser} className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className={labelClass}>ID</label>
                    <input
                      value={adminToEdit.id}
                      disabled
                      className={`${inputClass} opacity-60 cursor-not-allowed`}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>USERNAME *</label>
                    <input
                      value={form.username}
                      onChange={(e) =>
                        setForm({ ...form, username: e.target.value })
                      }
                      className={inputClass}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>FIRST_NAME *</label>
                    <input
                      value={form.firstName}
                      onChange={(e) =>
                        setForm({ ...form, firstName: e.target.value })
                      }
                      className={inputClass}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>LAST_NAME *</label>
                    <input
                      value={form.lastName}
                      onChange={(e) =>
                        setForm({ ...form, lastName: e.target.value })
                      }
                      className={inputClass}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>EMAIL *</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                      className={inputClass}
                      placeholder="name@company.com"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>DEPARTMENT</label>
                    <select
                      value={form.department}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          department: e.target.value,
                        }))
                      }
                      className={inputClass}
                    >
                      <option value="">Please choose department</option>
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>SHIFT</label>
                    <select
                      value={form.shift}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          shift: e.target.value,
                        }))
                      }
                      className={inputClass}
                    >
                      <option value="">Please choose shift</option>
                      {shifts.map((shift) => (
                        <option key={shift} value={shift}>
                          {shift}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>PERMISSION GROUP</label>
                    <select
                      value={form.role}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          role: e.target.value as AppRole | "",
                        }))
                      }
                      className={inputClass}
                      required
                    >
                      <option value="" disabled>
                        Select permission group
                      </option>
                      {appRoles.map((role) => (
                        <option key={role} value={role}>
                          {formatRoleLabel(role)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className={labelClass}>
                      UPDATE PASSWORD (OPTIONAL)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={form.password}
                        onChange={(e) =>
                          setForm({ ...form, password: e.target.value })
                        }
                        className={inputClass}
                        placeholder="Password@123"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="p-2 rounded-lg border border-slate-300 bg-white text-black hover:bg-slate-50 transition-colors"
                        title={
                          showPassword ? "Hide Password" : "Reveal Password"
                        }
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            password: generatePassword(),
                          }))
                        }
                        className="p-2 rounded-lg border border-slate-300 bg-white text-black hover:bg-slate-50 transition-colors"
                        title="Generate Secure Password"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <DialogFooter className="pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setAdminToEdit(null)}
                    disabled={isUpdatingUser}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-black hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingUser}
                    className="rounded-xl bg-[#3B82F6] px-5 py-2 text-xs font-bold text-white hover:brightness-105 disabled:opacity-50"
                  >
                    {isUpdatingUser ? "Saving..." : "Save Changes"}
                  </button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {/* DELETE MODAL */}
        <Dialog
          open={Boolean(adminToDelete)}
          onOpenChange={(open) => {
            if (!open && !isDeletingUser) {
              setAdminToDelete(null);
            }
          }}
        >
          <DialogContent className="max-w-[420px] rounded-2xl border border-slate-300 bg-white text-black shadow-lg">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-base font-bold text-black">
                Delete User
              </DialogTitle>
              <DialogDescription className="text-xs leading-relaxed text-black">
                Are you sure you want to delete{" "}
                <span className="text-[#EF4444] font-bold">
                  {adminToDelete?.name ?? "this user"}
                </span>
                ? This permanently removes their portal login.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setAdminToDelete(null)}
                disabled={isDeletingUser}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-black hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteUser()}
                disabled={isDeletingUser}
                className="rounded-xl bg-[#EF4444] px-4 py-2 text-xs font-bold text-white shadow-sm hover:brightness-110 disabled:opacity-50"
              >
                {isDeletingUser ? "Deleting..." : "Delete User"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* CREATE MODAL */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-2xl rounded-2xl border border-slate-300 bg-white text-black shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-black">
                Create User
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Create a portal user and send an email invitation to set up
                their password.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreate} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={labelClass}>ID</label>
                  <input
                    value="Automatic Generation"
                    disabled
                    className={`${inputClass} opacity-60 cursor-not-allowed`}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>USERNAME *</label>
                  <input
                    value={form.username}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        username: event.target.value,
                      }))
                    }
                    className={inputClass}
                    placeholder="Enter Username"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>FIRST_NAME *</label>
                  <input
                    value={form.firstName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        firstName: event.target.value,
                      }))
                    }
                    className={inputClass}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>LAST_NAME *</label>
                  <input
                    value={form.lastName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        lastName: event.target.value,
                      }))
                    }
                    className={inputClass}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>EMAIL *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    className={inputClass}
                    placeholder="name@company.com"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>DEPARTMENT</label>
                  <select
                    value={form.department}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        department: event.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="">Please choose department</option>
                    {departments.map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>SHIFT</label>
                  <select
                    value={form.shift}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        shift: event.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="">Please choose shift</option>
                    {shifts.map((shift) => (
                      <option key={shift} value={shift}>
                        {shift}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>PERMISSION GROUP</label>
                  <select
                    value={form.role}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        role: event.target.value as AppRole | "",
                      }))
                    }
                    className={inputClass}
                    required
                  >
                    <option value="" disabled>
                      Select permission group
                    </option>
                    {appRoles.map((role) => (
                      <option key={role} value={role}>
                        {formatRoleLabel(role)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <DialogFooter className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isSubmitting}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-black hover:bg-slate-50"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#FF4500] px-5 py-2 text-xs font-bold text-white hover:brightness-105 disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Submit"}
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* SUCCESS MODAL */}
        <Dialog open={isSuccessOpen} onOpenChange={setIsSuccessOpen}>
          <DialogContent className="max-w-sm text-center rounded-2xl border border-slate-300 bg-white text-black shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-black">
                User created successfully
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                The user has been created successfully.
              </DialogDescription>
            </DialogHeader>
            <button
              type="button"
              onClick={() => setIsSuccessOpen(false)}
              className="w-full mt-4 rounded-xl bg-[#FF4500] px-4 py-2 text-xs font-bold text-white hover:brightness-105"
            >
              OK
            </button>
          </DialogContent>
        </Dialog>
      </PageWrapper>
    </div>
  );
};

export default Settings;
