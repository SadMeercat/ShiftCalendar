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
import type { AdvanceMode } from '../../utils/ruWorkTime';

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
  bonusPercent: number;
  setBonusPercent: (v: number) => void;
  bonusInExtras: boolean;
  setBonusInExtras: (v: boolean) => void;
  unionPercent: number;
  setUnionPercent: (v: number) => void;
  advanceMode: AdvanceMode;
  setAdvanceMode: (v: AdvanceMode) => void;
  advanceValue: number;
  setAdvanceValue: (v: number) => void;
  advanceMinusNdfl: boolean;
  setAdvanceMinusNdfl: (v: boolean) => void;
  advanceDay: number;
  setAdvanceDay: (v: number) => void;
  salaryDay: number;
  setSalaryDay: (v: number) => void;
}

const ADVANCE_HINTS: Record<AdvanceMode, string> = {
  norm: 'Оклад за первую половину месяца по норме: оклад × норма с 1 по 15 число ÷ норма месяца',
  worked: 'Оклад за часы, отработанные с 1 по 15 число по вашему графику',
  percent: 'Процент от оклада',
  fixed: 'Одна и та же сумма на руки каждый месяц',
};

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
              subtitle={`Переносы и праздники подтягиваются автоматически раз в месяц\n${syncSubtitle}`}
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
              subtitle="До вычета НДФЛ. Ставка = оклад ÷ норма месяца. Пусто — берётся часовая ставка из раздела «Оплата»"
              colors={colors}
              right={<NumberField value={props.monthlySalary} onCommit={props.setMonthlySalary} colors={colors} prefix={currency.symbol} suffix="" max={1e8} label="Оклад в месяц" />}
            />
            <SettingsRow
              icon="gift-outline"
              iconColor={colors.success}
              title="Премия, % от оклада"
              subtitle="Для прогноза месяцев, где сумма не вписана. Где вписана — премия считается сама"
              colors={colors}
              right={<NumberField value={props.bonusPercent} onCommit={props.setBonusPercent} colors={colors} suffix="%" max={1000} label="Премия, процентов от оклада" />}
            />
            <SettingsRow
              icon="calendar-star"
              iconColor={colors.danger}
              title="Премия в оплате праздников и переработки"
              subtitle="Включено — праздники и сверхурочные считаются от оклада с премией (Постановление КС РФ № 35-П от 27.06.2023). Выключено — только от оклада"
              switchValue={props.bonusInExtras}
              onSwitch={props.setBonusInExtras}
              colors={colors}
            />
            <SettingsRow
              icon="account-group-outline"
              title="Профсоюзные взносы, %"
              subtitle="Процент от начисленного; 0 — если не удерживают. Если вписать взносы из листка в статистике, берётся точная сумма"
              colors={colors}
              right={<NumberField value={props.unionPercent} onCommit={props.setUnionPercent} colors={colors} suffix="%" max={20} label="Профсоюзные взносы, процентов" />}
            />
            <View style={styles.block}>
              <Text style={[styles.label, { color: colors.text }]}>Аванс</Text>
              <Segmented
                options={[
                  { value: 'norm', label: 'По норме' },
                  { value: 'worked', label: 'По сменам' },
                  { value: 'percent', label: '% оклада' },
                  { value: 'fixed', label: 'Сумма' },
                ]}
                value={props.advanceMode}
                onChange={(v) => {
                  haptic.selection();
                  props.setAdvanceMode(v as AdvanceMode);
                }}
                colors={colors}
              />
              <Text style={[styles.blockHint, { color: colors.textMuted }]}>{ADVANCE_HINTS[props.advanceMode]}</Text>
            </View>
            {(props.advanceMode === 'percent' || props.advanceMode === 'fixed') && (
              <SettingsRow
                icon="cash-fast"
                title={props.advanceMode === 'percent' ? 'Аванс, % от оклада' : 'Аванс, сумма на руки'}
                colors={colors}
                right={
                  props.advanceMode === 'percent' ? (
                    <NumberField value={props.advanceValue} onCommit={props.setAdvanceValue} colors={colors} suffix="%" max={100} label="Аванс, процентов от оклада" />
                  ) : (
                    <NumberField value={props.advanceValue} onCommit={props.setAdvanceValue} colors={colors} prefix={currency.symbol} suffix="" max={1e8} label="Аванс, сумма" />
                  )
                }
              />
            )}
            {props.advanceMode !== 'fixed' && (
              <SettingsRow
                icon="percent-outline"
                title="Аванс за вычетом НДФЛ"
                subtitle="Так платят большинство работодателей"
                switchValue={props.advanceMinusNdfl}
                onSwitch={props.setAdvanceMinusNdfl}
                colors={colors}
              />
            )}
            <SettingsRow
              icon="calendar-arrow-right"
              title="День аванса"
              subtitle="В том же месяце"
              colors={colors}
              right={<NumberField value={props.advanceDay} onCommit={(v) => props.setAdvanceDay(Math.min(31, Math.max(1, Math.round(v) || 1)))} colors={colors} suffix="число" max={31} label="День выплаты аванса" />}
            />
            <SettingsRow
              icon="calendar-arrow-right"
              title="День зарплаты"
              subtitle="В следующем месяце"
              colors={colors}
              right={<NumberField value={props.salaryDay} onCommit={(v) => props.setSalaryDay(Math.min(31, Math.max(1, Math.round(v) || 1)))} colors={colors} suffix="число" max={31} label="День выплаты зарплаты" />}
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
  blockHint: { fontSize: 12, lineHeight: 17 },
  hint: { fontSize: 12, lineHeight: 17, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 4 },
});
