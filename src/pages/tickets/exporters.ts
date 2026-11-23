// [ticket-management] CSV / Excel exports of the ticket list.
import { format } from "date-fns";
import { categoryLabel, priorityMeta, statusLabel, type Ticket } from "./types";

const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

const csvCell = (value: unknown) => {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const downloadCsv = (rows: Record<string, unknown>[], filename: string) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvCell).join(","), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(","))];
  // BOM so Excel opens UTF-8 (₹, names with accents) correctly.
  download(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }), filename);
};

const fmt = (iso: string | null) => (iso ? format(new Date(iso), "yyyy-MM-dd HH:mm") : "");

export const ticketRows = (tickets: Ticket[]) =>
  tickets.map((t) => ({
    Ticket: t.key,
    Title: t.title,
    Category: categoryLabel(t),
    Priority: priorityMeta(t.priority).label,
    Status: statusLabel(t.status),
    "Raised by": t.raisedBy.name,
    "Assigned to": t.assignee?.name ?? "",
    "People added": t.watchers.map((w) => w.name).join("; "),
    Created: fmt(t.createdAt),
    "Deadline date": fmt(t.dueDate),
    Closed: fmt(t.closedAt),
    "Resolution hours": t.closedAt ? Math.round((new Date(t.closedAt).getTime() - new Date(t.createdAt).getTime()) / 36e5) : "",
    "Met due date": t.closedAt ? (new Date(t.closedAt) <= new Date(t.dueDate) ? "Yes" : "No") : "",
    Escalation: t.escalationLevel || "",
    Rating: t.rating ?? "",
    "Rating comment": t.ratingComment ?? "",
    Reopened: t.reopenedCount || "",
  }));

export const exportTicketsExcel = async (tickets: Ticket[], suffix = format(new Date(), "yyyy-MM-dd")) => {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Tickets");
  const rows = ticketRows(tickets);
  const headers = rows.length ? Object.keys(rows[0]) : ["Ticket"];
  sheet.columns = headers.map((h) => ({ header: h, key: h, width: Math.max(12, Math.min(48, h.length + 6)) }));
  rows.forEach((r) => sheet.addRow(r));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE5D6" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  const buffer = await workbook.xlsx.writeBuffer();
  download(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `tickets-${suffix}.xlsx`,
  );
};

export const exportTicketsCsv = (tickets: Ticket[], suffix = format(new Date(), "yyyy-MM-dd")) => downloadCsv(ticketRows(tickets), `tickets-${suffix}.csv`);
