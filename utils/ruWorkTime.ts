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
  /** Премия в процентах к окладу — для расчёта месяцев, где сумма не вписана. */
  bonusPercent: number;
  /** Праздники и переработка оплачиваются с учётом премии (КС РФ № 35-П). */
  bonusInExtras: boolean;
  /** Профсоюзные взносы, % от начисленного. */
  unionPercent: number;
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
  /** Базовая ставка за час: оклад ÷ норма месяца (или часовая ставка). */
  rate: number;
  /** Ставка, по которой оплачиваются праздники и переработка (с премией или без). */
  extrasRate: number;
  /** Откуда ставка: оклад / часовая ставка / вычислена из полученной суммы. */
  rateSource: 'salary' | 'hourly' | 'received' | 'none';
  /** Премия в процентах к окладу за отработанное время (может быть отрицательной). */
  bonusPercent: number;
  /** Часы, оплачиваемые окладом: обычные в пределах нормы + оплачиваемый отпуск. */
  baseHours: number;
  /** Оклад за отработанные в пределах нормы часы. */
  regularPay: number;
  paidLeavePay: number;
  bonusPay: number;
  /** Отпускные по листку (начислено). В прогнозе 0 — там отпуск в paidLeavePay и премии. */
  vacationPay: number;
  /** Отпуск по прогнозу с премией (начислено): примерно столько придёт отпускными. */
  leaveTotal: number;
  holidayPay: number;
  overtimePay: number;
  gross: number;
  ndfl: number;
  /** Профсоюзные взносы. */
  union: number;
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

/**
 * Начисление при базовой ставке `rate` и премии `k` (доля от оклада, 0.3 = 30%).
 * Премия начисляется на оклад за отработанное время и отпуск. Если bonusInExtras,
 * праздники и переработка оплачиваются по ставке с премией (Постановление КС РФ
 * от 27.06.2023 № 35-П), иначе — по ставке оклада.
 */
function breakdown(rate: number, k: number, source: RuPayBreakdown['rateSource'], w: RuWorkStats, p: RuPaySettings): RuPayBreakdown {
  const h = weightedHours(w, p);
  const baseHours = h.regular + h.leave;
  const extrasRate = p.bonusInExtras ? rate * (1 + k) : rate;
  const regularPay = rate * h.regular;
  const paidLeavePay = rate * h.leave;
  const bonusPay = rate * k * baseHours;
  const holidayPay = extrasRate * h.holiday;
  const overtimePay = extrasRate * h.overtime;
  const gross = regularPay + paidLeavePay + bonusPay + holidayPay + overtimePay;
  const ndfl = gross * (p.ndflPercent / 100);
  const union = gross * (p.unionPercent / 100);
  return {
    rate: round2(rate),
    extrasRate: round2(extrasRate),
    rateSource: source,
    bonusPercent: round1(k * 100),
    baseHours: round1(baseHours),
    regularPay: round2(regularPay),
    paidLeavePay: round2(paidLeavePay),
    bonusPay: round2(bonusPay),
    vacationPay: 0,
    leaveTotal: round2(paidLeavePay * (1 + k)),
    holidayPay: round2(holidayPay),
    overtimePay: round2(overtimePay),
    gross: round2(gross),
    ndfl: round2(ndfl),
    union: round2(union),
    net: round2(gross - ndfl - union),
    weightedHours: round1(baseHours + h.holiday + h.overtime),
  };
}

function baseRate(w: RuWorkStats, p: RuPaySettings): { rate: number; source: RuPayBreakdown['rateSource'] } | null {
  if (p.monthlySalary > 0 && w.normHours > 0) return { rate: p.monthlySalary / w.normHours, source: 'salary' };
  if (p.hourlyRate > 0) return { rate: p.hourlyRate, source: 'hourly' };
  return null;
}

/** Расчёт по окладу (или часовой ставке) и проценту премии из настроек. */
export function estimateRuPay(w: RuWorkStats, p: RuPaySettings): RuPayBreakdown {
  const base = baseRate(w, p);
  if (!base) return breakdown(0, 0, 'none', w, p);
  return breakdown(base.rate, p.bonusPercent / 100, base.source, w, p);
}

/** Что пришло за месяц: части выплаты, как в расчётном листке. */
export interface PaidParts {
  /** Аванс на руки. */
  advance: number;
  /** Зарплата (окончательный расчёт) на руки. */
  salary: number;
  /** Профсоюзные взносы из листка; 0 — посчитать по проценту из настроек. */
  union: number;
  /** Отпускные на руки (приходят отдельно, до отпуска). */
  vacation: number;
}

export function paidTotal(parts: PaidParts | undefined): number {
  return parts ? parts.advance + parts.salary + parts.vacation : 0;
}

/**
 * Начислено по частям выплаты. Всё начисленное расходится на аванс, зарплату, НДФЛ и
 * профвзносы: начислено = (аванс + зарплата + взносы) ÷ (1 − НДФЛ). Если взносы не вписаны,
 * они берутся процентом из настроек.
 */
export function grossFromParts(parts: Omit<PaidParts, 'vacation'>, p: RuPaySettings): number {
  const net = parts.advance + parts.salary;
  const ndfl = Math.min(p.ndflPercent, 99) / 100;
  if (parts.union > 0) return (net + parts.union) / (1 - ndfl);
  return net / Math.max(0.01, 1 - ndfl - p.unionPercent / 100);
}

/**
 * Обратный расчёт по тому, что пришло за месяц.
 * Если задан оклад (или ставка), всё, что сверх оклада, праздников и переработки, — это
 * премия: находим её процент и раскладываем сумму. Без оклада находим только ставку в час.
 * Если взносы вписаны, их процент берётся из листка, а не из настроек.
 */
export function payFromReceived(parts: PaidParts | undefined, w: RuWorkStats, p: RuPaySettings): RuPayBreakdown | null {
  if (!parts || paidTotal(parts) <= 0) return null;
  const ndflShare = Math.min(p.ndflPercent, 99) / 100;
  // Отпускные считаются по среднему заработку и приходят отдельно: оклад и премию
  // раскладываем без них, а отпускные добавляем отдельной строкой.
  const vacationGross = parts.vacation / (1 - ndflShare);
  if (parts.vacation > 0) w = { ...w, paidLeaveNormHours: 0 };
  const withVacation = (r: RuPayBreakdown): RuPayBreakdown => {
    if (!(vacationGross > 0)) return r;
    const gross = r.gross + vacationGross;
    const ndfl = gross * ndflShare;
    return { ...r, vacationPay: round2(vacationGross), gross: round2(gross), ndfl: round2(ndfl), net: round2(gross - ndfl - r.union) };
  };
  const h = weightedHours(w, p);
  const total = h.regular + h.leave + h.holiday + h.overtime;
  const gross = parts.advance + parts.salary > 0 ? grossFromParts(parts, p) : 0;
  const pp: RuPaySettings = parts.union > 0 && gross > 0 ? { ...p, unionPercent: (parts.union / gross) * 100 } : p;
  if (gross <= 0 || total <= 0) {
    // Смен в этом месяце нет (или пришли только отпускные): показываем начисленное одной суммой.
    const r = breakdown(0, 0, 'received', w, { ...pp, unionPercent: 0 });
    const union = gross * (pp.unionPercent / 100);
    return withVacation({ ...r, regularPay: round2(gross), gross: round2(gross), union: round2(union), ndfl: round2(gross * ndflShare), net: round2(gross * (1 - ndflShare) - union) });
  }
  const base = baseRate(w, p);
  if (!base) return withVacation(breakdown(gross / total, 0, 'received', w, pp));

  const b = base.rate;
  const baseHours = h.regular + h.leave;
  const extras = h.holiday + h.overtime;
  let k: number;
  if (p.bonusInExtras) {
    // gross = b·(1+k)·(baseHours + extras)
    k = gross / (b * total) - 1;
  } else {
    // gross = b·(1+k)·baseHours + b·extras
    k = baseHours > 0 ? (gross - b * extras) / (b * baseHours) - 1 : 0;
  }
  return withVacation(breakdown(b, k, base.source, w, pp));
}

export type AdvanceMode = 'worked' | 'norm' | 'percent' | 'fixed';

export interface AdvanceSettings {
  mode: AdvanceMode;
  /** Процент от оклада (mode 'percent') или сумма (mode 'fixed'). */
  value: number;
  /** Аванс выплачивается за вычетом НДФЛ. */
  minusNdfl: boolean;
}

/**
 * Аванс на руки.
 * - worked: оклад ÷ норма месяца × часы, отработанные с 1 по 15 число;
 * - norm: оклад × норма с 1 по 15 ÷ норма месяца (половина месяца по календарю);
 * - percent: процент от оклада;
 * В режимах norm и percent аванс уменьшается за отпуск/больничный с 1 по 15 число —
 * пропорционально норме, которая на них пришлась.
 * - fixed: фиксированная сумма (уже на руки, НДФЛ не вычитается).
 * Округляется до рубля.
 */
export function computeAdvance(
  a: AdvanceSettings,
  p: RuPaySettings,
  month: RuWorkStats,
  firstHalf: RuWorkStats
): number {
  if (a.mode === 'fixed') return Math.max(0, Math.round(a.value));
  const salary = p.monthlySalary > 0 ? p.monthlySalary : p.hourlyRate * month.normHours;
  if (!(salary > 0)) return 0;
  let gross = 0;
  const presentShare = firstHalf.normHours > 0 ? Math.max(0, firstHalf.normHours - firstHalf.leaveNormHours) / firstHalf.normHours : 1;
  if (a.mode === 'percent') gross = ((salary * a.value) / 100) * presentShare;
  else if (month.normHours > 0) {
    const rate = salary / month.normHours;
    gross = a.mode === 'worked' ? rate * firstHalf.workedHours : rate * firstHalf.normHours * presentShare;
  }
  const net = a.minusNdfl ? gross * (1 - p.ndflPercent / 100) : gross;
  return Math.max(0, Math.round(net));
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
  const baseHours = s((p) => p.baseHours);
  const salaryPart = s((p) => p.regularPay + p.paidLeavePay);
  const bonusPay = s((p) => p.bonusPay);
  const gross = s((p) => p.gross);
  const weighted = s((p) => p.weightedHours);
  const rate = baseHours > 0 ? salaryPart / baseHours : list[0].rate;
  const bonusShare = salaryPart > 0 ? bonusPay / salaryPart : 0;
  return {
    rate: round2(rate),
    extrasRate: round2(list[0].extrasRate === list[0].rate ? rate : rate * (1 + bonusShare)),
    rateSource: list[0].rateSource,
    bonusPercent: round1(bonusShare * 100),
    baseHours: round1(baseHours),
    regularPay: s((p) => p.regularPay),
    paidLeavePay: s((p) => p.paidLeavePay),
    bonusPay,
    vacationPay: s((p) => p.vacationPay),
    leaveTotal: s((p) => p.leaveTotal),
    holidayPay: s((p) => p.holidayPay),
    overtimePay: s((p) => p.overtimePay),
    gross,
    ndfl: s((p) => p.ndfl),
    union: s((p) => p.union),
    net: s((p) => p.net),
    weightedHours: round1(weighted),
  };
}
