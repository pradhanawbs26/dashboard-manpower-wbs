import React, { useMemo, useState } from 'react';
import { HeavyUnit, Employee, UnitSetting, BackupTransfer } from '../types';
import { calculateShift, formatIndonesianDate, formatIndonesianDayName } from '../utils/scheduler';
import { 
  CheckCircle2, AlertTriangle, Users, Calendar, Moon, Sun, 
  Armchair, Settings2, ShieldCheck, HelpCircle, UserX, ToggleRight, Layers
} from 'lucide-react';

interface ResumeOperatorProps {
  units: HeavyUnit[];
  employees: Employee[];
  settings: UnitSetting[];
  backupTransfers: BackupTransfer[];
  selectedDate: string;
  setSelectedDate: (date: string) => void;
}

export default function ResumeOperator({
  units,
  employees,
  settings,
  backupTransfers,
  selectedDate,
  setSelectedDate
}: ResumeOperatorProps) {
  const [selectedShift, setSelectedShift] = useState<1 | 2>(() => {
    const now = new Date();
    const hr = now.getHours();
    return (hr >= 6 && hr < 18) ? 1 : 2;
  });

  // Quick Day adjustment
  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  const handleToday = () => {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const wib = new Date(utc + (3600000 * 7));
    const yyyy = wib.getFullYear();
    const mm = String(wib.getMonth() + 1).padStart(2, '0');
    const dd = String(wib.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  const employeeMap = useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);
  const unitMap = useMemo(() => new Map(units.map(u => [u.id, u])), [units]);

  // Compute resolved settings
  const { 
    resolvedSettings, 
    totalOnDutyOperators,
    standbyMasters,
    unitsWithOperator,
    unitsNoOperator,
    readyCount,
    breakdownCount
  } = useMemo(() => {
    const activeTransfersForThisShift = (backupTransfers || []).filter(
      bt => bt.date === selectedDate && Number(bt.shift) === Number(selectedShift)
    );

    const operatorTransferTargetMap = new Map<string, string>();
    const unitTransferredOperatorsListMap = new Map<string, Employee[]>();

    activeTransfersForThisShift.forEach(bt => {
      const op = employeeMap.get(bt.operatorId);
      if (op && op.status === 'Active') {
        operatorTransferTargetMap.set(op.id, bt.targetUnitId);
        if (!unitTransferredOperatorsListMap.has(bt.targetUnitId)) {
          unitTransferredOperatorsListMap.set(bt.targetUnitId, []);
        }
        unitTransferredOperatorsListMap.get(bt.targetUnitId)!.push(op);
      }
    });

    // 1. Scheduled On-duty employees count
    let onDutyCount = 0;
    const scheduledOnDutyEmployeeIds = new Set<string>();

    settings.forEach(s => {
      const shiftInfo = calculateShift(s, selectedDate);
      const op1 = employeeMap.get(s.operator1Id);
      const op2 = employeeMap.get(s.operator2Id);

      let activeMop: Employee | null = null;
      let activeRole: 'S' | 'M' | 'OFF' = 'OFF';

      if (selectedShift === 1) { // Shift Siang
        if (shiftInfo.operator1Role === 'S') {
          activeMop = op1 || null;
          activeRole = 'S';
        } else if (shiftInfo.operator2Role === 'S') {
          activeMop = op2 || null;
          activeRole = 'S';
        }
      } else { // Shift Malam
        if (shiftInfo.operator1Role === 'M') {
          activeMop = op1 || null;
          activeRole = 'M';
        } else if (shiftInfo.operator2Role === 'M') {
          activeMop = op2 || null;
          activeRole = 'M';
        }
      }

      if (activeMop && activeMop.status === 'Active' && activeRole !== 'OFF') {
        scheduledOnDutyEmployeeIds.add(activeMop.id);
      }
    });

    // 2. Main target items
    const initialUtama = settings
      .filter(s => s.groupId === 'utama')
      .map(setting => {
        const shiftInfo = calculateShift(setting, selectedDate);
        const op1 = employeeMap.get(setting.operator1Id);
        const op2 = employeeMap.get(setting.operator2Id);
        const unit = unitMap.get(setting.unitId);

        let activeOperator: Employee | null = null;
        let activeRoleStatus: 'S' | 'M' | 'OFF' = 'OFF';
        let originalOperator: Employee | null = null;

        const isConfiguredEmpty = selectedShift === 1 ? !setting.operator1Id : !setting.operator2Id;

        if (selectedShift === 1) {
          if (shiftInfo.operator1Role === 'S') {
            activeOperator = op1 || null;
            activeRoleStatus = 'S';
            originalOperator = op1 || null;
          } else if (shiftInfo.operator2Role === 'S') {
            activeOperator = op2 || null;
            activeRoleStatus = 'S';
            originalOperator = op2 || null;
          }
        } else {
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

        let isTransferredOut = false;
        if (activeOperator && operatorTransferTargetMap.has(activeOperator.id)) {
          const targetUnitId = operatorTransferTargetMap.get(activeOperator.id);
          if (targetUnitId !== setting.unitId) {
            isTransferredOut = true;
            activeOperator = null;
            activeRoleStatus = 'OFF';
          }
        }

        let isFilledByBackupTransfer = false;
        const transferredInOps = unitTransferredOperatorsListMap.get(setting.unitId);
        if (transferredInOps && transferredInOps.length > 0) {
          activeOperator = transferredInOps[0];
          activeRoleStatus = selectedShift === 1 ? 'S' : 'M';
          isFilledByBackupTransfer = true;
        }

        const isPrimaryActive = activeOperator && activeOperator.status === 'Active' && activeRoleStatus !== 'OFF';
        const isUnitBroken = unit && (unit.status === 'Breakdown' || unit.status === 'Maintenance');

        return {
          setting,
          unit,
          op1,
          op2,
          activeOperator,
          activeRoleStatus,
          shiftInfo,
          isFilledByMaster: false,
          backupFromSlot: undefined,
          originalOperator,
          isConfiguredEmpty,
          isFilledByBackupTransfer,
          isUnitBroken,
          isPrimaryActive,
          isTransferredOut,
          isFilledByBreakdownRelocation: false,
          breakdownOperatorFromUnitCode: undefined
        };
      });

    const configuredUnitIds = new Set(settings.map(s => s.unitId));
    const rawUnconfiguredUnits = units.filter(u => !configuredUnitIds.has(u.id));

    const targetUnconfiguredItems = rawUnconfiguredUnits.map(unit => {
      const mockSetting: UnitSetting = {
        id: `unconfig-setting-${unit.id}`,
        unitId: unit.id,
        groupId: 'utama',
        operator1Id: '',
        operator2Id: '',
        rosterPattern: '6-1',
        fixedOffDayOfWeek: 0,
        startSiangDate: selectedDate,
        createdAt: new Date().toISOString()
      } as any;

      return {
        setting: mockSetting,
        unit,
        op1: null,
        op2: null,
        activeOperator: null as Employee | null,
        activeRoleStatus: 'OFF' as const,
        shiftInfo: {
          operator1Role: 'OFF' as const,
          operator2Role: 'OFF' as const,
          operator1PatternName: 'None',
          operator2PatternName: 'None'
        },
        isFilledByMaster: false,
        backupFromSlot: undefined as string | undefined,
        originalOperator: null as Employee | null,
        isConfiguredEmpty: true,
        isFilledByBackupTransfer: false,
        isUnitBroken: unit.status === 'Breakdown' || unit.status === 'Maintenance',
        isPrimaryActive: false,
        isTransferredOut: false,
        isFilledByBreakdownRelocation: false,
        breakdownOperatorFromUnitCode: undefined as string | undefined,
        isUnconfiguredTarget: true
      };
    });

    const allTargets = [
      ...initialUtama,
      ...targetUnconfiguredItems
    ];

    const availableBreakdownCandidates: Array<{
      id: string;
      employee: Employee;
      specializations: string[];
      fromUnitCode: string;
      fromUnitId: string;
      settingId: string;
      isAssignedToUnitCode?: string;
    }> = [];

    initialUtama.forEach(item => {
      if (item.isPrimaryActive && item.isUnitBroken && !item.isFilledByBackupTransfer && !item.isTransferredOut) {
        if (item.activeOperator) {
          availableBreakdownCandidates.push({
            id: item.activeOperator.id,
            employee: item.activeOperator,
            specializations: item.activeOperator.specializations || [],
            fromUnitCode: item.unit?.unitCode || '',
            fromUnitId: item.unit?.id || '',
            settingId: item.setting.id
          });
          item.activeOperator = null;
          item.activeRoleStatus = 'OFF';
        }
      }
    });

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

        if (selectedShift === 1) {
          if (mShiftInfo.operator1Role === 'S') {
            activeMop = mop1 || null;
            activeRole = 'S';
          } else if (mShiftInfo.operator2Role === 'S') {
            activeMop = mop2 || null;
            activeRole = 'S';
          }
        } else {
          if (mShiftInfo.operator1Role === 'M') {
            activeMop = mop1 || null;
            activeRole = 'M';
          } else if (mShiftInfo.operator2Role === 'M') {
            activeMop = mop2 || null;
            activeRole = 'M';
          }
        }

        if (activeMop && activeMop.status === 'Active' && activeRole !== 'OFF') {
          const isManuallyTransferred = operatorTransferTargetMap.has(activeMop.id);
          if (!isManuallyTransferred) {
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
      }
    });

    // Relocate Breakdown primary operators
    allTargets.forEach(item => {
      const isVacantAndReady = item.unit && 
                               item.unit.status === 'Ready' && 
                               !item.activeOperator && 
                               !item.isFilledByBackupTransfer;

      if (isVacantAndReady && item.unit) {
        const eligibleBreakdowns = availableBreakdownCandidates
          .filter(cand => !cand.isAssignedToUnitCode)
          .filter(cand => cand.specializations.includes(item.unit!.type));

        if (eligibleBreakdowns.length > 0) {
          const matchedCand = eligibleBreakdowns[0];
          matchedCand.isAssignedToUnitCode = item.unit.unitCode;
          item.activeOperator = matchedCand.employee;
          item.activeRoleStatus = selectedShift === 1 ? 'S' : 'M';
          item.isFilledByBreakdownRelocation = true;
          item.breakdownOperatorFromUnitCode = matchedCand.fromUnitCode;
        }
      }
    });

    // Relay Master operators
    allTargets.forEach(item => {
      const isVacantAndReady = item.unit && 
                               item.unit.status === 'Ready' && 
                               !item.activeOperator && 
                               !item.isFilledByBackupTransfer;

      if (isVacantAndReady && item.unit) {
        const scoredCandidates = availableMasterCandidates
          .filter(cand => !cand.isAssignedToUnitCode)
          .filter(cand => {
            const hasSpecialization = (cand.specializations || []).includes(item.unit!.type);
            const hasPriorityUnit1 = cand.backupPriorityUnitId1 === item.unit!.id;
            const hasPriorityUnit2 = cand.backupPriorityUnitId2 === item.unit!.id;
            const hasPriorityType1 = cand.backupPriorityType1 === item.unit!.type;
            const hasPriorityType2 = cand.backupPriorityType2 === item.unit!.type;
            return hasSpecialization || hasPriorityUnit1 || hasPriorityUnit2 || hasPriorityType1 || hasPriorityType2;
          })
          .map(cand => {
            let score = 1;
            if (cand.backupPriorityUnitId1 && cand.backupPriorityUnitId1 === item.unit!.id) {
              score += 1000;
            } else if (cand.backupPriorityUnitId2 && cand.backupPriorityUnitId2 === item.unit!.id) {
              score += 500;
            } else if (cand.backupPriorityType1 && cand.backupPriorityType1 === item.unit!.type) {
              score += 200;
            } else if (cand.backupPriorityType2 && cand.backupPriorityType2 === item.unit!.type) {
              score += 100;
            } else if ((cand.specializations || []).includes(item.unit!.type)) {
              score += 10;
            }
            return { cand, score };
          });

        scoredCandidates.sort((a, b) => b.score - a.score);

        if (scoredCandidates.length > 0) {
          const matchedCand = scoredCandidates[0].cand;
          matchedCand.isAssignedToUnitCode = item.unit.unitCode;
          item.activeOperator = matchedCand.employee;
          item.activeRoleStatus = selectedShift === 1 ? 'S' : 'M';
          item.isFilledByMaster = true;
          item.backupFromSlot = matchedCand.masterSlotCode;
        }
      }
    });

    const mappedUtamaSettings = allTargets.filter(item => {
      if ((item as any).isUnconfiguredTarget) {
        return item.activeOperator !== null;
      }
      return true;
    });

    // Find Standby Masters (Master operators who are scheduled on-duty but NOT active on any unit)
    const assignedMasterIds = new Set(
      mappedUtamaSettings
        .filter(item => item.isFilledByMaster && item.activeOperator)
        .map(item => item.activeOperator!.id)
    );

    const standbyMastersList = availableMasterCandidates
      .filter(cand => !assignedMasterIds.has(cand.id))
      .map(cand => cand.employee);

    // Active operators in resolved
    const activeOperatorsAssignedCount = mappedUtamaSettings.filter(item => item.activeOperator && item.unit?.status === 'Ready').length;
    const unitsReadyNoOperatorList = units.filter(u => {
      if (u.status !== 'Ready') return false;
      const isFilled = mappedUtamaSettings.some(item => item.unit?.id === u.id && item.activeOperator);
      return !isFilled;
    });

    const readyStats = units.filter(u => u.status === 'Ready').length;
    const breakdownStats = units.filter(u => u.status === 'Breakdown' || u.status === 'Maintenance').length;

    return {
      resolvedSettings: mappedUtamaSettings,
      totalOnDutyOperators: scheduledOnDutyEmployeeIds.size,
      standbyMasters: standbyMastersList,
      unitsWithOperator: activeOperatorsAssignedCount,
      unitsNoOperator: unitsReadyNoOperatorList.length,
      readyCount: readyStats,
      breakdownCount: breakdownStats
    };
  }, [settings, selectedDate, selectedShift, employees, units, backupTransfers]);

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-700">
      {/* Header Panel */}
      <div className="bg-white text-slate-800 p-5 border-b border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-amber-500" />
            <h1 className="text-xl font-black tracking-tight text-slate-900">
              Resume Operator &amp; Unit
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Analisis alokasi operator, kekosongan unit, dan kesiapan armada saat ini
          </p>
        </div>

        {/* Quick Shift Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-bold gap-1 self-start md:self-center">
          <button
            onClick={() => setSelectedShift(1)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              selectedShift === 1
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sun className="h-3.5 w-3.5" />
            <span>Shift Siang</span>
          </button>
          <button
            onClick={() => setSelectedShift(2)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              selectedShift === 2
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Moon className="h-3.5 w-3.5" />
            <span>Shift Malam</span>
          </button>
        </div>

        {/* Date Navigator */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 text-xs font-semibold rounded-lg bg-white shadow-xs text-slate-800 outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Main Content Scroll Grid */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        {/* Active Shift Card Callout */}
        <div className={`p-4 rounded-xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
          selectedShift === 1 
            ? 'bg-amber-50/50 border-amber-200/60' 
            : 'bg-indigo-50/50 border-indigo-200/60'
        }`}>
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
              Shift Aktif: {selectedShift === 1 ? 'Siang' : 'Malam'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Menampilkan data terjadwal per tanggal <strong className="text-slate-700 font-extrabold">{formatIndonesianDate(selectedDate)}</strong> ({formatIndonesianDayName(selectedDate)})
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase border font-mono shadow-xs bg-white">
            <span className={`h-2 w-2 rounded-full ${selectedShift === 1 ? 'bg-amber-500 animate-pulse' : 'bg-indigo-500 animate-pulse'}`}></span>
            Status Sinkron Dinamis
          </div>
        </div>

        {/* 5 Big Resume Cards Requested by User */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* Card 1: Unit Tersetting Operator */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Unit Terisi Operator</span>
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-black text-slate-900">{unitsWithOperator}</span>
              <span className="text-xs text-slate-550 ml-1.5 font-bold">Unit</span>
            </div>
          </div>

          {/* Card 2: Unit No Operator */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Unit No Operator</span>
              <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
                <UserX className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-black text-rose-650">{unitsNoOperator}</span>
              <span className="text-xs text-rose-500 ml-1.5 font-bold">Unit</span>
            </div>
          </div>

          {/* Card 3: Unit Ready */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Unit Status Ready</span>
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-black text-slate-900">{readyCount}</span>
              <span className="text-xs text-slate-550 ml-1.5 font-bold">Unit</span>
            </div>
          </div>

          {/* Card 4: Unit Breakdown */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Unit Breakdown</span>
              <div className="p-2 rounded-lg bg-orange-50 text-orange-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-black text-orange-650">{breakdownCount}</span>
              <span className="text-xs text-orange-500 ml-1.5 font-bold">Unit</span>
            </div>
          </div>

          {/* Card 5: Operator Tersedia */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Operator Tersedia</span>
              <div className="p-2 rounded-lg bg-violet-50 text-violet-600">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-black text-slate-900">{totalOnDutyOperators}</span>
              <span className="text-xs text-slate-550 ml-1.5 font-bold">Aktif</span>
            </div>
          </div>

        </div>

        {/* Detailed Panels: Operator Standby & Unit Tanpa Operator */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* 1. Unit Tanpa Operator Lists */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[400px]">
            <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse"></div>
                <h3 className="font-black text-xs uppercase tracking-wider text-slate-700">
                  Daftar Unit Kosong / Tanpa Operator ({unitsNoOperator})
                </h3>
              </div>
              <span className="text-[10px] font-black uppercase bg-rose-100 text-rose-800 px-2 py-0.5 rounded">
                Kritis
              </span>
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-2.5">
              {units.filter(u => {
                if (u.status !== 'Ready') return false;
                const isFilled = resolvedSettings.some(item => item.unit?.id === u.id && item.activeOperator);
                return !isFilled;
              }).map(unit => (
                <div 
                  key={unit.id}
                  className="p-3 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50/50 flex justify-between items-center transition-all"
                >
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-805">{unit.unitCode}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{unit.brand} • {unit.type}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black uppercase bg-amber-100 text-amber-900 px-2.5 py-1 rounded-md border border-amber-200">
                      Butuh Operator
                    </span>
                  </div>
                </div>
              ))}

              {unitsNoOperator === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-slate-405 text-center p-8">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                  <p className="text-xs font-black uppercase text-slate-600">Semua Unit Terisi</p>
                  <p className="text-[10px] text-slate-400 mt-1">Seluruh unit ready sudah berhasil dialokasikan operator.</p>
                </div>
              )}
            </div>
          </div>

          {/* 2. Standby Master Operators Column */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[400px]">
            <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></div>
                <h3 className="font-black text-xs uppercase tracking-wider text-slate-700">
                  Reserves / Operator Master Standby ({standbyMasters.length})
                </h3>
              </div>
              <span className="text-[10px] font-black uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                Standby Pool
              </span>
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-2.5">
              {standbyMasters.map(employee => (
                <div 
                  key={employee.id}
                  className="p-3 rounded-lg border border-slate-200 hover:border-slate-350 bg-amber-50/10 flex justify-between items-center transition-all"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-sm text-slate-805">{employee.name}</h4>
                      <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 uppercase">
                        Master
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono mt-1">NRP {employee.nrp}</p>
                  </div>
                  <div className="flex flex-wrap gap-1 max-w-[50%] justify-end">
                    {employee.specializations?.map(spec => (
                      <span 
                        key={spec} 
                        className="text-[9px] font-extrabold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 uppercase"
                      >
                        {spec}
                      </span>
                    )) || (
                      <span className="text-[9px] font-extrabold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                        Dump Truck
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {standbyMasters.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-slate-405 text-center p-8">
                  <Armchair className="h-8 w-8 text-slate-355 mb-2" />
                  <p className="text-xs font-black uppercase text-slate-600">Tidak Ada Master Standby</p>
                  <p className="text-[10px] text-slate-400 mt-1">Seluruh operator master sedang dikerahkan mengisi unit kosong.</p>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
