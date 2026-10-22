import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

export interface CsvColumn<Row> {
  heading: string;
  value: (row: Row) => string | number | null | undefined;
}

/** Serializes an explicit, caller-approved field set and neutralizes spreadsheet formulas. */
export function toCsv<Row>(rows: readonly Row[], columns: readonly CsvColumn<Row>[]): string {
  const lines = [columns.map((column) => csvCell(column.heading)).join(',')];
  rows.forEach((row) => lines.push(columns.map((column) => csvCell(column.value(row))).join(',')));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

@Injectable({ providedIn: 'root' })
export class CsvExportService {
  private readonly document = inject(DOCUMENT);

  download<Row>(filename: string, rows: readonly Row[], columns: readonly CsvColumn<Row>[]): void {
    const url = URL.createObjectURL(new Blob([toCsv(rows, columns)], { type: 'text/csv;charset=utf-8' }));
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}

function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
