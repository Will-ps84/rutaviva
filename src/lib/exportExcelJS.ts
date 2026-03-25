import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export async function exportToExcelJS(
  data: Record<string, unknown>[],
  filename: string,
  sheetName = 'Reporte',
  companyName?: string,
  reportType?: string,
  period?: string
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'RutaViva';
  wb.created = new Date();

  const ws = wb.addWorksheet(sheetName);

  if (data.length === 0) {
    ws.addRow(['Sin datos para el período seleccionado']);
    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `${filename}.xlsx`);
    return;
  }

  const headers = Object.keys(data[0]);

  // Title row
  ws.addRow([`RutaViva — ${companyName || ''} — ${reportType || 'Reporte'} — ${period || ''}`]);
  ws.getRow(1).font = { bold: true, size: 12 };
  ws.addRow([]); // blank

  // Header row
  const headerRow = ws.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    cell.alignment = { horizontal: 'center' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } } };
  });

  // Data rows
  data.forEach((row, i) => {
    const values = headers.map(h => row[h] ?? '');
    const dataRow = ws.addRow(values);
    if (i % 2 === 0) {
      dataRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } };
      });
    }
  });

  // Auto-width
  headers.forEach((_, colIdx) => {
    const col = ws.getColumn(colIdx + 1);
    let maxLen = String(headers[colIdx]).length;
    ws.eachRow((row) => {
      const cellVal = String(row.getCell(colIdx + 1).value ?? '');
      if (cellVal.length > maxLen) maxLen = cellVal.length;
    });
    col.width = Math.min(maxLen + 4, 40);
  });

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${filename}.xlsx`);
}
