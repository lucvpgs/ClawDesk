/**
 * Client-side export utilities — CSV and JSON download via Blob + anchor click.
 */

/** Escape a single CSV cell value */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Wrap in quotes if contains comma, quote, or newline
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Convert an array of objects to a CSV string */
export function toCSV(rows: Record<string, unknown>[], columns?: string[]): string {
  if (rows.length === 0) return "";
  const keys = columns ?? Object.keys(rows[0]);
  const header = keys.join(",");
  const body = rows.map((row) => keys.map((k) => csvCell(row[k])).join(",")).join("\n");
  return `${header}\n${body}`;
}

/** Trigger a browser download of a text file */
function downloadText(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Download data as a JSON file */
export function downloadJSON(data: unknown, filename: string) {
  downloadText(JSON.stringify(data, null, 2), filename, "application/json");
}

/** Download rows as a CSV file */
export function downloadCSV(rows: Record<string, unknown>[], filename: string, columns?: string[]) {
  downloadText(toCSV(rows, columns), filename, "text/csv;charset=utf-8;");
}

/** Filename with timestamp: "clawdesk-tasks-2026-03-22.csv" */
export function exportFilename(entity: string, format: "csv" | "json"): string {
  const date = new Date().toISOString().slice(0, 10);
  return `clawdesk-${entity}-${date}.${format}`;
}
