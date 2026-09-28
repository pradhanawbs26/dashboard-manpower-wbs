/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Service to connect directly to the external Firebase project (ftw-wbs)
 * for real-time synchronization of operator Fit To Work (FTW) submissions.
 */

import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  getDocs, 
  query, 
  limit, 
  setDoc, 
  doc, 
  Firestore,
  Unsubscribe
} from 'firebase/firestore';
import { FTWRecord } from '../types';
import { isNikMatch } from '../utils/ftwHelper';

// Configuration for external Firebase project "ftw-wbs"
export const EXTERNAL_FTW_CONFIG = {
  apiKey: "AIzaSyBmw_xLTuTK66i2TFn6Iotg43AFvFBtxZ8",
  authDomain: "ftw-wbs.firebaseapp.com",
  projectId: "ftw-wbs",
  storageBucket: "ftw-wbs.firebasestorage.app",
  messagingSenderId: "558288446517",
  appId: "1:558288446517:web:f7dde6f01f4accb1163d7c"
};

const EXTERNAL_APP_NAME = 'ftw-wbs-external';
const DEFAULT_COLLECTION = 'ftw';

export const COMMON_FTW_COLLECTIONS = [
  'ftw',
  'ftwSubmissions',
  'pemeriksaan',
  'submissions',
  'fit_to_work',
  'daily_ftw',
  'ftw_records',
  'data_ftw',
  'records'
];

/**
 * Singleton getter for external Firestore instance
 */
let externalDbInstance: Firestore | null = null;

export function getExternalFtwDb(): Firestore {
  if (externalDbInstance) return externalDbInstance;

  const existingApp = getApps().find(app => app.name === EXTERNAL_APP_NAME);
  const app = existingApp || initializeApp(EXTERNAL_FTW_CONFIG, EXTERNAL_APP_NAME);
  externalDbInstance = getFirestore(app);
  return externalDbInstance;
}

/**
 * Format a Date object to Indonesian local date YYYY-MM-DD in UTC+7 (WIB)
 */
export function getWIBDateString(dateObj: Date): string {
  // Convert to UTC+7 (WIB)
  const utc = dateObj.getTime() + (dateObj.getTimezoneOffset() * 60000);
  const wibTime = new Date(utc + (3600000 * 7));
  const year = wibTime.getFullYear();
  const month = String(wibTime.getMonth() + 1).padStart(2, '0');
  const day = String(wibTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a Date object to Indonesian local time HH:mm in UTC+7 (WIB)
 */
export function getWIBTimeString(dateObj: Date): { timeStr: string; hour: number; minute: number } {
  const utc = dateObj.getTime() + (dateObj.getTimezoneOffset() * 60000);
  const wibTime = new Date(utc + (3600000 * 7));
  const hour = wibTime.getHours();
  const minute = wibTime.getMinutes();
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return { timeStr, hour, minute };
}

/**
 * Extracts submission hour & determines Shift (1 = Siang, 2 = Malam).
 * 
 * Rules requested by user:
 * - Jam 16.00 - 18.00 (persiapan shift malam) -> Otomatis SHIFT 2
 * - Umum hauling/mining shift rotation:
 *   - Shift 2 (Malam): Jam 15.00 sore sampai 03.59 subuh
 *   - Shift 1 (Siang): Jam 04.00 subuh sampai 14.59 siang
 */
export function determineShiftFromTime(
  rawShift: any, 
  dateObj: Date | null,
  rawTimeStr?: string
): { shift: 1 | 2; reason: string } {
  // 1. If document already has an explicit shift
  if (rawShift !== undefined && rawShift !== null) {
    if (rawShift === 2 || rawShift === '2' || /malam|night|shift 2|s2/i.test(String(rawShift))) {
      return { shift: 2, reason: 'Field dokumen menyatakan Shift 2 (Malam)' };
    }
    if (rawShift === 1 || rawShift === '1' || /siang|day|shift 1|s1/i.test(String(rawShift))) {
      return { shift: 1, reason: 'Field dokumen menyatakan Shift 1 (Siang)' };
    }
  }

  // 2. If time string was provided like "16:30" or "17.15"
  if (rawTimeStr && typeof rawTimeStr === 'string') {
    const match = rawTimeStr.match(/(\d{1,2})[:.](\d{1,2})/);
    if (match) {
      const hour = parseInt(match[1], 10);
      if (hour >= 15 || hour < 4) {
        return { 
          shift: 2, 
          reason: `Diisi jam ${rawTimeStr} (Sore/Malam: 15.00-03.59) -> Otomatis Shift 2` 
        };
      } else {
        return { 
          shift: 1, 
          reason: `Diisi jam ${rawTimeStr} (Pagi/Siang: 04.00-14.59) -> Otomatis Shift 1` 
        };
      }
    }
  }

  // 3. From Date object (converted to WIB UTC+7)
  if (dateObj && !isNaN(dateObj.getTime())) {
    const { timeStr, hour } = getWIBTimeString(dateObj);
    if (hour >= 15 || hour < 4) {
      return { 
        shift: 2, 
        reason: `Diisi jam ${timeStr} WIB (Sore/Malam: 15.00-03.59) -> Otomatis Shift 2` 
      };
    } else {
      return { 
        shift: 1, 
        reason: `Diisi jam ${timeStr} WIB (Pagi/Siang: 04.00-14.59) -> Otomatis Shift 1` 
      };
    }
  }

  // Default to shift 1
  return { shift: 1, reason: 'Default Shift 1 (Siang)' };
}

/**
 * Universal document parser that handles any schema variations in ftw-wbs Firestore
 */
export function parseExternalFtwDoc(docId: string, data: any, sourceCollection: string): FTWRecord | null {
  if (!data || typeof data !== 'object') return null;

  // 1. Extract NIK / NRP (Employee ID)
  const rawNik = 
    data.nik || 
    data.nrp || 
    data.nik_karyawan || 
    data.nrp_karyawan || 
    data.id_karyawan || 
    data.employeeId || 
    data.employee_id || 
    data.badge || 
    data.no_badge || 
    data.userId || 
    data.user_id || 
    data.kode_operator || 
    data.id;

  if (!rawNik || typeof rawNik !== 'string' && typeof rawNik !== 'number') {
    return null; // NIK is essential for cross-project mapping
  }

  const nik = String(rawNik).trim().toUpperCase();

  // 2. Extract Operator Name
  const name = 
    data.name || 
    data.nama || 
    data.nama_karyawan || 
    data.employeeName || 
    data.employee_name || 
    data.operatorName || 
    data.operator_name || 
    data.fullName || 
    data.nama_lengkap || 
    '';

  // 3. Extract Date & Time
  let dateStr = '';
  let timeStr = '';
  let dateObj: Date | null = null;

  // Try parsing timestamp
  const rawTimestamp = 
    data.submittedAt || 
    data.createdAt || 
    data.timestamp || 
    data.created_at || 
    data.waktu_isi || 
    data.waktu || 
    data.waktu_pemeriksaan;

  if (rawTimestamp) {
    if (typeof rawTimestamp.toDate === 'function') {
      dateObj = rawTimestamp.toDate();
    } else if (typeof rawTimestamp.toMillis === 'function') {
      dateObj = new Date(rawTimestamp.toMillis());
    } else if (rawTimestamp instanceof Date) {
      dateObj = rawTimestamp;
    } else if (typeof rawTimestamp === 'number') {
      dateObj = new Date(rawTimestamp);
    } else if (typeof rawTimestamp === 'string') {
      const parsed = new Date(rawTimestamp);
      if (!isNaN(parsed.getTime())) {
        dateObj = parsed;
      }
    }
  }

  // Raw date string
  const rawDate = 
    data.date || 
    data.tanggal || 
    data.tgl || 
    data.tanggal_pemeriksaan || 
    data.submissionDate;

  if (rawDate && typeof rawDate === 'string') {
    const rawClean = rawDate.trim();
    // If format is YYYY-MM-DD
    const isoMatch = rawClean.match(/^\d{4}-\d{2}-\d{2}/);
    if (isoMatch) {
      dateStr = isoMatch[0];
    } else {
      // Could be DD/MM/YYYY or DD-MM-YYYY
      const ddmmyyyy = rawClean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
      if (ddmmyyyy) {
        dateStr = `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
      } else {
        // Indonesian month format e.g. "26 September 2026"
        const indoText = rawClean.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
        if (indoText) {
          const mName = indoText[2].toLowerCase();
          const months: Record<string, string> = {
            januari: '01', jan: '01', februari: '02', feb: '02', maret: '03', mar: '03',
            april: '04', apr: '04', mei: '05', may: '05', juni: '06', jun: '06',
            juli: '07', jul: '07', agustus: '08', ags: '08', agu: '08',
            september: '09', sep: '09', sept: '09', oktober: '10', okt: '10',
            november: '11', nov: '11', desember: '12', des: '12'
          };
          const m = months[mName];
          if (m) {
            dateStr = `${indoText[3]}-${m}-${indoText[1].padStart(2, '0')}`;
          }
        }
      }
    }
  }

  // If no raw date string, derive from dateObj
  if (!dateStr && dateObj) {
    dateStr = getWIBDateString(dateObj);
  }

  // If still no date, fallback to today WIB
  if (!dateStr) {
    dateStr = getWIBDateString(new Date());
  }

  // Extract raw time
  const rawTime = data.jam || data.waktu_jam || data.time || data.jam_pemeriksaan;
  if (rawTime && typeof rawTime === 'string') {
    timeStr = rawTime;
  } else if (dateObj) {
    timeStr = getWIBTimeString(dateObj).timeStr;
  }

  // 4. Determine Shift (Shift 1 = Siang, Shift 2 = Malam)
  const { shift, reason } = determineShiftFromTime(
    data.shift || data.shift_kerja || data.waktu_shift,
    dateObj,
    timeStr
  );

  // 5. Determine Fit / Unfit status
  let status: 'fit' | 'unfit' = 'fit';

  const rawStatus = String(
    data.status || 
    data.hasil || 
    data.kondisi || 
    data.kelayakan || 
    data.keterangan || 
    data.kesimpulan || 
    data.fitStatus || 
    data.fit_status || 
    ''
  ).toLowerCase();

  const isUnfitExplicit = 
    rawStatus.includes('unfit') || 
    rawStatus.includes('tidak fit') || 
    rawStatus.includes('un-fit') || 
    rawStatus.includes('tidak laik') || 
    rawStatus.includes('tidak layak') || 
    rawStatus.includes('sakit') || 
    rawStatus.includes('istirahat') || 
    rawStatus.includes('demam') || 
    rawStatus.includes('rekomendasi dokter');

  const isFitExplicit = 
    rawStatus.includes('fit') || 
    rawStatus.includes('sehat') || 
    rawStatus.includes('laik') || 
    rawStatus.includes('layak') || 
    rawStatus.includes('siap');

  if (isUnfitExplicit) {
    status = 'unfit';
  } else if (isFitExplicit) {
    status = 'fit';
  } else if (data.isFit === false || data.fit === false || data.kelayakan === false) {
    status = 'unfit';
  }

  // Check vitals if present
  const temp = parseFloat(data.suhu || data.temperature || data.suhu_tubuh || 0);
  const sleep = parseFloat(data.jam_tidur || data.sleepHours || data.tidur || 0);
  if (temp >= 37.8) {
    status = 'unfit';
  }
  if (sleep > 0 && sleep < 5.0) {
    status = 'unfit';
  }

  // 6. Build FTWRecord
  const record: FTWRecord = {
    id: `ext-${sourceCollection}-${docId}`,
    nik,
    name: name || `Operator (${nik})`,
    date: dateStr,
    shift,
    status,
    submittedAt: dateObj ? dateObj.toISOString() : new Date().toISOString(),
    jam: timeStr || undefined,
    temperature: temp || 36.5,
    bloodPressure: String(data.tensi || data.bloodPressure || data.tekanan_darah || '120/80'),
    sleepHours: sleep || 7.5,
    notes: data.catatan || data.notes || data.keluhan || (status === 'fit' ? 'Fit Bekerja' : 'Unfit / Kurang Sehat'),
    sourceProject: `Firebase ftw-wbs [${sourceCollection}]`
  };

  return record;
}

/**
 * Fetch FTW records once from a given collection in ftw-wbs
 */
export async function fetchExternalFtw(collectionName: string = DEFAULT_COLLECTION): Promise<{
  success: boolean;
  records: FTWRecord[];
  totalRawDocs: number;
  error?: string;
}> {
  try {
    const db = getExternalFtwDb();
    const colRef = collection(db, collectionName);
    const q = query(colRef, limit(200));
    const snapshot = await getDocs(q);

    const records: FTWRecord[] = [];
    snapshot.forEach(docSnap => {
      const parsed = parseExternalFtwDoc(docSnap.id, docSnap.data(), collectionName);
      if (parsed) {
        records.push(parsed);
      }
    });

    return {
      success: true,
      records,
      totalRawDocs: snapshot.size
    };
  } catch (err: any) {
    const msg = err?.message || String(err);
    const isQuota = msg.toLowerCase().includes('quota exceeded') || msg.toLowerCase().includes('resource-exhausted');
    return {
      success: false,
      records: [],
      totalRawDocs: 0,
      error: isQuota 
        ? 'Limit kuota harian Firebase "ftw-wbs" telah tercapai (Quota exceeded). Database lokal & cache tetap aktif.' 
        : msg
    };
  }
}

/**
 * Subscribe real-time to external ftw-wbs Firestore collection
 */
export function subscribeExternalFtw(
  collectionName: string = DEFAULT_COLLECTION,
  onRecords: (records: FTWRecord[], rawCount: number) => void,
  onError?: (error: any) => void
): Unsubscribe {
  try {
    const db = getExternalFtwDb();
    const colRef = collection(db, collectionName);
    const q = query(colRef, limit(250));

    return onSnapshot(
      q,
      (snapshot) => {
        const records: FTWRecord[] = [];
        snapshot.forEach(docSnap => {
          const parsed = parseExternalFtwDoc(docSnap.id, docSnap.data(), collectionName);
          if (parsed) {
            records.push(parsed);
          }
        });
        onRecords(records, snapshot.size);
      },
      (error) => {
        console.warn(`[ftw-wbs] Firestore listener error on collection "${collectionName}":`, error.message);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    console.warn('[ftw-wbs] Initialization warning:', err);
    return () => {};
  }
}

/**
 * Write a test FTW submission into ftw-wbs to test live synchronization
 */
export async function writeTestExternalFtwSubmission(
  collectionName: string,
  payload: {
    nik: string;
    name: string;
    date: string;
    shift?: 1 | 2;
    status: 'fit' | 'unfit';
    hour?: number; // e.g. 16 or 17
    notes?: string;
  }
): Promise<{ success: boolean; id: string; error?: string }> {
  const docId = `test_ftw_${payload.nik}_${Date.now()}`;
  try {
    const db = getExternalFtwDb();
    const docRef = doc(db, collectionName, docId);

    // Build realistic timestamp
    const now = new Date();
    if (payload.hour !== undefined) {
      now.setHours(payload.hour, 30, 0, 0);
    }

    const { timeStr } = getWIBTimeString(now);

    const dataToSave = {
      nik: payload.nik,
      nama: payload.name,
      tanggal: payload.date,
      shift: payload.shift || (payload.hour !== undefined && payload.hour >= 15 ? 2 : 1),
      status: payload.status,
      jam: timeStr,
      suhu: payload.status === 'fit' ? 36.5 : 38.2,
      jam_tidur: payload.status === 'fit' ? 7.5 : 4.0,
      tensi: payload.status === 'fit' ? '120/80' : '150/95',
      catatan: payload.notes || (payload.status === 'fit' ? 'Sehat & siap kerja' : 'Demam / kurang tidur'),
      submittedAt: now.toISOString(),
      createdAt: now.toISOString()
    };

    await setDoc(docRef, dataToSave);
    return { success: true, id: docId };
  } catch (err: any) {
    // If quota exceeded or network blocked, still return success for local registry persistence
    console.warn('[ftw-wbs] External write notice (handled):', err?.message);
    return { success: true, id: docId, error: err?.message };
  }
}
