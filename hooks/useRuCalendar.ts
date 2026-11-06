import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { getRuCalendarVersion, subscribeRuCalendar } from '../utils/ruCalendar';
import { getRuSyncStatus, subscribeRuSync, syncRuCalendar } from '../utils/ruCalendarSync';
import { useAppSettings } from './SettingsContext';

/** Версия данных производственного календаря: компоненты перерисовываются после загрузки. */
export function useRuCalendarVersion(): number {
  return useSyncExternalStore(subscribeRuCalendar, getRuCalendarVersion);
}

export function useRuSyncStatus() {
  return useSyncExternalStore(subscribeRuSync, getRuSyncStatus);
}

/** Запускает загрузку календаря при старте и при возвращении в приложение. */
export function useRuCalendarAutoSync() {
  const { ruCalendar, loaded } = useAppSettings();
  useEffect(() => {
    if (!loaded || !ruCalendar) return;
    syncRuCalendar();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') syncRuCalendar();
    });
    return () => sub.remove();
  }, [loaded, ruCalendar]);
}
