/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Employee, ShiftInfo, UnitSetting } from '../types';

/**
 * Helper to get differences in calendar days between two ISO date strings (YYYY-MM-DD)
 */
export function getDaysBetween(date1Str: string, date2Str: string): number {
  const d1 = new Date(date1Str + 'T00:00:00');
  const d2 = new Date(date2Str + 'T00:00:00');
  
  // Reset hours to avoid daylight saving issues
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Helper to get the Sunday of the week containing a given date
 * (Used for weekly-fixed shift rotation calculation)
 */
export function getSundayOfWeek(dateStr: string): Date {
  const date = new Date(dateStr + 'T00:00:00');
  date.setHours(0,0,0,0);
  const day = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const diff = date.getDate() - day; // adjust back to Sunday
  return new Date(date.setDate(diff));
}

/**
 * Calculate active shifts for Operator 1 and Operator 2 on a given target date
 */
export function calculateShift(setting: UnitSetting, targetDateStr: string): ShiftInfo {
  const refDateStr = setting.startSiangDate;
  
  // Default fallback
  const fallback: ShiftInfo = { operator1Role: 'OFF', operator2Role: 'OFF' };
  
  if (!refDateStr || !targetDateStr) return fallback;
  
  const daysDiff = getDaysBetween(refDateStr, targetDateStr);
  
  // Pattern 1: 6-1 Roster (14-day cycle)
  if (setting.rosterPattern === '6-1') {
    // A 14-day cycle:
    // Day 0 to 5 (6 days): Op 1 = S, Op 2 = M
    // Day 6 (1 day): OFF / OFF
    // Day 7 to 12 (6 days): Op 1 = M, Op 2 = S
    // Day 13 (1 day): OFF / OFF
    const cycleLength = 14;
    // Handle negative days diff by wrapping around correctly
    const index = ((daysDiff % cycleLength) + cycleLength) % cycleLength;
    
    if (index >= 0 && index <= 5) {
      return { operator1Role: 'S', operator2Role: 'M' };
    } else if (index === 6) {
      return { operator1Role: 'OFF', operator2Role: 'OFF' };
    } else if (index >= 7 && index <= 12) {
      return { operator1Role: 'M', operator2Role: 'S' };
    } else {
      return { operator1Role: 'OFF', operator2Role: 'OFF' };
    }
  }
  
  // Pattern 2: 13-1 Roster (14-day cycle)
  if (setting.rosterPattern === '13-1') {
    const cycleLength = 14;
    const index = ((daysDiff % cycleLength) + cycleLength) % cycleLength;
    const isDay7Malam = setting.roster13_1Day7Shift === 'malam';
    
    if (isDay7Malam) {
      // Skema Hari ke-7 disetel Shift Malam (Total Roster Operator: 6 Siang, 7 Malam):
      // Day 0 to 5 (Hari 1-6): Op 1 = S, Op 2 = M
      // Day 6 (Hari ke-7): Op 1 = M, Op 2 = OFF (Hari ke-7: Op 1 mulai Malam ke-1, Op 2 OFF)
      // Day 7 to 12 (Hari 8-13): Op 1 = M, Op 2 = S (Op 1: lanjut Malam ke 2-7, Op 2: 6 Siang)
      // Day 13 (Hari ke-14): Op 1 = OFF, Op 2 = M (Op 1: OFF, Op 2: mulai Malam ke-1)
      // Hasil total kedua operator: Tepat 6 Siang, 7 Malam, 1 OFF (13-1)
      if (index >= 0 && index <= 5) {
        return { operator1Role: 'S', operator2Role: 'M' };
      } else if (index === 6) {
        return { operator1Role: 'M', operator2Role: 'OFF' };
      } else if (index >= 7 && index <= 12) {
        return { operator1Role: 'M', operator2Role: 'S' };
      } else { // index === 13
        return { operator1Role: 'OFF', operator2Role: 'M' };
      }
    } else {
      // Skema Hari ke-7 disetel Shift Siang (Total Roster Operator: 7 Siang, 6 Malam):
      // Day 0 to 5 (Hari 1-6): Op 1 = S, Op 2 = M
      // Day 6 (Hari ke-7): Op 1 = S, Op 2 = OFF (Hari ke-7: Op 1 tetap Siang ke-7, Op 2 OFF)
      // Day 7 to 12 (Hari 8-13): Op 1 = M, Op 2 = S (Op 1: 6 Malam, Op 2: 6 Siang)
      // Day 13 (Hari ke-14): Op 1 = OFF, Op 2 = S (Op 1: OFF, Op 2: tetap Siang ke-7)
      // Hasil total kedua operator: Tepat 7 Siang, 6 Malam, 1 OFF (13-1)
      if (index >= 0 && index <= 5) {
        return { operator1Role: 'S', operator2Role: 'M' };
      } else if (index === 6) {
        return { operator1Role: 'S', operator2Role: 'OFF' };
      } else if (index >= 7 && index <= 12) {
        return { operator1Role: 'M', operator2Role: 'S' };
      } else { // index === 13
        return { operator1Role: 'OFF', operator2Role: 'S' };
      }
    }
  }
  
  // Pattern 3: Weekly Fixed Off Day (e.g. Sunday is always OFF)
  if (setting.rosterPattern === 'weekly-fixed') {
    const targetDate = new Date(targetDateStr + 'T00:00:00');
    const dayOfWeek = targetDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Check if target date is the fixed off day
    if (dayOfWeek === setting.fixedOffDayOfWeek) {
      return { operator1Role: 'OFF', operator2Role: 'OFF' };
    }
    
    // Calculate how many weeks (off periods) have passed since reference date's Sunday
    const refSunday = getSundayOfWeek(refDateStr);
    const targetSunday = getSundayOfWeek(targetDateStr);
    const msDiff = targetSunday.getTime() - refSunday.getTime();
    const weeksDiff = Math.round(msDiff / (1000 * 60 * 60 * 24 * 7));
    
    // Even weeks: Op 1 = S, Op 2 = M
    // Odd weeks: Op 1 = M, Op 2 = S (they swap every off day)
    const cycleIndex = ((weeksDiff % 2) + 2) % 2;
    if (cycleIndex === 0) {
      return { operator1Role: 'S', operator2Role: 'M' };
    } else {
      return { operator1Role: 'M', operator2Role: 'S' };
    }
  }
  
  return fallback;
}

/**
 * Generates an array of dates starting from a specific date for a certain number of days
 */
export function generateDateRange(startDateStr: string, count: number): string[] {
  const dates: string[] = [];
  const start = new Date(startDateStr + 'T00:00:00');
  
  for (let i = 0; i < count; i++) {
    const current = new Date(start);
    current.setDate(start.getDate() + i);
    
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }
  
  return dates;
}

/**
 * Format date nicely in Indonesian
 */
export function formatIndonesianDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatIndonesianDayName(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return days[date.getDay()];
}

/**
 * Check if an employee is on scheduled annual leave on a given target date.
 * Respects optional explicit leave start/end strings, otherwise falls back to emp.annualLeaveStartDate / emp.annualLeaveEndDate.
 */
export function isEmployeeOnLeave(
  emp?: Employee | null,
  targetDateStr?: string,
  explicitLeaveStart?: string,
  explicitLeaveEnd?: string
): boolean {
  if (!targetDateStr) return false;
  
  const start = explicitLeaveStart || emp?.annualLeaveStartDate;
  const end = explicitLeaveEnd || emp?.annualLeaveEndDate;
  
  if (!start && !end) return false;
  
  // If only start date is set
  if (start && !end) {
    return targetDateStr === start;
  }
  // If only end date is set
  if (!start && end) {
    return targetDateStr === end;
  }
  // Both start and end dates are set
  if (start && end) {
    const minDate = start <= end ? start : end;
    const maxDate = start <= end ? end : start;
    return targetDateStr >= minDate && targetDateStr <= maxDate;
  }
  
  return false;
}
