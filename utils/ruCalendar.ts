/**
 * Производственный календарь РФ.
 *
 * Праздники — ст. 112 ТК РФ. Переносы выходных, рабочие субботы и сокращённые
 * предпраздничные дни взяты из постановлений Правительства РФ:
 *   2024 — № 2016 от 10.08.2023, 2025 — № 1335 от 04.10.2024,
 *   2026 — № 1466 от 24.09.2025, 2027 — № 1187 от 17.09.2026.
 * Для годов без данных используется правило ст. 112: праздник, выпавший на
 * выходной, переносит выходной на следующий рабочий день (кроме новогодних
 * 1–8 января, их переносит только постановление), а день перед праздником
 * сокращается на час.
 */
import { addDaysToKey, daysInMonth, fromDateKey, toDateKey } from './dates';

export type RuDayKind = 'work' | 'weekend' | 'holiday' | 'transfer';

export interface RuDayInfo {
  kind: RuDayKind;
  /** Нерабочий день (выходной, праздник или перенесённый выходной). */
  off: boolean;
  /** Нерабочий праздничный день по ст. 112 ТК РФ: работа в него оплачивается в двойном размере. */
  holiday: boolean;
  holidayName?: string;
  /** Предпраздничный день, короче на 1 час. */
  shortened: boolean;
  /** Суббота или воскресенье, ставшие рабочими из-за переноса. */
  workingWeekend: boolean;
}

const HOLIDAYS: Record<string, string> = {
  '01-01': 'Новогодние каникулы',
  '01-02': 'Новогодние каникулы',
  '01-03': 'Новогодние каникулы',
  '01-04': 'Новогодние каникулы',
  '01-05': 'Новогодние каникулы',
  '01-06': 'Новогодние каникулы',
  '01-07': 'Рождество Христово',
  '01-08': 'Новогодние каникулы',
  '02-23': 'День защитника Отечества',
  '03-08': 'Международный женский день',
  '05-01': 'Праздник Весны и Труда',
  '05-09': 'День Победы',
  '06-12': 'День России',
  '11-04': 'День народного единства',
};

interface YearData {
  /** Дополнительные выходные (переносы), MM-DD. */
  off: string[];
  /** Рабочие субботы/воскресенья, MM-DD. */
  work: string[];
  /** Сокращённые на 1 час дни, MM-DD. */
  short: string[];
}

const OFFICIAL: Record<number, YearData> = {
  2024: {
    off: ['04-29', '04-30', '05-10', '12-30', '12-31'],
    work: ['04-27', '11-02', '12-28'],
    short: ['02-22', '03-07', '05-08', '06-11', '11-02'],
  },
  2025: {
    off: ['05-02', '05-08', '06-13', '11-03', '12-31'],
    work: ['11-01'],
    short: ['03-07', '04-30', '06-11', '11-01'],
  },
  2026: {
    off: ['01-09', '03-09', '05-11', '12-31'],
    work: [],
    short: ['04-30', '05-08', '06-11', '11-03'],
  },
  2027: {
    off: ['02-22', '05-03', '05-10', '06-14', '11-05', '12-31'],
    work: ['02-20'],
    short: ['02-20', '04-30', '06-11', '11-03'],
  },
};

const cache = new Map<number, Map<string, RuDayInfo>>();

function mmdd(key: string) {
  return key.slice(5);
}

/** Год, для которого есть данные постановления (иначе — расчёт по правилам ТК). */
export function hasOfficialCalendar(year: number): boolean {
  return year in OFFICIAL;
}

function computeFallback(year: number): YearData {
  const off: string[] = [];
  const short: string[] = [];
  const offSet = new Set<string>();
  const isWeekend = (key: string) => {
    const wd = fromDateKey(key).getDay();
    return wd === 0 || wd === 6;
  };
  const isOff = (key: string) => isWeekend(key) || !!HOLIDAYS[mmdd(key)] || offSet.has(key);
  for (const md of Object.keys(HOLIDAYS)) {
    if (md.startsWith('01-')) continue;
    const key = `${year}-${md}`;
    if (!isWeekend(key)) continue;
    let next = addDaysToKey(key, 1);
    while (isOff(next)) next = addDaysToKey(next, 1);
    offSet.add(next);
    off.push(mmdd(next));
  }
  for (const md of Object.keys(HOLIDAYS)) {
    const prev = addDaysToKey(`${year}-${md}`, -1);
    if (prev.startsWith(String(year)) && !isOff(prev)) short.push(mmdd(prev));
  }
  return { off, work: [], short };
}

function buildYear(year: number): Map<string, RuDayInfo> {
  const data = OFFICIAL[year] ?? computeFallback(year);
  const off = new Set(data.off);
  const work = new Set(data.work);
  const short = new Set(data.short);
  const map = new Map<string, RuDayInfo>();
  for (let m = 0; m < 12; m++) {
    const total = daysInMonth(year, m);
    for (let d = 1; d <= total; d++) {
      const date = new Date(year, m, d);
      const key = toDateKey(date);
      const md = mmdd(key);
      const wd = date.getDay();
      const weekend = wd === 0 || wd === 6;
      const holidayName = HOLIDAYS[md];
      let kind: RuDayKind = 'work';
      if (holidayName) kind = 'holiday';
      else if (work.has(md)) kind = 'work';
      else if (off.has(md)) kind = 'transfer';
      else if (weekend) kind = 'weekend';
      map.set(key, {
        kind,
        off: kind !== 'work',
        holiday: kind === 'holiday',
        holidayName,
        shortened: kind === 'work' && short.has(md),
        workingWeekend: kind === 'work' && weekend,
      });
    }
  }
  return map;
}

export function getRuDayInfo(key: string): RuDayInfo {
  const year = Number(key.slice(0, 4));
  let map = cache.get(year);
  if (!map) {
    map = buildYear(year);
    cache.set(year, map);
  }
  return map.get(key)!;
}

/** Норма часов за один день по производственному календарю (0 для выходных). */
export function ruNormHoursForDay(key: string, weeklyHours: number): number {
  const info = getRuDayInfo(key);
  if (info.off) return 0;
  const daily = weeklyHours / 5;
  return info.shortened ? Math.max(0, daily - 1) : daily;
}

export interface RuNorm {
  workDays: number;
  offDays: number;
  holidays: number;
  shortenedDays: number;
  hours: number;
}

/** Норма рабочего времени за диапазон дней (включительно). */
export function ruNormForRange(fromKey: string, toKey: string, weeklyHours: number): RuNorm {
  const res: RuNorm = { workDays: 0, offDays: 0, holidays: 0, shortenedDays: 0, hours: 0 };
  let key = fromKey;
  while (key <= toKey) {
    const info = getRuDayInfo(key);
    if (info.off) res.offDays++;
    else res.workDays++;
    if (info.holiday) res.holidays++;
    if (info.shortened) res.shortenedDays++;
    res.hours += ruNormHoursForDay(key, weeklyHours);
    key = addDaysToKey(key, 1);
  }
  res.hours = Math.round(res.hours * 10) / 10;
  return res;
}
