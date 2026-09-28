/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FTWRecord, FTWStatus } from '../types';

/**
 * Indonesian month map for parsing dates like "26 September 2026"
 */
const INDO_MONTH_MAP: Record<string, string> = {
  januari: '01', jan: '01',
  februari: '02', feb: '02',
  maret: '03', mar: '03',
  april: '04', apr: '04',
  mei: '05', may: '05',
  juni: '06', jun: '06',
  juli: '07', jul: '07',
  agustus: '08', ags: '08', agu: '08',
  september: '09', sep: '09', sept: '09',
  oktober: '10', okt: '10', oct: '10',
  november: '11', nov: '11',
  desember: '12', des: '12', dec: '12'
};

/**
 * Normalizes NIK or NRP string for clean comparisons across disparate database schemas.
 * Trims whitespace, uppercases, removes punctuation/hyphens.
 */
export function normalizeNIK(nik?: string): string {
  if (!nik) return '';
  return String(nik).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Checks if two NIK strings match, even if one has prefix "NIK" / "NRP", leading zeros, or spaces.
 * e.g., "NIK226900186" matches "226900186", "0226900186", "NRP-226900186".
 */
export function isNikMatch(nikA?: string, nikB?: string): boolean {
  if (!nikA || !nikB) return false;
  const a = normalizeNIK(nikA);
  const b = normalizeNIK(nikB);
  if (a === b) return true;

  const strippedA = a.replace(/^(NIK|NRP)/, '').replace(/^0+/, '');
  const strippedB = b.replace(/^(NIK|NRP)/, '').replace(/^0+/, '');
  if (strippedA.length > 0 && strippedA === strippedB) return true;

  // Substring match for badge numbers with length >= 5
  if (strippedA.length >= 5 && strippedB.length >= 5) {
    if (strippedA.includes(strippedB) || strippedB.includes(strippedA)) {
      return true;
    }
  }

  return false;
}

/**
 * Gets normalized WIB date YYYY-MM-DD from an FTWRecord.
 * Handles ISO (2026-09-26), DD/MM/YYYY, Indonesian text ("26 September 2026"), and timestamps.
 */
export function getRecordWibDate(record: FTWRecord): string {
  if (record.date) {
    const raw = String(record.date).trim();

    // 1. Format YYYY-MM-DD
    const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
    }

    // 2. Format DD-MM-YYYY or DD/MM/YYYY
    const ddmmyyyy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (ddmmyyyy) {
      return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
    }

    // 3. Format Indonesian month e.g. "26 September 2026" or "26 Sep 2026"
    const textDate = raw.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
    if (textDate) {
      const day = textDate[1].padStart(2, '0');
      const mName = textDate[2].toLowerCase();
      const year = textDate[3];
      const month = INDO_MONTH_MAP[mName];
      if (month) {
        return `${year}-${month}-${day}`;
      }
    }
  }

  // 4. Derive from submittedAt if available
  if (record.submittedAt) {
    const d = new Date(record.submittedAt);
    if (!isNaN(d.getTime())) {
      const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
      const wib = new Date(utc + (3600000 * 7));
      const yyyy = wib.getFullYear();
      const mm = String(wib.getMonth() + 1).padStart(2, '0');
      const dd = String(wib.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  return record.date || '';
}

/**
 * Determines shift (1 or 2) from an FTWRecord.
 * - Shift 2 (Malam): Jam 15.00 sore - 03.59 subuh (Termasuk 16.00 - 18.00)
 * - Shift 1 (Siang): Jam 04.00 subuh - 14.59 siang
 */
export function getRecordShift(record: FTWRecord): 1 | 2 {
  if (record.shift !== undefined && record.shift !== null) {
    const str = String(record.shift).toLowerCase().trim();
    if (str === '2' || Number(record.shift) === 2 || /malam|night|shift 2|s2/i.test(str)) {
      return 2;
    }
    if (str === '1' || Number(record.shift) === 1 || /siang|pagi|day|shift 1|s1/i.test(str)) {
      return 1;
    }
  }

  // Derive from raw jam string if present
  if (record.jam) {
    const m = String(record.jam).match(/(\d{1,2})/);
    if (m) {
      const h = parseInt(m[1], 10);
      return (h >= 15 || h < 4) ? 2 : 1;
    }
  }

  // Derive from submittedAt if available
  if (record.submittedAt) {
    const d = new Date(record.submittedAt);
    if (!isNaN(d.getTime())) {
      const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
      const wib = new Date(utc + (3600000 * 7));
      const hr = wib.getHours();
      return (hr >= 15 || hr < 4) ? 2 : 1;
    }
  }

  return 1;
}

/**
 * Returns all FTW records submitted for a specific date and shift (or all shifts if shift is 'all' or undefined).
 */
export function getSubmittedFtwForDateAndShift(
  date: string,
  shift: 1 | 2 | 'all' | undefined,
  records: FTWRecord[]
): FTWRecord[] {
  if (!records || records.length === 0) return [];

  return records.filter(r => {
    const recDate = getRecordWibDate(r);
    if (recDate !== date) return false;

    if (!shift || shift === 'all') return true;
    const recShift = getRecordShift(r);
    return recShift === shift;
  });
}

/**
 * Resolves the FTW status of an operator for a specific date and optional shift.
 * Supports fallback matching by operator name and automatically honors valid FIT results
 * filled on that date even if shift field was slightly divergent.
 * 
 * Returns:
 * - 'fit': Operator filled FTW and was declared FIT (Label Hijau)
 * - 'unfit': Operator filled FTW and was declared UNFIT (Label Merah)
 * - 'pending': Operator has NOT filled FTW yet (Label Abu-abu)
 */
export function getOperatorFTW(
  nik: string | undefined,
  date: string,
  shift: 1 | 2 | undefined,
  records: FTWRecord[],
  operatorName?: string
): {
  status: FTWStatus;
  record?: FTWRecord;
} {
  if ((!nik && !operatorName) || !records || records.length === 0) {
    return { status: 'pending' };
  }

  // Normalize operator name for secondary fallback matching
  const cleanOpName = operatorName ? operatorName.trim().toUpperCase() : '';

  // Filter candidates matching this operator NIK (or Name) and target date
  const candidateRecords = records.filter(r => {
    const recDate = getRecordWibDate(r);
    const dateMatches = recDate === date || r.date === date;
    if (!dateMatches) return false;

    // 1. Primary match by NIK
    if (nik && isNikMatch(r.nik, nik)) return true;

    // 2. Secondary match by Operator Name if NIK didn't match or was formatted differently
    if (cleanOpName && r.name) {
      const recName = r.name.trim().toUpperCase();
      if (recName === cleanOpName || recName.includes(cleanOpName) || cleanOpName.includes(recName)) {
        return true;
      }
    }

    return false;
  });

  if (candidateRecords.length === 0) {
    return { status: 'pending' };
  }

  // Sort candidate records by submission timestamp descending (most recent first)
  const sorted = [...candidateRecords].sort((a, b) => {
    const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    return timeB - timeA;
  });

  // 1. Look for a record explicitly matching the requested shift
  let matched = sorted.find(r => {
    if (!shift) return true;
    const recShift = getRecordShift(r);
    return recShift === shift;
  });

  // 2. If no exact shift match, but the operator DID fill FTW on this date:
  // An operator who did their medical FTW inspection today is FIT to work!
  // Don't mark them as "Belum Isi" if they already submitted on this date.
  if (!matched && sorted.length > 0) {
    matched = sorted[0];
  }

  if (matched) {
    return {
      status: matched.status === 'unfit' ? 'unfit' : 'fit',
      record: matched
    };
  }

  return { status: 'pending' };
}

export interface FTWStyleConfig {
  status: FTWStatus;
  label: string;
  badgeLabel: string;
  description: string;
  badgeBg: string;
  chipBg: string;
  boxBorder: string;
  boxBg: string;
  dotColor: string;
  indicatorText: string;
  iconType: 'fit' | 'unfit' | 'pending';
}

/**
 * Visual styling configuration corresponding to the user's color specifications:
 * - Fit -> Label Hijau (Emerald/Green)
 * - Unfit -> Label Merah (Rose/Red)
 * - Belum Mengisi -> Label Abu-abu (Gray/Slate)
 */
export function getFTWStyleConfig(status: FTWStatus): FTWStyleConfig {
  switch (status) {
    case 'fit':
      return {
        status: 'fit',
        label: 'FIT',
        badgeLabel: 'FIT TO WORK',
        description: 'Operator Fit Bekerja',
        badgeBg: 'bg-emerald-500 text-white font-black shadow-sm',
        chipBg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
        boxBorder: 'border-emerald-500 ring-1 ring-emerald-500/20',
        boxBg: 'bg-emerald-50/20',
        dotColor: 'bg-emerald-500',
        indicatorText: 'text-emerald-700',
        iconType: 'fit'
      };

    case 'unfit':
      return {
        status: 'unfit',
        label: 'UNFIT',
        badgeLabel: 'TIDAK FIT',
        description: 'Operator Unfit (Butuh Pengganti)',
        badgeBg: 'bg-rose-600 text-white font-black shadow-sm animate-pulse',
        chipBg: 'bg-rose-50 text-rose-800 border-rose-300 font-bold',
        boxBorder: 'border-rose-500 ring-2 ring-rose-500/40',
        boxBg: 'bg-rose-50/30',
        dotColor: 'bg-rose-600',
        indicatorText: 'text-rose-700',
        iconType: 'unfit'
      };

    case 'pending':
    default:
      return {
        status: 'pending',
        label: 'BELUM ISI',
        badgeLabel: 'BELUM ISI FTW',
        description: 'Belum Mengisi Input FTW Online',
        badgeBg: 'bg-slate-400 text-white font-bold',
        chipBg: 'bg-slate-100 text-slate-600 border-slate-300',
        boxBorder: 'border-slate-300',
        boxBg: 'bg-slate-50/50',
        dotColor: 'bg-slate-400',
        indicatorText: 'text-slate-500',
        iconType: 'pending'
      };
  }
}
