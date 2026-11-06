/**
 * Учёт рабочего времени и расчёт зарплаты по правилам ТК РФ.
 *
 * - Норма — по производственному календарю, уменьшенная на норму дней отпуска/больничного
 *   (индивидуальная норма).
 * - Часы в праздники (ст. 153 ТК РФ) — часы смен, попавшие на нерабочие праздничные дни;
 *   ночная смена делится по полуночи. Эти часы оплачиваются в двойном размере и
 *   не входят в переработку.
 * - Переработка (ст. 152 ТК РФ) — всё, что отработано сверх индивидуальной нормы
 *   (без праздничных часов): первые 2 часа ×1,5, остальные ×2.
 */
import { ShiftType, isWorkingShift } from '../constants/shifts';
import { LeaveType } from '../constants/leaveTypes';
import { parseHHMM } from './time';
import { addDaysToKey } from './dates';
import { getRuDayInfo, ruNormForRange, ruNormHoursForDay } from './ruCalendar';

export interface RuPaySettings {
  weeklyHours: number;
  /** Оклад в месяц (до вычета НДФЛ). 0 — не задан. */
  monthlySalary: number;
  /** Часовая ставка, если оклада нет. */
  hourlyRate: number;
  ndflPercent: number;
  overtimeFirstRate: number;
  overtimeNextRate: number;
  holidayRate: number;
}

export interface RuWorkInput {
  shifts: Record<string, string>;
  overtime: Record<string, number>;
  leave: Record<string, string>;
  allShifts: ShiftType[];
  leaveTypes: LeaveType[];
  fromKey: string;
  toKey: string;
  weeklyHours: number;
}

export interface RuWorkStats {
  /** Норма по производственному календарю. */
  normHours: number;
  normDays: number;
  /** Норма за вычетом дней отпуска/больничного. */
  personalNormHours: number;
  /** Норма, приходящаяся на оплачиваемые отпуска (для расчёта по окладу). */
  paidLeaveNormHours: number;
  leaveNormHours: number;
  /** Отработано всего: смены + вписанная вручную переработка. */
  workedHours: number;
  shiftHours: number;
  loggedOvertimeHours: number;
  /** Отработано в нерабочие праздничные дни. */
  holidayHours: number;
  holidayShifts: number;
  /** Сверхурочные: отработано (без праздничных часов) сверх индивидуальной нормы. */
  overtimeHours: number;
  /** Недоработка до нормы. */
  shortfallHours: number;
  /** Отработано в пределах нормы (без праздников). */
  regularHours: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Часы смены по датам: ночная смена делится по полуночи. */
function splitShiftByDay(key: string, shift: ShiftType): [string, number][] {
  const s = parseHHMM(shift.startTime);
  const e = parseHHMM(shift.endTime);
  if (!s || !e) return [];
  const start = s[0] * 60 + s[1];
  let end = e[0] * 60 + e[1];
  if (end <= start) end += 24 * 60;
  const first = Math.min(end, 24 * 60) - start;
  const out: [string, number][] = [[key, first / 60]];
  if (end > 24 * 60) out.push([addDaysToKey(key, 1), (end - 24 * 60) / 60]);
  return out;
}

export function computeRuWork(input: RuWorkInput): RuWorkStats {
  const { fromKey, toKey, weeklyHours } = input;
  const inRange = (k: string) => k >= fromKey && k <= toKey;
  const shiftMap = new Map(input.allShifts.map((s) => [s.code, s]));
  const leaveMap = new Map(input.leaveTypes.map((t) => [t.id, t]));

  const norm = ruNormForRange(fromKey, toKey, weeklyHours);

  let leaveNormHours = 0;
  let paidLeaveNormHours = 0;
  for (const [key, id] of Object.entries(input.leave)) {
    if (!inRange(key)) continue;
    const type = leaveMap.get(id);
    if (!type) continue;
    const h = ruNormHoursForDay(key, weeklyHours);
    leaveNormHours += h;
    if (type.paid) paidLeaveNormHours += h;
  }

  let shiftHours = 0;
  let holidayHours = 0;
  const holidayShiftDays = new Set<string>();
  // Смена с предыдущего дня может заходить в первый день периода, поэтому берём на день раньше.
  const scanFrom = addDaysToKey(fromKey, -1);
  for (const [key, code] of Object.entries(input.shifts)) {
    if (key < scanFrom || key > toKey || input.leave[key]) continue;
    const shift = shiftMap.get(code);
    if (!shift || !isWorkingShift(shift)) continue;
    // Смена целиком относится к периоду дня начала (как и в остальной статистике),
    // а праздничные часы считаем по фактическим датам.
    for (const [day, hours] of splitShiftByDay(key, shift)) {
      if (inRange(key)) shiftHours += hours;
      if (inRange(day) && getRuDayInfo(day).holiday) {
        holidayHours += hours;
        holidayShiftDays.add(key);
      }
    }
  }

  let loggedOvertimeHours = 0;
  for (const [key, hours] of Object.entries(input.overtime)) {
    if (!inRange(key) || !(hours > 0)) continue;
    loggedOvertimeHours += hours;
    if (getRuDayInfo(key).holiday) holidayHours += hours;
  }

  const workedHours = shiftHours + loggedOvertimeHours;
  const personalNormHours = Math.max(0, norm.hours - leaveNormHours);
  const nonHoliday = workedHours - holidayHours;
  const overtimeHours = Math.max(0, nonHoliday - personalNormHours);
  const shortfallHours = Math.max(0, personalNormHours - nonHoliday);

  return {
    normHours: round1(norm.hours),
    normDays: norm.workDays,
    personalNormHours: round1(personalNormHours),
    paidLeaveNormHours: round1(paidLeaveNormHours),
    leaveNormHours: round1(leaveNormHours),
    workedHours: round1(workedHours),
    shiftHours: round1(shiftHours),
    loggedOvertimeHours: round1(loggedOvertimeHours),
    holidayHours: round1(holidayHours),
    holidayShifts: holidayShiftDays.size,
    overtimeHours: round1(overtimeHours),
    shortfallHours: round1(shortfallHours),
    regularHours: round1(Math.min(nonHoliday, personalNormHours)),
  };
}

export interface RuPayBreakdown {
  /** Ставка за час. */
  rate: number;
  /** Откуда ставка: оклад / часовая ставка / вычислена из полученной суммы. */
  rateSource: 'salary' | 'hourly' | 'received' | 'none';
  regularPay: number;
  paidLeavePay: number;
  holidayPay: number;
  overtimePay: number;
  gross: number;
  ndfl: number;
  net: number;
  /** Сколько «нормальных» часов стоит весь месяц с учётом коэффициентов. */
  weightedHours: number;
}

function weightedHours(w: RuWorkStats, p: RuPaySettings) {
  const ot = w.overtimeHours;
  const otWeighted = Math.min(ot, 2) * p.overtimeFirstRate + Math.max(0, ot - 2) * p.overtimeNextRate;
  return {
    regular: w.regularHours,
    leave: w.paidLeaveNormHours,
    holiday: w.holidayHours * p.holidayRate,
    overtime: otWeighted,
  };
}

function breakdown(rate: number, source: RuPayBreakdown['rateSource'], w: RuWorkStats, p: RuPaySettings): RuPayBreakdown {
  const h = weightedHours(w, p);
  const regularPay = rate * h.regular;
  const paidLeavePay = rate * h.leave;
  const holidayPay = rate * h.holiday;
  const overtimePay = rate * h.overtime;
  const gross = regularPay + paidLeavePay + holidayPay + overtimePay;
  const ndfl = gross * (p.ndflPercent / 100);
  return {
    rate: round2(rate),
    rateSource: source,
    regularPay: round2(regularPay),
    paidLeavePay: round2(paidLeavePay),
    holidayPay: round2(holidayPay),
    overtimePay: round2(overtimePay),
    gross: round2(gross),
    ndfl: round2(ndfl),
    net: round2(gross - ndfl),
    weightedHours: round1(h.regular + h.leave + h.holiday + h.overtime),
  };
}

/** Расчёт по окладу или часовой ставке из настроек. */
export function estimateRuPay(w: RuWorkStats, p: RuPaySettings): RuPayBreakdown {
  if (p.monthlySalary > 0 && w.normHours > 0) return breakdown(p.monthlySalary / w.normHours, 'salary', w, p);
  if (p.hourlyRate > 0) return breakdown(p.hourlyRate, 'hourly', w, p);
  return breakdown(0, 'none', w, p);
}

/**
 * Обратный расчёт: по сумме, полученной на руки, находим фактическую ставку в час
 * и раскладываем сумму на обычные часы, праздники и переработку.
 */
export function payFromReceived(received: number, w: RuWorkStats, p: RuPaySettings): RuPayBreakdown | null {
  const h = weightedHours(w, p);
  const total = h.regular + h.leave + h.holiday + h.overtime;
  if (!(received > 0) || total <= 0) return null;
  const gross = received / (1 - Math.min(p.ndflPercent, 99) / 100);
  return breakdown(gross / total, 'received', w, p);
}

/** Сумма помесячных показателей (переработка считается по каждому месяцу отдельно). */
export function sumRuWork(list: RuWorkStats[]): RuWorkStats {
  const keys = Object.keys(list[0]) as (keyof RuWorkStats)[];
  const out = {} as RuWorkStats;
  for (const k of keys) out[k] = round1(list.reduce((acc, w) => acc + w[k], 0));
  return out;
}

export function sumRuPay(list: RuPayBreakdown[]): RuPayBreakdown | null {
  if (!list.length) return null;
  const s = (f: (p: RuPayBreakdown) => number) => round2(list.reduce((acc, p) => acc + f(p), 0));
  const weighted = s((p) => p.weightedHours);
  const gross = s((p) => p.gross);
  return {
    rate: weighted > 0 ? round2(gross / weighted) : 0,
    rateSource: list[0].rateSource,
    regularPay: s((p) => p.regularPay),
    paidLeavePay: s((p) => p.paidLeavePay),
    holidayPay: s((p) => p.holidayPay),
    overtimePay: s((p) => p.overtimePay),
    gross,
    ndfl: s((p) => p.ndfl),
    net: s((p) => p.net),
    weightedHours: round1(weighted),
  };
}
