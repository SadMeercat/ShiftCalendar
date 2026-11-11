import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, ThemeColors } from '../constants/colors';
import { DEFAULT_CURRENCY } from '../constants/currencies';
import { STANDARD_WORK_HOURS } from '../constants/leaveTypes';
import { WeekStart } from '../utils/dates';
import { TimeFormat } from '../utils/time';
import { setHapticsEnabled } from '../utils/haptics';
import { runMigrations } from '../utils/migrations';
import { LanguageSetting, setLanguage } from '../utils/i18n';
import type { AdvanceMode } from '../utils/ruWorkTime';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Settings {
  themeMode: ThemeMode;
  weekStart: WeekStart;
  timeFormat: TimeFormat;
  baseRate: number;
  overtimeRate: number;
  paidLeaveHours: number;
  currencyCode: string;
  notificationsEnabled: boolean;
  notificationHour: number;
  preShiftAlarm: boolean;
  alarmLeadMinutes: number;
  primaryCalendarId: string;
  hapticsEnabled: boolean;
  showShiftTimes: boolean;
  onboardingComplete: boolean;
  /** Производственный календарь РФ: выходные, праздники, норма часов. */
  ruCalendar: boolean;
  /** Продолжительность рабочей недели для нормы: 40, 36 или 24 часа. */
  weeklyHours: number;
  /** Оклад в месяц до вычета НДФЛ (0 — считать по часовой ставке). */
  monthlySalary: number;
  ndflPercent: number;
  /** Премия в процентах к окладу — для прогноза месяцев без вписанной суммы. */
  bonusPercent: number;
  /** Праздники и переработка оплачиваются с учётом премии. */
  bonusInExtras: boolean;
  /** Профсоюзные взносы, % от начисленного (0 — нет). */
  unionPercent: number;
  /** Как считается аванс. */
  advanceMode: AdvanceMode;
  /** % от оклада или сумма аванса — в зависимости от advanceMode. */
  advanceValue: number;
  advanceMinusNdfl: boolean;
  /** Дни выплаты: аванс в текущем месяце, зарплата — в следующем. */
  advanceDay: number;
  salaryDay: number;
  /** Язык интерфейса: системный, русский или английский. */
  language: LanguageSetting;
}

export const DEFAULT_SETTINGS: Settings = {
  themeMode: 'system',
  weekStart: 0,
  timeFormat: '24h',
  baseRate: 0,
  overtimeRate: 0,
  paidLeaveHours: STANDARD_WORK_HOURS,
  currencyCode: DEFAULT_CURRENCY,
  notificationsEnabled: false,
  notificationHour: 20,
  preShiftAlarm: false,
  alarmLeadMinutes: 60,
  primaryCalendarId: 'default',
  hapticsEnabled: true,
  showShiftTimes: true,
  onboardingComplete: false,
  ruCalendar: true,
  weeklyHours: 40,
  monthlySalary: 0,
  ndflPercent: 13,
  bonusPercent: 0,
  bonusInExtras: true,
  unionPercent: 1,
  advanceMode: 'norm',
  advanceValue: 0,
  advanceMinusNdfl: true,
  advanceDay: 25,
  salaryDay: 10,
  language: 'system',
};

/** Storage keys (the older ones are unchanged so existing preferences carry over). */
export const SETTINGS_KEYS: Record<keyof Settings, string> = {
  themeMode: 'theme_mode',
  weekStart: 'week_start',
  timeFormat: 'time_format',
  baseRate: 'base_rate',
  overtimeRate: 'overtime_rate',
  paidLeaveHours: 'paid_leave_hours',
  currencyCode: 'currency_code',
  notificationsEnabled: 'notif_enabled',
  notificationHour: 'notif_hour',
  preShiftAlarm: 'pre_shift_alarm',
  alarmLeadMinutes: 'alarm_lead_minutes',
  primaryCalendarId: 'primary_calendar',
  hapticsEnabled: 'haptics_enabled',
  showShiftTimes: 'show_shift_times',
  onboardingComplete: 'onboarding_complete',
  ruCalendar: 'ru_calendar',
  weeklyHours: 'ru_weekly_hours',
  monthlySalary: 'ru_monthly_salary',
  ndflPercent: 'ru_ndfl_percent',
  bonusPercent: 'ru_bonus_percent',
  bonusInExtras: 'ru_bonus_in_extras',
  unionPercent: 'ru_union_percent',
  advanceMode: 'ru_advance_mode',
  advanceValue: 'ru_advance_value',
  advanceMinusNdfl: 'ru_advance_minus_ndfl',
  advanceDay: 'ru_advance_day',
  salaryDay: 'ru_salary_day',
  language: 'app_language',
};

function parseNumber(raw: string, min: number, max: number, fallback: number) {
  const n = parseFloat(raw);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

function parseSettings(raw: Map<string, string | null>): Settings {
  const s: Settings = { ...DEFAULT_SETTINGS };
  const get = (k: keyof Settings) => raw.get(SETTINGS_KEYS[k]) ?? null;

  const theme = get('themeMode');
  if (theme === 'light' || theme === 'dark' || theme === 'system') s.themeMode = theme;
  const week = get('weekStart');
  if (week === '0' || week === '1' || week === '6') s.weekStart = Number(week) as WeekStart;
  const tf = get('timeFormat');
  if (tf === '12h' || tf === '24h') s.timeFormat = tf;
  const base = get('baseRate');
  if (base) s.baseRate = parseNumber(base, 0, 1e7, 0);
  const ot = get('overtimeRate');
  if (ot) s.overtimeRate = parseNumber(ot, 0, 1e7, 0);
  const leaveHours = get('paidLeaveHours');
  if (leaveHours) s.paidLeaveHours = parseNumber(leaveHours, 0, 24, STANDARD_WORK_HOURS);
  const currency = get('currencyCode');
  if (currency) s.currencyCode = currency;
  s.notificationsEnabled = get('notificationsEnabled') === 'true';
  const hour = get('notificationHour');
  if (hour) s.notificationHour = Math.round(parseNumber(hour, 0, 23, 20));
  s.preShiftAlarm = get('preShiftAlarm') === 'true';
  const lead = get('alarmLeadMinutes');
  if (lead) s.alarmLeadMinutes = Math.round(parseNumber(lead, 5, 720, 60));
  const primary = get('primaryCalendarId');
  if (primary) s.primaryCalendarId = primary;
  s.hapticsEnabled = get('hapticsEnabled') !== 'false';
  s.showShiftTimes = get('showShiftTimes') !== 'false';
  // Any stored value (older versions wrote 'true') means onboarding was seen.
  s.onboardingComplete = get('onboardingComplete') !== null;
  s.ruCalendar = get('ruCalendar') !== 'false';
  const weekly = get('weeklyHours');
  if (weekly) s.weeklyHours = parseNumber(weekly, 1, 60, 40);
  const salary = get('monthlySalary');
  if (salary) s.monthlySalary = parseNumber(salary, 0, 1e9, 0);
  const ndfl = get('ndflPercent');
  if (ndfl) s.ndflPercent = parseNumber(ndfl, 0, 50, 13);
  const bonus = get('bonusPercent');
  if (bonus) s.bonusPercent = parseNumber(bonus, 0, 1000, 0);
  s.bonusInExtras = get('bonusInExtras') !== 'false';
  const union = get('unionPercent');
  if (union) s.unionPercent = parseNumber(union, 0, 20, 1);
  const advMode = get('advanceMode');
  if (advMode === 'worked' || advMode === 'norm' || advMode === 'percent' || advMode === 'fixed') s.advanceMode = advMode;
  const advValue = get('advanceValue');
  if (advValue) s.advanceValue = parseNumber(advValue, 0, 1e8, 0);
  s.advanceMinusNdfl = get('advanceMinusNdfl') !== 'false';
  const advDay = get('advanceDay');
  if (advDay) s.advanceDay = Math.round(parseNumber(advDay, 1, 31, 25));
  const salDay = get('salaryDay');
  if (salDay) s.salaryDay = Math.round(parseNumber(salDay, 1, 31, 10));
  const lang = get('language');
  if (lang === 'ru' || lang === 'en' || lang === 'system') s.language = lang;
  return s;
}

export function useSettings() {
  const systemScheme = useColorScheme();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const settingsRef = useRef(settings);

  const reloadSettings = useCallback(async () => {
    try {
      await runMigrations();
      const keys = Object.values(SETTINGS_KEYS);
      const pairs = await AsyncStorage.multiGet(keys);
      const next = parseSettings(new Map(pairs));
      settingsRef.current = next;
      setSettings(next);
      setHapticsEnabled(next.hapticsEnabled);
      setLanguage(next.language);
    } catch (e) {
      console.error('Failed to load settings', e);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    reloadSettings();
  }, [reloadSettings]);

  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    if (settingsRef.current[key] === value) return;
    const next = { ...settingsRef.current, [key]: value };
    settingsRef.current = next;
    setSettings(next);
    if (key === 'hapticsEnabled') setHapticsEnabled(value as boolean);
    if (key === 'language') setLanguage(value as LanguageSetting);
    AsyncStorage.setItem(SETTINGS_KEYS[key], String(value)).catch(console.error);
  }, []);

  const completeOnboarding = useCallback(() => updateSetting('onboardingComplete', true), [updateSetting]);

  const isDark = settings.themeMode === 'system' ? systemScheme !== 'light' : settings.themeMode === 'dark';
  const colors: ThemeColors = isDark ? Colors.dark : Colors.light;

  return useMemo(
    () => ({ ...settings, loaded, isDark, colors, updateSetting, completeOnboarding, reloadSettings }),
    [settings, loaded, isDark, colors, updateSetting, completeOnboarding, reloadSettings]
  );
}

export type SettingsApi = ReturnType<typeof useSettings>;
