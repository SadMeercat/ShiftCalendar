/**
 * Автоматическая загрузка производственного календаря РФ.
 *
 * Источники (по очереди, до первого успешного):
 *   1. isdayoff.ru — https://isdayoff.ru/api/getdata?year=YYYY&pre=1
 *      ответ: по цифре на каждый день года (0 — рабочий, 1 — нерабочий, 2 — сокращённый).
 *   2. xmlcalendar.ru — https://xmlcalendar.ru/data/ru/YYYY/calendar.json
 *      ответ: по месяцам список нерабочих дней; «*» — сокращённый рабочий день,
 *      «+» — перенесённый выходной.
 *
 * Загруженное сохраняется на телефоне и используется без интернета. Текущий и
 * следующий год перепроверяются раз в месяц (30 дней), чтобы подхватить новое постановление
 * о переносах (его обычно публикуют осенью). Если данные не прошли проверку или
 * сети нет, остаются встроенные данные и правила ТК РФ.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { daysInMonth } from './dates';
import { builtInYearCodes, isLawHoliday, setRemoteYear } from './ruCalendar';

export const RU_CALENDAR_CACHE_KEY = 'ru_calendar_cache';
/** Как часто перепроверять текущий и следующий год. */
const REFRESH_MS = 30 * 24 * 3600 * 1000;
const RETRY_MS = 6 * 3600 * 1000;
const TIMEOUT_MS = 10000;

export type RuCalendarSource = 'isdayoff.ru' | 'xmlcalendar.ru';

export interface CachedYear {
  codes: string;
  source: RuCalendarSource;
  /** Когда данные последний раз успешно проверялись. */
  fetchedAt: number;
}

interface CacheFile {
  years: Record<string, CachedYear>;
  /** Последняя неудачная попытка, чтобы не стучаться без сети при каждом запуске. */
  failedAt?: number;
}

export interface RuSyncStatus {
  state: 'idle' | 'loading' | 'ok' | 'offline';
  /** Последняя успешная загрузка. */
  lastSync?: number;
  years: { year: number; source: RuCalendarSource | 'встроенные данные' }[];
  error?: string;
}

let status: RuSyncStatus = { state: 'idle', years: [] };
const listeners = new Set<() => void>();
let running: Promise<void> | null = null;

function setStatus(next: Partial<RuSyncStatus>) {
  status = { ...status, ...next };
  listeners.forEach((l) => l());
}

export function getRuSyncStatus(): RuSyncStatus {
  return status;
}

export function subscribeRuSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function daysInYear(year: number) {
  return Array.from({ length: 12 }, (_, m) => daysInMonth(year, m)).reduce((a, b) => a + b, 0);
}

/** Проверка, что ответ похож на настоящий производственный календарь. */
export function validateCodes(year: number, codes: string): boolean {
  if (codes.length !== daysInYear(year) || !/^[012]+$/.test(codes)) return false;
  const off = codes.split('').filter((c) => c === '1').length;
  if (off < 100 || off > 140) return false;
  // Все праздники по ст. 112 ТК РФ должны быть нерабочими.
  let i = 0;
  for (let m = 0; m < 12; m++) {
    for (let d = 1; d <= daysInMonth(year, m); d++, i++) {
      const md = `${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (isLawHoliday(md) && codes[i] !== '1') return false;
    }
  }
  return true;
}

export function parseIsDayOff(year: number, body: string): string | null {
  const codes = body.trim();
  return validateCodes(year, codes) ? codes : null;
}

export function parseXmlCalendar(year: number, body: string): string | null {
  let json: any;
  try {
    json = JSON.parse(body);
  } catch {
    return null;
  }
  if (!json || Number(json.year) !== year || !Array.isArray(json.months)) return null;
  const out: string[] = [];
  for (let m = 0; m < 12; m++) {
    const total = daysInMonth(year, m);
    const row = Array<string>(total).fill('0');
    const entry = json.months.find((x: any) => Number(x?.month) === m + 1);
    if (!entry || typeof entry.days !== 'string') return null;
    for (const raw of entry.days.split(',')) {
      const t = raw.trim();
      if (!t) continue;
      const day = parseInt(t, 10);
      if (!(day >= 1 && day <= total)) return null;
      row[day - 1] = t.endsWith('*') ? '2' : '1';
    }
    out.push(row.join(''));
  }
  const codes = out.join('');
  return validateCodes(year, codes) ? codes : null;
}

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json, text/plain' } });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function downloadYear(year: number): Promise<CachedYear | null> {
  const a = await fetchText(`https://isdayoff.ru/api/getdata?year=${year}&pre=1`);
  const fromA = a ? parseIsDayOff(year, a) : null;
  if (fromA) return { codes: fromA, source: 'isdayoff.ru', fetchedAt: Date.now() };
  const b = await fetchText(`https://xmlcalendar.ru/data/ru/${year}/calendar.json`);
  const fromB = b ? parseXmlCalendar(year, b) : null;
  if (fromB) return { codes: fromB, source: 'xmlcalendar.ru', fetchedAt: Date.now() };
  return null;
}

async function readCache(): Promise<CacheFile> {
  try {
    const raw = await AsyncStorage.getItem(RU_CALENDAR_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed.years === 'object') return parsed;
  } catch {
    // повреждённый кэш просто перезапишется
  }
  return { years: {} };
}

function summarize(cache: CacheFile, years: number[]): RuSyncStatus['years'] {
  return years.map((y) => ({ year: y, source: cache.years[y]?.source ?? 'встроенные данные' }));
}

/**
 * Подгружает кэш и при необходимости обновляет календарь из интернета.
 * `force` — проверить сейчас, не дожидаясь месячного интервала.
 */
export function syncRuCalendar(force = false): Promise<void> {
  if (running) return running;
  running = (async () => {
    const thisYear = new Date().getFullYear();
    const years = [thisYear - 1, thisYear, thisYear + 1];
    const cache = await readCache();

    // Сначала сохранённое — календарь работает и без сети.
    for (const [y, entry] of Object.entries(cache.years)) {
      if (entry && validateCodes(Number(y), entry.codes)) setRemoteYear(Number(y), entry.codes);
    }
    const lastSync = Math.max(0, ...Object.values(cache.years).map((e) => e?.fetchedAt ?? 0));
    setStatus({ years: summarize(cache, years), lastSync: lastSync || undefined, state: lastSync ? 'ok' : 'idle' });

    const now = Date.now();
    const due = years.filter((y) => {
      const entry = cache.years[y];
      if (!entry) return true;
      // Прошлый год уже не меняется — проверяем только текущий и следующий.
      return y >= thisYear && (force || now - entry.fetchedAt > REFRESH_MS);
    });
    if (!due.length) return;
    if (!force && cache.failedAt && now - cache.failedAt < RETRY_MS) {
      setStatus({ state: lastSync ? 'ok' : 'offline' });
      return;
    }

    setStatus({ state: 'loading', error: undefined });
    let failed = 0;
    for (const y of due) {
      const got = await downloadYear(y);
      if (got) {
        cache.years[y] = got;
        setRemoteYear(y, got.codes);
      } else {
        failed++;
      }
    }
    cache.failedAt = failed ? now : undefined;
    await AsyncStorage.setItem(RU_CALENDAR_CACHE_KEY, JSON.stringify(cache)).catch(console.error);
    const newest = Math.max(0, ...Object.values(cache.years).map((e) => e?.fetchedAt ?? 0));
    setStatus({
      state: failed === due.length ? 'offline' : 'ok',
      lastSync: newest || undefined,
      years: summarize(cache, years),
      error: failed ? 'Не удалось загрузить часть данных — используются сохранённые или встроенные' : undefined,
    });
  })()
    .catch((e) => {
      console.error('Production calendar sync failed', e);
      setStatus({ state: 'offline', error: 'Ошибка загрузки календаря' });
    })
    .finally(() => {
      running = null;
    });
  return running;
}

/** Совпадает ли загруженный год со встроенными данными (для отладки и тестов). */
export function matchesBuiltIn(year: number, codes: string): boolean {
  return builtInYearCodes(year) === codes;
}
