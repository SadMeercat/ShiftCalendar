import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ThemeColors } from '../../constants/colors';
import { formatMoney, getCurrency } from '../../constants/currencies';
import { RuPayBreakdown, RuWorkStats } from '../../utils/ruWorkTime';
import { formatHoursRu } from '../../utils/ruFormat';
import { Card, Divider, SectionLabel } from '../ui/primitives';
import { NumberField } from '../settings/PayEarningsSection';

function Row({ label, value, note, colors, strong, accent }: { label: string; value: string; note?: string; colors: ThemeColors; strong?: boolean; accent?: string }) {
  return (
    <View style={styles.row} accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.flex}>
        <Text style={[styles.label, { color: strong ? colors.text : colors.textSecondary }, strong && styles.strong]}>{label}</Text>
        {note ? <Text style={[styles.note, { color: colors.textMuted }]}>{note}</Text> : null}
      </View>
      <Text style={[styles.value, { color: accent ?? colors.text }, strong && styles.valueStrong]}>{value}</Text>
    </View>
  );
}

interface Props {
  title: string;
  work: RuWorkStats;
  weeklyHours: number;
  colors: ThemeColors;
  currencyCode: string;
  ndflPercent: number;
  /** Расчёт по окладу/ставке из настроек (null — ставка не задана). */
  estimate: RuPayBreakdown | null;
  /** Обратный расчёт из полученной суммы. */
  fromReceived: RuPayBreakdown | null;
  received: number;
  /** Задан только для месяца: поле ввода полученной суммы. */
  onReceivedChange?: (amount: number) => void;
}

function PayRows({ pay, colors, currencyCode, ndflPercent, work }: { pay: RuPayBreakdown; colors: ThemeColors; currencyCode: string; ndflPercent: number; work: RuWorkStats }) {
  const m = (n: number) => formatMoney(n, currencyCode);
  return (
    <>
      <Row label="Ставка в час" value={m(pay.rate)} colors={colors} note={pay.rateSource === 'salary' ? 'Оклад ÷ норма месяца' : pay.rateSource === 'received' ? 'Вычислена из полученной суммы' : 'Из настроек'} />
      <Divider colors={colors} />
      <Row label="Обычные часы" note={formatHoursRu(work.regularHours)} value={m(pay.regularPay)} colors={colors} />
      {pay.paidLeavePay > 0 && (
        <>
          <Divider colors={colors} />
          <Row label="Оплачиваемый отпуск" note={`${formatHoursRu(work.paidLeaveNormHours)} по норме`} value={m(pay.paidLeavePay)} colors={colors} />
        </>
      )}
      <Divider colors={colors} />
      <Row label="Работа в праздники" note={`${formatHoursRu(work.holidayHours)} × 2`} value={m(pay.holidayPay)} colors={colors} accent={pay.holidayPay > 0 ? colors.danger : undefined} />
      <Divider colors={colors} />
      <Row
        label="Переработка"
        note={work.overtimeHours > 0 ? `${formatHoursRu(Math.min(work.overtimeHours, 2))} × 1,5${work.overtimeHours > 2 ? ` + ${formatHoursRu(work.overtimeHours - 2)} × 2` : ''}` : 'Нет'}
        value={m(pay.overtimePay)}
        colors={colors}
        accent={pay.overtimePay > 0 ? colors.overtimeAccent : undefined}
      />
      <Divider colors={colors} />
      <Row label="Начислено" value={m(pay.gross)} colors={colors} />
      <Divider colors={colors} />
      <Row label={`НДФЛ ${String(ndflPercent).replace('.', ',')}%`} value={`−${m(pay.ndfl)}`} colors={colors} />
      <Divider colors={colors} />
      <Row label="На руки" value={m(pay.net)} colors={colors} strong />
    </>
  );
}

export function RuWorkCard(props: Props) {
  const { work, colors, currencyCode, estimate, fromReceived, received, ndflPercent } = props;
  const diff = work.overtimeHours > 0 ? work.overtimeHours : -work.shortfallHours;
  const currency = getCurrency(currencyCode);

  return (
    <>
      <SectionLabel colors={colors}>{`Рабочее время · ${props.title}`}</SectionLabel>
      <Card colors={colors}>
        <Row
          label="Норма по производственному календарю"
          note={`${work.normDays} раб. дн. · ${props.weeklyHours}-часовая неделя`}
          value={formatHoursRu(work.normHours)}
          colors={colors}
        />
        {work.leaveNormHours > 0 && (
          <>
            <Divider colors={colors} />
            <Row label="Ваша норма" note={`минус отпуск/больничный ${formatHoursRu(work.leaveNormHours)}`} value={formatHoursRu(work.personalNormHours)} colors={colors} />
          </>
        )}
        <Divider colors={colors} />
        <Row
          label="Отработано"
          note={work.loggedOvertimeHours > 0 ? `смены ${formatHoursRu(work.shiftHours)} + доп. часы ${formatHoursRu(work.loggedOvertimeHours)}` : undefined}
          value={formatHoursRu(work.workedHours)}
          colors={colors}
        />
        <Divider colors={colors} />
        <Row
          label="В праздничные дни"
          note={work.holidayShifts > 0 ? `${work.holidayShifts} смен(ы) · оплата ×2, не входят в переработку` : 'Не было'}
          value={formatHoursRu(work.holidayHours)}
          colors={colors}
          accent={work.holidayHours > 0 ? colors.danger : undefined}
        />
        <Divider colors={colors} />
        <Row
          label={diff >= 0 ? 'Переработка' : 'Недоработка'}
          note="Сверх вашей нормы, без праздничных часов"
          value={formatHoursRu(Math.abs(diff))}
          colors={colors}
          strong
          accent={diff > 0 ? colors.overtimeAccent : undefined}
        />
      </Card>

      <SectionLabel colors={colors}>{`Зарплата · ${props.title}`}</SectionLabel>
      <Card colors={colors}>
        {props.onReceivedChange ? (
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={[styles.label, styles.strong, { color: colors.text }]}>Получено на руки</Text>
              <Text style={[styles.note, { color: colors.textMuted }]}>Впишите сумму — посчитаем ставку и доплаты</Text>
            </View>
            <NumberField value={received} onCommit={props.onReceivedChange} colors={colors} prefix={currency.symbol} suffix="" max={1e8} label="Получено за месяц" />
          </View>
        ) : (
          <Row label="Получено на руки" note="Сумма по месяцам, где вписано" value={formatMoney(received, currencyCode)} colors={colors} strong />
        )}

        {fromReceived && (
          <>
            <Divider colors={colors} />
            <Text style={[styles.subhead, { color: colors.textMuted }]}>РАСЧЁТ ИЗ ПОЛУЧЕННОЙ СУММЫ</Text>
            <PayRows pay={fromReceived} colors={colors} currencyCode={currencyCode} ndflPercent={ndflPercent} work={work} />
          </>
        )}

        {estimate && (
          <>
            <Divider colors={colors} />
            <Text style={[styles.subhead, { color: colors.textMuted }]}>ПО ОКЛАДУ / СТАВКЕ ИЗ НАСТРОЕК</Text>
            <PayRows pay={estimate} colors={colors} currencyCode={currencyCode} ndflPercent={ndflPercent} work={work} />
            {received > 0 && props.onReceivedChange && (
              <>
                <Divider colors={colors} />
                <Row
                  label="Разница с полученным"
                  note={received >= estimate.net ? 'Получено не меньше расчёта' : 'Получено меньше расчёта'}
                  value={`${received - estimate.net >= 0 ? '+' : '−'}${formatMoney(Math.abs(received - estimate.net), currencyCode)}`}
                  colors={colors}
                  accent={received - estimate.net < -0.5 ? colors.danger : colors.success}
                />
              </>
            )}
          </>
        )}

        {!estimate && !fromReceived && (
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Впишите полученную сумму или задайте оклад/часовую ставку в настройках, чтобы увидеть расчёт.
          </Text>
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 10 },
  label: { fontSize: 14, fontWeight: '600' },
  strong: { fontWeight: '800' },
  note: { fontSize: 12, marginTop: 1 },
  value: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  valueStrong: { fontSize: 17, fontWeight: '800' },
  subhead: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginTop: 12, marginBottom: 2 },
  hint: { fontSize: 13, lineHeight: 18, paddingVertical: 10 },
});
