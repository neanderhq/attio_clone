export const CSV_MAX_BYTES = 10 * 1024 * 1024;
export const CSV_MAX_ROWS = 10_000;
export type ImportType = 'companies' | 'people';
export type ImportMode = 'create-only' | 'update-only' | 'upsert';
export const CSV_FIELDS = { companies: ['domain', 'name', 'description'], people: ['email', 'name', 'companyDomain'] } as const;
export type RowOutcome = { row: number; action: 'create' | 'update' | 'unchanged' | 'error'; id?: number; message: string };

export function parseCsv(input: string) {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  if (!text || text.includes('\0')) throw new Error('Choose a nonempty UTF-8 CSV file without NUL characters.');
  const rows: string[][] = []; let row: string[] = [], field = '', quoted = false, endedQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { quoted = false; endedQuote = true; }
      else field += c;
    } else if (endedQuote) {
      if (c === ',') { row.push(field); field = ''; endedQuote = false; }
      else if (c === '\n' || c === '\r') { row.push(field); rows.push(row); row = []; field = ''; endedQuote = false; if (c === '\r' && text[i + 1] === '\n') i++; }
      else throw new Error(`Malformed CSV near row ${rows.length + 1}: text after a quoted cell.`);
    } else if (c === '"') {
      if (field) throw new Error(`Malformed CSV near row ${rows.length + 1}: quote inside an unquoted cell.`);
      quoted = true;
    } else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { row.push(field); rows.push(row); row = []; field = ''; if (c === '\r' && text[i + 1] === '\n') i++; }
    else field += c;
    if (rows.length > CSV_MAX_ROWS + 1) throw new Error(`CSV files may contain at most ${CSV_MAX_ROWS} data rows.`);
  }
  if (quoted) throw new Error('Malformed CSV: an opening quote has no closing quote.');
  if (field || row.length || endedQuote) { row.push(field); rows.push(row); }
  if (!rows.length || rows[0].every(x => !x.trim())) throw new Error('The CSV needs a header row.');
  if (rows.length - 1 > CSV_MAX_ROWS) throw new Error(`CSV files may contain at most ${CSV_MAX_ROWS} data rows.`);
  const headers = rows[0].map(x => x.trim());
  if (headers.some(x => !x)) throw new Error('CSV headers cannot be blank.');
  if (new Set(headers.map(x => x.toLowerCase())).size !== headers.length) throw new Error('CSV headers must be unique.');
  return { headers, rows: rows.slice(1).map((cells, i) => ({ row: i + 2, cells })) };
}

export function csvCell(value: string | null | undefined) {
  let text = value ?? '';
  // Excel and other spreadsheet apps can evaluate cells even after leading whitespace.
  if (/^[\s\uFEFF]*[=+@-]/u.test(text) || /^[\t\r\n]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function serializeCsv(rows: (string | null | undefined)[][]) { return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'; }
