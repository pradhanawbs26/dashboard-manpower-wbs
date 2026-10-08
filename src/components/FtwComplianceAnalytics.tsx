/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Employee, HeavyUnit, UnitSetting, BackupTransfer, FTWRecord } from '../types';
import { calculateShift, formatIndonesianDate, formatIndonesianDayName } from '../utils/scheduler';
import { getOperatorFTW } from '../utils/ftwHelper';
import { 
  BarChart3, TrendingDown, TrendingUp, Calendar, Filter, 
  Search, Download, UserX, CheckCircle2, AlertTriangle, 
  ShieldAlert, Clock, ChevronRight, X, ArrowUpDown, FileSpreadsheet,
  Layers, Sun, Moon, Sparkles, RefreshCw, Eye
} from 'lucide-react';

interface FtwComplianceAnalyticsProps {
  units: HeavyUnit[];
  employees: Employee[];
  settings: UnitSetting[];
  backupTransfers: BackupTransfer[];
  ftwRecords?: FTWRecord[];
  initialDate?: string;
  onOpenFTWModal?: () => void;
}

interface MissingInstance {
  date: string;
  shift: 1 | 2;
  unitCode: string;
  unitBrand?: string;
}

interface OperatorFrequencyStat {
  operator: Employee;
  totalScheduled: number;
  totalFilled: number;
  totalMissing: number;
  complianceRate: number;
  missingInstances: MissingInstance[];
  riskTier: 'high' | 'medium' | 'low';
}

interface DailyTrendStat {
  date: string;
  dayName: string;
  totalScheduled: number;
  totalFilled: number;
  totalMissing: number;
  complianceRate: number;
  missingOperators: {
    operator: Employee;
    shift: 1 | 2;
    unitCode: string;
  }[];
}

export default function FtwComplianceAnalytics({
  units,
  employees,
  settings,
  backupTransfers,
  ftwRecords = [],
  initialDate = new Date().toISOString().split('T')[0],
  onOpenFTWModal
}: FtwComplianceAnalyticsProps) {
  // Helper to format date YYYY-MM-DD
  const formatDateISO = (d: Date): string => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // State for date range (Default: last 7 days)
  const [endDate, setEndDate] = useState<string>(() => initialDate || formatDateISO(new Date()));
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date(initialDate || new Date());
    d.setDate(d.getDate() - 6);
    return formatDateISO(d);
  });

  // State for filter controls
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<'all' | '1' | '2'>('all');
  const [selectedSpecialization, setSelectedSpecialization] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [minMissingFilter, setMinMissingFilter] = useState<number>(1);
  const [sortBy, setSortBy] = useState<'missing_desc' | 'missing_asc' | 'name_asc' | 'compliance_asc'>('missing_desc');

  // Modal detail for a selected operator
  const [detailOperatorStat, setDetailOperatorStat] = useState<OperatorFrequencyStat | null>(null);

  // Selected date filter on chart click (drill-down)
  const [drillDownDate, setDrillDownDate] = useState<string | null>(null);

  // Fast maps
  const employeeMap = useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);
  const unitMap = useMemo(() => new Map(units.map(u => [u.id, u])), [units]);

  // Quick preset period handler
  const handleQuickPreset = (days: number) => {
    const end = new Date(endDate);
    const start = new Date(endDate);
    start.setDate(end.getDate() - (days - 1));
    setStartDate(formatDateISO(start));
    setDrillDownDate(null);
  };

  const handleThisMonthPreset = () => {
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    setStartDate(formatDateISO(start));
    setEndDate(formatDateISO(end));
    setDrillDownDate(null);
  };

  // Generate list of dates within range (capped at 60 days)
  const datesInRange = useMemo(() => {
    const list: string[] = [];
    if (!startDate || !endDate) return list;

    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');

    if (start > end) return [startDate];

    const curr = new Date(start);
    let count = 0;
    while (curr <= end && count < 60) {
      list.push(formatDateISO(curr));
      curr.setDate(curr.getDate() + 1);
      count++;
    }
    return list;
  }, [startDate, endDate]);

  // Compute daily trend and operator frequency statistics
  const { dailyTrendStats, operatorStats, overallKpis } = useMemo(() => {
    const operatorStatsMap = new Map<string, {
      operator: Employee;
      totalScheduled: number;
      totalFilled: number;
      totalMissing: number;
      missingInstances: MissingInstance[];
    }>();

    // Initialize operator map for all active employees
    employees.forEach(emp => {
      operatorStatsMap.set(emp.id, {
        operator: emp,
        totalScheduled: 0,
        totalFilled: 0,
        totalMissing: 0,
        missingInstances: []
      });
    });

    const dailyTrends: DailyTrendStat[] = [];
    let grandTotalScheduled = 0;
    let grandTotalFilled = 0;
    let grandTotalMissing = 0;

    const shiftsToCheck: (1 | 2)[] = selectedShiftFilter === 'all' 
      ? [1, 2] 
      : [Number(selectedShiftFilter) as 1 | 2];

    // Iterate through each date in the period
    datesInRange.forEach(dStr => {
      let dayScheduled = 0;
      let dayFilled = 0;
      let dayMissing = 0;
      const dayMissingOps: { operator: Employee; shift: 1 | 2; unitCode: string }[] = [];

      shiftsToCheck.forEach(shiftNum => {
        // Find scheduled operators from settings for this date and shift
        const scheduledOpsInThisShift = new Map<string, { operator: Employee; unitCode: string; unitBrand?: string }>();

        // 1. Settings regular assignments
        settings.forEach(setting => {
          const shiftInfo = calculateShift(setting, dStr);
          const op1 = employeeMap.get(setting.operator1Id);
          const op2 = employeeMap.get(setting.operator2Id);
          const unit = unitMap.get(setting.unitId);
          const unitLabel = unit?.unitCode || setting.masterSlotCode || 'Master Slot';
          const unitBrand = unit?.brand;

          if (shiftNum === 1) {
            if (shiftInfo.operator1Role === 'S' && op1 && op1.status === 'Active') {
              scheduledOpsInThisShift.set(op1.id, { operator: op1, unitCode: unitLabel, unitBrand });
            } else if (shiftInfo.operator2Role === 'S' && op2 && op2.status === 'Active') {
              scheduledOpsInThisShift.set(op2.id, { operator: op2, unitCode: unitLabel, unitBrand });
            }
          } else {
            if (shiftInfo.operator1Role === 'M' && op1 && op1.status === 'Active') {
              scheduledOpsInThisShift.set(op1.id, { operator: op1, unitCode: unitLabel, unitBrand });
            } else if (shiftInfo.operator2Role === 'M' && op2 && op2.status === 'Active') {
              scheduledOpsInThisShift.set(op2.id, { operator: op2, unitCode: unitLabel, unitBrand });
            }
          }
        });

        // 2. Backup Transfers adjustments
        (backupTransfers || []).forEach(bt => {
          if (bt.date === dStr && Number(bt.shift) === shiftNum) {
            const op = employeeMap.get(bt.operatorId);
            const targetUnit = unitMap.get(bt.targetUnitId);
            if (op && op.status === 'Active') {
              scheduledOpsInThisShift.set(op.id, {
                operator: op,
                unitCode: targetUnit?.unitCode || 'Relokasi Backup',
                unitBrand: targetUnit?.brand
              });
            }
          }
        });

        // Check FTW status for each scheduled operator
        scheduledOpsInThisShift.forEach(({ operator, unitCode, unitBrand }) => {
          // Check FTW submission for this operator on date & shift
          const ftw = getOperatorFTW(operator.nrp, dStr, shiftNum, ftwRecords, operator.name);
          const isPending = ftw.status === 'pending';

          dayScheduled++;
          grandTotalScheduled++;

          const opStat = operatorStatsMap.get(operator.id);
          if (opStat) {
            opStat.totalScheduled++;
            if (isPending) {
              opStat.totalMissing++;
              opStat.missingInstances.push({
                date: dStr,
                shift: shiftNum,
                unitCode,
                unitBrand
              });
            } else {
              opStat.totalFilled++;
            }
          }

          if (isPending) {
            dayMissing++;
            grandTotalMissing++;
            dayMissingOps.push({ operator, shift: shiftNum, unitCode });
          } else {
            dayFilled++;
            grandTotalFilled++;
          }
        });
      });

      const dayRate = dayScheduled > 0 ? Math.round((dayFilled / dayScheduled) * 100) : 100;

      dailyTrends.push({
        date: dStr,
        dayName: formatIndonesianDayName(dStr),
        totalScheduled: dayScheduled,
        totalFilled: dayFilled,
        totalMissing: dayMissing,
        complianceRate: dayRate,
        missingOperators: dayMissingOps
      });
    });

    // Format operator frequency stats array
    const opArray: OperatorFrequencyStat[] = [];
    operatorStatsMap.forEach(stat => {
      // If the operator was scheduled at least once
      if (stat.totalScheduled > 0) {
        const rate = Math.round((stat.totalFilled / stat.totalScheduled) * 100);
        let riskTier: 'high' | 'medium' | 'low' = 'low';
        if (stat.totalMissing >= 3) {
          riskTier = 'high';
        } else if (stat.totalMissing === 2) {
          riskTier = 'medium';
        }

        opArray.push({
          operator: stat.operator,
          totalScheduled: stat.totalScheduled,
          totalFilled: stat.totalFilled,
          totalMissing: stat.totalMissing,
          complianceRate: rate,
          missingInstances: stat.missingInstances,
          riskTier
        });
      }
    });

    const uniqueMissingEmployees = opArray.filter(o => o.totalMissing > 0).length;
    const overallComplianceRate = grandTotalScheduled > 0
      ? Math.round((grandTotalFilled / grandTotalScheduled) * 100)
      : 100;

    // Find peak non-compliance day
    let peakDay: DailyTrendStat | null = null;
    dailyTrends.forEach(d => {
      if (!peakDay || d.totalMissing > peakDay.totalMissing) {
        if (d.totalMissing > 0) {
          peakDay = d;
        }
      }
    });

    return {
      dailyTrendStats: dailyTrends,
      operatorStats: opArray,
      overallKpis: {
        totalScheduled: grandTotalScheduled,
        totalFilled: grandTotalFilled,
        totalMissing: grandTotalMissing,
        complianceRate: overallComplianceRate,
        uniqueMissingEmployees,
        peakDay
      }
    };
  }, [datesInRange, selectedShiftFilter, settings, backupTransfers, employees, units, ftwRecords, employeeMap, unitMap]);

  // Filter & sort operators
  const filteredOperators = useMemo(() => {
    let result = operatorStats.filter(item => {
      // Filter by minimum missing count
      if (item.totalMissing < minMissingFilter) return false;

      // Filter by specialization/equipment type
      if (selectedSpecialization !== 'all') {
        const hasSpec = (item.operator.specializations || []).some(
          s => s.toLowerCase().includes(selectedSpecialization.toLowerCase())
        );
        if (!hasSpec) return false;
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.operator.name.toLowerCase().includes(q);
        const matchNrp = item.operator.nrp.toLowerCase().includes(q);
        if (!matchName && !matchNrp) return false;
      }

      // Filter by drill-down date if selected
      if (drillDownDate) {
        const matchDrill = item.missingInstances.some(inst => inst.date === drillDownDate);
        if (!matchDrill) return false;
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'missing_desc') return b.totalMissing - a.totalMissing || a.complianceRate - b.complianceRate;
      if (sortBy === 'missing_asc') return a.totalMissing - b.totalMissing;
      if (sortBy === 'compliance_asc') return a.complianceRate - b.complianceRate;
      if (sortBy === 'name_asc') return a.operator.name.localeCompare(b.operator.name);
      return 0;
    });

    return result;
  }, [operatorStats, minMissingFilter, selectedSpecialization, searchQuery, drillDownDate, sortBy]);

  // All distinct specializations for filter dropdown
  const allSpecializations = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      (e.specializations || []).forEach(s => set.add(s));
    });
    return Array.from(set).sort();
  }, [employees]);

  // Export CSV handler
  const handleExportCsv = () => {
    if (filteredOperators.length === 0) return;

    const headers = ['Peringkat', 'NIK / NRP', 'Nama Operator', 'Spesialisasi Alat', 'Total Hari Bertugas', 'Jumlah Alpa FTW', '% Kepatuhan', 'Kategori Risiko', 'Daftar Tanggal Alpa'];
    const rows = filteredOperators.map((item, idx) => {
      const datesList = item.missingInstances.map(i => `${i.date} (S${i.shift})`).join('; ');
      return [
        idx + 1,
        `"${item.operator.nrp}"`,
        `"${item.operator.name}"`,
        `"${(item.operator.specializations || []).join(', ')}"`,
        item.totalScheduled,
        item.totalMissing,
        `${item.complianceRate}%`,
        item.riskTier === 'high' ? 'Kritis' : item.riskTier === 'medium' ? 'Sedang' : 'Ringan',
        `"${datesList}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Laporan_Pelanggaran_FTW_${startDate}_sd_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Periode Configuration Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Analisis Ketidakhadiran &amp; Tren Pengisian FTW</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold font-mono">
                    HSE &amp; K3 Monitor
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pemantauan kepatuhan pengisian sertifikat Fit to Work karyawan terjadwal, analisis frekuensi pelanggaran, dan tren per periode
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCsv}
              disabled={filteredOperators.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs transition cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Ekspor CSV / Excel</span>
            </button>
            {onOpenFTWModal && (
              <button
                onClick={onOpenFTWModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-xs transition cursor-pointer"
              >
                <Calendar className="h-3.5 w-3.5 text-amber-400" />
                <span>Buka Master FTW Online</span>
              </button>
            )}
          </div>
        </div>

        {/* Period & Filter Controls Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-4">
          {/* Start Date & End Date */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-mono font-bold text-slate-400 flex items-center gap-1">
              <Calendar className="h-3 w-3 text-slate-500" />
              <span>Rentang Tanggal (Mulai - Selesai):</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDrillDownDate(null);
                }}
                className="w-full px-2.5 py-1.5 text-xs font-mono font-bold border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-rose-500 text-slate-800"
              />
              <span className="text-slate-400 text-xs font-bold">s/d</span>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDrillDownDate(null);
                }}
                className="w-full px-2.5 py-1.5 text-xs font-mono font-bold border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-rose-500 text-slate-800"
              />
            </div>
          </div>

          {/* Quick Presets */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-mono font-bold text-slate-400">
              Preset Periode Cepat:
            </label>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => handleQuickPreset(7)}
                className="px-2 py-1 text-[11px] font-bold rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition cursor-pointer"
              >
                7 Hari
              </button>
              <button
                onClick={() => handleQuickPreset(14)}
                className="px-2 py-1 text-[11px] font-bold rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition cursor-pointer"
              >
                14 Hari
              </button>
              <button
                onClick={() => handleQuickPreset(30)}
                className="px-2 py-1 text-[11px] font-bold rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition cursor-pointer"
              >
                30 Hari
              </button>
              <button
                onClick={handleThisMonthPreset}
                className="px-2 py-1 text-[11px] font-bold rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition cursor-pointer"
              >
                Bulan Ini
              </button>
            </div>
          </div>

          {/* Shift Filter */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-mono font-bold text-slate-400 flex items-center gap-1">
              <Sun className="h-3 w-3 text-amber-500" />
              <span>Filter Shift Kerja:</span>
            </label>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-bold">
              <button
                onClick={() => setSelectedShiftFilter('all')}
                className={`flex-1 py-1 text-[11px] rounded transition cursor-pointer text-center ${
                  selectedShiftFilter === 'all' ? 'bg-white shadow-xs text-slate-900 font-extrabold' : 'text-slate-600'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setSelectedShiftFilter('1')}
                className={`flex-1 py-1 text-[11px] rounded transition cursor-pointer text-center ${
                  selectedShiftFilter === '1' ? 'bg-amber-500 text-slate-950 font-extrabold shadow-xs' : 'text-slate-600'
                }`}
              >
                Shift 1 (Siang)
              </button>
              <button
                onClick={() => setSelectedShiftFilter('2')}
                className={`flex-1 py-1 text-[11px] rounded transition cursor-pointer text-center ${
                  selectedShiftFilter === '2' ? 'bg-indigo-600 text-white font-extrabold shadow-xs' : 'text-slate-600'
                }`}
              >
                Shift 2 (Malam)
              </button>
            </div>
          </div>

          {/* Spesialisasi / Departemen Filter */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-mono font-bold text-slate-400 flex items-center gap-1">
              <Filter className="h-3 w-3 text-slate-500" />
              <span>Departemen / Alat:</span>
            </label>
            <select
              value={selectedSpecialization}
              onChange={(e) => setSelectedSpecialization(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs font-bold border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-rose-500 text-slate-800 cursor-pointer"
            >
              <option value="all">Semua Jenis Unit &amp; Operator</option>
              {allSpecializations.map(spec => (
                <option key={spec} value={spec}>{spec}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Drill-down date indicator if selected */}
        {drillDownDate && (
          <div className="mt-3 px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between text-xs text-rose-800">
            <span className="font-bold flex items-center gap-1.5">
              <span>🎯 Menampilkan fokus tanggal: <strong>{formatIndonesianDate(drillDownDate)}</strong> ({formatIndonesianDayName(drillDownDate)})</span>
            </span>
            <button
              onClick={() => setDrillDownDate(null)}
              className="text-[11px] underline text-rose-700 hover:text-rose-900 font-bold cursor-pointer"
            >
              Reset Fokus (Tampilkan Semua Tanggal)
            </button>
          </div>
        )}
      </div>

      {/* 2. Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Tugas Terjadwal */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Tugas Terjadwal</span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-slate-900">{overallKpis.totalScheduled}</span>
            <span className="text-xs text-slate-400 ml-1.5 font-bold">Man-Days</span>
            <p className="text-[10px] text-slate-400 mt-1 font-mono">
              Periode {datesInRange.length} Hari ({startDate} s/d {endDate})
            </p>
          </div>
        </div>

        {/* Card 2: Patuh Mengisi FTW */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Patuh Mengisi FTW</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-emerald-600">{overallKpis.totalFilled}</span>
            <span className="text-xs text-emerald-600/80 ml-1.5 font-bold">Laporan</span>
            <p className="text-[10px] text-emerald-600 font-semibold mt-1">
              ✓ Telah mengisi kelaikan sebelum operasi
            </p>
          </div>
        </div>

        {/* Card 3: Tidak Mengisi FTW (Alpa) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tidak Mengisi FTW</span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <UserX className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-rose-600">{overallKpis.totalMissing}</span>
            <span className="text-xs text-rose-600/80 ml-1.5 font-bold">Kejadian</span>
            <p className="text-[10px] text-rose-600 font-semibold mt-1 font-mono">
              🚨 Pelanggaran prosedur K3
            </p>
          </div>
        </div>

        {/* Card 4: Persentase Kepatuhan */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Rata-Rata Kepatuhan</span>
            <div className={`p-2 rounded-xl ${
              overallKpis.complianceRate >= 95 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
            }`}>
              <BarChart3 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className={`text-3xl font-black ${
              overallKpis.complianceRate >= 95 ? 'text-emerald-600' : overallKpis.complianceRate >= 80 ? 'text-amber-600' : 'text-rose-600'
            }`}>
              {overallKpis.complianceRate}%
            </span>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 rounded-full ${
                  overallKpis.complianceRate >= 95 ? 'bg-emerald-500' : overallKpis.complianceRate >= 80 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${overallKpis.complianceRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 5: Karyawan Alpa Unik */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Karyawan Alpa Unik</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-purple-600">{overallKpis.uniqueMissingEmployees}</span>
            <span className="text-xs text-purple-600/80 ml-1.5 font-bold">Orang</span>
            <p className="text-[10px] text-slate-400 mt-1">
              Dari total {employees.length} operator terdaftar
            </p>
          </div>
        </div>
      </div>

      {/* 3. Visualisasi Tren Harian (Trend Chart over Time) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-rose-500" />
              <span>Tren Ketidakhadiran FTW Harian (Klik Batang untuk Drill-Down)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Grafik perbandingan jumlah operator patuh (hijau) versus tidak mengisi FTW (merah) per tanggal
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-slate-600 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              <span>Patuh Mengisi</span>
            </span>
            <span className="flex items-center gap-1.5 text-rose-600 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block animate-pulse"></span>
              <span>Tidak Mengisi</span>
            </span>
          </div>
        </div>

        {/* Visual Bar Chart */}
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[650px] flex items-end gap-2.5 h-48 pt-6 px-2">
            {dailyTrendStats.map((item) => {
              const total = item.totalScheduled;
              const missingPct = total > 0 ? (item.totalMissing / total) * 100 : 0;
              const filledPct = total > 0 ? (item.totalFilled / total) * 100 : 100;
              const isSelected = drillDownDate === item.date;

              return (
                <div
                  key={item.date}
                  onClick={() => setDrillDownDate(isSelected ? null : item.date)}
                  className={`flex-1 flex flex-col items-center h-full justify-end cursor-pointer group transition-all p-1.5 rounded-xl ${
                    isSelected 
                      ? 'bg-rose-50 ring-2 ring-rose-500/80 shadow-xs' 
                      : 'hover:bg-slate-50'
                  }`}
                  title={`${item.date} (${item.dayName}): ${item.totalMissing} tidak mengisi dari ${total} jadwal (${item.complianceRate}% patuh)`}
                >
                  {/* Floating Number Badge on Top */}
                  <div className="mb-1 text-center">
                    {item.totalMissing > 0 ? (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-600 text-white shadow-xs font-mono">
                        {item.totalMissing}
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-emerald-600 font-mono">
                        ✓
                      </span>
                    )}
                  </div>

                  {/* Stacked Bar Container */}
                  <div className="w-full max-w-[32px] bg-slate-100 rounded-t-lg overflow-hidden flex flex-col justify-end h-32 relative">
                    {/* Filled Bar (Green) */}
                    <div 
                      className="w-full bg-emerald-400 group-hover:bg-emerald-500 transition-all"
                      style={{ height: `${filledPct}%` }}
                    />
                    {/* Missing Bar (Red on top) */}
                    {item.totalMissing > 0 && (
                      <div 
                        className="w-full bg-rose-500 group-hover:bg-rose-600 transition-all absolute top-0"
                        style={{ height: `${missingPct}%` }}
                      />
                    )}
                  </div>

                  {/* Date & Day Label */}
                  <div className="mt-2 text-center">
                    <p className={`text-[10px] font-mono font-black truncate leading-tight ${
                      isSelected ? 'text-rose-700' : 'text-slate-700'
                    }`}>
                      {item.date.split('-')[2]}/{item.date.split('-')[1]}
                    </p>
                    <p className="text-[8.5px] text-slate-400 font-medium truncate uppercase">
                      {item.dayName.substring(0, 3)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart Summary Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-1 font-mono">
            <span className="font-bold">Total Tanggal:</span>
            <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-800">{dailyTrendStats.length} Hari</span>
          </div>
          {overallKpis.peakDay && (
            <div className="text-rose-700 font-bold text-[11px] flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
              <span>Puncak Alpa Tertinggi: <strong>{formatIndonesianDate(overallKpis.peakDay.date)}</strong> ({overallKpis.peakDay.totalMissing} orang tidak mengisi)</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Analisis Frekuensi Karyawan (Ranking & Frequency Table) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Table Filter & Toolbar */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <UserX className="h-4 w-4 text-rose-600" />
              <span>Daftar Frekuensi Operator Tidak Mengisi FTW</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-700">
                {filteredOperators.length} Operator Ditemukan
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Diurutkan berdasarkan frekuensi pengabaian pengisian sertifikat kelaikan harian
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Box */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama atau NIK..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-rose-500 text-slate-800 w-48"
              />
            </div>

            {/* Minimum Missing Threshold */}
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <span className="text-[10px] uppercase font-mono text-slate-400">Min Alpa:</span>
              <select
                value={minMissingFilter}
                onChange={(e) => setMinMissingFilter(Number(e.target.value))}
                className="px-2 py-1 text-xs font-bold border border-slate-200 rounded-lg bg-slate-50 cursor-pointer"
              >
                <option value={1}>Minimal 1x Alpa</option>
                <option value={2}>Minimal 2x Alpa (Peringatan)</option>
                <option value={3}>Minimal 3x Alpa (Kritis)</option>
                <option value={0}>Semua Operator Terjadwal</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2 py-1 text-xs font-bold border border-slate-200 rounded-lg bg-slate-50 cursor-pointer"
              >
                <option value="missing_desc">Alpa Terbanyak (Puncak Pelanggar)</option>
                <option value="missing_asc">Alpa Tersedikit</option>
                <option value="compliance_asc">Kepatuhan Terendah (%)</option>
                <option value="name_asc">Nama (A-Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/70 text-slate-600 font-mono font-bold uppercase text-[10px] border-b border-slate-200">
                <th className="p-3.5 text-center w-12">No</th>
                <th className="p-3.5">Operator &amp; NIK</th>
                <th className="p-3.5">Spesialisasi / Dept</th>
                <th className="p-3.5 text-center">Frekuensi Alpa FTW</th>
                <th className="p-3.5 text-center">Tingkat Kepatuhan</th>
                <th className="p-3.5">Tanggal-Tanggal Tidak Mengisi</th>
                <th className="p-3.5 text-center">Tingkat Risiko</th>
                <th className="p-3.5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOperators.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                      <p className="font-bold text-slate-700">Tidak Ada Pelanggaran FTW Ditemukan</p>
                      <p className="text-xs text-slate-400">
                        Seluruh operator terjadwal pada filter ini telah memenuhi kewajiban pengisian kelaikan kerja
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOperators.map((item, idx) => {
                  const isCritical = item.totalMissing >= 3;
                  const isWarning = item.totalMissing === 2;

                  return (
                    <tr 
                      key={item.operator.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isCritical ? 'bg-rose-50/20' : isWarning ? 'bg-amber-50/15' : ''
                      }`}
                    >
                      {/* Rank Number */}
                      <td className="p-3.5 text-center font-mono font-bold text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Operator Identity */}
                      <td className="p-3.5">
                        <div className="font-black text-slate-900 tracking-tight">
                          {item.operator.name}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 font-bold flex items-center gap-1.5 mt-0.5">
                          <span>NIK: {item.operator.nrp}</span>
                          <span>•</span>
                          <span>Roster: {item.operator.rosterPattern}</span>
                        </div>
                      </td>

                      {/* Specializations / Dept */}
                      <td className="p-3.5">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {(item.operator.specializations || []).length > 0 ? (
                            item.operator.specializations.map(spec => (
                              <span key={spec} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[9.5px] font-medium">
                                {spec}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 text-[10px] italic">Reguler Operator</span>
                          )}
                        </div>
                      </td>

                      {/* Missing Count (Frequency) */}
                      <td className="p-3.5 text-center">
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-mono font-black text-xs shadow-2xs ${
                          isCritical ? 'bg-rose-600 text-white' : isWarning ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 text-slate-800'
                        }">
                          <span>{item.totalMissing} Kali</span>
                        </div>
                        <p className="text-[9.5px] text-slate-400 font-mono mt-0.5">
                          dari {item.totalScheduled} tugas
                        </p>
                      </td>

                      {/* Compliance Rate Bar */}
                      <td className="p-3.5 text-center">
                        <span className={`font-mono font-black text-xs ${
                          item.complianceRate >= 90 ? 'text-emerald-600' : item.complianceRate >= 75 ? 'text-amber-600' : 'text-rose-600'
                        }`}>
                          {item.complianceRate}%
                        </span>
                        <div className="w-16 mx-auto bg-slate-100 rounded-full h-1 mt-1 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              item.complianceRate >= 90 ? 'bg-emerald-500' : item.complianceRate >= 75 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${item.complianceRate}%` }}
                          />
                        </div>
                      </td>

                      {/* Specific Missing Dates Chip List */}
                      <td className="p-3.5">
                        <div className="flex flex-wrap gap-1 max-w-[280px]">
                          {item.missingInstances.map((inst, iIdx) => (
                            <span 
                              key={`${inst.date}-${inst.shift}-${iIdx}`}
                              className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[9.5px] font-mono font-bold border border-rose-200"
                              title={`Unit: ${inst.unitCode} (${inst.unitBrand || '-'})`}
                            >
                              {inst.date.split('-')[2]}/{inst.date.split('-')[1]} (S{inst.shift})
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Risk Tier Badge */}
                      <td className="p-3.5 text-center">
                        {isCritical ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-300">
                            <AlertTriangle className="h-3 w-3 text-rose-600" />
                            Kritis / SP
                          </span>
                        ) : isWarning ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300">
                            <Clock className="h-3 w-3 text-amber-600" />
                            Peringatan
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold uppercase bg-slate-100 text-slate-700">
                            Perhatian
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => setDetailOperatorStat(item)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1 mx-auto cursor-pointer"
                        >
                          <Eye className="h-3 w-3 text-slate-500" />
                          <span>Audit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Detail Audit Modal for a Selected Operator */}
      {detailOperatorStat && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h4 className="text-base font-black tracking-tight flex items-center gap-2">
                  <UserX className="h-5 w-5 text-rose-500" />
                  <span>Audit Kepatuhan: {detailOperatorStat.operator.name}</span>
                </h4>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  NIK: {detailOperatorStat.operator.nrp} • Roster {detailOperatorStat.operator.rosterPattern}
                </p>
              </div>
              <button
                onClick={() => setDetailOperatorStat(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Stats overview */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-400 font-bold uppercase font-mono">Total Tugas</span>
                  <p className="text-xl font-black text-slate-800 mt-1">{detailOperatorStat.totalScheduled} Hari</p>
                </div>
                <div className="bg-rose-50 p-3 rounded-xl border border-rose-200 text-center">
                  <span className="text-[10px] text-rose-500 font-bold uppercase font-mono">Alpa FTW</span>
                  <p className="text-xl font-black text-rose-600 mt-1">{detailOperatorStat.totalMissing} Kali</p>
                </div>
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-center">
                  <span className="text-[10px] text-emerald-600 font-bold uppercase font-mono">Kepatuhan</span>
                  <p className="text-xl font-black text-emerald-700 mt-1">{detailOperatorStat.complianceRate}%</p>
                </div>
              </div>

              {/* Missing Details List */}
              <div>
                <h5 className="text-xs font-black uppercase text-slate-700 tracking-wider mb-2 font-mono">
                  Rincian Kejadian Tidak Mengisi FTW:
                </h5>
                <div className="space-y-2">
                  {detailOperatorStat.missingInstances.map((inst, idx) => (
                    <div 
                      key={idx}
                      className="p-3 rounded-xl bg-rose-50/50 border border-rose-200 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-rose-600 text-white rounded-lg font-black font-mono text-[11px]">
                          #{idx + 1}
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-900">
                            {formatIndonesianDate(inst.date)} ({formatIndonesianDayName(inst.date)})
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                            Shift: <strong className="text-slate-700">{inst.shift === 1 ? 'Siang (Shift 1)' : 'Malam (Shift 2)'}</strong> • Unit Tugas: <strong className="text-slate-700">{inst.unitCode}</strong>
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-rose-200 text-rose-900 font-bold text-[10px] font-mono">
                        Belum Mengisi
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* HSE Action Recommendation */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                <p className="font-bold flex items-center gap-1.5 mb-1 text-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span>Rekomendasi Tindakan HSE &amp; Pengawas Lapangan:</span>
                </p>
                <p className="text-[11px] leading-relaxed">
                  {detailOperatorStat.totalMissing >= 3 
                    ? 'Operator memiliki tingkat alpa pengisian FTW kritis (≥ 3 kali). Direkomendasikan pemanggilan khusus oleh HSE Officer dan penghentian tugas sebelum clearance medis diterbitkan.'
                    : detailOperatorStat.totalMissing === 2
                      ? 'Operator telah 2 kali mengabaikan pengisian FTW. Pengawas wajib memberikan teguran lisan dan memastikan kelaikan fisik sebelum pergantian shift.'
                      : 'Lakukan pengingat briefing P5M sebelum memulai operasi agar operator mengisi FTW tepat waktu.'}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setDetailOperatorStat(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg cursor-pointer transition"
              >
                Tutup Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
