import { tr } from '../utils/i18n';
export interface LeaveType {
  id: string;
  code: string;       // short code for calendar pill (e.g. "AL", "SL")
  label: string;
  color: string;
  icon: string;
  paid: boolean;       // whether this leave counts as paid hours
  defaultDays: number; // annual allocation
}

export const DEFAULT_LEAVE_TYPES: LeaveType[] = [
  { id: 'annual',    code: 'AL', label: 'Annual Leave',    color: '#10B981', icon: 'umbrella-beach',       paid: true,  defaultDays: 21 },
  { id: 'sick',      code: 'SL', label: 'Sick Leave',      color: '#EF4444', icon: 'hospital-box-outline', paid: true,  defaultDays: 14 },
  { id: 'emergency', code: 'EL', label: 'Emergency Leave', color: '#F97316', icon: 'alert-circle-outline', paid: true,  defaultDays: 5  },
  { id: 'unpaid',    code: 'UL', label: 'Unpaid Leave',    color: '#EC4899', icon: 'cash-off',             paid: false, defaultDays: 0  },
];

/** Виды отпуска с названиями и кодами на языке приложения (id не меняются). */
export function localizedLeaveTypes(): LeaveType[] {
  return DEFAULT_LEAVE_TYPES.map((t) => ({ ...t, label: tr(t.label), code: tr(t.code) }));
}

/** Default hours credited per paid leave day (configurable in Settings → Pay). */
export const STANDARD_WORK_HOURS = 8;

export function defaultLeaveBalances(): Record<string, number> {
  return Object.fromEntries(DEFAULT_LEAVE_TYPES.map((t) => [t.id, t.defaultDays]));
}
