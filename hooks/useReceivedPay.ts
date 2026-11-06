import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Суммы, полученные на руки, по месяцам: 'yyyy-MM' → сумма. Входит в резервную копию. */
export const RECEIVED_PAY_KEY = 'ru_received_pay';

let cache: Record<string, number> | null = null;
const listeners = new Set<(v: Record<string, number>) => void>();

function parse(raw: string | null): Record<string, number> {
  try {
    const obj = raw ? JSON.parse(raw) : {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(obj ?? {})) {
      if (/^\d{4}-\d{2}$/.test(k) && typeof v === 'number' && v > 0) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function useReceivedPay() {
  const [received, setReceived] = useState<Record<string, number>>(cache ?? {});

  useEffect(() => {
    listeners.add(setReceived);
    // Перечитываем при каждом монтировании: данные могли смениться после восстановления копии.
    AsyncStorage.getItem(RECEIVED_PAY_KEY)
      .then((raw) => {
        cache = parse(raw);
        listeners.forEach((l) => l(cache!));
      })
      .catch(console.error);
    return () => {
      listeners.delete(setReceived);
    };
  }, []);

  const setMonthReceived = useCallback((monthKey: string, amount: number) => {
    const next = { ...(cache ?? {}) };
    if (amount > 0) next[monthKey] = amount;
    else delete next[monthKey];
    cache = next;
    listeners.forEach((l) => l(next));
    AsyncStorage.setItem(RECEIVED_PAY_KEY, JSON.stringify(next)).catch(console.error);
  }, []);

  return { received, setMonthReceived };
}
