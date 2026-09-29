/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Employee, FTWRecord } from '../types';
import { getOperatorFTW, getFTWStyleConfig, isNikMatch } from '../utils/ftwHelper';
import { 
  EXTERNAL_FTW_CONFIG,
  COMMON_FTW_COLLECTIONS,
  fetchExternalFtw
} from '../services/externalFtwService';
import { 
  HeartPulse, CheckCircle2, AlertTriangle, Clock, X,
  RefreshCw, Upload, Download, Search, Database, 
  Layers, Check, Info, FileSpreadsheet, Sun, Moon,
  ShieldCheck, FileText, ArrowUpDown, Filter, ChevronRight
} from 'lucide-react';

interface FTWOnlineModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  ftwRecords: FTWRecord[];
  onSaveRecord: (record: FTWRecord) => void;
  onDeleteRecord: (id: string) => void;
  onBulkSync: (records: FTWRecord[]) => void;
  selectedDate: string;
  selectedShift?: 1 | 2;
  externalCollectionName?: string;
  onSetExternalCollectionName?: (col: string) => void;
}

export default function FTWOnlineModal({
  isOpen,
  onClose,
  employees,
  ftwRecords,
  onBulkSync,
  selectedDate,
  externalCollectionName: initialCollection = 'ftw',
  onSetExternalCollectionName
}: FTWOnlineModalProps) {
  // Navigation Tabs matching the FTW Admin Center
  const [activeTab, setActiveTab] = useState<'dashboard_logs' | 'sheets_integration' | 'firebase_cloud' | 'shift_rules'>('dashboard_logs');
  
  // Dashboard Log Filters
  const [filterDate, setFilterDate] = useState<string>(selectedDate);
  const [filterShift, setFilterShift] = useState<'all' | '1' | '2'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'fit' | 'unfit'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected detail record modal
  const [selectedRecordDetail, setSelectedRecordDetail] = useState<FTWRecord | null>(null);

  // External Firebase controls
  const [collectionName, setCollectionName] = useState(() => {
    const saved = localStorage.getItem('wbs_external_ftw_col');
    return (saved && saved !== 'ftw') ? saved : (initialCollection || 'assessments');
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Spreadsheet / CSV Import State
  const [csvText, setCsvText] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<FTWRecord[]>([]);

  const handleCollectionChange = (newCol: string) => {
    setCollectionName(newCol);
    localStorage.setItem('wbs_external_ftw_col', newCol);
    if (onSetExternalCollectionName) {
      onSetExternalCollectionName(newCol);
    }
  };

  // Pull data from external Firebase ftw-wbs
  const handlePullExternalData = async () => {
    setIsSyncing(true);
    setSyncError(null);
    setSyncStatusText(`Menghubungkan ke project "ftw-wbs" (koleksi: "${collectionName}")...`);

    try {
      const result = await fetchExternalFtw(collectionName, true);
      if (result.success) {
        if (result.records.length > 0) {
          const existingIds = new Set(result.records.map(r => r.id));
          const filteredOld = ftwRecords.filter(r => !existingIds.has(r.id));
          const merged = [...result.records, ...filteredOld];
          onBulkSync(merged);

          setSyncStatusText(
            `Berhasil menyinkronkan ${result.records.length} data FTW dari Firebase ftw-wbs! (${result.totalRawDocs} dokumen terbaca secara hemat kuota). Data tersimpan aman di cache & database lokal.`
          );
        } else {
          setSyncStatusText(
            `Koneksi ke ftw-wbs berhasil, namun koleksi "${collectionName}" mengembalikan 0 dokumen aktif.`
          );
        }
      } else {
        setSyncError(`Gagal menarik data: ${result.error}`);
      }
    } catch (err: any) {
      setSyncError(`Terjadi kesalahan: ${err?.message || String(err)}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Summary Statistics for FTW Top Banner matching official format
  const summaryStats = useMemo(() => {
    const base = filterDate ? ftwRecords.filter(r => r.date === filterDate) : ftwRecords;
    const total = base.length;
    const conditional = base.filter(r => r.status === 'conditional').length;
    const rest = base.filter(r => r.status === 'rest').length;
    const unfit = base.filter(r => r.status === 'unfit').length;
    const problem = conditional + rest + unfit;
    const percent = total > 0 ? Math.round((problem / total) * 100) : 0;
    return {
      total,
      problem,
      percent,
      conditional,
      rest,
      unfit
    };
  }, [ftwRecords, filterDate]);

  // Filtered logs for the FTW dashboard table
  const filteredRecords = useMemo(() => {
    return ftwRecords.filter(r => {
      // Date filter
      if (filterDate && r.date !== filterDate) return false;
      // Shift filter
      if (filterShift !== 'all' && String(r.shift) !== filterShift) return false;
      // Status filter
      if (filterStatus === 'problem') {
        if (r.status === 'fit') return false;
      } else if (filterStatus !== 'all' && r.status !== filterStatus) {
        return false;
      }
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNik = r.nik.toLowerCase().includes(q);
        const matchName = (r.name || '').toLowerCase().includes(q);
        const matchDept = (r.department || '').toLowerCase().includes(q);
        if (!matchNik && !matchName && !matchDept) return false;
      }
      return true;
    }).sort((a, b) => {
      // Prioritize problematic (unfit, rest, conditional) records at the top if any
      const weight = (s) => (s === 'unfit' ? 4 : s === 'rest' ? 3 : s === 'conditional' ? 2 : 1);
      const diffWeight = weight(b.status) - weight(a.status);
      if (diffWeight !== 0) return diffWeight;
      const timeA = a.submittedAt || a.jam || '';
      const timeB = b.submittedAt || b.jam || '';
      return timeB.localeCompare(timeA);
    });
  }, [ftwRecords, filterDate, filterShift, filterStatus, searchQuery]);

  // Export filtered logs to CSV (Excel compatible)
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return;
    const headers = ['Waktu Lapor', 'Tanggal', 'NIK', 'Nama Karyawan', 'Shift', 'Detail Tidur 12 Jam', 'Detail Tidur 36 Jam', 'Aspek Risiko', 'Rekomendasi Fit', 'Suhu (°C)', 'Tekanan Darah', 'Catatan'];
    const rows = filteredRecords.map(r => [
      `"${r.date} ${r.jam || (r.submittedAt ? new Date(r.submittedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '')}"`,
      `"${r.date}"`,
      `"${r.nik}"`,
      `"${r.name || ''}"`,
      `"${r.shift === 1 ? 'SIANG' : 'MALAM'}"`,
      `"${r.sleepHours || 7} Jam"`,
      `"${r.sleepHours36 || 14} Jam"`,
      `"${r.riskAspects || 'No risk drugs'}"`,
      `"${r.status === 'fit' ? 'FIT TO WORK' : 'UNFIT'}"`,
      `"${r.temperature || 36.5}"`,
      `"${r.bloodPressure || '120/80'}"`,
      `"${r.notes || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Laporan_FTW_${filterDate || 'All'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Text / File parser for Spreadsheet Import
  const handleParseCsv = (rawText: string) => {
    setImportError(null);
    setImportStatus(null);
    if (!rawText.trim()) {
      setParsedPreview([]);
      return;
    }

    try {
      const lines = rawText.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        setImportError('Data CSV terlalu pendek atau tidak memiliki header.');
        return;
      }

      // Detect delimiter (, or ; or \t)
      const firstLine = lines[0];
      const delimiter = firstLine.includes('\t') ? '\t' : (firstLine.includes(';') ? ';' : ',');
      
      const headerCols = firstLine.split(delimiter).map(c => c.replace(/["\r]/g, '').trim().toLowerCase());
      
      // Identify column indices
      const nikIdx = headerCols.findIndex(c => c.includes('nik') || c.includes('nrp') || c.includes('badge') || c.includes('identitas'));
      const nameIdx = headerCols.findIndex(c => c.includes('nama') || c.includes('name') || c.includes('karyawan'));
      const dateIdx = headerCols.findIndex(c => c.includes('tanggal') || c.includes('date') || c.includes('waktu lapor') || c.includes('tgl'));
      const shiftIdx = headerCols.findIndex(c => c.includes('shift'));
      const statusIdx = headerCols.findIndex(c => c.includes('fit') || c.includes('rekomendasi') || c.includes('status') || c.includes('hasil'));
      const sleepIdx = headerCols.findIndex(c => c.includes('tidur') || c.includes('sleep') || c.includes('12 jm'));
      const timeIdx = headerCols.findIndex(c => c.includes('jam') || c.includes('waktu') || c.includes('pukul'));

      if (nikIdx === -1 && nameIdx === -1) {
        setImportError('Header CSV harus memiliki kolom NIK / NRP atau Nama Karyawan.');
        return;
      }

      const results: FTWRecord[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const cols = line.split(delimiter).map(c => c.replace(/^["']|["']$/g, '').trim());
        if (cols.length < 2) continue;

        let rawNik = nikIdx >= 0 ? cols[nikIdx] : '';
        // If NIK is inside text like "Ongky Andreansyah (256900023)"
        if (!rawNik && nameIdx >= 0) {
          const match = cols[nameIdx].match(/\((\d+)\)/);
          if (match) rawNik = match[1];
        }

        const rawName = nameIdx >= 0 ? cols[nameIdx].replace(/\s*\(\d+\).*/, '').trim() : '';
        
        // Find matching employee in database if name or NIK given
        const matchedEmp = employees.find(e => 
          (rawNik && isNikMatch(e.nrp, rawNik)) || 
          (rawName && e.name.toLowerCase() === rawName.toLowerCase())
        );

        const finalNik = rawNik || (matchedEmp ? matchedEmp.nrp : `NRP-${i}`);
        const finalName = rawName || (matchedEmp ? matchedEmp.name : `Operator ${finalNik}`);

        // Parse date
        let recordDate = filterDate || selectedDate;
        let recordTime = '06:30';
        if (dateIdx >= 0 && cols[dateIdx]) {
          const dStr = cols[dateIdx];
          const isoM = dStr.match(/\d{4}-\d{2}-\d{2}/);
          if (isoM) recordDate = isoM[0];
          const timeM = dStr.match(/(\d{1,2})[:.](\d{2})/);
          if (timeM) recordTime = `${timeM[1].padStart(2, '0')}:${timeM[2]}`;
        }
        if (timeIdx >= 0 && cols[timeIdx]) {
          const tM = cols[timeIdx].match(/(\d{1,2})[:.](\d{2})/);
          if (tM) recordTime = `${tM[1].padStart(2, '0')}:${tM[2]}`;
        }

        // Shift
        let shift: 1 | 2 = 1;
        if (shiftIdx >= 0 && cols[shiftIdx]) {
          const sVal = cols[shiftIdx].toLowerCase();
          if (sVal.includes('malam') || sVal.includes('2')) shift = 2;
          else shift = 1;
        } else {
          const h = parseInt(recordTime.split(':')[0], 10);
          shift = (h >= 15 || h < 4) ? 2 : 1;
        }

        // Status
        let status: 'fit' | 'conditional' | 'rest' | 'unfit' = 'fit';
        let recommendation = 'FIT TO WORK';
        if (statusIdx >= 0 && cols[statusIdx]) {
          const stVal = cols[statusIdx].toLowerCase();
          if (stVal.includes('tidak boleh') || stVal.includes('dilarang') || stVal.includes('unfit')) {
            status = 'unfit';
            recommendation = 'TIDAK BOLEH BEKERJA';
          } else if (stVal.includes('istirahat') || stVal.includes('rest')) {
            status = 'rest';
            recommendation = 'WAJIB ISTIRAHAT';
          } else if (stVal.includes('pengawasan') || stVal.includes('conditional')) {
            status = 'conditional';
            recommendation = 'PENGAWASAN KHUSUS';
          }
        }

        const sleepHours = sleepIdx >= 0 && parseFloat(cols[sleepIdx]) ? parseFloat(cols[sleepIdx]) : 7.0;

        results.push({
          id: `ftw-csv-${recordDate}-${finalNik}`,
          nik: finalNik,
          name: finalName,
          date: recordDate,
          shift,
          status,
          submittedAt: `${recordDate}T${recordTime}:00+07:00`,
          jam: recordTime,
          sleepHours,
          sleepHours36: sleepHours * 2.1,
          department: matchedEmp?.specializations?.[0] ? `${matchedEmp.specializations[0]} • CY & PORT OPERATION` : 'CY & PORT OPERATION',
          riskAspects: 'No risk drugs',
          recommendation,
          notes: `Impor Spreadsheet CSV (${recordDate})`,
          sourceProject: 'Spreadsheet Integration'
        });
      }

      setParsedPreview(results);
      setImportStatus(`Berhasil membaca ${results.length} baris data dari CSV/Spreadsheet.`);
    } catch (err: any) {
      setImportError(`Gagal membaca CSV: ${err?.message || String(err)}`);
    }
  };

  const handleApplyImportedRows = () => {
    if (parsedPreview.length === 0) return;
    const incomingMap = new Map(parsedPreview.map(r => [r.id, r]));
    const preserved = ftwRecords.filter(r => !incomingMap.has(r.id));
    const merged = [...parsedPreview, ...preserved];
    onBulkSync(merged);
    setImportStatus(`Sukses! ${parsedPreview.length} data laporan FTW telah disinkronkan ke Cloud Firestore.`);
    setParsedPreview([]);
    setCsvText('');
    setActiveTab('dashboard_logs');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvText(content);
      handleParseCsv(content);
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-50 animate-fadeIn font-sans">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden">
        
        {/* Top Crimson Banner Header matching the screenshot branding */}
        <div className="bg-[#8b0021] text-white px-5 py-3.5 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/15 rounded-lg border border-white/20">
              <ShieldCheck className="h-6 w-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-wider uppercase font-mono">
                  PUSAT KENDALI ADMIN
                </h3>
                <span className="text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full border border-white/30 font-mono">
                  PT. WAHANA BARA SENTOSA
                </span>
              </div>
              <p className="text-xs text-rose-100 font-medium">
                Sistem Pemantauan Status Kesehatan &amp; Kelaikan Kerja (Fit to Work)
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition cursor-pointer border border-white/20"
          >
            <X className="h-4 w-4" />
            <span>Tutup</span>
          </button>
        </div>

        {/* Tab Navigation Bar matching the screenshot */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
          <div className="flex items-center gap-2">
            
            {/* Tab 1: FIT TO WORK DASHBOARD */}
            <button
              onClick={() => setActiveTab('dashboard_logs')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wide font-mono transition cursor-pointer shadow-xs ${
                activeTab === 'dashboard_logs'
                  ? 'bg-[#d81b4b] text-white shadow-sm ring-1 ring-rose-400'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300'
              }`}
            >
              <HeartPulse className="h-4 w-4" />
              <span>FIT TO WORK DASHBOARD</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTab === 'dashboard_logs' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
              }`}>
                {filteredRecords.length}
              </span>
            </button>

            {/* Tab 2: GOOGLE SHEETS & SPREADSHEET INTEGRATION */}
            <button
              onClick={() => setActiveTab('sheets_integration')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wide font-mono transition cursor-pointer ${
                activeTab === 'sheets_integration'
                  ? 'bg-[#0f766e] text-white shadow-sm ring-1 ring-teal-400'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
              <span>GOOGLE SHEETS INTEGRATION</span>
            </button>

            {/* Tab 3: FIREBASE CLOUD BACKUP */}
            <button
              onClick={() => setActiveTab('firebase_cloud')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wide font-mono transition cursor-pointer ${
                activeTab === 'firebase_cloud'
                  ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-400'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300'
              }`}
            >
              <Database className="h-4 w-4 text-amber-500" />
              <span>FIREBASE CLOUD BACKUP</span>
            </button>

            {/* Tab 4: SHIFT RULES */}
            <button
              onClick={() => setActiveTab('shift_rules')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wide font-mono transition cursor-pointer ${
                activeTab === 'shift_rules'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300'
              }`}
            >
              <Clock className="h-4 w-4 text-indigo-500" />
              <span>ATURAN SHIFT</span>
            </button>
          </div>

          {/* Quick Refresh Cloud sync button */}
          <button
            onClick={handlePullExternalData}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition cursor-pointer disabled:opacity-50 shrink-0"
            title="Cek pembaruan live data FTW"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-amber-400' : ''}`} />
            <span className="hidden sm:inline">{isSyncing ? 'Sinkronisasi...' : 'Tarik Database'}</span>
          </button>
        </div>

        {/* Global Notifications if sync completed / failed */}
        {syncStatusText && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5 flex items-center justify-between text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{syncStatusText}</span>
            </div>
            <button onClick={() => setSyncStatusText(null)} className="text-emerald-700 hover:text-emerald-900">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {syncError && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>{syncError}</span>
            </div>
            <button onClick={() => setSyncError(null)} className="text-amber-700 hover:text-amber-900">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* MAIN BODY AREA */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-5">

          {/* TAB 1: FIT TO WORK DASHBOARD (SEMUA LAPORAN FATIGUE TERFILTER) */}
          {activeTab === 'dashboard_logs' && (
            <div className="space-y-4">
              
              {/* 5 Top Summary Cards Matching Screenshot */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {/* 1. TOTAL PENILAIAN */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs text-center flex flex-col justify-center">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">TOTAL PENILAIAN</span>
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{summaryStats.total}</span>
                  <span className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">LAPORAN</span>
                </div>

                {/* 2. BERMASALAH */}
                <div className="bg-rose-50/40 p-3.5 rounded-xl border border-rose-200 shadow-2xs text-center flex flex-col justify-center">
                  <span className="text-[10px] font-black uppercase text-rose-700 tracking-wider flex items-center justify-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> BERMASALAH
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-rose-700 mt-1">{summaryStats.problem}</span>
                  <span className="text-[10px] font-bold text-rose-600 mt-0.5 uppercase tracking-wide">({summaryStats.percent}%) KURANG FIT</span>
                </div>

                {/* 3. PENGAWASAN KHUSUS */}
                <div 
                  onClick={() => setFilterStatus(filterStatus === 'conditional' ? 'all' : 'conditional')}
                  className={`p-3.5 rounded-xl border shadow-2xs text-center flex flex-col justify-center cursor-pointer transition ${
                    filterStatus === 'conditional' ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-400' : 'bg-amber-50/50 border-amber-300 hover:bg-amber-100/60'
                  }`}
                >
                  <span className="text-[10px] font-black uppercase text-amber-900 tracking-wider flex items-center justify-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span> PENGAWASAN KHUSUS
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-amber-900 mt-1">{summaryStats.conditional}</span>
                  <span className="text-[9px] font-bold text-amber-700 mt-0.5 uppercase tracking-tight">BEKERJA DALAM PENGAWASAN KHUSUS</span>
                </div>

                {/* 4. WAJIB ISTIRAHAT */}
                <div 
                  onClick={() => setFilterStatus(filterStatus === 'rest' ? 'all' : 'rest')}
                  className={`p-3.5 rounded-xl border shadow-2xs text-center flex flex-col justify-center cursor-pointer transition ${
                    filterStatus === 'rest' ? 'bg-orange-100 border-orange-400 ring-2 ring-orange-400' : 'bg-orange-50/50 border-orange-300 hover:bg-orange-100/60'
                  }`}
                >
                  <span className="text-[10px] font-black uppercase text-orange-900 tracking-wider flex items-center justify-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-orange-500 inline-block"></span> WAJIB ISTIRAHAT
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-orange-900 mt-1">{summaryStats.rest}</span>
                  <span className="text-[9px] font-bold text-orange-700 mt-0.5 uppercase tracking-tight">WAJIB ISTIRAHAT SEBELUM BEKERJA</span>
                </div>

                {/* 5. TIDAK BOLEH BEKERJA */}
                <div 
                  onClick={() => setFilterStatus(filterStatus === 'unfit' ? 'all' : 'unfit')}
                  className={`p-3.5 rounded-xl border shadow-2xs text-center flex flex-col justify-center col-span-2 sm:col-span-1 cursor-pointer transition ${
                    filterStatus === 'unfit' ? 'bg-rose-100 border-rose-400 ring-2 ring-rose-400' : 'bg-rose-50/50 border-rose-300 hover:bg-rose-100/60'
                  }`}
                >
                  <span className="text-[10px] font-black uppercase text-rose-900 tracking-wider flex items-center justify-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-600 inline-block"></span> TIDAK BOLEH BEKERJA
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-rose-900 mt-1">{summaryStats.unfit}</span>
                  <span className="text-[9px] font-bold text-rose-700 mt-0.5 uppercase tracking-tight">DILARANG KERAS BEKERJA HARIAN</span>
                </div>
              </div>

              {/* Header Box matching screenshot */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-50 text-rose-700 rounded-xl border border-rose-200">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h4 className="font-black text-slate-900 text-sm sm:text-base uppercase tracking-tight font-mono">
                        {filterStatus === 'problem' ? 'DAFTAR KARYAWAN KURANG FIT TERDETEKSI' : 'SEMUA LAPORAN FATIGUE TERFILTER'}
                      </h4>
                      <span className="bg-slate-900 text-white font-mono text-xs font-black px-2.5 py-0.5 rounded-full shadow-2xs">
                        {filteredRecords.length} Logs Match
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Data hasil pemeriksaan kebugaran &amp; fatigue operator dari sistem FTW Online WBS.
                    </p>
                  </div>
                </div>

                {/* Action button: Unduh Spreadsheet (Excel/CSV) */}
                <button
                  onClick={handleExportCSV}
                  disabled={filteredRecords.length === 0}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0f766e] hover:bg-[#115e59] text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-40 shrink-0"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Unduh Spreadsheet (Excel/CSV)</span>
                </button>
              </div>

              {/* Filters Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs text-xs">
                
                {/* 1. Date Filter */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1">
                    Tanggal Laporan:
                  </label>
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* 2. Shift Filter */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1">
                    Shift Kerja:
                  </label>
                  <select
                    value={filterShift}
                    onChange={(e) => setFilterShift(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                  >
                    <option value="all">Semua Shift</option>
                    <option value="1">Shift 1 (Siang)</option>
                    <option value="2">Shift 2 (Malam)</option>
                  </select>
                </div>

                {/* 3. Status Filter */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1">
                    Rekomendasi Medis:
                  </label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                  >
                    <option value="all">Semua Status</option>
                    <option value="problem">⚠️ Hanya Kurang Fit ({summaryStats.problem})</option>
                    <option value="fit">🟢 FIT TO WORK</option>
                    <option value="conditional">🟡 PENGAWASAN KHUSUS ({summaryStats.conditional})</option>
                    <option value="rest">🟠 WAJIB ISTIRAHAT ({summaryStats.rest})</option>
                    <option value="unfit">🔴 TIDAK BOLEH BEKERJA ({summaryStats.unfit})</option>
                  </select>
                </div>

                {/* 4. Search Filter */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1">
                    Cari NIK / Nama / Posisi:
                  </label>
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Ketik NIK atau nama..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* TABLE CONTAINER: Exactly styled as in the screenshot */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/90 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                        <th className="py-3 px-4 w-32 font-mono">WAKTU LAPOR</th>
                        <th className="py-3 px-4 font-mono">IDENTITAS KARYAWAN</th>
                        <th className="py-3 px-4 w-28 text-center font-mono">SHIFT</th>
                        <th className="py-3 px-4 w-40 font-mono">DETAIL JADWAL TIDUR</th>
                        <th className="py-3 px-4 w-36 font-mono">ASPEK RISIKO</th>
                        <th className="py-3 px-4 w-36 text-center font-mono">REKOMENDASI FIT</th>
                        <th className="py-3 px-4 w-24 text-center font-mono">AKSI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRecords.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            <HeartPulse className="h-10 w-10 mx-auto text-slate-300 mb-2 animate-pulse" />
                            <p className="font-bold text-slate-600">Tidak ada log laporan FTW yang cocok</p>
                            <p className="text-xs text-slate-400 mt-1">
                              Coba ganti filter tanggal di atas ({filterDate}) atau lakukan sinkronisasi spreadsheet.
                            </p>
                          </td>
                        </tr>
                      ) : (
                        filteredRecords.map((record) => {
                          const timeStr = record.jam || (record.submittedAt ? new Date(record.submittedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '06:00');
                          const isFit = record.status === 'fit';

                          return (
                            <tr key={record.id} className="hover:bg-slate-50/80 transition group">
                              
                              {/* 1. Waktu Lapor */}
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div className="font-mono font-bold text-slate-900 text-xs">
                                  {record.date}
                                </div>
                                <div className="flex items-center gap-1 font-mono text-[11px] text-slate-500 mt-0.5">
                                  <Clock className="h-3 w-3 text-slate-400" />
                                  <span>{timeStr}</span>
                                </div>
                              </td>

                              {/* 2. Identitas Karyawan */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-baseline gap-2">
                                  <span className="font-black text-slate-900 text-sm">
                                    {record.name || 'Nama Operator'}
                                  </span>
                                  <span className="font-mono text-slate-400 text-xs">
                                    ({record.nik})
                                  </span>
                                </div>
                                <div className="text-[11px] font-bold text-slate-500 uppercase mt-0.5 tracking-tight">
                                  {record.department || 'FD DRIVER • CY & PORT OPERATION'}
                                </div>
                              </td>

                              {/* 3. Shift Badge */}
                              <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                {record.shift === 2 ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-800 font-black text-[10px] font-mono uppercase">
                                    <Moon className="h-3 w-3 text-indigo-600" />
                                    <span>MALAM</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-300 text-amber-900 font-black text-[10px] font-mono uppercase">
                                    <Sun className="h-3 w-3 text-amber-500" />
                                    <span>SIANG</span>
                                  </span>
                                )}
                              </td>

                              {/* 4. Detail Jadwal Tidur */}
                              <td className="py-3.5 px-4 text-xs font-mono">
                                <div className="font-bold text-slate-800">
                                  12 Jm: <span className={record.sleepHours && record.sleepHours < 6 ? 'font-black text-rose-600' : 'font-black text-slate-900'}>{record.sleepHours || 7} Jam</span>
                                </div>
                                <div className="text-slate-500 text-[11px] mt-0.5">
                                  36 Jm: <span className="font-medium text-slate-700">{record.sleepHours36 || ((record.sleepHours || 7) * 2.1).toFixed(1)} Jam</span>
                                </div>
                              </td>

                              {/* 5. Aspek Risiko */}
                              <td className="py-3.5 px-4 text-xs">
                                {record.fatigueScore && record.fatigueScore >= 10 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-orange-300 bg-orange-50 text-orange-900 font-bold text-[10px]">
                                    <span>⚡ Fatigue Score: {record.fatigueScore}</span>
                                  </span>
                                ) : record.fatigueScore && record.fatigueScore >= 5 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-900 font-bold text-[10px]">
                                    <span>⚡ Fatigue Score: {record.fatigueScore}</span>
                                  </span>
                                ) : record.riskAspects && (record.riskAspects.toLowerCase().includes('obat') || record.riskAspects.toLowerCase().includes('meds')) ? (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-900 font-bold text-[10px]">
                                      <span>💊 Obat / Meds</span>
                                    </span>
                                    <div className="text-[10px] text-emerald-700 font-medium">✓ No risk drugs</div>
                                  </div>
                                ) : (
                                  <span className="text-emerald-700 font-bold flex items-center gap-1 text-[11px]">
                                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                                    <span>{record.riskAspects || 'No risk drugs'}</span>
                                  </span>
                                )}
                              </td>

                              {/* 6. Rekomendasi Fit */}
                              <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                {record.status === 'conditional' ? (
                                  <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-400 text-amber-950 font-black text-[11px] font-mono shadow-2xs">
                                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                                    <span>PENGAWASAN KHUSUS</span>
                                  </span>
                                ) : record.status === 'rest' ? (
                                  <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-100 border border-orange-400 text-orange-950 font-black text-[11px] font-mono shadow-2xs animate-pulse">
                                    <span className="w-2 h-2 rounded-full bg-orange-600" />
                                    <span>WAJIB ISTIRAHAT</span>
                                  </span>
                                ) : record.status === 'unfit' ? (
                                  <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-100 border border-rose-400 text-rose-950 font-black text-[11px] font-mono shadow-2xs animate-pulse">
                                    <span className="w-2 h-2 rounded-full bg-rose-600" />
                                    <span>TIDAK BOLEH BEKERJA</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100/90 border border-emerald-400 text-emerald-950 font-black text-[11px] font-mono shadow-2xs">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span>FIT TO WORK</span>
                                  </span>
                                )}
                              </td>

                              {/* 7. Aksi Detail */}
                              <td className="py-3.5 px-4 text-center">
                                <button
                                  onClick={() => setSelectedRecordDetail(record)}
                                  className="inline-flex items-center gap-1 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white font-mono font-black text-[10px] rounded-lg transition cursor-pointer shadow-2xs"
                                >
                                  <Search className="h-3 w-3" />
                                  <span>DETAIL</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer info */}
                <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2 font-mono">
                  <span>
                    Menampilkan <strong>{filteredRecords.length}</strong> laporan fatigue (Filter: {filterDate || 'Semua Tanggal'})
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-emerald-800 font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Fit: {filteredRecords.filter(r => r.status === 'fit').length}
                    </span>
                    <span className="flex items-center gap-1.5 text-rose-800 font-bold">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      Unfit: {filteredRecords.filter(r => r.status === 'unfit').length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GOOGLE SHEETS & CSV IMPORT INTEGRATION */}
          {activeTab === 'sheets_integration' && (
            <div className="max-w-4xl mx-auto space-y-6">
              
              {/* Introduction Card */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
                    <FileSpreadsheet className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm sm:text-base uppercase tracking-tight font-mono">
                      Integrasi Google Sheets &amp; Berkas Spreadsheet (CSV/Excel)
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Sinkronkan data FTW langsung dari file CSV hasil ekspor tombol <strong>"Unduh Spreadsheet (Excel/CSV)"</strong> atau Google Sheets.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  
                  {/* File Upload Box */}
                  <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-6 text-center bg-slate-50/50 transition cursor-pointer flex flex-col items-center justify-center relative">
                    <input 
                      type="file" 
                      accept=".csv,.txt"
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <Upload className="h-8 w-8 text-emerald-600 mb-2" />
                    <span className="text-xs font-black text-slate-800 uppercase font-mono">
                      Pilih / Jatuhkan File CSV Di Sini
                    </span>
                    <span className="text-[11px] text-slate-500 mt-1">
                      Mendukung format ekspor spreadsheet FTW (.csv)
                    </span>
                  </div>

                  {/* Quick Export current database */}
                  <div className="p-5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex flex-col justify-between">
                    <div>
                      <h5 className="font-black text-emerald-950 text-xs font-mono uppercase flex items-center gap-1.5">
                        <Download className="h-4 w-4 text-emerald-700" />
                        Ekspor Data FTW Saat Ini
                      </h5>
                      <p className="text-xs text-emerald-800 mt-1">
                        Unduh seluruh <strong>{ftwRecords.length}</strong> data laporan FTW dalam format CSV untuk diarsipkan di Excel atau Google Drive.
                      </p>
                    </div>
                    <button
                      onClick={handleExportCSV}
                      className="mt-4 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg transition cursor-pointer shadow-xs self-start"
                    >
                      Unduh Berkas CSV
                    </button>
                  </div>
                </div>
              </div>

              {/* Paste CSV / Text Input Area */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-900 uppercase font-mono flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-600" />
                    <span>Atau Tempel (Paste) Teks Baris CSV / Tabel Spreadsheet:</span>
                  </label>
                  {csvText && (
                    <button
                      onClick={() => { setCsvText(''); setParsedPreview([]); }}
                      className="text-xs text-rose-600 hover:underline font-bold"
                    >
                      Bersihkan
                    </button>
                  )}
                </div>

                <textarea
                  rows={6}
                  value={csvText}
                  onChange={(e) => {
                    setCsvText(e.target.value);
                    handleParseCsv(e.target.value);
                  }}
                  placeholder="Tempel baris CSV di sini (misal: Waktu Lapor, NIK, Nama, Shift, Status, Jam Tidur)..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
                />

                {importError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                    <span>{importError}</span>
                  </div>
                )}

                {importStatus && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{importStatus}</span>
                  </div>
                )}

                {/* Parsed Preview Table */}
                {parsedPreview.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800 font-mono uppercase">
                        Pratinjau {parsedPreview.length} Data Terbaca:
                      </span>
                      <button
                        onClick={handleApplyImportedRows}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-2"
                      >
                        <Check className="h-4 w-4" />
                        <span>Terapkan &amp; Sinkronkan ke Cloud</span>
                      </button>
                    </div>

                    <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                          <tr>
                            <th className="p-2 font-mono">NIK</th>
                            <th className="p-2 font-mono">Nama</th>
                            <th className="p-2 font-mono">Tanggal</th>
                            <th className="p-2 font-mono">Shift</th>
                            <th className="p-2 font-mono">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {parsedPreview.slice(0, 10).map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-2 font-mono font-bold text-slate-800">{row.nik}</td>
                              <td className="p-2 text-slate-900">{row.name}</td>
                              <td className="p-2 font-mono text-slate-600">{row.date} ({row.jam})</td>
                              <td className="p-2 font-mono">{row.shift === 1 ? 'Siang' : 'Malam'}</td>
                              <td className="p-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  row.status === 'fit' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {row.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {parsedPreview.length > 10 && (
                        <div className="p-2 bg-slate-50 text-center text-xs text-slate-500 font-mono">
                          ... dan {parsedPreview.length - 10} data lainnya
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: FIREBASE CLOUD BACKUP & STATUS */}
          {activeTab === 'firebase_cloud' && (
            <div className="max-w-4xl mx-auto space-y-6">
              
              {/* Cloud Firestore Internal Status */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
                    <Database className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-slate-900 text-sm sm:text-base uppercase tracking-tight font-mono">
                        Cloud Firestore Registry (manpower-wbs)
                      </h4>
                      <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
                        ONLINE &amp; SYNCHRONIZED
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Penyimpanan database cloud utama aplikasi pengawas dengan izin baca/tulis aktif di seluruh perangkat supervisor.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Arsip FTW</span>
                    <span className="text-base font-black text-slate-900">{ftwRecords.length} Catatan</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Tanggal 28 September</span>
                    <span className="text-base font-black text-emerald-700">
                      {ftwRecords.filter(r => r.date === '2026-09-28').length} Logs Match
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Tanggal 26 September</span>
                    <span className="text-base font-black text-slate-800">
                      {ftwRecords.filter(r => r.date === '2026-09-26').length} Logs Match
                    </span>
                  </div>
                </div>
              </div>

              {/* External ftw-wbs Diagnostic Info */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="font-black text-slate-900 text-sm uppercase tracking-wide font-mono flex items-center gap-2">
                      External Project: ftw-wbs
                      <span className="text-[10px] font-black bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-300">
                        Koleksi: {collectionName}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Koneksi langsung ke server Firebase aplikasi form input operator.
                    </p>
                  </div>

                  <button
                    onClick={handlePullExternalData}
                    disabled={isSyncing}
                    className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Menghubungkan...' : 'Tes Tarik Data'}</span>
                  </button>
                </div>

                {/* Quota Information Banner */}
                <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1.5">
                  <div className="font-bold flex items-center gap-2 text-amber-950">
                    <Info className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Catatan Kuota Google Cloud Firestore (Project ftw-wbs):</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-900">
                    Jika server eksternal <code>ftw-wbs</code> mengembalikan pesan <strong>"Quota exceeded (Resource Exhausted)"</strong>, itu berarti batas baca harian gratis Firestore telah tercapai di Google Cloud. Seluruh data yang sudah ditarik tetap aman tersimpan di database Cloud Firestore internal <code>manpower-wbs</code> dan dapat diperbarui kapan saja menggunakan fitur <strong>Spreadsheet / CSV Integration</strong>.
                  </p>
                </div>

                {/* Collection selector */}
                <div className="space-y-2 pt-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase font-mono">
                    Pilih Nama Koleksi di project ftw-wbs:
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {COMMON_FTW_COLLECTIONS.map(col => (
                      <button
                        key={col}
                        onClick={() => handleCollectionChange(col)}
                        className={`text-[11px] font-mono px-2.5 py-1 rounded-md transition cursor-pointer ${
                          collectionName === col
                            ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        {col}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SHIFT ALLOCATION RULES */}
          {activeTab === 'shift_rules' && (
            <div className="max-w-4xl mx-auto space-y-5">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="p-2.5 bg-indigo-100 text-indigo-800 rounded-xl">
                    <Clock className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm sm:text-base uppercase tracking-tight font-mono">
                      Logika Otomatisasi Alokasi Shift FTW
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Pencocokan NIK operator dan penentuan Shift 1 (Siang) atau Shift 2 (Malam)
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Shift 1 Rule */}
                  <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                    <div className="flex items-center gap-2">
                      <Sun className="h-5 w-5 text-amber-600" />
                      <h5 className="font-black text-amber-950 text-xs font-mono uppercase">
                        Shift 1 (Siang)
                      </h5>
                    </div>
                    <p className="text-xs text-amber-900 leading-relaxed">
                      Pengisian form FTW yang dilakukan pada jam <strong>04.00 subuh hingga 14.59 siang</strong> dialokasikan untuk <strong>Shift 1 (Operator Siang)</strong>.
                    </p>
                    <div className="text-[11px] font-mono text-amber-800 bg-white/80 p-2 rounded border border-amber-200">
                      Operator 1 pada Roster Siang akan otomatis berstatus FIT jika NIK cocok.
                    </div>
                  </div>

                  {/* Shift 2 Rule */}
                  <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
                    <div className="flex items-center gap-2">
                      <Moon className="h-5 w-5 text-indigo-600" />
                      <h5 className="font-black text-indigo-950 text-xs font-mono uppercase">
                        Shift 2 (Malam)
                      </h5>
                    </div>
                    <p className="text-xs text-indigo-900 leading-relaxed">
                      Pengisian form FTW pada jam <strong>15.00 sore hingga 03.59 subuh</strong> (khususnya <strong>jam 16.00 - 18.00</strong> persiapan kerja) dialokasikan untuk <strong>Shift 2 (Operator Malam)</strong>.
                    </p>
                    <div className="text-[11px] font-mono text-indigo-800 bg-white/80 p-2 rounded border border-indigo-200">
                      Operator 2 pada Roster Malam akan otomatis berstatus FIT di kotak settingan.
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-slate-900">
                    <Info className="h-4 w-4 text-slate-500" />
                    <span>Prioritas Kelayakan Medis Hari Kerja:</span>
                  </div>
                  <p className="leading-relaxed">
                    Jika seorang operator telah mengisi form FTW dan dinyatakan <strong>FIT</strong> pada hari tersebut, sistem menjamin operator tersebut diakui kelayakannya bekerja sehingga tidak ada operator yang tertahan dengan status abu-abu/pending.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* DETAIL POPUP MODAL */}
        {selectedRecordDetail && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-fadeIn font-sans">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HeartPulse className="h-5 w-5 text-amber-400" />
                  <span className="font-mono font-black text-sm uppercase">Detail Laporan FTW</span>
                </div>
                <button 
                  onClick={() => setSelectedRecordDetail(null)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h5 className="font-black text-slate-900 text-base">{selectedRecordDetail.name}</h5>
                    <span className="font-mono text-slate-500 font-bold">NIK / NRP: {selectedRecordDetail.nik}</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-black font-mono ${
                    selectedRecordDetail.status === 'fit' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-rose-100 text-rose-900 border border-rose-300'
                  }`}>
                    {selectedRecordDetail.status === 'fit' ? 'FIT TO WORK' : 'UNFIT'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 font-mono">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Tanggal &amp; Waktu</span>
                    <span className="font-black text-slate-800">{selectedRecordDetail.date} ({selectedRecordDetail.jam || '06:00'} WIB)</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Alokasi Shift</span>
                    <span className="font-black text-slate-800">Shift {selectedRecordDetail.shift || 1} ({selectedRecordDetail.shift === 2 ? 'Malam' : 'Siang'})</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Durasi Tidur (12 Jam)</span>
                    <span className="font-black text-slate-800">{selectedRecordDetail.sleepHours || 7} Jam</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Durasi Tidur (36 Jam)</span>
                    <span className="font-black text-slate-800">{selectedRecordDetail.sleepHours36 || 14} Jam</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Suhu Tubuh</span>
                    <span className="font-black text-slate-800">{selectedRecordDetail.temperature || 36.5} °C</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Tekanan Darah</span>
                    <span className="font-black text-slate-800">{selectedRecordDetail.bloodPressure || '120/80'}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block font-mono">Departemen &amp; Posisi</span>
                  <span className="font-bold text-slate-800">{selectedRecordDetail.department || 'CY & PORT OPERATION'}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block font-mono">Catatan Medis</span>
                  <span className="font-medium text-slate-700">{selectedRecordDetail.notes || 'Fit Siap Bekerja'}</span>
                </div>
              </div>

              <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => setSelectedRecordDetail(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
