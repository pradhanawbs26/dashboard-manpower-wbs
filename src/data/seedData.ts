/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HeavyUnit, Employee, UnitGroup, UnitSetting } from '../types';

export const INITIAL_UNITS: HeavyUnit[] = [
  { id: 'u-dt-01', unitCode: 'DT-01', brand: 'Scania P410', type: 'Dump Truck', status: 'Ready' },
  { id: 'u-dt-02', unitCode: 'DT-02', brand: 'Scania P410', type: 'Dump Truck', status: 'Ready' },
  { id: 'u-dt-03', unitCode: 'DT-03', brand: 'Volvo FMX 440', type: 'Dump Truck', status: 'Ready' },
  { id: 'u-dt-04', unitCode: 'DT-04', brand: 'Volvo FMX 440', type: 'Dump Truck', status: 'Ready' },
  { id: 'u-dt-05', unitCode: 'DT-05', brand: 'Hino Ranger 260', type: 'Dump Truck', status: 'Ready' },
  { id: 'u-dt-06', unitCode: 'DT-06', brand: 'Hino Ranger 260', type: 'Dump Truck', status: 'Ready' },
  { id: 'u-dt-07', unitCode: 'DT-07', brand: 'Scania P410', type: 'Dump Truck', status: 'Ready' },
  { id: 'u-dt-08', unitCode: 'DT-08', brand: 'Volvo FMX 440', type: 'Dump Truck', status: 'Maintenance' },
  { id: 'u-wl-01', unitCode: 'WL-01', brand: 'Komatsu WA500', type: 'Wheel Loader', status: 'Ready' },
  { id: 'u-wl-02', unitCode: 'WL-02', brand: 'Komatsu WA500', type: 'Wheel Loader', status: 'Ready' },
  { id: 'u-ex-01', unitCode: 'EX-01', brand: 'Komatsu PC300', type: 'Excavator', status: 'Ready' },
  { id: 'u-ex-02', unitCode: 'EX-02', brand: 'Caterpillar 320D', type: 'Excavator', status: 'Ready' },
  { id: 'u-gd-01', unitCode: 'GD-01', brand: 'Caterpillar 14M', type: 'Motor Grader', status: 'Ready' },
  { id: 'u-cp-01', unitCode: 'CP-01', brand: 'Bomag BW211', type: 'Compactor', status: 'Ready' },
  { id: 'u-wt-01', unitCode: 'WT-01', brand: 'Isuzu Giga 12KL', type: 'Water Truck', status: 'Ready' },
];

export const INITIAL_EMPLOYEES: Employee[] = [
  { id: 'e-budi', nrp: 'NRP20231001', name: 'Budi Santoso', rosterPattern: '6-1', status: 'Active', specializations: ['Dump Truck'] },
  { id: 'e-andi', nrp: 'NRP20231002', name: 'Andi Wijaya', rosterPattern: '6-1', status: 'Active', specializations: ['Dump Truck'] },
  { id: 'e-edi', nrp: 'NRP20231003', name: 'Edi Wibowo', rosterPattern: '6-1', status: 'Active', specializations: ['Dump Truck'] },
  { id: 'e-rahmat', nrp: 'NRP20231004', name: 'Rahmat Hidayat', rosterPattern: '6-1', status: 'Active', specializations: ['Dump Truck'] },
  { id: 'e-agus', nrp: 'NRP20231005', name: 'Agus Setiawan', rosterPattern: '6-1', status: 'Active', specializations: ['Dump Truck', 'Water Truck'] },
  { id: 'e-hendra', nrp: 'NRP20231006', name: 'Hendra Wijaya', rosterPattern: '6-1', status: 'Active', specializations: ['Dump Truck'] },
  { id: 'e-joko', nrp: 'NRP20231007', name: 'Joko Susilo', rosterPattern: '6-1', status: 'Active', specializations: ['Wheel Loader'] },
  { id: 'e-rudi', nrp: 'NRP20231008', name: 'Rudi Hartono', rosterPattern: '6-1', status: 'Active', specializations: ['Wheel Loader'] },
  { id: 'e-bambang', nrp: 'NRP20231009', name: 'Bambang Mulyono', rosterPattern: '6-1', status: 'Active', specializations: ['Excavator'] },
  { id: 'e-slamet', nrp: 'NRP20231010', name: 'Slamet Riyadi', rosterPattern: '6-1', status: 'Active', specializations: ['Excavator'] },
  { id: 'e-dedi', nrp: 'NRP20231011', name: 'Dedi Supriadi', rosterPattern: '6-1', status: 'Active', specializations: ['Water Truck', 'Dump Truck'] },
  { id: 'e-asep', nrp: 'NRP20231012', name: 'Asep Sunandar', rosterPattern: '6-1', status: 'Active', specializations: ['Motor Grader'] },
  { id: 'e-mulyadi', nrp: 'NRP20231013', name: 'Mulyadi', rosterPattern: '6-1', status: 'Active', specializations: ['Compactor'] },
  { id: 'e-eko', nrp: 'NRP20231014', name: 'Eko Prasetyo', rosterPattern: '6-1', status: 'Active', specializations: ['Dump Truck'] },
  { id: 'e-yudi', nrp: 'NRP20231015', name: 'Yudi Pratama', rosterPattern: '6-1', status: 'Active', specializations: ['Dump Truck'] },
  { id: 'e-tri', nrp: 'NRP20231016', name: 'Tri Wahyuni', rosterPattern: '6-1', status: 'Active', specializations: ['Dump Truck'] },
  { id: 'e-heri', nrp: 'NRP20231017', name: 'Herianto', rosterPattern: '6-1', status: 'Active', specializations: ['Dump Truck'] },
  { id: 'e-suparman', nrp: 'NRP20231018', name: 'Suparman', rosterPattern: '6-1', status: 'Active', specializations: ['Dump Truck'] },
  { id: 'e-wawan', nrp: 'NRP20231019', name: 'Wawan Hermawan', rosterPattern: '6-1', status: 'Active', specializations: ['Dump Truck'] },
  { id: 'e-sugeng', nrp: 'NRP20231020', name: 'Sugeng Priyadi', rosterPattern: '6-1', status: 'Active', specializations: ['Dump Truck'] },
];

export const INITIAL_GROUPS: UnitGroup[] = [
  { id: 'utama', name: 'Grup Alat Utama', description: 'Grup armada Dump Truck dan Wheel Loader utama untuk angkutan Batubara (hauling).' },
  { id: 'master', name: 'Grup Master', description: 'Grup operator Master cadangan (tidak terikat unit fisik, terbagi dalam slot kotak M-1, M-2 dst).' }
];

export const INITIAL_SETTINGS: UnitSetting[] = [
  { id: 'setting-dt-01', groupId: 'utama', unitId: 'u-dt-01', operator1Id: 'e-budi', operator2Id: 'e-andi', rosterPattern: '6-1', fixedOffDayOfWeek: 0, startSiangDate: '2026-06-01' },
  { id: 'setting-dt-02', groupId: 'utama', unitId: 'u-dt-02', operator1Id: 'e-edi', operator2Id: 'e-rahmat', rosterPattern: '6-1', fixedOffDayOfWeek: 0, startSiangDate: '2026-06-01' },
  { id: 'setting-dt-03', groupId: 'utama', unitId: 'u-dt-03', operator1Id: 'e-agus', operator2Id: 'e-hendra', rosterPattern: '6-1', fixedOffDayOfWeek: 0, startSiangDate: '2026-06-01' },
  { id: 'setting-wl-01', groupId: 'utama', unitId: 'u-wl-01', operator1Id: 'e-joko', operator2Id: 'e-rudi', rosterPattern: '6-1', fixedOffDayOfWeek: 0, startSiangDate: '2026-06-01' },
  { id: 'setting-ex-01', groupId: 'utama', unitId: 'u-ex-01', operator1Id: 'e-bambang', operator2Id: 'e-slamet', rosterPattern: '6-1', fixedOffDayOfWeek: 0, startSiangDate: '2026-06-01' },
  
  // Master Slots for backfilling
  { id: 'setting-master-01', groupId: 'master', unitId: '', masterSlotCode: 'M-1', operator1Id: 'e-eko', operator2Id: 'e-yudi', rosterPattern: '6-1', fixedOffDayOfWeek: 0, startSiangDate: '2026-06-01', backupPriorityType1: 'Dump Truck' },
  { id: 'setting-master-02', groupId: 'master', unitId: '', masterSlotCode: 'M-2', operator1Id: 'e-tri', operator2Id: 'e-heri', rosterPattern: '6-1', fixedOffDayOfWeek: 0, startSiangDate: '2026-06-01', backupPriorityType1: 'Dump Truck' },
  { id: 'setting-master-03', groupId: 'master', unitId: '', masterSlotCode: 'M-3', operator1Id: 'e-suparman', operator2Id: 'e-wawan', rosterPattern: '6-1', fixedOffDayOfWeek: 0, startSiangDate: '2026-06-01', backupPriorityType1: 'Dump Truck', backupPriorityType2: 'Water Truck' },
];
