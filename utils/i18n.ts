/**
 * Простая локализация: строки в коде пишутся по-английски и оборачиваются в tr().
 * Для русского языка перевод берётся из словаря RU (ключ — английский текст).
 * Нет перевода — показывается английский, так что ничего не ломается.
 */
import { format as dfFormat } from 'date-fns';
import { ru as ruLocale } from 'date-fns/locale/ru';
import { RU } from './i18n.ru';

export type Language = 'ru' | 'en';
export type LanguageSetting = Language | 'system';

function detectSystemLanguage(): Language {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    return /^(ru|be|uk|kk)\b/i.test(locale) ? 'ru' : 'en';
  } catch {
    return 'en';
  }
}

let current: Language = detectSystemLanguage();

export function resolveLanguage(setting: LanguageSetting): Language {
  return setting === 'system' ? detectSystemLanguage() : setting;
}

export function setLanguage(setting: LanguageSetting): Language {
  current = resolveLanguage(setting);
  return current;
}

export function getLanguage(): Language {
  return current;
}

export const isRu = () => current === 'ru';

/** Перевод с подстановкой: tr('{n} days', { n: 3 }). */
export function tr(text: string, vars?: Record<string, string | number>): string {
  let out = current === 'ru' ? RU[text] ?? text : text;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

/** Русская форма слова по числу: 1 смена, 2 смены, 5 смен. */
export function ruPlural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}

/**
 * Число со словом на текущем языке: pl(3, ['shift', 'shifts'], ['смена', 'смены', 'смен']) → '3 смены'.
 * Дробные числа в русском — форма «few» (2,5 смены).
 */
export function pl(n: number, en: [string, string], ru: [string, string, string], withNumber = true): string {
  const word =
    current === 'ru' ? (Number.isInteger(n) ? ruPlural(n, ru[0], ru[1], ru[2]) : ru[1]) : n === 1 ? en[0] : en[1];
  return withNumber ? `${formatNumber(n)} ${word}` : word;
}

export function formatNumber(n: number): string {
  return current === 'ru' ? String(n).replace('.', ',') : String(n);
}

function capitalize(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * format() из date-fns с учётом языка. В русском месяц без числа ставится в именительном
 * падеже («Ноябрь 2026»), с числом — в родительном («6 ноября»).
 */
export function formatDate(date: Date | number, pattern: string): string {
  if (current !== 'ru') return dfFormat(date, pattern);
  const standalone = !/d/.test(pattern);
  // В русском число идёт перед месяцем: «6 нояб.», а не «нояб. 6».
  const p = standalone
    ? pattern.replace(/MMMM/g, 'LLLL').replace(/MMM/g, 'LLL')
    : pattern.replace(/MMMM d\b/g, 'd MMMM').replace(/MMM d\b/g, 'd MMM').replace(/(MMM+), yyyy/g, '$1 yyyy');
  const out = dfFormat(date, p, { locale: ruLocale });
  return /^[LE]/.test(p) ? capitalize(out) : out;
}

export function dateLocale() {
  return current === 'ru' ? ruLocale : undefined;
}

/** Название месяца (0–11) в именительном падеже: 'January' / 'январь'; short — 'Jan' / 'янв.'. */
export function monthName(month: number, short = false, capital = true): string {
  const d = new Date(2000, month, 1);
  const out = dfFormat(d, short ? 'LLL' : 'LLLL', { locale: dateLocale() });
  return capital ? capitalize(out) : out;
}

/**
 * Стандартные названия (смены по умолчанию, «My Shifts», виды отпуска) переводятся, пока
 * пользователь их не переименовал: и английское, и русское стандартное название
 * заменяются на название текущего языка.
 */
export function localizeDefault(value: string, english: string): string {
  return value === english || value === RU[english] ? tr(english) : value;
}
