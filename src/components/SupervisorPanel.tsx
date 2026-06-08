/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { HeavyUnit, Employee, UnitSetting, UnitGroup, BackupTransfer } from '../types';
import { calculateShift, generateDateRange, formatIndonesianDayName, formatIndonesianDate } from '../utils/scheduler';
import { 
  Building2, Truck, Users, Settings, Plus, Pencil, Trash2, Check, X, 
  HelpCircle, AlertCircle, Info, Calendar, CalendarDays, Eye, RefreshCw, Search, Sun, Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const EQUIPMENT_CATEGORIES = [
  'Wheel Loader',
  'Excavator',
  'Bulldozer',
  'Reach Stacker',
  'Forklift',
  'Dump Truck',
  'Flat Deck',
  'Water Truck',
  'Barge Loading Conveyor',
  'Weightbridge',
  'Kapten FD',
  'Motor Grader',
  'Compactor',
  'Other'
];

interface SupervisorPanelProps {
  units: HeavyUnit[];
  setUnits: React.Dispatch<React.SetStateAction<HeavyUnit[]>>;
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  settings: UnitSetting[];
  setSettings: React.Dispatch<React.SetStateAction<UnitSetting[]>>;
  groups: UnitGroup[];
  backupTransfers: BackupTransfer[];
  setBackupTransfers: React.Dispatch<React.SetStateAction<BackupTransfer[]>>;
  selectedDate: string; // From parent for calendar preview sync
  activeSettingIdForPanel?: string | null;
  setActiveSettingIdForPanel?: React.Dispatch<React.SetStateAction<string | null>>;
}

export default function SupervisorPanel({
  units,
  setUnits,
  employees,
  setEmployees,
  settings,
  setSettings,
  groups,
  backupTransfers,
  setBackupTransfers,
  selectedDate,
  activeSettingIdForPanel,
  setActiveSettingIdForPanel
}: SupervisorPanelProps) {
  // Main Navigation Menu Tabs (Jendela 2)
  const [activeMenu, setActiveMenu] = useState<'unit_db' | 'employee_db' | 'unit_settings' | 'backup_settings'>('unit_settings');

  // Search & Sort States for Unit Database
  const [unitSearchQuery, setUnitSearchQuery] = useState('');
  const [unitSortBy, setUnitSortBy] = useState<'unitCode' | 'type' | 'brand' | 'status'>('unitCode');
  const [unitSortOrder, setUnitSortOrder] = useState<'asc' | 'desc'>('asc');

  // Search & Sort States for Employee Database
  const [empSearchQuery, setEmpSearchQuery] = useState('');
  const [empSortBy, setEmpSortBy] = useState<'nrp' | 'name' | 'status' | 'rosterPattern'>('nrp');
  const [empSortOrder, setEmpSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Setting Submenus
  const [activeSubSetting, setActiveSubSetting] = useState<string>('utama'); // 'utama' or 'master'
  const [expandedSettingId, setExpandedSettingId] = useState<string | null>('s1'); // Expand s1 by default to show image 2 mockup
  const [settingSearchQuery, setSettingSearchQuery] = useState('');

  // Synchronize navigation from the unit dashboard
  React.useEffect(() => {
    if (activeSettingIdForPanel) {
      setExpandedSettingId(activeSettingIdForPanel);
      setActiveMenu('unit_settings');
      const foundSetting = settings.find(s => s.id === activeSettingIdForPanel);
      if (foundSetting) {
        setActiveSubSetting(foundSetting.groupId);
      }
      if (setActiveSettingIdForPanel) {
        setActiveSettingIdForPanel(null);
      }
    }
  }, [activeSettingIdForPanel, settings, setActiveSettingIdForPanel]);

  // Database Unit states
  const [unitFormOpen, setUnitFormOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<HeavyUnit | null>(null);
  const [unitCode, setUnitCode] = useState('');
  const [unitBrand, setUnitBrand] = useState('');
  const [unitType, setUnitType] = useState<HeavyUnit['type']>('Dump Truck');
  const [unitStatus, setUnitStatus] = useState<HeavyUnit['status']>('Ready');

  // Database Karyawan states
  const [empFormOpen, setEmpFormOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [empNrp, setEmpNrp] = useState('');
  const [empName, setEmpName] = useState('');
  const [empRoster, setEmpRoster] = useState<Employee['rosterPattern']>('6-1');
  const [empStatus, setEmpStatus] = useState<Employee['status']>('Active');
  const [empSpecializations, setEmpSpecializations] = useState<string[]>(['Dump Truck']);

  // Setting Unit states
  const [settingFormOpen, setSettingFormOpen] = useState(false);
  const [editingSetting, setEditingSetting] = useState<UnitSetting | null>(null);
  const [setGroupId, setSetGroupId] = useState('utama');
  const [setUnitId, setSetUnitId] = useState('');
  const [setMasterSlotCode, setSetMasterSlotCode] = useState('M-1');
  const [setOp1Id, setSetOp1Id] = useState('');
  const [setOp2Id, setSetOp2Id] = useState('');
  const [setRosterPattern, setSetRosterPattern] = useState<UnitSetting['rosterPattern']>('6-1');
  const [setFixedOffDay, setSetFixedOffDay] = useState(0); // 0 = Sunday
  const [setStartSiangDate, setSetStartSiangDate] = useState('2026-06-01');
  const [setBackupPriorityType1, setSetBackupPriorityType1] = useState('');
  const [setBackupPriorityType2, setSetBackupPriorityType2] = useState('');
  const [setBackupPriorityUnitId1, setSetBackupPriorityUnitId1] = useState('');
  const [setBackupPriorityUnitId2, setSetBackupPriorityUnitId2] = useState('');

  // Backup Transfer states
  const [backupFormOpen, setBackupFormOpen] = useState(false);
  const [editingBackup, setEditingBackup] = useState<BackupTransfer | null>(null);
  const [backupOperatorId, setBackupOperatorId] = useState('');
  const [backupTargetUnitId, setBackupTargetUnitId] = useState('');
  const [backupDate, setBackupDate] = useState(selectedDate);
  const [backupShift, setBackupShift] = useState<1 | 2>(1);

  React.useEffect(() => {
    if (!backupDate) {
      setBackupDate(selectedDate);
    }
  }, [selectedDate]);

  // 8-Day rolling calendar starting point for setting previews (mimics Image 2)
  const [previewStartDate, setPreviewStartDate] = useState('2026-06-01');

  // Helper map lookups for fast calculations
  const unitMap = useMemo(() => new Map(units.map(u => [u.id, u])), [units]);
  const employeeMap = useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);

  // Computed and filtered/sorted lists for Database Unit
  const filteredAndSortedUnits = useMemo(() => {
    let result = [...units];

    // Filter by search query
    if (unitSearchQuery.trim()) {
      const q = unitSearchQuery.toLowerCase();
      result = result.filter(u => 
        u.unitCode.toLowerCase().includes(q) || 
        u.brand.toLowerCase().includes(q) || 
        u.type.toLowerCase().includes(q)
      );
    }

    // Sort by selected property
    result.sort((a, b) => {
      const valA = (a[unitSortBy] || '').toString().toLowerCase();
      const valB = (b[unitSortBy] || '').toString().toLowerCase();
      if (valA < valB) return unitSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return unitSortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [units, unitSearchQuery, unitSortBy, unitSortOrder]);

  // Computed and filtered/sorted lists for Database Employees (Karyawan)
  const filteredAndSortedEmployees = useMemo(() => {
    let result = [...employees];

    // Filter by search query
    if (empSearchQuery.trim()) {
      const q = empSearchQuery.toLowerCase();
      result = result.filter(e => 
        e.nrp.toLowerCase().includes(q) || 
        e.name.toLowerCase().includes(q) ||
        (e.specializations || []).some(spec => spec.toLowerCase().includes(q))
      );
    }

    // Sort by selected property
    result.sort((a, b) => {
      const valA = (a[empSortBy] || '').toString().toLowerCase();
      const valB = (b[empSortBy] || '').toString().toLowerCase();
      if (valA < valB) return empSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return empSortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [employees, empSearchQuery, empSortBy, empSortOrder]);

  // Handle unit CRUD
  const saveUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitCode) return;

    if (editingUnit) {
      setUnits(prev => prev.map(u => u.id === editingUnit.id 
        ? { ...u, unitCode: unitCode.trim().toUpperCase(), brand: unitBrand, type: unitType, status: unitStatus }
        : u
      ));
    } else {
      const newUnit: HeavyUnit = {
        id: 'u_' + Date.now(),
        unitCode: unitCode.trim().toUpperCase(),
        brand: unitBrand || 'Alat Berat Baru',
        type: unitType,
        status: unitStatus
      };
      setUnits(prev => [...prev, newUnit]);
    }
    resetUnitForm();
  };

  const resetUnitForm = () => {
    setUnitFormOpen(false);
    setEditingUnit(null);
    setUnitCode('');
    setUnitBrand('');
    setUnitType('Dump Truck');
    setUnitStatus('Ready');
  };

  const startEditUnit = (u: HeavyUnit) => {
    setEditingUnit(u);
    setUnitCode(u.unitCode);
    setUnitBrand(u.brand);
    setUnitType(u.type);
    setUnitStatus(u.status);
    setUnitFormOpen(true);
  };

  const deleteUnit = (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus Unit ini?')) {
      setUnits(prev => prev.filter(u => u.id !== id));
      // Remove setting too if bound
      setSettings(prev => prev.filter(s => s.unitId !== id));
    }
  };

  // Handle employee CRUD
  const saveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName || !empNrp) return;

    if (editingEmp) {
      setEmployees(prev => prev.map(emp => emp.id === editingEmp.id
        ? { ...emp, nrp: empNrp.trim().toUpperCase(), name: empName.trim().toUpperCase(), rosterPattern: empRoster, status: empStatus, specializations: empSpecializations }
        : emp
      ));
    } else {
      const newEmp: Employee = {
        id: 'e_' + Date.now(),
        nrp: empNrp.trim().toUpperCase(),
        name: empName.trim().toUpperCase(),
        rosterPattern: empRoster,
        status: empStatus,
        specializations: empSpecializations
      };
      setEmployees(prev => [...prev, newEmp]);
    }
    resetEmployeeForm();
  };

  const resetEmployeeForm = () => {
    setEmpFormOpen(false);
    setEditingEmp(null);
    setEmpNrp('');
    setEmpName('');
    setEmpRoster('6-1');
    setEmpStatus('Active');
    setEmpSpecializations(['Dump Truck']);
  };

  const startEditEmployee = (emp: Employee) => {
    setEditingEmp(emp);
    setEmpNrp(emp.nrp);
    setEmpName(emp.name);
    setEmpRoster(emp.rosterPattern);
    setEmpStatus(emp.status);
    setEmpSpecializations(emp.specializations || ['Dump Truck']);
    setEmpFormOpen(true);
  };

  const deleteEmployee = (id: string) => {
    if (confirm('Apakah Anda yakin menghapus Karyawan ini?')) {
      setEmployees(prev => prev.filter(emp => emp.id !== id));
      // Break any setting bindings
      setSettings(prev => prev.filter(s => s.operator1Id !== id && s.operator2Id !== id));
    }
  };

  // Handle Settings CRUD
  const saveSetting = (e: React.FormEvent) => {
    e.preventDefault();
    const isMaster = setGroupId === 'master';

    if (!isMaster && !setUnitId) {
      alert('Mohon pilih Unit Alat Berat!');
      return;
    }
    if (isMaster && !setMasterSlotCode) {
      alert('Mohon isi Nomor Slot Master (e.g. M-1, M-2)!');
      return;
    }
    if (!setOp1Id && !setOp2Id) {
      alert('Mohon pilih minimal satu Operator untuk dikonfigurasi!');
      return;
    }
    if (setOp1Id && setOp2Id && setOp1Id === setOp2Id) {
      alert('Operator 1 dan Operator 2 tidak boleh orang yang sama!');
      return;
    }

    // Check conflict
    if (isMaster) {
      const hasConflictSlot = settings.some(s => s.groupId === 'master' && s.masterSlotCode?.trim().toUpperCase() === setMasterSlotCode.trim().toUpperCase() && (!editingSetting || s.id !== editingSetting.id));
      if (hasConflictSlot) {
        alert(`Slot Master ${setMasterSlotCode.trim().toUpperCase()} sudah dikonfigurasi!`);
        return;
      }
    } else {
      const hasConflictUnit = settings.some(s => s.unitId === setUnitId && s.groupId === setGroupId && (!editingSetting || s.id !== editingSetting.id));
      if (hasConflictUnit) {
        alert('Unit Alat Berat ini sudah dikonfigurasi di grup penugasan ini!');
        return;
      }
    }

    if (editingSetting) {
      setSettings(prev => prev.map(s => s.id === editingSetting.id
        ? {
            ...s,
            groupId: setGroupId,
            unitId: isMaster ? '' : setUnitId,
            masterSlotCode: isMaster ? setMasterSlotCode.trim().toUpperCase() : undefined,
            operator1Id: setOp1Id,
            operator2Id: setOp2Id,
            rosterPattern: setRosterPattern,
            fixedOffDayOfWeek: setFixedOffDay,
            startSiangDate: setStartSiangDate,
            backupPriorityType1: isMaster ? setBackupPriorityType1 : undefined,
            backupPriorityType2: isMaster ? setBackupPriorityType2 : undefined,
            backupPriorityUnitId1: isMaster ? setBackupPriorityUnitId1 : undefined,
            backupPriorityUnitId2: isMaster ? setBackupPriorityUnitId2 : undefined
          }
        : s
      ));
    } else {
      const newSetting: UnitSetting = {
        id: 's_' + Date.now(),
        groupId: setGroupId,
        unitId: isMaster ? '' : setUnitId,
        masterSlotCode: isMaster ? setMasterSlotCode.trim().toUpperCase() : undefined,
        operator1Id: setOp1Id,
        operator2Id: setOp2Id,
        rosterPattern: setRosterPattern,
        fixedOffDayOfWeek: setFixedOffDay,
        startSiangDate: setStartSiangDate,
        backupPriorityType1: isMaster ? setBackupPriorityType1 : undefined,
        backupPriorityType2: isMaster ? setBackupPriorityType2 : undefined,
        backupPriorityUnitId1: isMaster ? setBackupPriorityUnitId1 : undefined,
        backupPriorityUnitId2: isMaster ? setBackupPriorityUnitId2 : undefined
      };
      setSettings(prev => [...prev, newSetting]);
    }
    resetSettingForm();
  };

  const resetSettingForm = () => {
    setSettingFormOpen(false);
    setEditingSetting(null);
    setSetGroupId('utama');
    setSetUnitId('');
    setSetMasterSlotCode('M-1');
    setSetOp1Id('');
    setSetOp2Id('');
    setSetRosterPattern('6-1');
    setSetFixedOffDay(0);
    setSetStartSiangDate('2026-06-01');
    setSetBackupPriorityType1('');
    setSetBackupPriorityType2('');
    setSetBackupPriorityUnitId1('');
    setSetBackupPriorityUnitId2('');
  };

  const startAddSetting = (gId: string) => {
    resetSettingForm();
    setSetGroupId(gId);
    if (gId === 'master') {
      const masterCodes = settings
        .filter(s => s.groupId === 'master' && s.masterSlotCode)
        .map(s => {
          const match = s.masterSlotCode?.match(/M-(\d+)/i);
          return match ? parseInt(match[1], 10) : 0;
        });
      const nextNum = masterCodes.length > 0 ? Math.max(...masterCodes) + 1 : 1;
      setSetMasterSlotCode(`M-${nextNum}`);
      setSetUnitId('');
    } else {
      // Find first unconfigured unit to default
      const configuredUnitIds = new Set(settings.map(s => s.unitId));
      const firstUnconfigured = units.find(u => !configuredUnitIds.has(u.id));
      if (firstUnconfigured) {
        setSetUnitId(firstUnconfigured.id);
      }
    }
    setSettingFormOpen(true);
  };

  const startEditSetting = (s: UnitSetting) => {
    setEditingSetting(s);
    setSetGroupId(s.groupId);
    setSetUnitId(s.unitId || '');
    setSetMasterSlotCode(s.masterSlotCode || 'M-1');
    setSetOp1Id(s.operator1Id);
    setSetOp2Id(s.operator2Id);
    setSetRosterPattern(s.rosterPattern);
    setSetFixedOffDay(s.fixedOffDayOfWeek);
    setSetStartSiangDate(s.startSiangDate);
    setSetBackupPriorityType1(s.backupPriorityType1 || '');
    setSetBackupPriorityType2(s.backupPriorityType2 || '');
    setSetBackupPriorityUnitId1(s.backupPriorityUnitId1 || '');
    setSetBackupPriorityUnitId2(s.backupPriorityUnitId2 || '');
    setSettingFormOpen(true);
  };

  const deleteSetting = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid expanding cell click
    if (confirm('Apakah Anda yakin menghapus penugasan ini?')) {
      setSettings(prev => prev.filter(s => s.id !== id));
      if (expandedSettingId === id) setExpandedSettingId(null);
    }
  };

  // Generate local dates for schedule mockup preview (Day 1 - 8)
  const rollingDates = useMemo(() => {
    return generateDateRange(previewStartDate, 8);
  }, [previewStartDate]);

  // Split configurations by group for submenus with search & sort defaults by Code
  const groupedSettings = useMemo(() => {
    let list = settings.filter(s => s.groupId === activeSubSetting);

    if (settingSearchQuery.trim()) {
      const q = settingSearchQuery.toLowerCase();
      list = list.filter(s => {
        const isMaster = s.groupId === 'master';
        const unit = !isMaster ? unitMap.get(s.unitId) : null;
        const code = isMaster ? (s.masterSlotCode || '') : (unit ? unit.unitCode : '');
        const brand = isMaster ? '' : (unit ? unit.brand : '');
        const op1 = employeeMap.get(s.operator1Id);
        const op2 = employeeMap.get(s.operator2Id);
        return code.toLowerCase().includes(q) || 
               brand.toLowerCase().includes(q) ||
               (op1?.name || '').toLowerCase().includes(q) ||
               (op2?.name || '').toLowerCase().includes(q);
      });
    }

    list.sort((a, b) => {
      const isMasterA = a.groupId === 'master';
      const isMasterB = b.groupId === 'master';
      const codeA = isMasterA ? (a.masterSlotCode || '') : (unitMap.get(a.unitId)?.unitCode || '');
      const codeB = isMasterB ? (b.masterSlotCode || '') : (unitMap.get(b.unitId)?.unitCode || '');
      return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
    });

    return list;
  }, [settings, activeSubSetting, settingSearchQuery, unitMap, employeeMap]);

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-700" id="supervisor-panel-container">
      
      {/* Jendela 2 Main Tabs Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm z-10">
        <div className="px-5 pt-4">
          <h2 className="text-base font-black text-slate-805 mt-1">Konfigurasi &amp; Manajemen Database</h2>
        </div>

        {/* Tab switch buttons */}
        <div className="flex gap-1 px-5 mt-4">
          <button
            id="tab-settings-unit"
            onClick={() => setActiveMenu('unit_settings')}
            className={`flex items-center gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all cursor-pointer ${
              activeMenu === 'unit_settings'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            <span>SETTINGAN OPERATOR</span>
          </button>

          <button
            id="tab-settings-backup"
            onClick={() => setActiveMenu('backup_settings')}
            className={`flex items-center gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all cursor-pointer ${
              activeMenu === 'backup_settings'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <RefreshCw className="h-4 w-4 text-indigo-505 shrink-0" />
            <span>SETTINGAN BACKUP</span>
          </button>

          <button
            id="tab-unit-db"
            onClick={() => setActiveMenu('unit_db')}
            className={`flex items-center gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all cursor-pointer ${
              activeMenu === 'unit_db'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck className="h-4 w-4" />
            <span>DATABASE UNIT</span>
          </button>

          <button
            id="tab-employee-db"
            onClick={() => setActiveMenu('employee_db')}
            className={`flex items-center gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all cursor-pointer ${
              activeMenu === 'employee_db'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Database Karyawan</span>
          </button>
        </div>
      </div>

      {/* Main Panel Content Body */}
      <div className="flex-1 p-6 overflow-y-auto bg-slate-100">
        <AnimatePresence mode="wait">
          
          {/* ==================== MENU 1: DATABASE UNIT ==================== */}
          {activeMenu === 'unit_db' && (
            <motion.div
              key="unit_db_section"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-lg border border-slate-200 gap-4 shadow-sm">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Data Alat Berat</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Daftar nomor unit dan jenis alat berat Dept Operation</p>
                </div>
                <button
                  id="add-unit-btn"
                  onClick={() => { resetUnitForm(); setUnitFormOpen(true); }}
                  className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs py-2 px-4 rounded transition cursor-pointer shadow-sm"
                >
                  <Plus className="h-4 w-4" /> Add Unit Baru
                </button>
              </div>

              {/* Search & Sort Filtering Bar */}
              <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-80">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <Search className="h-4 w-4 text-slate-400" />
                  </span>
                  <input
                    type="text"
                    placeholder="Cari Kode Unit, Merek, atau Jenis..."
                    value={unitSearchQuery}
                    onChange={(e) => setUnitSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 w-full bg-slate-50 border border-slate-200 rounded text-xs text-slate-850 focus:outline-none focus:border-amber-500 transition"
                  />
                  {unitSearchQuery && (
                    <button 
                      onClick={() => setUnitSearchQuery('')} 
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-650 text-[10px] uppercase font-bold"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto shrink-0 justify-end">
                  <span className="text-[11px] text-slate-500 font-extrabold font-mono uppercase tracking-wider">Urutkan:</span>
                  <div className="flex items-center gap-1 bg-slate-50 p-1 border border-slate-200 rounded text-xs font-bold">
                    <select
                      value={unitSortBy}
                      onChange={(e) => setUnitSortBy(e.target.value as any)}
                      className="bg-transparent border-none text-slate-700 p-1 cursor-pointer focus:outline-none"
                    >
                      <option value="unitCode">Kode Unit</option>
                      <option value="type">Kategori Alat</option>
                      <option value="brand">Nama / Merek</option>
                      <option value="status">Status Kondisi</option>
                    </select>
                    <span className="text-slate-350">|</span>
                    <select
                      value={unitSortOrder}
                      onChange={(e) => setUnitSortOrder(e.target.value as 'asc' | 'desc')}
                      className="bg-transparent border-none text-amber-600 p-1 cursor-pointer focus:outline-none font-bold"
                    >
                      <option value="asc">A-Z (Asc)</option>
                      <option value="desc">Z-A (Desc)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* POP-UP CENTERED MODAL FOR ADDING ROW (Satisfies "tidak perlu scrolling" and keeps it elegant) */}
              {unitFormOpen && !editingUnit && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xl w-full max-w-lg space-y-4"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <h4 className="font-extrabold text-slate-905 text-sm uppercase tracking-wider flex items-center gap-2">
                        <Truck className="h-4 w-4 text-amber-500" /> Registrasi Armada Unit Baru
                      </h4>
                      <button onClick={resetUnitForm} className="text-slate-400 hover:text-slate-650 cursor-pointer">
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <form onSubmit={saveUnit} className="space-y-4">
                      <div className="space-y-3.5">
                        <div>
                          <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1.5 font-mono">Kode Unit (e.g. DT-01)</label>
                          <input
                            type="text"
                            value={unitCode}
                            onChange={(e) => setUnitCode(e.target.value)}
                            placeholder="DT-01"
                            required
                            className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs text-slate-805 focus:outline-none focus:border-amber-500 transition uppercase font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1.5 font-mono">Merek / Seri Mesin (e.g. Scania P410)</label>
                          <input
                            type="text"
                            value={unitBrand}
                            onChange={(e) => setUnitBrand(e.target.value)}
                            placeholder="Volvo FMX / Komatsu PC400"
                            required
                            className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs text-slate-805 focus:outline-none focus:border-amber-500 transition"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1.5 font-mono">Kategori Tipe Alat</label>
                          <select
                            value={unitType}
                            onChange={(e) => setUnitType(e.target.value as HeavyUnit['type'])}
                            className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500 transition cursor-pointer font-bold"
                          >
                            <option value="Wheel Loader">Wheel Loader (WL)</option>
                            <option value="Excavator">Excavator (EX)</option>
                            <option value="Bulldozer">Bulldozer (DZ)</option>
                            <option value="Reach Stacker">Reach Stacker (RS)</option>
                            <option value="Forklift">Forklift (FL)</option>
                            <option value="Dump Truck">Dump Truck (DT)</option>
                            <option value="Flat Deck">Flat Deck (FD)</option>
                            <option value="Water Truck">Water Truck (WT)</option>
                            <option value="Barge Loading Conveyor">Barge Loading Conveyor (BLC)</option>
                            <option value="Weightbridge">Weightbridge (WB)</option>
                            <option value="Kapten FD">Kapten FD (KFD)</option>
                            <option value="Motor Grader">Motor Grader (GD)</option>
                            <option value="Compactor">Compactor (VC)</option>
                            <option value="Other">Lain-lain / Lainnya</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase text-slate-505 font-bold mb-1.5 font-mono">Status Lapangan</label>
                          <select
                            value={unitStatus}
                            onChange={(e) => setUnitStatus(e.target.value as HeavyUnit['status'])}
                            className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-550 transition cursor-pointer font-bold"
                          >
                            <option value="Ready">Ready (Siap Jalan)</option>
                            <option value="Maintenance">Maintenance (Servis Berkala)</option>
                            <option value="Breakdown">Breakdown (Mogok / Rusak)</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={resetUnitForm}
                          className="px-4 py-2 border border-slate-200 bg-transparent rounded text-xs font-bold text-slate-505 hover:bg-slate-50 transition cursor-pointer"
                        >
                          Batalkan
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded text-xs transition flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" /> Simpan Unit
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}

              {/* Data Table with Inline Row Pop-up Editor right beneath the selected element */}
              <div className="bg-white rounded-lg border border-slate-200 overflow-visible shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="p-4">Kode Unit</th>
                      <th className="p-4">Kategori Alat</th>
                      <th className="p-4">Nama / Seri Merek</th>
                      <th className="p-4">Status Kondisi</th>
                      <th className="p-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {filteredAndSortedUnits.map(u => {
                      const isEditing = editingUnit && editingUnit.id === u.id;
                      return (
                        <React.Fragment key={u.id}>
                          <tr className={`hover:bg-slate-50/80 transition-all ${isEditing ? 'bg-amber-50/20 font-medium' : ''}`}>
                            <td className="p-4 font-extrabold font-mono text-amber-600 text-sm">
                              {u.unitCode}
                            </td>
                            <td className="p-4">
                              <span className="px-2 py-0.5 rounded-sm bg-slate-100 text-slate-700 font-bold text-[10px] uppercase border border-slate-200 font-mono">
                                {u.type === 'Motor Grader' ? 'Motor Grader (GD)' : u.type === 'Compactor' ? 'Compactor (VC)' : u.type}
                              </span>
                            </td>
                            <td className="p-4 font-bold text-slate-800">{u.brand}</td>
                            <td className="p-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                                u.status === 'Ready' 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                  : u.status === 'Maintenance'
                                    ? 'bg-amber-50 text-amber-700 border-amber-250'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  u.status === 'Ready' ? 'bg-emerald-500 animate-pulse' : u.status === 'Maintenance' ? 'bg-amber-500' : 'bg-rose-500'
                                }`}></span>
                                {u.status}
                              </span>
                            </td>
                            <td className="p-4 text-right flex justify-end gap-1.5">
                              <button
                                onClick={() => startEditUnit(u)}
                                className={`p-1.5 rounded transition duration-150 cursor-pointer ${
                                  isEditing 
                                    ? 'bg-amber-400 text-slate-950 font-extrabold shadow-sm scale-105' 
                                    : 'text-slate-400 hover:text-amber-600 hover:bg-slate-100'
                                }`}
                                title="Edit Unit (Form di bawah terpilih)"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => deleteUnit(u.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 transition cursor-pointer"
                                title="Hapus Unit"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>

                          {/* INLINE POP-UP EDIT FORM (UNDER SELECT TARGET) */}
                          {isEditing && (
                            <tr className="bg-amber-50/10" id={`edit-unit-inline-${u.id}`}>
                              <td colSpan={5} className="p-4 border-y-2 border-amber-400 bg-amber-500/5">
                                <motion.div
                                  initial={{ opacity: 0, y: -5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="bg-white p-5 rounded-lg border border-amber-200 shadow-md space-y-4"
                                >
                                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                    <h5 className="font-extrabold text-slate-850 text-xs uppercase tracking-wider flex items-center gap-1 text-amber-700 font-mono">
                                      <Pencil className="h-3.5 w-3.5 text-amber-500" />
                                      {u.unitCode}
                                    </h5>
                                    <button onClick={resetUnitForm} className="text-slate-400 hover:text-slate-650 cursor-pointer">
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>

                                  <form onSubmit={saveUnit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                    <div>
                                      <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1.5 font-mono">Kode Unit (e.g. GD-10)</label>
                                      <input
                                        type="text"
                                        value={unitCode}
                                        onChange={(e) => setUnitCode(e.target.value)}
                                        placeholder="GD-10"
                                        required
                                        className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-850 focus:outline-none focus:border-amber-500 transition font-extrabold uppercase"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1.5 font-mono">Merek / Seri Mesin</label>
                                      <input
                                        type="text"
                                        value={unitBrand}
                                        onChange={(e) => setUnitBrand(e.target.value)}
                                        placeholder="Caterpillar 14M"
                                        required
                                        className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-850 focus:outline-none focus:border-amber-500 transition"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] uppercase text-slate-505 font-bold mb-1.5 font-mono">Kategori Alat</label>
                                      <select
                                        value={unitType}
                                        onChange={(e) => setUnitType(e.target.value as HeavyUnit['type'])}
                                        className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-850 focus:outline-none focus:border-amber-500 transition font-bold"
                                      >
                                        <option value="Wheel Loader">Wheel Loader (WL)</option>
                                        <option value="Excavator">Excavator (EX)</option>
                                        <option value="Bulldozer">Bulldozer (DZ)</option>
                                        <option value="Reach Stacker">Reach Stacker (RS)</option>
                                        <option value="Forklift">Forklift (FL)</option>
                                        <option value="Dump Truck">Dump Truck (DT)</option>
                                        <option value="Flat Deck">Flat Deck (FD)</option>
                                        <option value="Water Truck">Water Truck (WT)</option>
                                        <option value="Barge Loading Conveyor">Barge Loading Conveyor (BLC)</option>
                                        <option value="Weightbridge">Weightbridge (WB)</option>
                                        <option value="Kapten FD">Kapten FD (KFD)</option>
                                        <option value="Motor Grader">Motor Grader (GD)</option>
                                        <option value="Compactor">Compactor (VC)</option>
                                        <option value="Other">Lain-lain / Lainnya</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-[10px] uppercase text-slate-505 font-bold mb-1.5 font-mono">Status Kondisi</label>
                                      <select
                                        value={unitStatus}
                                        onChange={(e) => setUnitStatus(e.target.value as HeavyUnit['status'])}
                                        className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-850 focus:outline-none focus:border-amber-500 transition font-bold"
                                      >
                                        <option value="Ready">Ready (Siap Jalan)</option>
                                        <option value="Maintenance">Maintenance (Servis Berkala)</option>
                                        <option value="Breakdown">Breakdown (Mogok / Rusak)</option>
                                      </select>
                                    </div>

                                    <div className="md:col-span-4 flex justify-end gap-2 pt-2 border-t border-slate-100">
                                      <button
                                        type="button"
                                        onClick={resetUnitForm}
                                        className="px-3.5 py-1.5 border border-slate-200 bg-transparent rounded text-[11px] font-bold text-slate-400 hover:bg-slate-50 transition cursor-pointer animate-none"
                                      >
                                        Batal
                                      </button>
                                      <button
                                        type="submit"
                                        className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded text-[11px] transition flex items-center gap-1 cursor-pointer"
                                      >
                                        <Check className="h-3.5 w-3.5" /> Simpan Perubahan
                                      </button>
                                    </div>
                                  </form>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {filteredAndSortedUnits.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500">
                          {unitSearchQuery ? 'Tidak ada unit yang cocok dengan kriteria pencarian.' : 'Database unit kosong. Klik "Add Unit Baru" untuk menambah.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* ==================== MENU 2: DATABASE KARYAWAN ==================== */}
          {activeMenu === 'employee_db' && (
            <motion.div
              key="employee_db_section"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-lg border border-slate-200 gap-4 shadow-sm">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Data Manpower Operation</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Daftar karyawan yang dapat mengoperasikan alat berat</p>
                </div>
                <button
                  id="add-emp-btn"
                  onClick={() => { resetEmployeeForm(); setEmpFormOpen(true); }}
                  className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs py-2 px-4 rounded transition cursor-pointer shadow-sm animate-none"
                >
                  <Plus className="h-4 w-4" /> Add Operator Baru
                </button>
              </div>

              {/* Search & Sort Filtering Bar for Employee DB */}
              <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-80">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <Search className="h-4 w-4 text-slate-400" />
                  </span>
                  <input
                    type="text"
                    placeholder="Cari NRP, Nama, atau EGI Spesialisasi..."
                    value={empSearchQuery}
                    onChange={(e) => setEmpSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 w-full bg-slate-50 border border-slate-200 rounded text-xs text-slate-850 focus:outline-none focus:border-amber-500 transition"
                  />
                  {empSearchQuery && (
                    <button 
                      onClick={() => setEmpSearchQuery('')} 
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-655 text-[10px] uppercase font-bold"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto shrink-0 justify-end">
                  <span className="text-[11px] text-slate-500 font-extrabold font-mono uppercase tracking-wider">Urutkan Karyawan:</span>
                  <div className="flex items-center gap-1 bg-slate-50 p-1 border border-slate-200 rounded text-xs font-bold">
                    <select
                      value={empSortBy}
                      onChange={(e) => setEmpSortBy(e.target.value as any)}
                      className="bg-transparent border-none text-slate-700 p-1 cursor-pointer focus:outline-none font-bold"
                    >
                      <option value="nrp">NIK Karyawan</option>
                      <option value="name">Nama Lengkap</option>
                      <option value="rosterPattern">Default Roster</option>
                      <option value="status">Status Tugas</option>
                    </select>
                    <span className="text-slate-350">|</span>
                    <select
                      value={empSortOrder}
                      onChange={(e) => setEmpSortOrder(e.target.value as 'asc' | 'desc')}
                      className="bg-transparent border-none text-amber-600 p-1 cursor-pointer focus:outline-none font-bold"
                    >
                      <option value="asc">A-Z (Asc)</option>
                      <option value="desc">Z-A (Desc)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* POP-UP CENTERED MODAL FOR ADDING EMPLOYEE (Eliminates scrolling, satisfies requirements) */}
              {empFormOpen && !editingEmp && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xl w-full max-w-lg space-y-4"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <h4 className="font-extrabold text-slate-905 text-sm uppercase tracking-wider flex items-center gap-2">
                        <Users className="h-4 w-4 text-amber-500" /> Registrasi Operator Manpower Baru
                      </h4>
                      <button onClick={resetEmployeeForm} className="text-slate-400 hover:text-slate-650 cursor-pointer">
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <form onSubmit={saveEmployee} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1.5 font-mono">NIK Karyawan (e.g. NIK9901)</label>
                          <input
                            type="text"
                            value={empNrp}
                            onChange={(e) => setEmpNrp(e.target.value)}
                            placeholder="NIK99201"
                            required
                            className="w-full bg-slate-50 border border-slate-205 rounded px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500 transition uppercase font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1.5 font-mono">Nama Lengkap Operator</label>
                          <input
                            type="text"
                            value={empName}
                            onChange={(e) => setEmpName(e.target.value)}
                            placeholder="BUDI SANTOSO"
                            required
                            className="w-full bg-slate-50 border border-slate-205 rounded px-3 py-2 text-xs text-slate-805 focus:outline-none focus:border-amber-500 transition uppercase"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1.5 font-mono">Pola Roster Default</label>
                          <select
                            value={empRoster}
                            onChange={(e) => setEmpRoster(e.target.value as Employee['rosterPattern'])}
                            className="w-full bg-slate-50 border border-slate-205 rounded px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500 transition cursor-pointer font-bold"
                          >
                            <option value="6-1">Roster 6-1 (6 Hari Kerja, 1 Off)</option>
                            <option value="13-1">Roster 13-1 (13 Hari Kerja, 1 Off)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1.5 font-mono">Status Pekerja</label>
                          <select
                            value={empStatus}
                            onChange={(e) => setEmpStatus(e.target.value as Employee['status'])}
                            className="w-full bg-slate-50 border border-slate-205 rounded px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-550 transition cursor-pointer font-bold"
                          >
                            <option value="Active">Aktif Bekerja</option>
                            <option value="On Leave">Cuti Tahunan</option>
                            <option value="Sick">Sakit (Medical Leave)</option>
                            <option value="Inactive">Resign / Non-aktif</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase text-slate-550 font-extrabold mb-1.5 font-mono">Spesialisasi EGI Alat</label>
                        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 border border-slate-200 rounded max-h-36 overflow-y-auto">
                          {EQUIPMENT_CATEGORIES.map(category => {
                            const isChecked = empSpecializations.includes(category);
                            return (
                              <label key={category} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none py-0.5 hover:text-amber-600 font-bold font-mono">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setEmpSpecializations(prev => prev.filter(x => x !== category));
                                    } else {
                                      setEmpSpecializations(prev => [...prev, category]);
                                    }
                                  }}
                                  className="rounded border-slate-300 text-amber-500 focus:ring-amber-550 cursor-pointer h-4 w-4"
                                />
                                <span>{category === 'Motor Grader' ? 'Motor Grader (GD)' : category === 'Compactor' ? 'Compactor (VC)' : category}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={resetEmployeeForm}
                          className="px-4 py-2 border border-slate-200 bg-transparent rounded text-xs font-bold text-slate-505 hover:bg-slate-50 transition cursor-pointer animate-none"
                        >
                          Batalkan
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded text-xs transition flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" /> Registrasi Operator
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}

              {/* Data Table of Employees with inline POP-UP row editor right under selected item */}
              <div className="bg-white rounded-lg border border-slate-200 overflow-visible shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="p-4 font-mono">NIK Karyawan</th>
                      <th className="p-4">Nama Lengkap</th>
                      <th className="p-4">EGI Alat Spesialisasi</th>
                      <th className="p-4">Default Roster</th>
                      <th className="p-4">Status Tugas</th>
                      <th className="p-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {filteredAndSortedEmployees.map(emp => {
                      const isEditing = editingEmp && editingEmp.id === emp.id;
                      return (
                        <React.Fragment key={emp.id}>
                          <tr className={`hover:bg-slate-50/80 transition-all ${isEditing ? 'bg-amber-50/20 font-medium' : ''}`}>
                            <td className="p-4 font-extrabold font-mono text-amber-600 text-sm">
                              {emp.nrp}
                            </td>
                            <td className="p-4 font-black text-slate-800 uppercase">
                              {emp.name}
                            </td>
                            <td className="p-4">
                              <div className="flex flex-wrap gap-1 max-w-[325px]">
                                {(emp.specializations || []).map(spec => (
                                  <span key={spec} className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-800 font-extrabold text-[9px] border border-amber-500/15 uppercase font-mono">
                                    {spec === 'Motor Grader' ? 'Motor Grader (GD)' : spec === 'Compactor' ? 'Compactor (VC)' : spec}
                                  </span>
                                ))}
                                {(!emp.specializations || emp.specializations.length === 0) && (
                                  <span className="text-slate-400 italic text-[10px]">Belum di-spesifikasi</span>
                                )}
                              </div>
                            </td>
                            <td className="p-4 font-bold uppercase text-slate-500 text-[10px] font-mono">
                              Roster {emp.rosterPattern}
                            </td>
                            <td className="p-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                                emp.status === 'Active' 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-250' 
                                  : emp.status === 'On Leave'
                                    ? 'bg-amber-50 text-amber-700 border-amber-250'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  emp.status === 'Active' ? 'bg-emerald-500 animate-pulse' : emp.status === 'On Leave' ? 'bg-amber-550' : 'bg-rose-500'
                                }`}></span>
                                {emp.status === 'Active' ? 'Aktif' : emp.status === 'On Leave' ? 'Cuti' : emp.status === 'Sick' ? 'Sakit' : 'Non-aktif'}
                              </span>
                            </td>
                            <td className="p-4 text-right flex justify-end gap-1.5">
                              <button
                                onClick={() => startEditEmployee(emp)}
                                className={`p-1.5 rounded transition duration-150 cursor-pointer ${
                                  isEditing 
                                    ? 'bg-amber-400 text-slate-950 font-extrabold shadow-sm scale-105' 
                                    : 'text-slate-400 hover:text-amber-600 hover:bg-slate-100'
                                }`}
                                title="Edit Karyawan (Form di bawah terpilih)"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => deleteEmployee(emp.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 transition cursor-pointer"
                                title="Hapus Karyawan"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>

                          {/* INLINE POP-UP EDIT FORM RIGHT UNDER SELECT TARGET */}
                          {isEditing && (
                            <tr className="bg-amber-50/10" id={`edit-emp-inline-${emp.id}`}>
                              <td colSpan={6} className="p-4 border-y-2 border-amber-400 bg-amber-500/5">
                                <motion.div
                                  initial={{ opacity: 0, y: -5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="bg-white p-5 rounded-lg border border-amber-200 shadow-md space-y-4"
                                >
                                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                    <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1 text-amber-700">
                                      <Pencil className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                                      Panel Edit Di-Bawah: {emp.name} ({emp.nrp})
                                    </h5>
                                    <button onClick={resetEmployeeForm} className="text-slate-400 hover:text-slate-650 cursor-pointer">
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>

                                  <form onSubmit={saveEmployee} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                    <div>
                                      <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1.5 font-mono">NIK Karyawan</label>
                                      <input
                                        type="text"
                                        value={empNrp}
                                        onChange={(e) => setEmpNrp(e.target.value)}
                                        placeholder="NIK9901"
                                        required
                                        className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-850 focus:outline-none focus:border-amber-550 transition font-extrabold uppercase"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1.5 font-mono">Nama Lengkap</label>
                                      <input
                                        type="text"
                                        value={empName}
                                        onChange={(e) => setEmpName(e.target.value)}
                                        placeholder="NAMA LENGKAP"
                                        required
                                        className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-850 focus:outline-none focus:border-amber-550 transition uppercase font-black"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] uppercase text-slate-505 font-bold mb-1.5 font-mono">Pola Roster</label>
                                      <select
                                        value={empRoster}
                                        onChange={(e) => setEmpRoster(e.target.value as Employee['rosterPattern'])}
                                        className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-850 focus:outline-none focus:border-amber-500 transition font-bold cursor-pointer"
                                      >
                                        <option value="6-1">Roster 6-1 (6 Hari Kerja, 1 Off)</option>
                                        <option value="13-1">Roster 13-1 (13 Hari Kerja, 1 Off)</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-[10px] uppercase text-slate-505 font-bold mb-1.5 font-mono">Status Ketenagakerjaan</label>
                                      <select
                                        value={empStatus}
                                        onChange={(e) => setEmpStatus(e.target.value as Employee['status'])}
                                        className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-850 focus:outline-none focus:border-amber-500 transition font-bold cursor-pointer"
                                      >
                                        <option value="Active">Aktif Bekerja</option>
                                        <option value="On Leave">Cuti Tahunan</option>
                                        <option value="Sick">Sakit (Medical Leave)</option>
                                        <option value="Inactive">Resign / Non-aktif</option>
                                      </select>
                                    </div>

                                    <div className="md:col-span-4">
                                      <label className="block text-[10px] uppercase text-slate-505 font-bold mb-1.5 font-mono">Daftar EGI Alat Spesialisasi (Silakan pilih & ubah)</label>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-50 p-2.5 border border-slate-150 rounded max-h-24 overflow-y-auto">
                                        {EQUIPMENT_CATEGORIES.map(category => {
                                          const isChecked = empSpecializations.includes(category);
                                          return (
                                            <label key={category} className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer py-0.5 hover:text-amber-600 font-bold font-mono">
                                              <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => {
                                                  if (isChecked) {
                                                    setEmpSpecializations(prev => prev.filter(x => x !== category));
                                                  } else {
                                                    setEmpSpecializations(prev => [...prev, category]);
                                                  }
                                                }}
                                                className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 cursor-pointer h-3.5 w-3.5"
                                              />
                                              <span>{category === 'Motor Grader' ? 'Motor Grader (GD)' : category === 'Compactor' ? 'Compactor (VC)' : category}</span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    <div className="md:col-span-4 flex justify-end gap-2 pt-2 border-t border-slate-100">
                                      <button
                                        type="button"
                                        onClick={resetEmployeeForm}
                                        className="px-3.5 py-1.5 border border-slate-200 bg-transparent rounded text-[11px] font-bold text-slate-400 hover:bg-slate-50 transition cursor-pointer"
                                      >
                                        Batal
                                      </button>
                                      <button
                                        type="submit"
                                        className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded text-[11px] transition flex items-center gap-1 cursor-pointer"
                                      >
                                        <Check className="h-3.5 w-3.5" /> Simpan Perubahan
                                      </button>
                                    </div>
                                  </form>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {filteredAndSortedEmployees.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">
                          {empSearchQuery ? 'Tidak ada karyawan yang cocok dengan kriteria pencarian.' : 'Database karyawan kosong.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* ==================== MENU 3: SETTINGAN UNIT ROTATION ==================== */}
          {activeMenu === 'unit_settings' && (
            <motion.div
              key="unit_settings_section"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Introduction Box */}
              <div className="bg-white text-slate-700 p-4 rounded-lg border border-slate-200 flex flex-row items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="text-amber-500 h-5 w-5" />
                  <span className="text-sm font-black uppercase tracking-wider text-slate-700 font-mono">TGL PREVIEW</span>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <div className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-200">
                    <Calendar className="text-amber-500 h-4 w-4 shrink-0" />
                    <span className="text-[10px] font-black uppercase text-slate-500 font-mono">Tgl Preview:</span>
                    <input
                      type="date"
                      value={previewStartDate}
                      onChange={(e) => e.target.value && setPreviewStartDate(e.target.value)}
                      className="bg-white text-slate-800 text-xs border border-slate-200 rounded p-1 font-mono focus:outline-none focus:border-amber-550 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Submenu Tabs (Grup Alat Utama vs Grup Master) */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-1">
                <div className="flex gap-2 bg-slate-100 p-1 rounded border border-slate-200/80">
                  {groups.map(g => (
                    <button
                      key={g.id}
                      onClick={() => setActiveSubSetting(g.id)}
                      className={`px-4 py-2 text-xs font-bold rounded transition-all cursor-pointer ${
                        activeSubSetting === g.id
                          ? 'bg-white text-slate-800 border border-slate-200 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>

                <button
                  id="add-setting-btn"
                  onClick={() => startAddSetting(activeSubSetting)}
                  className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs py-2 px-4 rounded transition cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Setting Unit Baru
                </button>
              </div>

              {/* Search Bar for Unit Settings */}
              <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:w-80">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </span>
                  <input
                    id="setting-search"
                    type="text"
                    placeholder="Cari kode unit, slot, atau operator..."
                    value={settingSearchQuery}
                    onChange={(e) => setSettingSearchQuery(e.target.value)}
                    className="pl-9 pr-8 py-2 w-full bg-slate-50 border border-slate-200 rounded text-xs text-slate-850 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 transition font-bold"
                  />
                  {settingSearchQuery && (
                    <button 
                      onClick={() => setSettingSearchQuery('')} 
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-650 text-[10px] uppercase font-bold cursor-pointer"
                    >
                      CLEAR
                    </button>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider">
                  Sortir Default: Kode Unit / Slot Master
                </div>
              </div>

              {/* Setting Unit Setup Form */}
              {settingFormOpen && (
                <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-md animate-fadeIn">
                  <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100">
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-base">
                        {editingSetting ? 'Ubah Penugasan Roster Unit' : 'Pasang Operator & Roster Pada Unit'}
                      </h4>
                      <p className="text-[11px] text-slate-400 font-medium">Hubungkan armada, dua operator, dan rancang perhitungan masa tukar shift.</p>
                    </div>
                    <button onClick={resetSettingForm} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <form onSubmit={saveSetting} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      
                      {/* Select Group */}
                      <div>
                        <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1.5 font-mono">Grup Papan Tulis</label>
                        <select
                           value={setGroupId}
                           onChange={(e) => {
                             const gId = e.target.value;
                             setSetGroupId(gId);
                             if (gId === 'master') {
                               const masterCodes = settings
                                 .filter(s => s.groupId === 'master' && s.masterSlotCode)
                                 .map(s => {
                                   const match = s.masterSlotCode?.match(/M-(\d+)/i);
                                   return match ? parseInt(match[1], 10) : 0;
                                 });
                               const nextNum = masterCodes.length > 0 ? Math.max(...masterCodes) + 1 : 1;
                               setSetMasterSlotCode(`M-${nextNum}`);
                               setSetUnitId('');
                             } else {
                               const configuredUnitIds = new Set(settings.map(s => s.unitId));
                               const firstUnconfigured = units.find(u => !configuredUnitIds.has(u.id));
                               if (firstUnconfigured) {
                                 setSetUnitId(firstUnconfigured.id);
                               }
                             }
                           }}
                           className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-amber-550 cursor-pointer font-bold"
                        >
                          {groups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Select Unit or Show Auto Master Slot */}
                      {setGroupId === 'master' ? (
                        <div>
                          <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1.5 font-mono">Slot Master Otomatis</label>
                          <input
                            type="text"
                            value={setMasterSlotCode}
                            disabled
                            className="w-full bg-slate-150 border border-slate-200 rounded px-3 py-2 text-sm text-slate-600 font-extrabold font-mono"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">Ditentukan otomatis oleh aplikasi.</p>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1.5 font-mono">1. Pilih Unit Alat Berat</label>
                          <select
                            value={setUnitId}
                            onChange={(e) => setSetUnitId(e.target.value)}
                            required={setGroupId !== 'master'}
                            className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-808 focus:outline-none focus:border-amber-550 cursor-pointer font-bold font-mono"
                          >
                            <option value="">-- Pilih Unit Alat --</option>
                            {units.map(u => {
                              // Highlight if already configured elsewhere
                              const isConfigured = settings.some(s => s.unitId === u.id && (!editingSetting || s.id !== editingSetting.id));
                              return (
                                <option key={u.id} value={u.id} disabled={isConfigured}>
                                  {u.unitCode} - {u.brand} {isConfigured ? '(Sudah Ada)' : ''}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      )}

                      {/* Roster Pattern */}
                      <div>
                        <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1.5 font-mono">2. Skema Pola Roster Unit</label>
                        <select
                          value={setRosterPattern}
                          onChange={(e) => setSetRosterPattern(e.target.value as UnitSetting['rosterPattern'])}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-808 focus:outline-none focus:border-amber-550 cursor-pointer font-bold"
                        >
                          <option value="6-1">Roster Kerja 6-1 (6 Hari S/M, 1 Hari OFF Bersama)</option>
                          <option value="13-1">Roster Kerja 13-1 (13 Hari S/M, 1 Hari OFF Bersama)</option>
                          <option value="weekly-fixed">Roster Off Tetap (Off pada Hari Libur tetap mingguan)</option>
                        </select>
                      </div>

                      {/* Operator 1 */}
                      <div>
                        <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1.5 font-mono">3. Operator 1 (Awal Shift Siang)</label>
                        <select
                          value={setOp1Id}
                          onChange={(e) => setSetOp1Id(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-808 focus:outline-none focus:border-amber-550 font-bold cursor-pointer"
                        >
                          <option value="">-- Kosong / Tanpa Operator --</option>
                          {employees.map(emp => (
                            <option key={emp.id} value={emp.id} disabled={emp.id === setOp2Id}>
                              {emp.name} ({emp.nrp} - Roster {emp.rosterPattern})
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-slate-400 mt-1.5">Hari pertama siklus akan dimulai pada Shift 1 (Siang).</p>
                      </div>

                      {/* Operator 2 */}
                      <div>
                        <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1.5 font-mono">4. Operator 2 (Awal Shift Malam)</label>
                        <select
                          value={setOp2Id}
                          onChange={(e) => setSetOp2Id(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-808 focus:outline-none focus:border-amber-550 font-bold cursor-pointer"
                        >
                          <option value="">-- Kosong / Tanpa Operator --</option>
                          {employees.map(emp => (
                            <option key={emp.id} value={emp.id} disabled={emp.id === setOp1Id}>
                              {emp.name} ({emp.nrp} - Roster {emp.rosterPattern})
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-slate-400 mt-1.5">Hari pertama siklus akan dimulai pada Shift 2 (Malam).</p>
                      </div>

                      {/* Hari Pertama Siang Reference date */}
                      <div>
                        <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1.5 font-mono">5. Hari Pertama Siang (Tanggal Mulai Siklus)</label>
                        <input
                          type="date"
                          value={setStartSiangDate}
                          onChange={(e) => setSetStartSiangDate(e.target.value)}
                          required
                          className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-amber-550 cursor-pointer"
                        />
                        <p className="text-[10px] text-slate-400 mt-1.5">Tanggal acuan dimulainya siklus pembagian shift pertama.</p>
                      </div>

                      {/* Fixed Off Day select (shown only if rosterPattern is weekly-fixed) */}
                      {setRosterPattern === 'weekly-fixed' && (
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1.5 font-mono">6. Hari Off Tetap Mingguan (Libur Bersama)</label>
                          <select
                            value={setFixedOffDay}
                            onChange={(e) => setSetFixedOffDay(Number(e.target.value))}
                            className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-808 focus:outline-none focus:border-teal-500 font-bold cursor-pointer"
                          >
                            <option value={0}>Hari Minggu (Sunday)</option>
                            <option value={1}>Hari Senin (Monday)</option>
                            <option value={2}>Hari Selasa (Tuesday)</option>
                            <option value={3}>Hari Rabu (Wednesday)</option>
                            <option value={4}>Hari Kamis (Thursday)</option>
                            <option value={5}>Hari Jumat (Friday)</option>
                            <option value={6}>Hari Sabtu (Saturday)</option>
                          </select>
                          <p className="text-[10px] text-slate-400 mt-1.5">Unit dan kedua operator diliburkan serentak pada hari ini setiap minggunya.</p>
                        </div>
                      )}

                      {/* Backup Allocation Priorities (Only for Operator Master Settings) */}
                      {setGroupId === 'master' && (
                        <div className="col-span-1 sm:col-span-2 md:col-span-3 mt-2 bg-amber-500/5 border border-amber-500/15 p-4 rounded-lg space-y-4">
                          <div className="flex items-center gap-2 pb-2 border-b border-amber-500/10">
                            <span className="text-amber-500 font-extrabold text-xs">★</span>
                            <h5 className="font-extrabold text-xs text-amber-900 uppercase tracking-wide">
                              Pengaturan Unit Master
                            </h5>
                          </div>
                          <p className="text-[11px] text-slate-505 leading-relaxed font-semibold font-mono">
                            Sesuaikan unit prioritas utama yang harus d-backup terlebih dahulu oleh Operator Master ini sebelum beralih ke unit jenis lain.
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                            
                            {/* Priority Type 1 */}
                            <div>
                              <label className="block text-[10px] uppercase text-emerald-800 font-black mb-1 font-mono">1. Jenis Unit Prioritas #1</label>
                              <select
                                value={setBackupPriorityType1}
                                onChange={(e) => setSetBackupPriorityType1(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-808 font-bold cursor-pointer focus:outline-none focus:border-amber-500"
                              >
                                <option value="">-- Tanpa Prioritas --</option>
                                {EQUIPMENT_CATEGORIES.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </div>

                            {/* Priority Type 2 */}
                            <div>
                              <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1 font-mono">2. Jenis Unit Prioritas #2</label>
                              <select
                                value={setBackupPriorityType2}
                                onChange={(e) => setSetBackupPriorityType2(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-808 font-bold cursor-pointer focus:outline-none focus:border-amber-500"
                              >
                                <option value="">-- Tanpa Prioritas --</option>
                                {EQUIPMENT_CATEGORIES.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </div>

                            {/* Specific Unit 1 */}
                            <div>
                              <label className="block text-[10px] uppercase text-cyan-800 font-black mb-1 font-mono">3. No Unit Prioritas #1</label>
                              <select
                                value={setBackupPriorityUnitId1}
                                onChange={(e) => setSetBackupPriorityUnitId1(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-808 font-bold font-mono cursor-pointer focus:outline-none focus:border-amber-500"
                              >
                                <option value="">-- Tanpa Prioritas --</option>
                                {units.map(u => (
                                  <option key={u.id} value={u.id}>
                                    {u.unitCode} ({u.type})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Specific Unit 2 */}
                            <div>
                              <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1 font-mono">4. No Unit Prioritas #2</label>
                              <select
                                value={setBackupPriorityUnitId2}
                                onChange={(e) => setSetBackupPriorityUnitId2(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-808 font-bold font-mono cursor-pointer focus:outline-none focus:border-amber-500"
                              >
                                <option value="">-- Tanpa Prioritas --</option>
                                {units.map(u => (
                                  <option key={u.id} value={u.id}>
                                    {u.unitCode} ({u.type})
                                  </option>
                                ))}
                              </select>
                            </div>

                          </div>
                        </div>
                      )}

                    </div>

                    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                      <button
                        type="button"
                        onClick={resetSettingForm}
                        className="px-4 py-2 border border-slate-200 bg-transparent rounded text-xs font-bold text-slate-505 hover:bg-slate-5 transition cursor-pointer"
                      >
                        Batalkan
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded text-xs transition flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="h-3.5 w-3.5" /> Simpan Settingan Master
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Settings List Table with Image 2 style Calendar visual rotation view! */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm">
                      Daftar Konfigurasi: {activeSubSetting === 'utama' ? 'Grup Alat Utama' : 'Grup Master'}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium">Klik baris unit untuk melihat visualisasi tabel rotasi 8 hari!</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono select-none font-bold">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block"></span>
                    <span>S = Siang</span>
                    <span className="ml-2 w-2.5 h-2.5 rounded-sm bg-indigo-600 inline-block"></span>
                    <span>M = Malam</span>
                    <span className="ml-2 w-2.5 h-2.5 rounded-sm bg-slate-200 inline-block border border-slate-300"></span>
                    <span className="text-rose-600 font-bold uppercase">OFF</span>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {groupedSettings.map(setting => {
                    const unit = unitMap.get(setting.unitId);
                    const op1 = employeeMap.get(setting.operator1Id);
                    const op2 = employeeMap.get(setting.operator2Id);
                    const isExpanded = expandedSettingId === setting.id;

                    const isMaster = setting.groupId === 'master';
                    const displayCode = isMaster ? (setting.masterSlotCode || 'M-?') : (unit?.unitCode || 'U-?');
                    const displayBrand = isMaster 
                      ? `${displayCode} (isinya 2 operator)` 
                      : (unit?.brand || 'Unit Tidak Ditemukan');

                    if (!isMaster && !unit) return null;

                    return (
                      <div key={setting.id} className="transition">
                        {/* Summary Row */}
                        <div
                          onClick={() => setExpandedSettingId(isExpanded ? null : setting.id)}
                          className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 cursor-pointer hover:bg-slate-50 gap-4 transition ${
                            isExpanded ? 'bg-amber-50 border-l-4 border-amber-500' : 'border-l-4 border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="text-center font-mono font-extrabold bg-slate-100 text-amber-600 p-2 rounded border border-slate-200 shrink-0 w-16">
                              {displayCode}
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-sm font-black text-slate-800">{displayBrand}</p>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-505 font-mono">
                                <span>Op 1 (Siang): <strong className="text-slate-805 font-bold">{op1?.name || 'TIDAK VALID'}</strong></span>
                                <span className="text-slate-300">|</span>
                                <span>Op 2 (Malam): <strong className="text-slate-805 font-bold">{op2?.name || 'TIDAK VALID'}</strong></span>
                              </div>
                              {isMaster && (setting.backupPriorityType1 || setting.backupPriorityType2 || setting.backupPriorityUnitId1 || setting.backupPriorityUnitId2) && (
                                <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                                  <span className="text-[9px] font-black text-amber-700 bg-amber-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider font-mono">PRIORITAS GL:</span>
                                  {setting.backupPriorityType1 && (
                                    <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-500/20 px-1.5 py-0.5 rounded font-black uppercase font-mono">
                                      Jenis #1: {setting.backupPriorityType1}
                                    </span>
                                  )}
                                  {setting.backupPriorityType2 && (
                                    <span className="text-[10px] bg-slate-100 text-slate-650 border border-slate-250 px-1.5 py-0.5 rounded font-bold uppercase font-mono">
                                      Jenis #2: {setting.backupPriorityType2}
                                    </span>
                                  )}
                                  {setting.backupPriorityUnitId1 && (
                                    <span className="text-[10px] bg-cyan-50 text-cyan-800 border border-cyan-500/20 px-1.5 py-0.5 rounded font-black font-mono">
                                      Unit #1: {unitMap.get(setting.backupPriorityUnitId1)?.unitCode || 'U-?'}
                                    </span>
                                  )}
                                  {setting.backupPriorityUnitId2 && (
                                    <span className="text-[10px] bg-slate-100 text-slate-650 border border-slate-250 px-1.5 py-0.5 rounded font-mono font-bold">
                                      Unit #2: {unitMap.get(setting.backupPriorityUnitId2)?.unitCode || 'U-?'}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                            <div className="text-left sm:text-right font-mono">
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Siklus Rota</span>
                              <span className="text-[10px] font-extrabold text-slate-600 uppercase bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-sm">
                                {setting.rosterPattern === 'weekly-fixed' ? `Off Mingguan` : `Roster ${setting.rosterPattern}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); startEditSetting(setting); }}
                                className="p-1 px-2.5 text-[11px] font-bold text-slate-600 hover:text-slate-900 rounded border border-slate-200 hover:border-amber-500 hover:bg-slate-50 transition flex items-center gap-1 cursor-pointer"
                              >
                                <Pencil className="h-3 w-3" /> Edit
                              </button>
                              <button
                                onClick={(e) => deleteSetting(setting.id, e)}
                                className="p-1 px-2.5 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded border border-rose-200 hover:border-rose-500 transition flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="h-3 w-3" /> Hapus
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* ==================== EXPANDED AREA: CALENDAR ROTATION MOCKUP ==================== */}
                        {/* This perfectly replicates the Image 2 Layout uploaded by user */}
                        {isExpanded && (
                          <div className="bg-slate-50 border-t border-slate-250 p-5 pl-4 sm:pl-12 shadow-inner">
                            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div>
                                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 font-mono">
                                  <Calendar className="h-3.5 w-3.5 text-amber-500" />
                                  Simulasi Otomatis Rotasi Shift 8 Hari
                                </h5>
                                <p className="text-xs text-slate-500 mt-1">
                                  Menampilkan skema penugasan mulai <strong>{formatIndonesianDate(previewStartDate)}</strong>.
                                </p>
                              </div>
                              <div className="text-[10px] text-slate-550 font-mono font-bold">
                                Tanggal Acuan Siklus: {formatIndonesianDate(setting.startSiangDate)}
                              </div>
                            </div>

                            {/* Image 2 Reconstructed Layout Grid */}
                            <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm bg-white">
                              <table className="w-full text-center border-collapse">
                                <thead>
                                  <tr className="bg-slate-50 text-slate-600 font-mono border-b border-slate-200 font-bold text-[11px]">
                                    <th className="p-2.5 border-r border-slate-200 text-left w-48 font-sans text-amber-600 font-extrabold uppercase tracking-wide">
                                      {displayCode} ({isMaster ? 'Master Slot' : 'Armada'})
                                    </th>
                                    <th className="p-2.5 border-r border-slate-200 text-left w-52 font-sans text-slate-500 uppercase text-[10px] tracking-wider">
                                      Nama Operator
                                    </th>
                                    
                                    {/* Days Headers (1 to 8) from Image 2 */}
                                    {rollingDates.map((dateStr, i) => {
                                      // Get day number (e.g. 1st, 2nd, etc. inside preview)
                                      const dayNum = new Date(dateStr + 'T00:00:00').getDate();
                                      const dayName = formatIndonesianDayName(dateStr);
                                      return (
                                        <th key={dateStr} className="p-2 border-r border-slate-200 text-center font-mono w-24">
                                          <span className="block text-[9px] text-slate-400 font-black uppercase">{dayName}</span>
                                          <span className="text-slate-700 font-extrabold text-xs">{dayNum}</span>
                                        </th>
                                      );
                                    })}
                                  </tr>
                                </thead>
                                <tbody className="text-xs font-bold text-slate-600">
                                  
                                  {/* Operator Row 1 */}
                                  <tr className="border-b border-slate-200">
                                    <td className="p-3 border-r border-slate-200 font-mono text-left text-slate-400 bg-slate-50/50 font-bold uppercase tracking-wider text-[10px]" colSpan={1}>
                                      PENUGASAN UTAMA
                                    </td>
                                    <td className="p-3 border-r border-slate-200 text-left font-sans bg-slate-50/50 font-black text-slate-800 max-w-[200px] truncate">
                                      {op1?.name || 'BELUM DI-SET'}
                                    </td>
                                    
                                    {/* 8-Day cells mapping Operator 1 */}
                                    {rollingDates.map((dateStr) => {
                                      const shift = calculateShift(setting, dateStr);
                                      const isDay = shift.operator1Role === 'S';
                                      const isNight = shift.operator1Role === 'M';
                                      const isOff = shift.operator1Role === 'OFF';

                                      return (
                                        <td
                                          key={`op1-${dateStr}`}
                                          className={`p-3 border-r border-slate-200 font-mono text-xs tracking-widest text-center transition-all ${
                                            isDay ? 'bg-amber-100 text-amber-800 font-black' : ''
                                          } ${
                                            isNight ? 'bg-indigo-100 text-indigo-800 font-black' : ''
                                          } ${
                                            isOff ? 'bg-slate-50 text-slate-300 font-light' : ''
                                          }`}
                                        >
                                          {isDay && 'S'}
                                          {isNight && 'M'}
                                          {isOff && <span className="text-[10px] tracking-tight text-rose-600 border border-rose-200 px-1.5 py-0.5 rounded-sm bg-rose-50 font-bold">OFF</span>}
                                        </td>
                                      );
                                    })}
                                  </tr>

                                  {/* Operator Row 2 */}
                                  <tr className="border-b border-transparent">
                                    <td className="p-3 border-r border-slate-200 font-mono text-left text-slate-400 bg-slate-50/50 font-bold uppercase tracking-wider text-[10px]" colSpan={1}>
                                      PENUGASAN SHIFT
                                    </td>
                                    <td className="p-3 border-r border-slate-200 text-left font-sans bg-slate-50/50 font-black text-slate-800 max-w-[200px] truncate">
                                      {op2?.name || 'BELUM DI-SET'}
                                    </td>

                                    {/* 8-Day cells mapping Operator 2 */}
                                    {rollingDates.map((dateStr) => {
                                      const shift = calculateShift(setting, dateStr);
                                      const isDay = shift.operator2Role === 'S';
                                      const isNight = shift.operator2Role === 'M';
                                      const isOff = shift.operator2Role === 'OFF';

                                      return (
                                        <td
                                          key={`op2-${dateStr}`}
                                          className={`p-3 border-r border-slate-200 font-mono text-xs tracking-widest text-center transition-all ${
                                            isDay ? 'bg-amber-100 text-amber-800 font-black' : ''
                                          } ${
                                            isNight ? 'bg-indigo-100 text-indigo-800 font-black' : ''
                                          } ${
                                            isOff ? 'bg-slate-50 text-slate-300 font-light' : ''
                                          }`}
                                        >
                                          {isDay && 'S'}
                                          {isNight && 'M'}
                                          {isOff && <span className="text-[10px] tracking-tight text-rose-600 border border-rose-200 px-1.5 py-0.5 rounded-sm bg-rose-50 font-bold">OFF</span>}
                                        </td>
                                      );
                                    })}
                                  </tr>

                                </tbody>
                              </table>
                            </div>

                            {/* Informative Roster cycle explanation */}
                            <div className="flex gap-2.5 items-start mt-3.5 text-[11px] text-slate-500 bg-white p-3 rounded border border-slate-200">
                              <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                              <div className="space-y-1">
                                <span className="font-extrabold text-slate-700">Keterangan Aturan Roster:</span>
                                <p className="leading-relaxed">
                                  {setting.rosterPattern === '6-1' && 'Pola Roster 6-1: Bekerja 6 hari bertuntutan, disusul 1 hari lurus OFF bersama. Sepulangnya dari hari off, shift tugas antara Operator 1 & 2 ditukar secara otomatis (Siang ⇄ Malam).'}
                                  {setting.rosterPattern === '13-1' && 'Pola Roster 13-1: Masing-masing operator bekerja 13 hari dan libur 1 hari secara bergantian. Pada hari ke-8, Operator 2 OFF dan Operator 1 beralih ke malam. Pada hari ke-14, Operator 1 OFF dan Operator 2 bekerja siang.'}
                                  {setting.rosterPattern === 'weekly-fixed' && 'Pola Roster Hari Off Mingguan: Unit dan operator diliburkan tetap (OFF) seminggu sekali pada hari tetap pilihan pengawas. Pergantian shift siang & malam berlangsung stabil di hari berikutnya.'}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {groupedSettings.length === 0 && (
                    <div className="p-8 text-center text-slate-500 text-xs font-mono font-bold uppercase">
                      {settingSearchQuery.trim() 
                        ? `Tidak ada settingan unit cocok dengan kata kunci: "${settingSearchQuery}"` 
                        : 'Tidak ada penugasan terdaftar untuk grup ini. Silahkan klik "Setting Unit Baru" di atas.'}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ==================== MENU 4: SETTINGAN BACKUP ==================== */}
          {activeMenu === 'backup_settings' && (
            <motion.div
              key="menu-backup-settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
              id="menu-panel-backup-settings"
            >
              {/* Header Box with Stats summary */}
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-in fade-in duration-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600">
                      <RefreshCw className="h-5 w-5 animate-spin-slow" />
                    </span>
                    <h3 className="font-extrabold text-slate-800 text-base">Settingan Backup Operator</h3>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-xl font-medium">
                    Atur pemindahan/pengalihan operator utama atau master ke unit alat berat lain secara khusus pada tanggal dan shift kerja tertentu di luar jadwal rutin mereka.
                  </p>
                </div>
                {!backupFormOpen && (
                  <button
                    onClick={() => {
                      setEditingBackup(null);
                      setBackupOperatorId('');
                      setBackupTargetUnitId('');
                      setBackupDate(selectedDate);
                      setBackupShift(1);
                      setBackupFormOpen(true);
                    }}
                    className="self-start md:self-auto px-4 py-2 text-xs font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white rounded shadow-sm hover:shadow transition flex items-center gap-1.5 cursor-pointer text-center"
                  >
                    <Plus className="h-4 w-4" /> TAMBAH BACKUP BARU
                  </button>
                )}
              </div>

              {/* Form Box (Visible when adding or editing) */}
              {backupFormOpen && (
                <div className="bg-white rounded-lg border border-indigo-200/50 shadow-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></span>
                      <h4 className="font-extrabold text-slate-850 text-sm">
                        {editingBackup ? 'Edit Penugasan Backup' : 'Pengaturan Operator Yang Membackup'}
                      </h4>
                    </div>
                    <button
                      onClick={() => setBackupFormOpen(false)}
                      className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!backupOperatorId) {
                        alert('Mohon pilih Operator!');
                        return;
                      }
                      if (!backupTargetUnitId) {
                        alert('Mohon pilih Unit Alat Barat Tujuan!');
                        return;
                      }
                      if (!backupDate) {
                        alert('Mohon tentukan Tanggal!');
                        return;
                      }

                      // Check double booking for same operator on same date and shift
                      const hasConf = (backupTransfers || []).some(
                        bt => bt.operatorId === backupOperatorId &&
                              bt.date === backupDate &&
                              Number(bt.shift) === Number(backupShift) &&
                              (!editingBackup || bt.id !== editingBackup.id)
                      );
                      if (hasConf) {
                        alert('Operator ini sudah mempunyai tugas mobilisasi backup lain di hari & shift yang sama!');
                        return;
                      }

                      if (editingBackup) {
                        setBackupTransfers(prev => prev.map(bt => bt.id === editingBackup.id
                          ? {
                              ...bt,
                              operatorId: backupOperatorId,
                              targetUnitId: backupTargetUnitId,
                              date: backupDate,
                              shift: Number(backupShift) as 1 | 2
                            }
                          : bt
                        ));
                      } else {
                        const newBT: BackupTransfer = {
                          id: 'bt_' + Date.now(),
                          operatorId: backupOperatorId,
                          targetUnitId: backupTargetUnitId,
                          date: backupDate,
                          shift: Number(backupShift) as 1 | 2
                        };
                        setBackupTransfers(prev => [...prev, newBT]);
                      }
                      setBackupFormOpen(false);
                      setEditingBackup(null);
                    }}
                    className="grid grid-cols-1 md:grid-cols-4 gap-5"
                  >
                    {/* Operator Selector */}
                    <div>
                      <label className="block text-[10px] uppercase text-indigo-700 font-extrabold mb-1.5 font-mono">1. Pilih Operator</label>
                      <select
                        value={backupOperatorId}
                        onChange={(e) => setBackupOperatorId(e.target.value)}
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-808 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="">-- Pilih Operator --</option>
                        {employees.filter(emp => emp.status === 'Active').map(emp => {
                          const originalUnitSetting = settings.find(s => s.operator1Id === emp.id || s.operator2Id === emp.id);
                          const isMaster = originalUnitSetting?.groupId === 'master';
                          const originalUnitCode = originalUnitSetting
                            ? isMaster 
                              ? `Master Slot ${originalUnitSetting.masterSlotCode}`
                              : `Unit ${unitMap.get(originalUnitSetting.unitId)?.unitCode || 'U-?'}`
                            : 'Pool Standby';

                          return (
                            <option key={emp.id} value={emp.id}>
                              {emp.name} ({emp.nrp} - Roster {emp.rosterPattern}) [{originalUnitCode}]
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Target Unit Selector */}
                    <div>
                      <label className="block text-[10px] uppercase text-indigo-700 font-extrabold mb-1.5 font-mono">2. Pilih Unit Tujuan</label>
                      <select
                        value={backupTargetUnitId}
                        onChange={(e) => setBackupTargetUnitId(e.target.value)}
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-808 font-bold font-mono focus:outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="">-- Pilih Unit Tujuan --</option>
                        {units.filter(u => u.status === 'Ready').map(u => (
                          <option key={u.id} value={u.id}>
                            {u.unitCode} - {u.brand} ({u.type})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Date Selector */}
                    <div>
                      <label className="block text-[10px] uppercase text-indigo-700 font-extrabold mb-1.5 font-mono">3. Tanggal Backup</label>
                      <input
                        type="date"
                        value={backupDate}
                        onChange={(e) => setBackupDate(e.target.value)}
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-808 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer font-mono"
                      />
                    </div>

                    {/* Shift Selector */}
                    <div>
                      <label className="block text-[10px] uppercase text-indigo-700 font-extrabold mb-1.5 font-mono">4. Pilih Shift Tugas</label>
                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded border border-slate-200 h-9">
                        <button
                          type="button"
                          onClick={() => setBackupShift(1)}
                          className={`text-xs font-bold rounded flex items-center justify-center gap-1 cursor-pointer transition ${
                            backupShift === 1 ? 'bg-amber-500 text-slate-950 font-black shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <Sun className="h-3.5 w-3.5" /> Siang (1)
                        </button>
                        <button
                          type="button"
                          onClick={() => setBackupShift(2)}
                          className={`text-xs font-bold rounded flex items-center justify-center gap-1 cursor-pointer transition ${
                            backupShift === 2 ? 'bg-indigo-600 text-white font-black shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <Moon className="h-3.5 w-3.5" /> Malam (2)
                        </button>
                      </div>
                    </div>

                    <div className="col-span-1 md:col-span-4 flex justify-end gap-2 border-t border-slate-100 pt-4">
                      <button
                        type="button"
                        onClick={() => setBackupFormOpen(false)}
                        className="px-4 py-2 border border-slate-200 bg-transparent rounded text-xs font-bold text-slate-505 hover:bg-slate-5 transition cursor-pointer"
                      >
                        Batalkan
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded text-xs transition flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="h-3.5 w-3.5" /> Simpan Operator Backup
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Transfers List Table */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                  <h4 className="font-extrabold text-slate-800 text-sm">
                    Jadwal Operator Backup
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium">Berikut adalah seluruh pengalihan tugas operator secara manual yang sedang aktif atau terjadwal.</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/50 text-slate-705 uppercase font-mono text-[9px] tracking-wider font-extrabold border-b border-slate-200">
                        <th className="p-3 pl-5">No.</th>
                        <th className="p-3">Nama Operator</th>
                        <th className="p-3">Unit Asal Rujuk</th>
                        <th className="p-3">Unit Target Backup</th>
                        <th className="p-3">Tanggal Backup</th>
                        <th className="p-3">Shift</th>
                        <th className="p-3 text-right pr-5">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs text-slate-605 divide-y divide-slate-100">
                      {(backupTransfers || []).map((bt, index) => {
                        const op = employeeMap.get(bt.operatorId);
                        const unitTarget = unitMap.get(bt.targetUnitId);
                        
                        // Trace original unit settings for display
                        const origSetting = settings.find(s => s.operator1Id === bt.operatorId || s.operator2Id === bt.operatorId);
                        const origBrand = origSetting
                          ? origSetting.groupId === 'master'
                            ? `Master Slot ${origSetting.masterSlotCode}`
                            : `Unit ${unitMap.get(origSetting.unitId)?.unitCode || 'U-?'}`
                          : 'Pool Standby';

                        return (
                          <tr key={bt.id} className="hover:bg-slate-50/50 font-medium select-none">
                            <td className="p-3 pl-5 font-bold text-slate-400">{index + 1}</td>
                            <td className="p-3">
                              <p className="font-extrabold text-slate-800 text-sm">{op?.name || 'Karyawan Terhapus'}</p>
                              <p className="text-[10px] text-slate-400 font-mono font-semibold">{op?.nrp || '-'}</p>
                            </td>
                            <td className="p-3 font-mono font-bold text-slate-505">
                              {origBrand}
                            </td>
                            <td className="p-3">
                              <span className="inline-flex items-center gap-1.5 text-xs bg-indigo-55 text-indigo-900 border border-indigo-250 rounded px-2.5 py-1 font-extrabold font-mono shadow-sm">
                                <Truck className="h-3.5 w-3.5 text-indigo-500" />
                                {unitTarget?.unitCode || 'U-?'}
                              </span>
                            </td>
                            <td className="p-3 font-semibold font-sans">
                              {formatIndonesianDate(bt.date)}
                            </td>
                            <td className="p-3">
                              {Number(bt.shift) === 1 ? (
                                <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-800 px-2 py-0.5 rounded font-black uppercase text-[10px] tracking-wide border border-amber-500/20">
                                  <Sun className="h-3 w-3" /> Siang
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-indigo-600/10 text-indigo-700 px-2 py-0.5 rounded font-black uppercase text-[10px] tracking-wide border border-indigo-600/20">
                                  <Moon className="h-3 w-3" /> Malam
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right pr-5">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setEditingBackup(bt);
                                    setBackupOperatorId(bt.operatorId);
                                    setBackupTargetUnitId(bt.targetUnitId);
                                    setBackupDate(bt.date);
                                    setBackupShift(bt.shift);
                                    setBackupFormOpen(true);
                                  }}
                                  className="p-1 px-2 border border-slate-200 bg-transparent hover:bg-slate-50 hover:border-slate-350 text-slate-500 hover:text-slate-800 rounded transition flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                                >
                                  <Pencil className="h-3 w-3" /> Edit
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm('Batal mobilisasi backup untuk operator ini?')) {
                                      setBackupTransfers(prev => prev.filter(x => x.id !== bt.id));
                                    }
                                  }}
                                  className="p-1 px-2 border border-rose-100 bg-rose-50/20 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded transition flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                                >
                                  <Trash2 className="h-3 w-3" /> Hapus
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {(!backupTransfers || backupTransfers.length === 0) && (
                        <tr>
                          <td colSpan={7} className="p-12 text-center text-slate-500 text-xs font-mono font-bold uppercase">
                            BELUM ADA OPERATOR BACKUP YANG TERDAFTAR
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
