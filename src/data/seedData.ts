/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HeavyUnit, Employee, UnitGroup, UnitSetting } from '../types';

export const INITIAL_UNITS: HeavyUnit[] = [];

export const INITIAL_EMPLOYEES: Employee[] = [];

export const INITIAL_GROUPS: UnitGroup[] = [
  { id: 'utama', name: 'Grup Alat Utama', description: 'Grup armada Dump Truck dan Wheel Loader utama untuk angkutan Batubara (hauling).' },
  { id: 'master', name: 'Grup Master', description: 'Grup operator Master cadangan (tidak terikat unit fisik, terbagi dalam slot kotak M-1, M-2 dst).' }
];

export const INITIAL_SETTINGS: UnitSetting[] = [];
