/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { HeavyUnit, Employee, UnitSetting, UnitGroup, BackupTransfer } from './types';
import { 
  INITIAL_UNITS, 
  INITIAL_EMPLOYEES, 
  INITIAL_GROUPS, 
  INITIAL_SETTINGS 
} from './data/seedData';
import FieldMonitor from './components/FieldMonitor';
import SupervisorPanel from './components/SupervisorPanel';
import { 
  LayoutGrid, Settings2, Columns, Monitor, RefreshCw, Layers, ShieldCheck, 
  HelpCircle, CalendarRange, Cloud, LogOut
} from 'lucide-react';
import { motion } from 'motion/react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { 
  db, 
  auth, 
  loginWithGoogle, 
  logoutUser, 
  saveDocument, 
  removeDocument, 
  handleFirestoreError, 
  OperationType 
} from './firebase';

export default function App() {
  // Cloud Database Sync connection status
  const [cloudSynced, setCloudSynced] = useState(false);
  // Keep track of any connection/permission errors
  const [cloudError, setCloudError] = useState<string | null>(null);

  // 1. Core States loaded with localStorage or fallback to Seed Data
  const [units, setUnits] = useState<HeavyUnit[]>(() => {
    const saved = localStorage.getItem('wbs_hauling_clean_v1_units');
    return saved ? JSON.parse(saved) : INITIAL_UNITS;
  });

  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('wbs_hauling_clean_v1_employees');
    return saved ? JSON.parse(saved) : INITIAL_EMPLOYEES;
  });

  const [settings, setSettings] = useState<UnitSetting[]>(() => {
    const saved = localStorage.getItem('wbs_hauling_clean_v1_settings');
    return saved ? JSON.parse(saved) : INITIAL_SETTINGS;
  });

  const [groups, setGroups] = useState<UnitGroup[]>(() => {
    const saved = localStorage.getItem('wbs_hauling_clean_v1_groups');
    return saved ? JSON.parse(saved) : INITIAL_GROUPS;
  });

  const [backupTransfers, setBackupTransfers] = useState<BackupTransfer[]>(() => {
    const saved = localStorage.getItem('wbs_hauling_clean_v1_backupTransfers');
    return saved ? JSON.parse(saved) : [];
  });

  // Selected date defaults to current date in Waktu Indonesia Barat (WIB - UTC+7)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const wibDate = new Date(utc + (3600000 * 7));
    const yyyy = wibDate.getFullYear();
    const mm = String(wibDate.getMonth() + 1).padStart(2, '0');
    const dd = String(wibDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  // Workspace layout style:
  // 'monitor_only' = Jendela 1 (Field Monitor Screen) -> Dashboard Unit
  // 'settings_only' = Jendela 2 (Supervisor settings) -> Pengaturan
  const [layoutMode, setLayoutMode] = useState<'monitor_only' | 'settings_only'>('monitor_only');

  // Multi-window navigation bridge: when clicking a card in monitor, auto-expand in settings
  const [activeSettingIdForPanel, setActiveSettingIdForPanel] = useState<string | null>(null);

  // Keep latest states in refs to access them securely inside async flow and onSnapshot without re-triggering useEffect
  const latestUnitsRef = React.useRef(units);
  const latestEmployeesRef = React.useRef(employees);
  const latestSettingsRef = React.useRef(settings);
  const latestGroupsRef = React.useRef(groups);
  const latestBackupTransfersRef = React.useRef(backupTransfers);

  useEffect(() => {
    latestUnitsRef.current = units;
  }, [units]);

  useEffect(() => {
    latestEmployeesRef.current = employees;
  }, [employees]);

  useEffect(() => {
    latestSettingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    latestGroupsRef.current = groups;
  }, [groups]);

  useEffect(() => {
    latestBackupTransfersRef.current = backupTransfers;
  }, [backupTransfers]);

  // Sync real-time Firestore collections onto states automatically
  useEffect(() => {
    const unsubUnits = onSnapshot(collection(db, 'heavyUnits'), (snapshot) => {
      const list: HeavyUnit[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as HeavyUnit);
      });
      // Seed Firestore with local state if empty and we have local data
      if (snapshot.empty && latestUnitsRef.current.length > 0) {
        latestUnitsRef.current.forEach(item => {
          saveDocument('heavyUnits', item.id, item);
        });
      } else {
        setUnits(list);
      }
      setCloudSynced(true);
      setCloudError(null);
    }, (error) => {
      setCloudError(error.message || String(error));
      handleFirestoreError(error, OperationType.GET, 'heavyUnits');
    });

    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snapshot) => {
      const list: Employee[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as Employee);
      });
      // Seed Firestore with local state if empty and we have local data
      if (snapshot.empty && latestEmployeesRef.current.length > 0) {
        latestEmployeesRef.current.forEach(item => {
          saveDocument('employees', item.id, item);
        });
      } else {
        setEmployees(list);
      }
      setCloudSynced(true);
      setCloudError(null);
    }, (error) => {
      setCloudError(error.message || String(error));
      handleFirestoreError(error, OperationType.GET, 'employees');
    });

    const unsubGroups = onSnapshot(collection(db, 'unitGroups'), (snapshot) => {
      const list: UnitGroup[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as UnitGroup);
      });
      if (list.length > 0) {
        setGroups(list);
      } else {
        // Automatically seed workspace default structures for Firestore
        INITIAL_GROUPS.forEach(g => {
          saveDocument('unitGroups', g.id, g);
        });
      }
      setCloudSynced(true);
      setCloudError(null);
    }, (error) => {
      setCloudError(error.message || String(error));
      handleFirestoreError(error, OperationType.GET, 'unitGroups');
    });

    const unsubSettings = onSnapshot(collection(db, 'unitSettings'), (snapshot) => {
      const list: UnitSetting[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as UnitSetting);
      });
      // Seed Firestore with local state if empty and we have data
      if (snapshot.empty && latestSettingsRef.current.length > 0) {
        latestSettingsRef.current.forEach(item => {
          saveDocument('unitSettings', item.id, item);
        });
      } else {
        setSettings(list);
      }
      setCloudSynced(true);
      setCloudError(null);
    }, (error) => {
      setCloudError(error.message || String(error));
      handleFirestoreError(error, OperationType.GET, 'unitSettings');
    });

    const unsubBackupTransfers = onSnapshot(collection(db, 'backupTransfers'), (snapshot) => {
      const list: BackupTransfer[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as BackupTransfer);
      });
      if (snapshot.empty && latestBackupTransfersRef.current.length > 0) {
        latestBackupTransfersRef.current.forEach(item => {
          saveDocument('backupTransfers', item.id, item);
        });
      } else {
        setBackupTransfers(list);
      }
      setCloudSynced(true);
      setCloudError(null);
    }, (error) => {
      // Allow passing through errors for backup transfers gracefully
    });

    return () => {
      unsubUnits();
      unsubEmployees();
      unsubGroups();
      unsubSettings();
      unsubBackupTransfers();
    };
  }, []);

  // Intercept state setters from SupervisorPanel to write to Firestore or localized fallback
  const customSetUnits = (value: React.SetStateAction<HeavyUnit[]>) => {
    // 1. Always update local state immediately for lag-free instant response
    setUnits(value);

    const nextVal = typeof value === 'function' ? (value as any)(latestUnitsRef.current) : value;
    // Sync upserts
    nextVal.forEach((item: HeavyUnit) => {
      const existingItem = latestUnitsRef.current.find(u => u.id === item.id);
      if (!existingItem || JSON.stringify(existingItem) !== JSON.stringify(item)) {
        saveDocument('heavyUnits', item.id, item);
      }
    });
    // Sync deletions
    latestUnitsRef.current.forEach((item: HeavyUnit) => {
      if (!nextVal.find(u => u.id === item.id)) {
        removeDocument('heavyUnits', item.id);
      }
    });
  };

  const customSetEmployees = (value: React.SetStateAction<Employee[]>) => {
    // 1. Always update local state immediately for lag-free instant response
    setEmployees(value);

    const nextVal = typeof value === 'function' ? (value as any)(latestEmployeesRef.current) : value;
    // Sync upserts
    nextVal.forEach((item: Employee) => {
      const existingItem = latestEmployeesRef.current.find(e => e.id === item.id);
      if (!existingItem || JSON.stringify(existingItem) !== JSON.stringify(item)) {
        saveDocument('employees', item.id, item);
      }
    });
    // Sync deletions
    latestEmployeesRef.current.forEach((item: Employee) => {
      if (!nextVal.find(e => e.id === item.id)) {
        removeDocument('employees', item.id);
      }
    });
  };

  const customSetSettings = (value: React.SetStateAction<UnitSetting[]>) => {
    // 1. Always update local state immediately for lag-free instant response
    setSettings(value);

    const nextVal = typeof value === 'function' ? (value as any)(latestSettingsRef.current) : value;
    // Sync upserts
    nextVal.forEach((item: UnitSetting) => {
      const existingItem = latestSettingsRef.current.find(s => s.id === item.id);
      if (!existingItem || JSON.stringify(existingItem) !== JSON.stringify(item)) {
        saveDocument('unitSettings', item.id, item);
      }
    });
    // Sync deletions
    latestSettingsRef.current.forEach((item: UnitSetting) => {
      if (!nextVal.find(s => s.id === item.id)) {
        removeDocument('unitSettings', item.id);
      }
    });
  };

  const customSetBackupTransfers = (value: React.SetStateAction<BackupTransfer[]>) => {
    setBackupTransfers(value);
    const nextVal = typeof value === 'function' ? (value as any)(latestBackupTransfersRef.current) : value;
    nextVal.forEach((item: BackupTransfer) => {
      const existingItem = latestBackupTransfersRef.current.find(b => b.id === item.id);
      if (!existingItem || JSON.stringify(existingItem) !== JSON.stringify(item)) {
        saveDocument('backupTransfers', item.id, item);
      }
    });
    latestBackupTransfersRef.current.forEach((item: BackupTransfer) => {
      if (!nextVal.find(b => b.id === item.id)) {
        removeDocument('backupTransfers', item.id);
      }
    });
  };

  // 2. Persist states in localStorage as fallback backup
  useEffect(() => {
    localStorage.setItem('wbs_hauling_clean_v1_units', JSON.stringify(units));
  }, [units]);

  useEffect(() => {
    localStorage.setItem('wbs_hauling_clean_v1_employees', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('wbs_hauling_clean_v1_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('wbs_hauling_clean_v1_backupTransfers', JSON.stringify(backupTransfers));
  }, [backupTransfers]);

  useEffect(() => {
    localStorage.setItem('wbs_hauling_clean_v1_groups', JSON.stringify(groups));
  }, [groups]);

  // System hard reset function
  const handleSystemReset = () => {
    if (confirm('Apakah Anda yakin ingin menyetel ulang seluruh data ke setelan awal pabrik (demo seed data)? Semua data di cloud dan lokal akan diatur ulang.')) {
      customSetUnits(INITIAL_UNITS);
      customSetEmployees(INITIAL_EMPLOYEES);
      customSetSettings(INITIAL_SETTINGS);
      customSetBackupTransfers([]);
      setGroups(INITIAL_GROUPS);
      setSelectedDate('2026-06-04');
      alert('Sistem berhasil direset!');
    }
  };

  // Navigational callback from Unit card in Jendela 1 to Jendela 2
  const handleNavigateToSetting = (settingId: string) => {
    setActiveSettingIdForPanel(settingId);
    setLayoutMode('settings_only');
    
    // Highlight or scroll can happen automatically
    setTimeout(() => {
      const el = document.getElementById('tab-settings-unit');
      if (el) el.click();
    }, 100);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans selection:bg-amber-400 selection:text-slate-900 overflow-x-hidden antialiased text-slate-700">
      
      {/* GLOBAL MANAGEMENT STRIP */}
      <header className="bg-white border-b border-slate-200 text-slate-800 py-3.5 px-6 shrink-0 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Logo Brand Brand */}
          <div className="flex items-center gap-3">
            <img 
              src="https://res.cloudinary.com/dgjnlxf69/image/upload/f_auto,q_auto/Logo_WBS_akrioo" 
              alt="Logo WBS" 
              className="h-10 object-contain"
              id="app-logo-wbs"
              referrerPolicy="no-referrer"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-black tracking-widest text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded">Dept Operation</span>
              </div>
              <h1 className="text-base font-extrabold tracking-tight text-slate-900 uppercase">WBS MANPOWER CONTROL</h1>
            </div>
          </div>

          {/* Controls & Mode Switches */}
          <div className="flex items-center flex-wrap gap-3">
            
            {/* Firebase Cloud Sync Status */}
            <div className="flex items-center gap-1.5">
              {cloudError ? (
                <div 
                  className="flex flex-col items-start bg-rose-50 border border-rose-200 text-rose-800 text-[10px] py-1 px-2.5 rounded-lg font-bold shadow-sm max-w-[200px]"
                  title={cloudError}
                >
                  <div className="flex items-center gap-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                    <span>Sync Offline</span>
                  </div>
                  <span className="text-[9px] text-rose-600 truncate w-full block">{cloudError}</span>
                </div>
              ) : cloudSynced ? (
                <div 
                  className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs py-1.5 px-3 rounded-lg font-extrabold shadow-sm"
                  title="Database terkoneksi dan disinkronkan secara online otomatis"
                >
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Cloud DB Connected</span>
                </div>
              ) : (
                <div 
                  className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs py-1.5 px-3 rounded-lg font-extrabold shadow-sm animate-pulse"
                  title="Menghubungkan ke database online"
                >
                  <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>Menghubungkan...</span>
                </div>
              )}
            </div>

            {/* View Mode selection */}
            <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200 text-xs font-bold">
              <button
                id="layout-monitor-btn"
                onClick={() => setLayoutMode('monitor_only')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  layoutMode === 'monitor_only' 
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Tampilkan Dashboard Unit (Monitor Lapangan)"
              >
                <Monitor className="h-3.5 w-3.5 shrink-0" />
                <span className="inline">Dashboard Unit</span>
              </button>

              <button
                id="layout-settings-btn"
                onClick={() => setLayoutMode('settings_only')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  layoutMode === 'settings_only' 
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Tampilkan Pengaturan (Panel Konfigurasi)"
              >
                <Settings2 className="h-3.5 w-3.5 shrink-0" />
                <span className="inline">Pengaturan</span>
              </button>
            </div>

          </div>

        </div>
      </header>

      {/* WORKSPACE AREA */}
      <main className="flex-1 w-full max-w-[1920px] mx-auto p-4 md:p-6 overflow-hidden flex flex-col gap-6 h-[calc(100vh-80px)]">
        
        {/* Jendela 1: FIELD MONITOR */}
        {layoutMode === 'monitor_only' && (
          <div 
            id="jendela-1"
            className="flex-1 w-full rounded-xl border border-slate-200 overflow-hidden shadow-lg flex flex-col bg-white"
          >
            <FieldMonitor 
              units={units}
              employees={employees}
              settings={settings}
              groups={groups}
              backupTransfers={backupTransfers}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              onNavigateToSetting={handleNavigateToSetting}
            />
          </div>
        )}

        {/* Jendela 2: SUPERVISOR CONTROLLER */}
        {layoutMode === 'settings_only' && (
          <div 
            id="jendela-2"
            className="flex-1 w-full rounded-xl border border-slate-200 overflow-hidden shadow-lg flex flex-col bg-white font-sans"
          >
            <SupervisorPanel 
              units={units}
              setUnits={customSetUnits}
              employees={employees}
              setEmployees={customSetEmployees}
              settings={settings}
              setSettings={customSetSettings}
              groups={groups}
              backupTransfers={backupTransfers}
              setBackupTransfers={customSetBackupTransfers}
              selectedDate={selectedDate}
              activeSettingIdForPanel={activeSettingIdForPanel}
              setActiveSettingIdForPanel={setActiveSettingIdForPanel}
            />
          </div>
        )}

      </main>

    </div>
  );
}
