import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportToPDF(
  data: Record<string, unknown>[],
  filename: string,
  reportType: string,
  companyName: string,
  period: string
) {
  const doc = new jsPDF({ orientation: 'landscape' });

  // Header
  doc.setFontSize(16);
  doc.setTextColor(30, 58, 95);
  doc.text('RutaViva', 14, 16);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`${companyName} — ${reportType} — ${period}`, 14, 23);

  if (data.length === 0) {
    doc.setFontSize(12);
    doc.text('Sin datos para el período seleccionado.', 14, 40);
  } else {
    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(h => String(row[h] ?? '')));

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 30,
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: 14, right: 14 },
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    const pageHeight = doc.internal.pageSize.height;
    doc.text(
      `Generado el ${new Date().toLocaleString('es-PE')} — RutaViva | Pág. ${i}/${pageCount}`,
      14,
      pageHeight - 8
    );
  }

  doc.save(`${filename}.pdf`);
}
