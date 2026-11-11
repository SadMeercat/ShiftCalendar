import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PaidParts } from '../utils/ruWorkTime';

/**
 * Что пришло за месяц, по частям расчётного листка: 'yyyy-MM' → { аванс, зарплата, взносы, отпускные }.
 * Входит в резервную копию. Старые версии хранили одно число (всё на руки) — оно читается
 * как зарплата без аванса.
 */
export const RECEIVED_PAY_KEY = 'ru_received_pay';

export type ReceivedMap = Record<string, PaidParts>;

let cache: ReceivedMap | null = null;
const listeners = new Set<(v: ReceivedMap) => void>();

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

function parse(raw: string | null): ReceivedMap {
  try {
    const obj = raw ? JSON.parse(raw) : {};
    const out: ReceivedMap = {};
    for (const [k, v] of Object.entries(obj ?? {})) {
      if (!/^\d{4}-\d{2}$/.test(k)) continue;
      const parts: PaidParts =
        typeof v === 'number'
          ? { advance: 0, salary: num(v), union: 0, vacation: 0 }
          : { advance: num((v as any)?.advance), salary: num((v as any)?.salary), union: num((v as any)?.union), vacation: num((v as any)?.vacation) };
      if (parts.advance || parts.salary || parts.union || parts.vacation) out[k] = parts;
    }
    return out;
  } catch {
    return {};
  }
}

export function useReceivedPay() {
  const [received, setReceived] = useState<ReceivedMap>(cache ?? {});

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

  /** Меняет одну часть выплаты за месяц. */
  const setMonthPart = useCallback((monthKey: string, part: keyof PaidParts, amount: number) => {
    const next = { ...(cache ?? {}) };
    const parts = { ...(next[monthKey] ?? { advance: 0, salary: 0, union: 0, vacation: 0 }), [part]: amount > 0 ? amount : 0 };
    if (parts.advance || parts.salary || parts.union || parts.vacation) next[monthKey] = parts;
    else delete next[monthKey];
    cache = next;
    listeners.forEach((l) => l(next));
    AsyncStorage.setItem(RECEIVED_PAY_KEY, JSON.stringify(next)).catch(console.error);
  }, []);

  return { received, setMonthPart };
}
