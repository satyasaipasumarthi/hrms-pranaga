import type { DepartmentEmployee } from "@/lib/hrms-api";
import { downloadExcel, sanitizeFileName } from "@/lib/export-excel";

export const exportTeamMembersToExcel = (
  teamName: string,
  members: DepartmentEmployee[],
) =>
  downloadExcel(
    `${sanitizeFileName(teamName) || "team"}_members.xlsx`,
    "Team Members",
    [
      { header: "Employee ID", key: "employeeId", width: 18 },
      { header: "First Name", key: "firstName", width: 20 },
      { header: "Last Name", key: "lastName", width: 20 },
      { header: "Email", key: "email", width: 36 },
      { header: "Department", key: "department", width: 22 },
      { header: "Designation", key: "designation", width: 24 },
    ],
    members.map((member) => ({
      employeeId: member.employee_id ?? "",
      firstName: member.first_name,
      lastName: member.last_name,
      email: member.personal_email ?? "",
      department: member.department ?? "",
      designation: member.designation ?? "",
    })),
  );
