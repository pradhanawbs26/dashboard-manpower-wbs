/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { HeavyUnit, Employee, UnitSetting, UnitGroup } from '../types';
import { calculateShift, generateDateRange, formatIndonesianDayName, formatIndonesianDate } from '../utils/scheduler';
import { 
  Building2, Truck, Users, Settings, Plus, Pencil, Trash2, Check, X, 
  HelpCircle, AlertCircle, Info, Calendar, CalendarDays, Eye, RefreshCw 
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
  selectedDate,
  activeSettingIdForPanel,
  setActiveSettingIdForPanel
}: SupervisorPanelProps) {
  // Main Navigation Menu Tabs (Jendela 2)
  const [activeMenu, setActiveMenu] = useState<'unit_db' | 'employee_db' | 'unit_settings'>('unit_settings');
  
  // Setting Submenus
  const [activeSubSetting, setActiveSubSetting] = useState<string>('utama'); // 'utama' or 'master'
  const [expandedSettingId, setExpandedSettingId] = useState<string | null>('s1'); // Expand s1 by default to show image 2 mockup

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

  // 8-Day rolling calendar starting point for setting previews (mimics Image 2)
  const [previewStartDate, setPreviewStartDate] = useState('2026-06-01');

  // Helper map lookups for fast calculations
  const unitMap = useMemo(() => new Map(units.map(u => [u.id, u])), [units]);
  const employeeMap = useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);

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
    if (!setOp1Id || !setOp2Id) {
      alert('Mohon pilih kedua Operator (Shift 1 & 2)!');
      return;
    }
    if (setOp1Id === setOp2Id) {
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
            startSiangDate: setStartSiangDate
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
        startSiangDate: setStartSiangDate
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

  // Split configurations by group for submenus
  const groupedSettings = useMemo(() => {
    return settings.filter(s => s.groupId === activeSubSetting);
  }, [settings, activeSubSetting]);

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
            <span>SETTINGAN UNIT</span>
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
                  <h3 className="font-extrabold text-slate-800 text-sm">Data Alat Berat</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Daftar nomor unit dan jenis alat berat Dept Operation</p>
                </div>
                <button
                  id="add-unit-btn"
                  onClick={() => { resetUnitForm(); setUnitFormOpen(true); }}
                  className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs py-2 px-4 rounded transition cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Add Unit Baru
                </button>
              </div>

              {/* Form Modal / Inline Block */}
              {unitFormOpen && (
                <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-md transition animate-fadeIn">
                  <div className="flex items-center justify-between pb-3 mt-1 mb-4 border-b border-slate-100">
                    <h4 className="font-extrabold text-slate-800 text-sm">
                      {editingUnit ? `Edit Armada: ${editingUnit.unitCode}` : 'Registrasi Armada Unit Baru'}
                    </h4>
                    <button onClick={resetUnitForm} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <form onSubmit={saveUnit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                      <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1.5">Kode Unit (e.g. DT-01)</label>
                      <input
                        type="text"
                        value={unitCode}
                        onChange={(e) => setUnitCode(e.target.value)}
                        placeholder="DT-01"
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-amber-550 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1.5">Merek / Seri Mesin (e.g. Scania P410)</label>
                      <input
                        type="text"
                        value={unitBrand}
                        onChange={(e) => setUnitBrand(e.target.value)}
                        placeholder="Volvo FMX / Komatsu"
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-amber-550 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1.5">Kategori Tipe Alat</label>
                      <select
                        value={unitType}
                        onChange={(e) => setUnitType(e.target.value as HeavyUnit['type'])}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-amber-550 transition cursor-pointer font-bold"
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
                        <option value="Other">Lain-lain / Lainnya</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1.5">Status Lapangan</label>
                      <select
                        value={unitStatus}
                        onChange={(e) => setUnitStatus(e.target.value as HeavyUnit['status'])}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-amber-550 transition cursor-pointer"
                      >
                        <option value="Ready">Ready (Siap Jalan)</option>
                        <option value="Maintenance">Maintenance (Servis Berkala)</option>
                        <option value="Breakdown">Breakdown (Mogok / Rusak)</option>
                      </select>
                    </div>

                    <div className="md:col-span-4 flex justify-end gap-2 pt-2">
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
                </div>
              )}

              {/* Data Table */}
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
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
                    {units.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50 transition">
                        <td className="p-4 font-extrabold font-mono text-amber-600">{u.unitCode}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded-sm bg-slate-100 text-slate-700 font-bold text-[10px] uppercase border border-slate-200">
                            {u.type}
                          </span>
                        </td>
                        <td className="p-4 font-medium text-slate-800">{u.brand}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                            u.status === 'Ready' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : u.status === 'Maintenance'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              u.status === 'Ready' ? 'bg-emerald-500' : u.status === 'Maintenance' ? 'bg-amber-550' : 'bg-rose-500'
                            }`}></span>
                            {u.status}
                          </span>
                        </td>
                        <td className="p-4 text-right flex justify-end gap-2">
                          <button
                            onClick={() => startEditUnit(u)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 rounded hover:bg-slate-100 transition cursor-pointer"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteUnit(u.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 transition cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {units.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500">Database unit kosong. Klik "Add Unit Baru" untuk menambah.</td>
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
                  <h3 className="font-extrabold text-slate-800 text-sm">Data Manpower Operation</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Daftar karyawan yang dapat mengoperasikan alat berat</p>
                </div>
                <button
                  id="add-emp-btn"
                  onClick={() => { resetEmployeeForm(); setEmpFormOpen(true); }}
                  className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs py-2 px-4 rounded transition cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Add Operator Baru
                </button>
              </div>

              {/* Form Modal/Section */}
              {empFormOpen && (
                <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-md transition animate-fadeIn">
                  <div className="flex items-center justify-between pb-3 mt-1 mb-4 border-b border-slate-100">
                    <h4 className="font-extrabold text-slate-800 text-sm">
                      {editingEmp ? `Edit Karyawan: ${editingEmp.name}` : 'Registrasi Karyawan Baru'}
                    </h4>
                    <button onClick={resetEmployeeForm} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <form onSubmit={saveEmployee} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                      <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1.5">NRP Pekerja (e.g. NRP9901)</label>
                      <input
                        type="text"
                        value={empNrp}
                        onChange={(e) => setEmpNrp(e.target.value)}
                        placeholder="NRP99201"
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-amber-550 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1.5">Nama Lengkap Operator</label>
                      <input
                        type="text"
                        value={empName}
                        onChange={(e) => setEmpName(e.target.value)}
                        placeholder="BUDI SANTOSO"
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-855 focus:outline-none focus:border-amber-550 transition uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1.5">Pola Roster Default</label>
                      <select
                        value={empRoster}
                        onChange={(e) => setEmpRoster(e.target.value as Employee['rosterPattern'])}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-805 focus:outline-none focus:border-amber-550 transition cursor-pointer font-bold animate-none"
                      >
                        <option value="6-1">Roster 6-1 (6 Hari Kerja, 1 Off)</option>
                        <option value="13-1">Roster 13-1 (13 Hari Kerja, 1 Off)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase text-slate-500 font-bold mb-1.5">Status Karyawan</label>
                      <select
                        value={empStatus}
                        onChange={(e) => setEmpStatus(e.target.value as Employee['status'])}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-805 focus:outline-none focus:border-amber-550 transition cursor-pointer font-bold animate-none"
                      >
                        <option value="Active">Aktif Bekerja</option>
                        <option value="On Leave">Cuti Tahunan</option>
                        <option value="Sick">Sakit (Medical Leave)</option>
                        <option value="Inactive">Resign / Non-aktif</option>
                      </select>
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-[10px] uppercase text-slate-500 font-bold mb-2">EGI Alat (Dapat memilih lebih dari 1)</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 bg-slate-50 p-3 border border-slate-205 rounded max-h-40 overflow-y-auto">
                        {EQUIPMENT_CATEGORIES.map(category => {
                          const isChecked = empSpecializations.includes(category);
                          return (
                            <label key={category} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none py-1 hover:text-amber-600 font-medium font-mono">
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
                              <span>{category}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="md:col-span-4 flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={resetEmployeeForm}
                        className="px-4 py-2 border border-slate-200 bg-transparent rounded text-xs font-bold text-slate-505 hover:bg-slate-50 transition cursor-pointer"
                      >
                        Batalkan
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded text-xs transition flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="h-3.5 w-3.5" /> Simpan Karyawan
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Data Table */}
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="p-4">NRP Pekerja</th>
                      <th className="p-4">Nama Lengkap</th>
                      <th className="p-4">EGI Alat</th>
                      <th className="p-4">Default Roster</th>
                      <th className="p-4">Status Tugas</th>
                      <th className="p-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {employees.map(emp => (
                      <tr key={emp.id} className="hover:bg-slate-50 transition">
                        <td className="p-4 font-bold font-mono text-amber-600">{emp.nrp}</td>
                        <td className="p-4 font-black text-slate-800">{emp.name}</td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1 max-w-[280px]">
                            {(emp.specializations || []).map(spec => (
                              <span key={spec} className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-800 font-extrabold text-[9px] border border-amber-500/15 uppercase font-mono">
                                {spec}
                              </span>
                            ))}
                            {(!emp.specializations || emp.specializations.length === 0) && (
                              <span className="text-slate-400 italic text-[10px]">Belum di-set</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 font-bold uppercase text-slate-400 text-[10px]">Roster {emp.rosterPattern}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                            emp.status === 'Active' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-250' 
                              : emp.status === 'On Leave'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {emp.status === 'Active' ? 'Aktif' : emp.status === 'On Leave' ? 'Cuti' : emp.status}
                          </span>
                        </td>
                        <td className="p-4 text-right flex justify-end gap-2">
                          <button
                            onClick={() => startEditEmployee(emp)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 rounded hover:bg-slate-100 transition cursor-pointer"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteEmployee(emp.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 transition cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {employees.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">Database karyawan kosong. Hubungi admin atau tambah di atas.</td>
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
                          required
                          className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-808 focus:outline-none focus:border-amber-550 font-bold cursor-pointer"
                        >
                          <option value="">-- Pilih Operator 1 --</option>
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
                          required
                          className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-808 focus:outline-none focus:border-amber-550 font-bold cursor-pointer"
                        >
                          <option value="">-- Pilih Operator 2 --</option>
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
                        <Check className="h-3.5 w-3.5" /> Simpan Settingan Rota
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
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-mono">
                                <span>Op 1 (Siang): <strong className="text-slate-805 font-bold">{op1?.name || 'TIDAK VALID'}</strong></span>
                                <span className="text-slate-300">|</span>
                                <span>Op 2 (Malam): <strong className="text-slate-805 font-bold">{op2?.name || 'TIDAK VALID'}</strong></span>
                              </div>
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
                    <div className="p-8 text-center text-slate-500 text-xs">
                      Tidak ada penugasan terdaftar untuk grup ini. Silahkan klik "Setting Unit Baru" di atas.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
