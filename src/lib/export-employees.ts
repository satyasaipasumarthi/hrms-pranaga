import type { OnboardingEmployeeRecord } from "@/lib/hrms-api";
import { downloadExcel, sanitizeFileName } from "@/lib/export-excel";

export const exportEmployeesToExcel = (
  employees: OnboardingEmployeeRecord[],
  fileLabel: string,
) =>
  downloadExcel(
    `employees_${sanitizeFileName(fileLabel) || "all"}.xlsx`,
    "Employees",
    [
      { header: "Employee Record ID", key: "recordId", width: 38 },
      { header: "Employee ID", key: "employeeId", width: 18 },
      { header: "First Name", key: "firstName", width: 20 },
      { header: "Last Name", key: "lastName", width: 20 },
      { header: "Email", key: "email", width: 36 },
      { header: "Department", key: "department", width: 30 },
      { header: "Designation", key: "designation", width: 24 },
      { header: "Role Type", key: "roleType", width: 18 },
    ],
    employees.map((employee) => ({
      recordId: employee.id,
      employeeId: employee.employee_id ?? "",
      firstName: employee.first_name,
      lastName: employee.last_name,
      email: employee.personal_email ?? "",
      department: employee.department ?? "",
      designation: employee.designation ?? "",
      roleType: employee.role_type ?? "",
    })),
  );
