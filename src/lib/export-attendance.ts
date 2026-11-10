import { downloadExcel } from "@/lib/export-excel";

interface AttendanceExportRow {
  employeeName?: string;
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  totalHours: string | number;
  status: string;
}

export const exportAttendanceToExcel = (
  rows: AttendanceExportRow[],
  includeEmployee: boolean,
  fileLabel: string,
) =>
  downloadExcel(
    `attendance_${fileLabel}.xlsx`,
    "Attendance",
    [
      ...(includeEmployee ? [{ header: "Employee", key: "employee", width: 28 }] : []),
      { header: "Date", key: "date", width: 14 },
      { header: "Check In", key: "checkIn", width: 14 },
      { header: "Check Out", key: "checkOut", width: 14 },
      { header: "Total Hours", key: "totalHours", width: 14 },
      { header: "Status", key: "status", width: 14 },
    ],
    rows.map((row) => ({
      employee: row.employeeName ?? "",
      date: row.date,
      checkIn: row.checkIn ?? "-",
      checkOut: row.checkOut ?? "-",
      totalHours: row.totalHours,
      status: row.status,
    })),
  );
