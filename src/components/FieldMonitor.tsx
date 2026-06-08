/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { HeavyUnit, Employee, UnitSetting, UnitGroup } from '../types';
import { calculateShift, formatIndonesianDate, formatIndonesianDayName } from '../utils/scheduler';
import { Search, Calendar, ShieldAlert, CheckCircle2, Moon, Sun, AlertTriangle, ListFilter, Users } from 'lucide-react';
import { motion } from 'motion/react';

interface FieldMonitorProps {
  units: HeavyUnit[];
  employees: Employee[];
  settings: UnitSetting[];
  groups: UnitGroup[];
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  onNavigateToSetting: (settingId: string) => void;
}

export default function FieldMonitor({
  units,
  employees,
  settings,
  groups,
  selectedDate,
  setSelectedDate,
  onNavigateToSetting
}: FieldMonitorProps) {
  const [selectedShift, setSelectedShift] = useState<1 | 2>(1); // 1 = Siang, 2 = Malam
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');

  // Employee mapping-by-ID helper for fast lookups
  const employeeMap = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach(e => map.set(e.id, e));
    return map;
  }, [employees]);

  // Unit mapping-by-ID helper for fast lookups
  const unitMap = useMemo(() => {
    const map = new Map<string, HeavyUnit>();
    units.forEach(u => map.set(u.id, u));
    return map;
  }, [units]);

  // Quick dates adjustment
  const handleNextDay = () => {
    const date = new Date(selectedDate + 'T00:00:00');
    date.setDate(date.getDate() + 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const handlePrevDay = () => {
    const date = new Date(selectedDate + 'T00:00:00');
    date.setDate(date.getDate() - 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const handleSetToday = () => {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const wib = new Date(utc + (3600000 * 7));
    const yyyy = wib.getFullYear();
    const mm = String(wib.getMonth() + 1).padStart(2, '0');
    const dd = String(wib.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  // Get active operator info for each setting on the selected date and shift with automatic master backfilling
  const resolvedSettings = useMemo(() => {
    // 1. Compile active, on-duty master operators for this shift & date
    const availableMasterCandidates: Array<{
      id: string;
      employee: Employee;
      masterSlotCode: string;
      specializations: string[];
      settingId: string;
      backupPriorityType1?: string;
      backupPriorityType2?: string;
      backupPriorityUnitId1?: string;
      backupPriorityUnitId2?: string;
      isAssignedToUnitCode?: string;
    }> = [];

    settings.forEach(s => {
      if (s.groupId === 'master') {
        const mShiftInfo = calculateShift(s, selectedDate);
        const mop1 = employeeMap.get(s.operator1Id);
        const mop2 = employeeMap.get(s.operator2Id);

        let activeMop: Employee | null = null;
        let activeRole: 'S' | 'M' | 'OFF' = 'OFF';

        if (selectedShift === 1) { // Shift Siang
          if (mShiftInfo.operator1Role === 'S') {
            activeMop = mop1 || null;
            activeRole = 'S';
          } else if (mShiftInfo.operator2Role === 'S') {
            activeMop = mop2 || null;
            activeRole = 'S';
          }
        } else { // Shift Malam
          if (mShiftInfo.operator1Role === 'M') {
            activeMop = mop1 || null;
            activeRole = 'M';
          } else if (mShiftInfo.operator2Role === 'M') {
            activeMop = mop2 || null;
            activeRole = 'M';
          }
        }

        if (activeMop && activeMop.status === 'Active' && activeRole !== 'OFF') {
          availableMasterCandidates.push({
            id: activeMop.id,
            employee: activeMop,
            masterSlotCode: s.masterSlotCode || 'M-1',
            specializations: activeMop.specializations || [],
            settingId: s.id,
            backupPriorityType1: s.backupPriorityType1,
            backupPriorityType2: s.backupPriorityType2,
            backupPriorityUnitId1: s.backupPriorityUnitId1,
            backupPriorityUnitId2: s.backupPriorityUnitId2
          });
        }
      }
    });

    // 2. Resolve 'utama' settings and assign backup from master pool if vacant
    const mappedUtamaSettings = settings
      .filter(s => s.groupId === 'utama')
      .map(setting => {
        const shiftInfo = calculateShift(setting, selectedDate);
        const op1 = employeeMap.get(setting.operator1Id);
        const op2 = employeeMap.get(setting.operator2Id);
        const unit = unitMap.get(setting.unitId);

        let activeOperator: Employee | null = null;
        let activeRoleStatus: 'S' | 'M' | 'OFF' = 'OFF';
        let originalOperator: Employee | null = null;

        if (selectedShift === 1) { // Shift Siang
          if (shiftInfo.operator1Role === 'S') {
            activeOperator = op1 || null;
            activeRoleStatus = 'S';
            originalOperator = op1 || null;
          } else if (shiftInfo.operator2Role === 'S') {
            activeOperator = op2 || null;
            activeRoleStatus = 'S';
            originalOperator = op2 || null;
          }
        } else { // Shift Malam
          if (shiftInfo.operator1Role === 'M') {
            activeOperator = op1 || null;
            activeRoleStatus = 'M';
            originalOperator = op1 || null;
          } else if (shiftInfo.operator2Role === 'M') {
            activeOperator = op2 || null;
            activeRoleStatus = 'M';
            originalOperator = op2 || null;
          }
        }

        const isPrimaryActive = activeOperator && activeOperator.status === 'Active' && activeRoleStatus !== 'OFF';

        let isFilledByMaster = false;
        let backupFromSlot: string | undefined = undefined;

        if (!isPrimaryActive && unit) {
          // Score each available master candidate for suitability
          const scoredCandidates = availableMasterCandidates
            .filter(cand => !cand.isAssignedToUnitCode)
            .map(cand => {
              let score = 0;

              // 1. Highest Priority: Specific Unit ID Match #1
              if (cand.backupPriorityUnitId1 && cand.backupPriorityUnitId1 === unit.id) {
                score += 1000;
              }
              // 2. High Priority: Specific Unit ID Match #2
              else if (cand.backupPriorityUnitId2 && cand.backupPriorityUnitId2 === unit.id) {
                score += 500;
              }
              // 3. Priority: Unit Type Match #1
              else if (cand.backupPriorityType1 && cand.backupPriorityType1 === unit.type) {
                score += 200;
              }
              // 4. Priority: Unit Type Match #2
              else if (cand.backupPriorityType2 && cand.backupPriorityType2 === unit.type) {
                score += 100;
              }
              // 5. Normal: Match Specialization
              else if ((cand.specializations || []).includes(unit.type)) {
                score += 10;
              }
              // 6. Low Priority: General fallback
              else {
                score += 1;
              }

              return { cand, score };
            });

          // Sort candidates by score descending
          scoredCandidates.sort((a, b) => b.score - a.score);

          // Select the best candidate (if there is at least one)
          const matchedCandidate = scoredCandidates.length > 0 ? scoredCandidates[0].cand : null;

          if (matchedCandidate) {
            matchedCandidate.isAssignedToUnitCode = unit.unitCode;
            activeOperator = matchedCandidate.employee;
            activeRoleStatus = selectedShift === 1 ? 'S' : 'M';
            isFilledByMaster = true;
            backupFromSlot = matchedCandidate.masterSlotCode;
          } else {
            activeOperator = null;
            activeRoleStatus = 'OFF';
          }
        }

        return {
          setting,
          unit,
          op1,
          op2,
          activeOperator,
          activeRoleStatus,
          shiftInfo,
          isFilledByMaster,
          backupFromSlot,
          originalOperator,
          dispatchedTo: undefined
        };
      });

    // 3. Resolve 'master' settings and show their active dispatch statuses
    const mappedMasterSettings = settings
      .filter(s => s.groupId === 'master')
      .map(setting => {
        const shiftInfo = calculateShift(setting, selectedDate);
        const op1 = employeeMap.get(setting.operator1Id);
        const op2 = employeeMap.get(setting.operator2Id);

        let activeOperator: Employee | null = null;
        let activeRoleStatus: 'S' | 'M' | 'OFF' = 'OFF';

        if (selectedShift === 1) { // Shift Siang
          if (shiftInfo.operator1Role === 'S') {
            activeOperator = op1 || null;
            activeRoleStatus = 'S';
          } else if (shiftInfo.operator2Role === 'S') {
            activeOperator = op2 || null;
            activeRoleStatus = 'S';
          }
        } else { // Shift Malam
          if (shiftInfo.operator1Role === 'M') {
            activeOperator = op1 || null;
            activeRoleStatus = 'M';
          } else if (shiftInfo.operator2Role === 'M') {
            activeOperator = op2 || null;
            activeRoleStatus = 'M';
          }
        }

        const isOff = !activeOperator || activeOperator.status !== 'Active' || activeRoleStatus === 'OFF';
        const slotCode = setting.masterSlotCode || 'M-1';
        
        // Find if they are currently assigned to any unit
        const dispatchedTo = availableMasterCandidates.find(
          cand => cand.masterSlotCode === slotCode
        )?.isAssignedToUnitCode;

        const opSpecializationsStr = op1?.specializations?.join(', ') || 'Dump Truck';
        const virtualUnit: HeavyUnit = {
          id: 'virtual-' + setting.id,
          unitCode: slotCode,
          brand: `Pool Cadangan (${opSpecializationsStr})`,
          type: (op1?.specializations?.[0] || 'Dump Truck') as any,
          status: 'Ready'
        };

        return {
          setting,
          unit: virtualUnit,
          op1,
          op2,
          activeOperator,
          activeRoleStatus: isOff ? ('OFF' as const) : (selectedShift === 1 ? ('S' as const) : ('M' as const)),
          shiftInfo,
          isFilledByMaster: false,
          backupFromSlot: undefined,
          originalOperator: null,
          dispatchedTo
        };
      });

    // Check if ALL 'utama' settings have their primary operators active & on-duty (not filled by master, and not blank)
    const allUtamaFilledByPrimary = mappedUtamaSettings.length > 0 && mappedUtamaSettings.every(item => {
      return item.originalOperator && 
             item.originalOperator.status === 'Active' && 
             !item.isFilledByMaster && 
             item.activeRoleStatus !== 'OFF';
    });

    const filteredMasterSettings = mappedMasterSettings.filter(m => {
      // 1. Hide if they have filled a vacant unit (dispatchedTo is set to some unitCode)
      if (m.dispatchedTo) return false;
      
      // 2. Hide all of them if NOT all primary units are filled by their original operators
      if (!allUtamaFilledByPrimary) return false;
      
      return true;
    });

    return [...mappedUtamaSettings, ...filteredMasterSettings];
  }, [settings, selectedDate, selectedShift, employeeMap, unitMap]);

  // Filter based on search query (unit code or operator name) and group id
  const filteredResolvedSettings = useMemo(() => {
    return resolvedSettings.filter(item => {
      if (!item.unit) return false;
      
      const matchesSearch = 
        item.unit.unitCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.activeOperator?.name || 'TIDAK ADA OPERATOR').toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.unit.brand.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesGroup = selectedGroupFilter === 'all' || item.setting.groupId === selectedGroupFilter;

      return matchesSearch && matchesGroup;
    });
  }, [resolvedSettings, searchQuery, selectedGroupFilter]);

  // Units that are not yet configured in setting
  const unconfiguredUnits = useMemo(() => {
    const configuredUnitIds = new Set(settings.map(s => s.unitId));
    return units.filter(u => {
      const matchesSearch = u.unitCode.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            u.brand.toLowerCase().includes(searchQuery.toLowerCase());
      return !configuredUnitIds.has(u.id) && matchesSearch;
    });
  }, [units, settings, searchQuery]);

  // Group both resolved settings and unconfigured units by their Category/Type (e.g. Wheel Loader, Dump Truck, etc.)
  const categorizedUnits = useMemo(() => {
    const tempGroups: Record<string, {
      type: string;
      resolvedSettings: typeof filteredResolvedSettings;
      unconfigured: typeof unconfiguredUnits;
    }> = {};

    // Standard types order we want to sort nicely
    const order = [
      'Wheel Loader',
      'Dump Truck',
      'Excavator',
      'Bulldozer',
      'Reach Stacker',
      'Forklift',
      'Flat Deck',
      'Water Truck',
      'Barge Loading Conveyor',
      'Weightbridge',
      'Kapten FD',
      'Other'
    ];

    filteredResolvedSettings.forEach(item => {
      const type = item.unit?.type || 'Other';
      if (!tempGroups[type]) {
        tempGroups[type] = { type, resolvedSettings: [], unconfigured: [] };
      }
      tempGroups[type].resolvedSettings.push(item);
    });

    unconfiguredUnits.forEach(unit => {
      const type = unit.type || 'Other';
      if (!tempGroups[type]) {
        tempGroups[type] = { type, resolvedSettings: [], unconfigured: [] };
      }
      tempGroups[type].unconfigured.push(unit);
    });

    return Object.values(tempGroups).sort((a, b) => {
      const indexA = order.indexOf(a.type);
      const indexB = order.indexOf(b.type);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.type.localeCompare(b.type);
    });
  }, [filteredResolvedSettings, unconfiguredUnits]);

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-700" id="field-monitor-container">
      {/* 1. Header Board */}
      <div className="bg-white text-slate-800 p-5 border-b border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 mt-1">
              Dashboard Unit
            </h1>
          </div>

          {/* Quick Shift Switcher */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200 self-start md:self-auto">
            <button
              id="shift-siang-btn"
              onClick={() => setSelectedShift(1)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
                selectedShift === 1
                  ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sun className="h-3.5 w-3.5" />
              <span>Shift 1 (Siang)</span>
            </button>
            <button
              id="shift-malam-btn"
              onClick={() => setSelectedShift(2)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
                selectedShift === 2
                  ? 'bg-indigo-600 text-white font-black shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Moon className="h-3.5 w-3.5" />
              <span>Shift 2 (Malam)</span>
            </button>
          </div>
        </div>

        {/* Date Selector Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-5 bg-slate-100 p-3 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-start">
            <Calendar className="text-amber-500 h-4 w-4 shrink-0" />
            <span className="text-xs font-black text-slate-800 font-mono uppercase tracking-wide">
              Tanggal Operasional: {formatIndonesianDate(selectedDate)}
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider font-mono">PILIH TANGGAL:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="bg-white text-slate-800 text-xs border border-slate-200 rounded p-1.5 font-mono font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* 2. Board Controls (Filter & Search) */}
      <div className="bg-white p-4 border-b border-slate-200 flex flex-col md:flex-row gap-3 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            id="field-search"
            type="text"
            placeholder="Cari kode unit atau nama operator..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 transition-all"
          />
        </div>

        <div className="flex gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-md border border-slate-200">
            <button
              onClick={() => setSelectedGroupFilter('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-sm transition cursor-pointer ${
                selectedGroupFilter === 'all'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Semua Grup
            </button>
            {groups.map(g => (
              <button
                key={g.id}
                onClick={() => setSelectedGroupFilter(g.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-sm transition cursor-pointer ${
                  selectedGroupFilter === g.id
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Monitor Active Grid (Blueprint layout from Image 1) */}
      <div className="flex-1 p-6 overflow-y-auto bg-slate-100">
        {/* If no configurations match and no unconfigured units */}
        {filteredResolvedSettings.length === 0 && unconfiguredUnits.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed border-slate-300 p-8 max-w-md mx-auto mt-6">
            <Users className="mx-auto h-12 w-12 text-slate-400 mb-3" />
            <h3 className="text-sm font-bold text-slate-700">Tidak ada unit ditemukan</h3>
            <p className="text-xs text-slate-500 mt-1">Coba sesuaikan pencarian atau filter grup Anda.</p>
          </div>
        )}

        {/* Categorized Bento Grids */}
        {categorizedUnits.map((category) => {
          return (
            <div key={category.type} className="mb-8 last:mb-2" id={`category-block-${category.type.toLowerCase().replace(/\s+/g, '-')}`}>
              {/* Category Divider Header / Title */}
              <div className="flex items-center gap-2 mb-3 select-none">
                <div className="bg-slate-800 text-white font-extrabold text-xs px-3.5 py-1.5 rounded uppercase tracking-wider font-mono border border-slate-700 shadow-sm">
                  {category.type.toUpperCase()}
                </div>
                <div className="flex-1 h-[2px] bg-slate-200"></div>
                <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider">
                  {category.resolvedSettings.length + category.unconfigured.length} Unit
                </span>
              </div>

              {/* Compact Responsive Grid: 6 columns horizontally on xl screens */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                 {/* 1. Render Configured Units in this category */}
                 {category.resolvedSettings.map(({ setting, unit, activeOperator, activeRoleStatus, isFilledByMaster, backupFromSlot, originalOperator, dispatchedTo }) => {
                   if (!unit) return null;
                   const isOff = activeRoleStatus === 'OFF' || !activeOperator;
                   const isMasterGroup = setting.groupId === 'master';

                   return (
                     <motion.div
                       key={setting.id}
                       layoutId={`field-card-${setting.id}`}
                       className={`select-none bg-white border rounded-lg shadow-sm flex flex-col overflow-hidden transition-all duration-200 cursor-pointer ${
                         isOff 
                           ? 'border-slate-200 bg-slate-50' 
                           : isMasterGroup
                             ? dispatchedTo
                               ? 'border-emerald-300 hover:border-emerald-500 hover:shadow-md bg-emerald-50/10'
                               : 'border-slate-200 hover:border-slate-400 hover:shadow-md'
                             : isFilledByMaster
                               ? selectedShift === 1 ? 'border-amber-300 hover:border-amber-500 hover:shadow-md bg-amber-50/10' : 'border-indigo-300 hover:border-indigo-500 hover:shadow-md bg-indigo-50/10'
                               : selectedShift === 1 
                                 ? 'border-slate-200 hover:border-amber-400 hover:shadow-md' 
                                 : 'border-slate-200 hover:border-indigo-400 hover:shadow-md'
                       }`}
                       onClick={() => onNavigateToSetting(setting.id)}
                     >
                       {/* Compact Unit Code Header */}
                       <div className={`py-1.5 px-2 text-center border-b font-extrabold font-mono tracking-wider text-xs ${
                         isOff 
                           ? 'bg-slate-100 border-slate-200 text-slate-400' 
                           : isMasterGroup
                             ? dispatchedTo
                               ? 'bg-emerald-600 border-emerald-600 text-white font-black'
                               : 'bg-slate-700 border-slate-700 text-white font-black'
                             : isFilledByMaster
                               ? selectedShift === 1 ? 'bg-amber-500 border-amber-500 text-slate-950 font-black' : 'bg-indigo-600 border-indigo-600 text-white font-black'
                               : selectedShift === 1 
                                 ? 'bg-amber-400 border-amber-400 text-slate-950 font-black' 
                                 : 'bg-indigo-600 border-indigo-600 text-white font-black'
                       }`}>
                         {unit.unitCode}
                       </div>

                       {/* Compact Operator Details Body */}
                       <div className="flex-1 p-2 flex flex-col justify-center items-center text-center">
                         {isOff ? (
                           <div className="py-1">
                             <div className="inline-flex items-center gap-1 py-0.5 px-1.5 rounded-full text-[8px] font-bold uppercase bg-rose-50 text-rose-650 border border-rose-100 mb-1 font-mono">
                               {isMasterGroup ? 'SLOT STANDBY' : 'STANDBY'}
                             </div>
                             <p className="text-[11px] font-black text-slate-400 tracking-tight uppercase line-clamp-1 truncate">
                               {isMasterGroup ? 'Operator Off' : 'ROSTER OFF'}
                             </p>
                             <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                               Libur / Off
                             </p>
                           </div>
                         ) : (
                           <div className="w-full py-1">
                             <p className="text-[8px] text-slate-400 font-mono uppercase tracking-wider mb-0.5 font-bold truncate">
                               {isMasterGroup 
                                 ? 'MASTER ON-DUTY' 
                                 : isFilledByMaster 
                                   ? 'BACKUP MASTER' 
                                   : 'OPERATOR'}
                             </p>
                             <h3 className={`text-xs font-black tracking-tight leading-normal line-clamp-1 truncate ${
                               isMasterGroup 
                                 ? dispatchedTo ? 'text-emerald-700 font-black' : 'text-slate-805'
                                 : isFilledByMaster ? selectedShift === 1 ? 'text-amber-700 font-black' : 'text-indigo-700 font-black' : 'text-slate-805'
                             }`}>
                               {activeOperator.name}
                             </h3>
                             <p className="text-[9px] text-slate-500 font-mono mt-1 flex items-center justify-center gap-1 truncate">
                               <span className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${
                                 isMasterGroup 
                                   ? dispatchedTo ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400' 
                                   : selectedShift === 1 ? 'bg-amber-500 animate-pulse' : 'bg-indigo-500 animate-pulse'
                               }`}></span>
                               <span className="truncate">{activeOperator.nrp}</span>
                             </p>

                             {isFilledByMaster && (
                               <div className={`mt-1.5 px-2 py-1 rounded text-[10px] font-black uppercase text-center flex items-center justify-center gap-1 shrink-0 border ${
                                 selectedShift === 1
                                   ? 'bg-amber-500/10 text-amber-855 border-amber-500/20'
                                   : 'bg-indigo-500/10 text-indigo-855 border-indigo-500/20'
                               }`}>
                                 ★ OPERATOR MASTER ★
                               </div>
                             )}

                             {isMasterGroup && (
                               <div className="mt-1 truncate">
                                 {dispatchedTo ? (
                                   <span className="inline-flex text-[8px] px-1 bg-emerald-50 text-emerald-800 rounded border border-emerald-150 font-bold uppercase truncate">
                                     Unit: {dispatchedTo}
                                   </span>
                                 ) : (
                                   <span className="inline-flex text-[8px] px-1 bg-slate-150 text-slate-600 rounded border border-slate-250 font-bold uppercase truncate">
                                     POOL STANDBY
                                   </span>
                                 )}
                               </div>
                             )}
                           </div>
                         )}
                       </div>

                       {/* Compact Footer brand info */}
                       <div className={`px-2 py-1 border-t text-[9px] flex items-center justify-between ${
                         isOff ? 'bg-slate-50 border-slate-200 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                       }`}>
                         <span className="truncate max-w-[80px] font-medium font-mono">
                           {isMasterGroup ? `EGI: ${activeOperator?.specializations?.[0] || 'Umum'}` : unit.brand}
                         </span>
                         {isOff ? (
                           <span className="shrink-0 text-slate-400 font-bold uppercase text-[8px]">OFF</span>
                         ) : (
                           <span className={`shrink-0 font-extrabold text-[8px] px-1 py-0.5 rounded uppercase ${
                             isMasterGroup
                               ? dispatchedTo
                                 ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                 : 'bg-slate-250 text-slate-600 border border-slate-350'
                               : isFilledByMaster
                                 ? selectedShift === 1 ? 'bg-amber-100 text-amber-805 border border-amber-200' : 'bg-indigo-100 text-indigo-805 border border-indigo-200'
                                 : selectedShift === 1 ? 'bg-amber-100 text-amber-805 border border-amber-205' : 'bg-indigo-100 text-indigo-805 border border-indigo-205'
                           }`}>
                             {selectedShift === 1 ? 'SNG' : 'MLM'}
                           </span>
                         )}
                       </div>
                     </motion.div>
                   );
                 })}

                 {/* 2. Render Unconfigured Units in this category as NO OPERATOR */}
                 {category.unconfigured.map(unit => {
                   return (
                     <motion.div
                       key={`unconfigured-${unit.id}`}
                       layoutId={`unconfigured-card-${unit.id}`}
                       className="select-none bg-white border border-rose-200 rounded-lg shadow-sm flex flex-col overflow-hidden transition-all duration-200 hover:border-rose-350 hover:shadow-md"
                     >
                       {/* Compact Unit Code Header of Unconfigured Tool */}
                       <div className="py-1.5 px-2 text-center border-b font-extrabold font-mono tracking-wider text-xs bg-rose-600 border-rose-600 text-white font-black">
                         {unit.unitCode}
                       </div>

                       {/* Compact NO OPERATOR information body */}
                       <div className="flex-1 p-2 flex flex-col justify-center items-center text-center">
                         <div className="py-1">
                           <div className="inline-flex items-center gap-0.5 py-0.5 px-1.5 rounded-full text-[8px] font-bold uppercase bg-rose-50 text-rose-650 border border-rose-100 mb-1 font-mono">
                             <AlertTriangle className="h-3 w-3 shrink-0" />
                             BELUM DISET
                           </div>
                           <p className="text-[11px] font-black text-rose-600 tracking-tight uppercase truncate">
                             NO OPERATOR
                           </p>
                           <p className="text-[8px] text-slate-400 font-mono mt-0.5">
                             Roster Belum Di-set
                           </p>
                         </div>
                       </div>

                       {/* Compact footer section */}
                       <div className="px-2 py-1 border-t text-[9px] flex items-center justify-between bg-slate-50 border-slate-200 text-slate-400">
                         <span className="truncate max-w-[80px] font-medium font-mono">
                           {unit.brand}
                         </span>
                         <span className="shrink-0 font-extrabold text-[8px] px-1 py-0.5 rounded uppercase bg-rose-50 text-rose-700 border border-rose-200">
                           KOSONG
                         </span>
                       </div>
                     </motion.div>
                   );
                 })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Bottom Info Status Strip */}
      <div className="bg-white border-t border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 shadow-inner">
        <div className="flex items-center gap-4 flex-wrap select-none">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-white border border-slate-300 rounded-xs"></span>
            <span>Unit Aktif Beroperasi</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-slate-50 border border-slate-200 rounded-xs"></span>
            <span>Unit Standby (Hari Roster Off)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-rose-600 rounded-xs"></span>
            <span>No Operator / Kosong</span>
          </div>
        </div>
        <div className="font-mono text-[10px] text-slate-400 font-extrabold uppercase">
          *PAPAN DIPERBARUI OTOMATIS SEIRING PERUBAHAN TANGGAL &amp; SHIFT
        </div>
      </div>
    </div>
  );
}
