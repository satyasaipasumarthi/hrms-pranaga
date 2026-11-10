export interface ExcelColumn {
  header: string;
  key: string;
  width: number;
}

export const sanitizeFileName = (value: string) =>
  value.trim().replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");

export const downloadExcel = async (
  fileName: string,
  sheetName: string,
  columns: ExcelColumn[],
  rows: Record<string, string | number>[],
) => {
  const { Workbook } = await import("exceljs");

  const workbook = new Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = columns;
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};
