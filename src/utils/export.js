// Exportable reports (D.4): CSV opens directly in Excel; PDF via the browser's
// print dialog ("Save as PDF") with print-specific CSS.
export function downloadCsv(filename, rows, attribution) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))];
  if (attribution) lines.push('', esc(`Source: ${attribution}`));
  const csv = lines.join('\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const printPage = () => window.print();
