import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ThemeColors } from '../../constants/colors';
import { getCurrency } from '../../constants/currencies';
import { haptic } from '../../utils/haptics';
import { Segmented, SectionLabel } from '../ui/primitives';
import { SettingsCard, SettingsRow } from './SettingsRow';
import { NumberField } from './PayEarningsSection';
import { useRuSyncStatus } from '../../hooks/useRuCalendar';
import { syncRuCalendar } from '../../utils/ruCalendarSync';

function formatSyncDate(ts: number) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

interface Props {
  colors: ThemeColors;
  currencyCode: string;
  ruCalendar: boolean;
  setRuCalendar: (v: boolean) => void;
  weeklyHours: number;
  setWeeklyHours: (v: number) => void;
  monthlySalary: number;
  setMonthlySalary: (v: number) => void;
  ndflPercent: number;
  setNdflPercent: (v: number) => void;
}

/** Производственный календарь РФ, норма часов и параметры расчёта зарплаты. */
export function RuCalendarSection(props: Props) {
  const { colors } = props;
  const currency = getCurrency(props.currencyCode);
  const sync = useRuSyncStatus();
  const syncSubtitle =
    sync.state === 'loading'
      ? 'Загрузка…'
      : [
          sync.lastSync ? `Обновлено ${formatSyncDate(sync.lastSync)}` : sync.state === 'offline' ? 'Нет связи — используются встроенные данные' : 'Ещё не загружался',
          sync.years.length ? sync.years.map((y) => `${y.year}: ${y.source}`).join(' · ') : '',
          sync.error ?? '',
        ]
          .filter(Boolean)
          .join('\n');
  return (
    <>
      <SectionLabel colors={colors}>Производственный календарь РФ</SectionLabel>
      <SettingsCard colors={colors}>
        <SettingsRow
          icon="calendar-star"
          iconColor={colors.danger}
          title="Выходные и праздники"
          subtitle="Красные даты, норма часов, переработки и часы в праздники"
          switchValue={props.ruCalendar}
          onSwitch={props.setRuCalendar}
          colors={colors}
        />
        {props.ruCalendar && (
          <>
            <SettingsRow
              icon="cloud-sync-outline"
              title="Обновлять из интернета"
              subtitle={`Переносы и праздники подтягиваются автоматически раз в неделю\n${syncSubtitle}`}
              value={sync.state === 'loading' ? undefined : 'Обновить'}
              onPress={() => {
                haptic.selection();
                syncRuCalendar(true);
              }}
              colors={colors}
            />
            <View style={styles.block}>
              <Text style={[styles.label, { color: colors.text }]}>Рабочая неделя для нормы</Text>
              <Segmented
                options={[
                  { value: 40, label: '40 ч' },
                  { value: 36, label: '36 ч' },
                  { value: 24, label: '24 ч' },
                ]}
                value={props.weeklyHours}
                onChange={(v) => {
                  haptic.selection();
                  props.setWeeklyHours(v as number);
                }}
                colors={colors}
              />
            </View>
            <SettingsRow
              icon="wallet-outline"
              iconColor={colors.success}
              title="Оклад в месяц"
              subtitle="До вычета НДФЛ. Ставка = оклад ÷ норма месяца. Пусто — берётся «Hourly rate»"
              colors={colors}
              right={<NumberField value={props.monthlySalary} onCommit={props.setMonthlySalary} colors={colors} prefix={currency.symbol} suffix="" max={1e8} label="Оклад в месяц" />}
            />
            <SettingsRow
              icon="percent-outline"
              title="НДФЛ"
              subtitle="Чтобы пересчитать «на руки» в начисленное"
              colors={colors}
              right={<NumberField value={props.ndflPercent} onCommit={props.setNdflPercent} colors={colors} suffix="%" max={50} label="НДФЛ, процентов" />}
            />
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              Праздничные часы оплачиваются ×2 (ст. 153 ТК РФ) и не входят в переработку. Переработка — часы сверх нормы месяца: первые 2 ч ×1,5, далее ×2 (ст. 152 ТК РФ). Отпуск и больничный уменьшают норму.
            </Text>
          </>
        )}
      </SettingsCard>
    </>
  );
}

const styles = StyleSheet.create({
  block: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  label: { fontSize: 15, fontWeight: '700' },
  hint: { fontSize: 12, lineHeight: 17, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 4 },
});
