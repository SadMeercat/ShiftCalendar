import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ThemeColors } from '../../constants/colors';
import { formatMoney, getCurrency } from '../../constants/currencies';
import { RuPayBreakdown, RuWorkStats } from '../../utils/ruWorkTime';
import { formatHoursRu } from '../../utils/ruFormat';
import { Button, Card, Divider, SectionLabel } from '../ui/primitives';
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
  /** Текущий процент премии для прогноза и сохранение нового. */
  bonusPercent?: number;
  onRememberBonus?: (percent: number) => void;
}

function pct(n: number) {
  return `${String(Math.round(n * 10) / 10).replace('.', ',')}%`;
}

function PayRows({ pay, colors, currencyCode, ndflPercent, work }: { pay: RuPayBreakdown; colors: ThemeColors; currencyCode: string; ndflPercent: number; work: RuWorkStats }) {
  const m = (n: number) => formatMoney(n, currencyCode);
  const hasBase = pay.rateSource === 'salary' || pay.rateSource === 'hourly';
  const withBonus = pay.extrasRate !== pay.rate;
  const extrasNote = withBonus ? ` по ставке с премией ${m(pay.extrasRate)}\u2060/ч` : "";
  return (
    <>
      <Row
        label={hasBase ? 'Ставка по окладу' : 'Ставка в час'}
        value={m(pay.rate)}
        colors={colors}
        note={pay.rateSource === 'salary' ? 'Оклад ÷ норма месяца' : pay.rateSource === 'received' ? 'Вычислена из полученной суммы' : 'Часовая ставка из настроек'}
      />
      <Divider colors={colors} />
      <Row
        label={hasBase ? 'Оклад за отработанное' : 'Обычные часы'}
        note={work.shortfallHours > 0 ? `${formatHoursRu(work.regularHours)} из нормы ${formatHoursRu(work.personalNormHours)}` : formatHoursRu(work.regularHours)}
        value={m(pay.regularPay)}
        colors={colors}
      />
      {pay.paidLeavePay > 0 && (
        <>
          <Divider colors={colors} />
          <Row label="Оплачиваемый отпуск" note={`${formatHoursRu(work.paidLeaveNormHours)} по норме`} value={m(pay.paidLeavePay)} colors={colors} />
        </>
      )}
      {hasBase && (
        <>
          <Divider colors={colors} />
          <Row
            label={`Премия · ${pct(pay.bonusPercent)}`}
            note={pay.bonusPay < 0 ? 'Получено меньше, чем положено по окладу' : 'От оклада за отработанное время'}
            value={m(pay.bonusPay)}
            colors={colors}
            accent={pay.bonusPay > 0 ? colors.success : pay.bonusPay < 0 ? colors.danger : undefined}
          />
        </>
      )}
      <Divider colors={colors} />
      <Row label="Работа в праздники" note={`${formatHoursRu(work.holidayHours)} × 2${extrasNote}`} value={m(pay.holidayPay)} colors={colors} accent={pay.holidayPay > 0 ? colors.danger : undefined} />
      <Divider colors={colors} />
      <Row
        label="Переработка"
        note={work.overtimeHours > 0 ? `${formatHoursRu(Math.min(work.overtimeHours, 2))} × 1,5${work.overtimeHours > 2 ? ` + ${formatHoursRu(work.overtimeHours - 2)} × 2` : ''}${extrasNote}` : 'Нет'}
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
              <Text style={[styles.note, { color: colors.textMuted }]}>Впишите сумму — разложим её на оклад, премию и доплаты</Text>
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
            {props.onRememberBonus && fromReceived.rateSource !== 'received' && fromReceived.bonusPercent > 0 && fromReceived.bonusPercent !== props.bonusPercent && (
              <Button
                label={`Запомнить премию ${pct(fromReceived.bonusPercent)} для прогноза`}
                icon="content-save-outline"
                variant="secondary"
                onPress={() => props.onRememberBonus!(fromReceived.bonusPercent)}
                colors={colors}
                style={styles.remember}
              />
            )}
          </>
        )}

        {estimate && (
          <>
            <Divider colors={colors} />
            <Text style={[styles.subhead, { color: colors.textMuted }]}>ПРОГНОЗ ПО ОКЛАДУ И ПРЕМИИ ИЗ НАСТРОЕК</Text>
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
  remember: { marginTop: 8, marginBottom: 4 },
});
