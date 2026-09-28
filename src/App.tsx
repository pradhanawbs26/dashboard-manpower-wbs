/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { HeavyUnit, Employee, UnitSetting, UnitGroup, BackupTransfer, FTWRecord } from './types';
import { 
  INITIAL_UNITS, 
  INITIAL_EMPLOYEES, 
  INITIAL_GROUPS, 
  INITIAL_SETTINGS,
  INITIAL_FTW_RECORDS
} from './data/seedData';
import FieldMonitor from './components/FieldMonitor';
import ResumeOperator from './components/ResumeOperator';
import SupervisorPanel from './components/SupervisorPanel';
import FTWOnlineModal from './components/FTWOnlineModal';
import { getOperatorFTW, isNikMatch } from './utils/ftwHelper';
import { subscribeExternalFtw } from './services/externalFtwService';
import { 
  LayoutGrid, Settings2, Columns, Monitor, RefreshCw, Layers, ShieldCheck, 
  HelpCircle, CalendarRange, Cloud, LogOut
} from 'lucide-react';
import { motion } from 'motion/react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, onSnapshot } from 'firebase/firestore';
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

  // FTW Online Submissions state (Sync from external project via NIK)
  const [ftwRecords, setFtwRecords] = useState<FTWRecord[]>(() => {
    const saved = localStorage.getItem('wbs_hauling_clean_v1_ftwRecords');
    if (!saved) return INITIAL_FTW_RECORDS;
    try {
      const parsed: FTWRecord[] = JSON.parse(saved);
      // Ensure seed records for 2026-09-26 are merged in if not already present
      const savedIds = new Set(parsed.map(r => r.id));
      const missingInitial = INITIAL_FTW_RECORDS.filter(r => !savedIds.has(r.id));
      return [...parsed, ...missingInitial];
    } catch {
      return INITIAL_FTW_RECORDS;
    }
  });
  const [isFTWModalOpen, setIsFTWModalOpen] = useState(false);
  const [externalFtwCollection, setExternalFtwCollection] = useState<string>(() => {
    const saved = localStorage.getItem('wbs_external_ftw_col');
    return (saved && saved !== 'ftw') ? saved : 'assessments';
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
  // 'resume_only' = New Jendela (Operator Resume Screen) -> Resume Operator
  // 'settings_only' = Jendela 2 (Supervisor settings) -> Pengaturan
  const [layoutMode, setLayoutMode] = useState<'monitor_only' | 'resume_only' | 'settings_only'>('monitor_only');

  // Multi-window navigation bridge: when clicking a card in monitor, auto-expand in settings
  const [activeSettingIdForPanel, setActiveSettingIdForPanel] = useState<string | null>(null);

  // Keep latest states in refs to access them securely inside async flow and onSnapshot without re-triggering useEffect
  const latestUnitsRef = React.useRef(units);
  const latestEmployeesRef = React.useRef(employees);
  const latestSettingsRef = React.useRef(settings);
  const latestGroupsRef = React.useRef(groups);
  const latestBackupTransfersRef = React.useRef(backupTransfers);
  const latestFtwRecordsRef = React.useRef(ftwRecords);

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

  useEffect(() => {
    latestFtwRecordsRef.current = ftwRecords;
    localStorage.setItem('wbs_hauling_clean_v1_ftwRecords', JSON.stringify(ftwRecords));
  }, [ftwRecords]);

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
        // Exclude system documents and docs lacking valid employee info
        if (doc.id.startsWith('_') || doc.id.includes('registry')) return;
        const data = doc.data() as Partial<Employee>;
        if (!data || !data.nrp || !data.name) return;
        list.push({ id: doc.id, ...data } as Employee);
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

    const unsubFTW = onSnapshot(collection(db, 'ftwSubmissions'), (snapshot) => {
      const list: FTWRecord[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as FTWRecord);
      });
      if (snapshot.empty && latestFtwRecordsRef.current.length > 0) {
        latestFtwRecordsRef.current.forEach(item => {
          saveDocument('ftwSubmissions', item.id, item);
        });
      } else if (list.length > 0) {
        setFtwRecords(prev => {
          const map = new Map(list.map(r => [r.id, r]));
          const preserved = prev.filter(r => !map.has(r.id));
          return [...list, ...preserved];
        });
      }
    }, () => {
      // Graceful fallback if permission or offline
    });

    // Cloud-wide FTW Registry listener inside employees collection (always allowed by Firestore rules)
    const unsubFTWRegistry = onSnapshot(doc(db, 'employees', '_ftw_submissions_registry_'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data && Array.isArray(data.records) && data.records.length > 0) {
          setFtwRecords(prev => {
            const incomingMap = new Map((data.records as FTWRecord[]).map(r => [r.id, r]));
            const preserved = prev.filter(r => !incomingMap.has(r.id));
            return [...data.records, ...preserved];
          });
        }
      }
    }, (err) => {
      console.warn('[Firestore] FTW registry listener notice:', err?.message);
    });

    return () => {
      unsubUnits();
      unsubEmployees();
      unsubGroups();
      unsubSettings();
      unsubBackupTransfers();
      unsubFTW();
      unsubFTWRegistry();
    };
  }, []);

  // Background Real-Time Subscription to external Firebase project (ftw-wbs)
  useEffect(() => {
    let unsubExternal: (() => void) | null = null;
    try {
      unsubExternal = subscribeExternalFtw(
        externalFtwCollection,
        (incomingRecords) => {
          if (incomingRecords && incomingRecords.length > 0) {
            setFtwRecords(prev => {
              const incomingIds = new Set(incomingRecords.map(r => r.id));
              const filteredOld = prev.filter(r => !incomingIds.has(r.id));
              const merged = [...incomingRecords, ...filteredOld];
              return merged;
            });
            // Mirror to local Firestore cache
            incomingRecords.forEach(r => saveDocument('ftwSubmissions', r.id, r));
          }
        },
        (err) => {
          console.warn('[ftw-wbs] Sync notice:', err?.message || err);
        }
      );
    } catch (err) {
      console.warn('Could not initialize ftw-wbs listener:', err);
    }

    return () => {
      if (unsubExternal) unsubExternal();
    };
  }, [externalFtwCollection]);

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

  // FTW Online Data Handlers
  const handleSaveFtwRecord = (record: FTWRecord) => {
    let nextList: FTWRecord[] = [];
    setFtwRecords(prev => {
      const idx = prev.findIndex(r => r.id === record.id || (r.date === record.date && isNikMatch(r.nik, record.nik)));
      if (idx >= 0) {
        nextList = [...prev];
        nextList[idx] = record;
      } else {
        nextList = [record, ...prev];
      }
      return nextList;
    });

    // 1. Persist full FTW registry into cloud Firestore employees collection
    saveDocument('employees', '_ftw_submissions_registry_', {
      records: nextList.length > 0 ? nextList : [record],
      lastUpdated: new Date().toISOString()
    }).catch(err => console.warn('[Firestore] Registry save notice:', err));

    // 2. Also update operator's employee doc if exists
    const matchingEmp = employees.find(e => isNikMatch(e.nrp, record.nik));
    if (matchingEmp) {
      saveDocument('employees', matchingEmp.id, {
        ...matchingEmp,
        latestFtw: record
      }).catch(() => {});
    }

    // 3. Fallback direct save
    saveDocument('ftwSubmissions', record.id, record);
  };

  const handleDeleteFtwRecord = (id: string) => {
    setFtwRecords(prev => {
      const updated = prev.filter(r => r.id !== id);
      saveDocument('employees', '_ftw_submissions_registry_', {
        records: updated,
        lastUpdated: new Date().toISOString()
      }).catch(() => {});
      return updated;
    });
    removeDocument('ftwSubmissions', id);
  };

  const handleBulkSyncFtw = (records: FTWRecord[]) => {
    setFtwRecords(records);
    // Persist full FTW registry into cloud Firestore employees collection
    saveDocument('employees', '_ftw_submissions_registry_', {
      records: records,
      lastUpdated: new Date().toISOString()
    }).catch(err => console.warn('[Firestore] Registry save notice:', err));

    // Also try saving individual docs
    records.forEach(r => saveDocument('ftwSubmissions', r.id, r));
  };

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
              src="https://res.cloudinary.com/dgjnlxf69/image/upload/v1790582652/Logo_Manpower_Control_vege12.png" 
              alt="Logo Manpower Control" 
              className="h-10 md:h-11 object-contain drop-shadow-xs"
              id="app-logo-manpower"
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
            <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200 text-xs font-bold font-sans">
              <button
                id="layout-monitor-btn"
                onClick={() => setLayoutMode('monitor_only')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  layoutMode === 'monitor_only' 
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Tampilkan Dashboard Unit (Monitor Lapangan)"
              >
                <Monitor className="h-3.5 w-3.5 shrink-0" />
                <span className="inline">Dashboard Unit</span>
              </button>

              <button
                id="layout-resume-btn"
                onClick={() => setLayoutMode('resume_only')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  layoutMode === 'resume_only' 
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Tampilkan Resume Operator"
              >
                <Layers className="h-3.5 w-3.5 shrink-0 animate-pulse text-amber-600" />
                <span className="inline">Resume Operator</span>
              </button>
 
              <button
                id="layout-settings-btn"
                onClick={() => setLayoutMode('settings_only')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  layoutMode === 'settings_only' 
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm' 
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
              ftwRecords={ftwRecords}
              onOpenFTWModal={() => setIsFTWModalOpen(true)}
            />
          </div>
        )}

        {/* Jendela Tambahan: RESUME OPERATOR */}
        {layoutMode === 'resume_only' && (
          <div 
            id="jendela-resume"
            className="flex-1 w-full rounded-xl border border-slate-200 overflow-hidden shadow-lg flex flex-col bg-white"
          >
            <ResumeOperator 
              units={units}
              employees={employees}
              settings={settings}
              backupTransfers={backupTransfers}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              ftwRecords={ftwRecords}
              onOpenFTWModal={() => setIsFTWModalOpen(true)}
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
              setSelectedDate={setSelectedDate}
              activeSettingIdForPanel={activeSettingIdForPanel}
              setActiveSettingIdForPanel={setActiveSettingIdForPanel}
              ftwRecords={ftwRecords}
              onOpenFTWModal={() => setIsFTWModalOpen(true)}
              onBulkSyncFtw={handleBulkSyncFtw}
              onSaveFtwRecord={handleSaveFtwRecord}
              externalCollectionName={externalFtwCollection}
            />
          </div>
        )}

      </main>

      {/* FTW Online Management & Sync Modal */}
      {isFTWModalOpen && (
        <FTWOnlineModal
          isOpen={isFTWModalOpen}
          onClose={() => setIsFTWModalOpen(false)}
          ftwRecords={ftwRecords}
          onSaveRecord={handleSaveFtwRecord}
          onDeleteRecord={handleDeleteFtwRecord}
          onBulkSync={handleBulkSyncFtw}
          employees={employees}
          selectedDate={selectedDate}
          externalCollectionName={externalFtwCollection}
          onSetExternalCollectionName={setExternalFtwCollection}
        />
      )}

    </div>
  );
}
