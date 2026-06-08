/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface HeavyUnit {
  id: string;
  unitCode: string; // e.g. "DT-101", "EX-203"
  brand: string;     // e.g. "Scania P410", "Volvo FMX 440", "Komatsu PC400"
  type: 'Wheel Loader' | 'Excavator' | 'Bulldozer' | 'Reach Stacker' | 'Forklift' | 'Dump Truck' | 'Flat Deck' | 'Water Truck' | 'Barge Loading Conveyor' | 'Weightbridge' | 'Kapten FD' | 'Motor Grader' | 'Compactor' | 'Other';
  status: 'Ready' | 'Breakdown' | 'Maintenance';
}

export interface Employee {
  id: string;
  nrp: string;       // Employee ID Code, e.g. "NRP99201"
  name: string;
  rosterPattern: '6-1' | '13-1';
  status: 'Active' | 'On Leave' | 'Sick' | 'Inactive';
  specializations: string[]; // EGI Alat: can hold multiple equipment category values
}

export interface UnitGroup {
  id: string;        // 'utama' (Grup Alat Utama) or 'master' (Grup Master) or custom UUID
  name: string;      // e.g. "Grup Alat Utama", "Grup Master"
  description?: string;
}

export interface UnitSetting {
  id: string;
  groupId: string;        // references UnitGroup.id
  unitId: string;         // references HeavyUnit.id (can be empty string for Master Slots)
  masterSlotCode?: string; // e.g. "M-1", "M-2" (used if groupId is 'master')
  operator1Id: string;    // references Employee.id
  operator2Id: string;    // references Employee.id
  rosterPattern: '6-1' | '13-1' | 'weekly-fixed';
  fixedOffDayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday (used only if rosterPattern is weekly-fixed)
  startSiangDate: string;    // YYYY-MM-DD (the reference start date where Operator 1 is Day Shift (Siang) and Operator 2 is Night Shift (Malam))
  backupPriorityType1?: string;
  backupPriorityType2?: string;
  backupPriorityUnitId1?: string;
  backupPriorityUnitId2?: string;
}

export interface BackupTransfer {
  id: string;
  operatorId: string;    // references Employee.id
  targetUnitId: string;  // references HeavyUnit.id
  date: string;          // YYYY-MM-DD
  shift: 1 | 2;          // 1 = Siang, 2 = Malam
}

export interface ShiftInfo {
  operator1Role: 'S' | 'M' | 'OFF'; // S = Siang (Shift 1), M = Malam (Shift 2)
  operator2Role: 'S' | 'M' | 'OFF';
}
