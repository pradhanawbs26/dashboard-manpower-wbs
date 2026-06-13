/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SpreadsheetBreakdown {
  tanggal: string;      // Parsed YYYY-MM-DD
  shift: 1 | 2;         // 1 = Siang, 2 = Malam
  rawUnitCode: string;   // Original spreadsheet code (e.g. "FD15001")
  appUnitCode: string;   // Mapped app code (e.g. "FD 23001")
  tipe: string;         // Col F (SM or USM)
  problem: string;      // Col G (Problem)
  lokasi: string;       // Col H (Location)
  status: 'BREAKDOWN' | 'RFU'; // Col BQ: 'actual done' -> RFU, other -> BREAKDOWN
  deskripsi: string;    // Col BS (Description)
}

/**
 * Custom mapping system for spreadsheet unit identification to application codes:
 * - FD15001 to FD15049 maps to FD 23001 to FD 23049
 * - WL15001 and onwards maps to WL 23001 and onwards
 * - Special exceptions:
 *   - FD23213 -> FD 23213
 *   - FD2314 -> FD 23214
 *   - FD23215 -> FD 23215
 *   - FD23209 -> FD 23209
 */
export function mapSpreadsheetUnitToAppUnit(sheetUnitCode: string): string {
  if (!sheetUnitCode) return "";
  const code = sheetUnitCode.trim().replace(/\s+/g, "").toUpperCase();

  // 1. Direct Exceptions
  if (code === "FD23213") return "FD 23213";
  if (code === "FD2314" || code === "FD23214") return "FD 23214";
  if (code === "FD23215") return "FD 23215";
  if (code === "FD23209") return "FD 23209";

  // 2. Pattern Match [Letters]15[3 digits] -> [Letters] 23[3 digits]
  const pattern15 = code.match(/^([A-Z]+)15(\d{3})$/);
  if (pattern15) {
    const prefix = pattern15[1];
    const numPart = pattern15[2];
    const numVal = parseInt(numPart, 10);
    if (numVal >= 1 && numVal <= 49) {
      return `${prefix} 23${numPart}`;
    }
  }

  // 3. Fallback General Split: e.g. "FD23001" -> "FD 23001"
  const generalPattern = code.match(/^([A-Z]+)(\d+)$/);
  if (generalPattern) {
    return `${generalPattern[1]} ${generalPattern[2]}`;
  }

  return sheetUnitCode.trim();
}

/**
 * Robust RFC 4180 CSV Parser to properly handle commas inside double quotes
 */
export function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  const chars = [...text];
  let i = 0;
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  while (i < chars.length) {
    const c = chars[i];
    const next = chars[i + 1];

    if (inQuotes) {
      if (c === '"') {
        if (next === '"') {
          cell += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(cell);
        cell = '';
      } else if (c === '\r' || c === '\n') {
        row.push(cell);
        cell = '';
        if (row.length > 0 || c === '\n') {
          lines.push(row);
          row = [];
        }
        if (c === '\r' && next === '\n') {
          i++; // Skip sequence
        }
      } else {
        cell += c;
      }
    }
    i++;
  }

  if (cell || row.length > 0) {
    row.push(cell);
    lines.push(row);
  }

  return lines;
}

export function parseSpreadsheetDate(val: string): string | null {
  if (!val) return null;
  val = val.trim();
  // Match standard YYYY-MM-DD
  const ymd = val.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  }
  // Match standard DD/MM/YYYY
  const dmy = val.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  return null;
}

export function parseSpreadsheetShift(val: string): 1 | 2 | null {
  if (!val) return null;
  val = val.toLowerCase().trim();
  if (val === "1" || val.includes("siang") || val.includes("day") || val === "shift 1") {
    return 1;
  }
  if (val === "2" || val.includes("malam") || val.includes("night") || val === "shift 2") {
    return 2;
  }
  return null;
}

/**
 * Fetch and parse data from Google Spreadsheet DATABASE sheet
 */
export async function fetchSpreadsheetBreakdowns(spreadsheetId: string, gid: string = "1150138172"): Promise<SpreadsheetBreakdown[]> {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  
  const response = await fetch(url, { headers: { 'pragma': 'no-cache', 'cache-control': 'no-cache' } });
  if (!response.ok) {
    throw new Error(`Gagal mengunduh spreadsheet: ${response.statusText}`);
  }

  const csvText = await response.text();
  const rows = parseCSV(csvText);
  const breakdowns: SpreadsheetBreakdown[] = [];

  // Headings are at rows[0], data starts at index 1
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 9) continue; // Minimum columns to contain primary items

    const colA_dateRaw = row[0]; // Tanggal input data
    const colB_shiftRaw = row[1]; // Shift input data
    const colE_unitRaw = row[4];  // Nomor unit alat berat
    const colF_typeRaw = row[5];  // Tipe breakdown (SM atau USM)
    const colG_problem = row[6];  // Problem breakdown
    const colH_location = row[7]; // Lokasi perbaikan
    
    // Safety checks for column indexes out of range
    const colBQ_statusRaw = row.length > 69 ? row[69] : ""; // Status RFU atau masih breakdown
    const colBS_descRaw = row.length > 71 ? row[71] : "";   // Deskripsi perbaikan

    if (!colE_unitRaw) continue; // If unit number is blank, skip row

    const parsedDate = parseSpreadsheetDate(colA_dateRaw);
    const parsedShift = parseSpreadsheetShift(colB_shiftRaw);
    const mappedUnitCode = mapSpreadsheetUnitToAppUnit(colE_unitRaw);

    // If date or shift could not be resolved, skip to match user layout accurately
    if (!parsedDate || !parsedShift) continue;

    const bqVal = colBQ_statusRaw.trim().toLowerCase();
    // Bila actual done maka sudah RFU, bila masih rumus please check maka masih BREAKDOWN
    const isReady = bqVal === "actual done" || bqVal.includes("done");
    const status: 'BREAKDOWN' | 'RFU' = isReady ? 'RFU' : 'BREAKDOWN';

    breakdowns.push({
      tanggal: parsedDate,
      shift: parsedShift,
      rawUnitCode: colE_unitRaw.trim(),
      appUnitCode: mappedUnitCode,
      tipe: colF_typeRaw ? colF_typeRaw.trim() : "BREAKDOWN",
      problem: colG_problem ? colG_problem.trim() : "ADA PROBLEM",
      lokasi: colH_location ? colH_location.trim() : "Workshop",
      status,
      deskripsi: colBS_descRaw ? colBS_descRaw.trim() : ""
    });
  }

  return breakdowns;
}
