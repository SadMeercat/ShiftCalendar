import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ThemeColors } from '../../constants/colors';
import { formatMoney, getCurrency } from '../../constants/currencies';
import { PaidParts, RuPayBreakdown, RuWorkStats, paidTotal } from '../../utils/ruWorkTime';
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
  /** Что пришло по расчётному листку (за год — сумма по месяцам, где вписано). */
  paid?: PaidParts;
  /** Задан только для месяца: поля ввода частей выплаты. */
  onPartChange?: (part: keyof PaidParts, amount: number) => void;
  /** Аванс по прогнозу (за год — сумма). */
  forecastAdvance: number;
  /** Отпускные по прогнозу на руки (0 — отпуска нет). */
  forecastVacation: number;
  /** Даты выплат (только для месяца). */
  payDates?: { advance: string; salary: string };
  /** Процент профвзносов из настроек: по нему видно, от какой суммы взяты взносы. */
  unionPercent?: number;
  /** Текущий процент премии для прогноза и сохранение нового. */
  bonusPercent?: number;
  onRememberBonus?: (percent: number) => void;
}

function pct(n: number, digits = 1) {
  const f = 10 ** digits;
  return `${String(Math.round(n * f) / f).replace('.', ',')}%`;
}

/**
 * Откуда взялись взносы. Если в листке они меньше процента от всего начисленного, значит часть
 * начислений (больничные, отпускные, компенсации) в базу взносов не входит — показываем базу.
 */
function unionInfo(pay: RuPayBreakdown, unionPercent: number, m: (n: number) => string): string | undefined {
  if (!(unionPercent > 0)) return undefined;
  const base = pay.union / (unionPercent / 100);
  const outside = pay.gross - base;
  if (Math.abs(outside) < 1) return 'От всего начисленного';
  return outside > 0
    ? `От ${m(base)} — ещё ${m(outside)} начислено без взносов (больничные, отпускные, компенсации…)`
    : `От ${m(base)} — больше начисленного, проверьте процент`;
}

function PayRows({ pay, colors, currencyCode, ndflPercent, work, unionPercent = 0 }: { pay: RuPayBreakdown; colors: ThemeColors; currencyCode: string; ndflPercent: number; work: RuWorkStats; unionPercent?: number }) {
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
          <Row label="Оплачиваемый отпуск" note={`${formatHoursRu(work.paidLeaveNormHours)} по норме по окладу; отпускные считаются по среднему заработку`} value={m(pay.paidLeavePay)} colors={colors} />
        </>
      )}
      {pay.vacationPay > 0 && (
        <>
          <Divider colors={colors} />
          <Row label="Отпускные" note="Начислено, из полученных отпускных" value={m(pay.vacationPay)} colors={colors} />
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
      {pay.union > 0 && (
        <>
          <Row
            label={unionPercent > 0 ? `Профсоюзные взносы ${pct(unionPercent, 2)}` : 'Профсоюзные взносы'}
            note={unionInfo(pay, unionPercent, m)}
            value={`−${m(pay.union)}`}
            colors={colors}
          />
          <Divider colors={colors} />
        </>
      )}
      <Row label="На руки" value={m(pay.net)} colors={colors} strong />
    </>
  );
}

export function RuWorkCard(props: Props) {
  const { work, colors, currencyCode, estimate, fromReceived, paid, ndflPercent } = props;
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

      <PayoutsCard {...props} />

      {props.onPartChange && (
        <>
          <SectionLabel colors={colors}>{`Расчётный листок · ${props.title}`}</SectionLabel>
          <Card colors={colors}>
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              Впишите, что пришло. Начисленное, премия и доплаты посчитаются сами: начислено = (аванс + зарплата + взносы) ÷ (1 − НДФЛ).
            </Text>
            <PartField label="Аванс" note="Сколько пришло авансом" value={paid?.advance ?? 0} onChange={(v) => props.onPartChange!('advance', v)} colors={colors} symbol={currency.symbol} />
            <Divider colors={colors} />
            <PartField label="Зарплата" note="Окончательный расчёт за месяц" value={paid?.salary ?? 0} onChange={(v) => props.onPartChange!('salary', v)} colors={colors} symbol={currency.symbol} />
            <Divider colors={colors} />
            <PartField label="Отпускные" note="Если в этом месяце был отпуск — пришли отдельно" value={paid?.vacation ?? 0} onChange={(v) => props.onPartChange!('vacation', v)} colors={colors} symbol={currency.symbol} />
            <Divider colors={colors} />
            <PartField
              label="Профсоюзные взносы"
              note={props.unionPercent ? `Из листка. Пусто — ${pct(props.unionPercent, 2)} от начисленного` : 'Из листка, если удерживают'}
              value={paid?.union ?? 0}
              onChange={(v) => props.onPartChange!('union', v)}
              colors={colors}
              symbol={currency.symbol}
            />

            {fromReceived && (
              <>
                <Divider colors={colors} />
                <Text style={[styles.subhead, { color: colors.textMuted }]}>РАЗБОР ПОЛУЧЕННОГО</Text>
                <PayRows pay={fromReceived} colors={colors} currencyCode={currencyCode} ndflPercent={ndflPercent} work={work} unionPercent={props.unionPercent} />
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
          </Card>
        </>
      )}

      {!props.onPartChange && fromReceived && (
        <>
          <SectionLabel colors={colors}>{`Разбор полученного · ${props.title}`}</SectionLabel>
          <Card colors={colors}>
            <PayRows pay={fromReceived} colors={colors} currencyCode={currencyCode} ndflPercent={ndflPercent} work={work} unionPercent={props.unionPercent} />
          </Card>
        </>
      )}

      {estimate && (
        <>
          <SectionLabel colors={colors}>{`Прогноз по окладу · ${props.title}`}</SectionLabel>
          <Card colors={colors}>
            <PayRows pay={estimate} colors={colors} currencyCode={currencyCode} ndflPercent={ndflPercent} work={work} unionPercent={props.unionPercent} />
          </Card>
        </>
      )}
    </>
  );
}

function PartField({ label, note, value, onChange, colors, symbol }: { label: string; note: string; value: number; onChange: (v: number) => void; colors: ThemeColors; symbol: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text style={[styles.label, styles.strong, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.note, { color: colors.textMuted }]}>{note}</Text>
      </View>
      <NumberField value={value} onCommit={onChange} colors={colors} prefix={symbol} suffix="" max={1e8} label={label} />
    </View>
  );
}

/** Сколько придёт авансом и зарплатой: прогноз и, если вписано, факт. */
function PayoutsCard(props: Props) {
  const { colors, currencyCode, estimate, paid, forecastAdvance, forecastVacation, payDates } = props;
  const m = (n: number) => formatMoney(n, currencyCode);
  const forecastSalary = estimate ? Math.max(0, estimate.net - forecastAdvance - forecastVacation) : 0;
  const hasForecast = !!estimate && estimate.net > 0;
  const hasPaid = paidTotal(paid) > 0;
  if (!hasForecast && !hasPaid) {
    return (
      <>
        <SectionLabel colors={colors}>{`Выплаты · ${props.title}`}</SectionLabel>
        <Card colors={colors}>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Задайте оклад в настройках, чтобы увидеть прогноз аванса и зарплаты, или впишите суммы из расчётного листка ниже.
          </Text>
        </Card>
      </>
    );
  }
  const diffNote = (fact: number, plan: number) => {
    if (!hasForecast) return undefined;
    const d = fact - plan;
    return Math.abs(d) < 1 ? 'Совпало с прогнозом' : `Прогноз ${m(plan)} · ${d > 0 ? '+' : '−'}${m(Math.abs(d))}`;
  };
  return (
    <>
      <SectionLabel colors={colors}>{`Выплаты · ${props.title}`}</SectionLabel>
      <Card colors={colors}>
        {hasForecast && (
          <View style={styles.payouts}>
            <Payout label="Аванс" date={payDates?.advance} value={m(forecastAdvance)} colors={colors} />
            <Payout label="Зарплата" date={payDates?.salary} value={m(forecastSalary)} colors={colors} />
          </View>
        )}
        {hasForecast && forecastVacation > 0 && (
          <View style={[styles.payouts, styles.payoutsGap]}>
            <Payout label="Отпускные" date="за 3 дня до отпуска" value={m(forecastVacation)} colors={colors} />
          </View>
        )}
        {hasForecast && (
          <Text style={[styles.payoutsNote, { color: colors.textMuted }]}>
            {`Прогноз: всего на руки ${m(estimate!.net)}${estimate!.bonusPercent ? ` · премия ${pct(estimate!.bonusPercent)}` : ''}`}
          </Text>
        )}
        {hasPaid && (
          <>
            {hasForecast && <Divider colors={colors} />}
            <Text style={[styles.subhead, { color: colors.textMuted }]}>ПРИШЛО ФАКТИЧЕСКИ</Text>
            <Row label="Аванс" note={diffNote(paid!.advance, forecastAdvance)} value={m(paid!.advance)} colors={colors} />
            <Divider colors={colors} />
            <Row label="Зарплата" note={diffNote(paid!.salary, forecastSalary)} value={m(paid!.salary)} colors={colors} />
            <Divider colors={colors} />
            {(paid!.vacation > 0 || forecastVacation > 0) && (
              <>
                <Row label="Отпускные" note={diffNote(paid!.vacation, forecastVacation)} value={m(paid!.vacation)} colors={colors} />
                <Divider colors={colors} />
              </>
            )}
            <Row
              label="Всего на руки"
              note={diffNote(paidTotal(paid), estimate?.net ?? 0)}
              value={m(paidTotal(paid))}
              colors={colors}
              strong
              accent={hasForecast && paidTotal(paid) - estimate!.net < -1 ? colors.danger : undefined}
            />
          </>
        )}
      </Card>
    </>
  );
}

function Payout({ label, date, value, colors }: { label: string; date?: string; value: string; colors: ThemeColors }) {
  return (
    <View style={[styles.payout, { backgroundColor: colors.surfaceVariant }]} accessibilityLabel={`${label}${date ? ' ' + date : ''}: ${value}`}>
      <Text style={[styles.payoutLabel, { color: colors.textSecondary }]}>{label}</Text>
      {date ? <Text style={[styles.payoutDate, { color: colors.textMuted }]}>{date}</Text> : null}
      <Text style={[styles.payoutValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
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
  payouts: { flexDirection: 'row', gap: 10, paddingTop: 4 },
  payout: { flex: 1, borderRadius: 14, padding: 12 },
  payoutLabel: { fontSize: 13, fontWeight: '800' },
  payoutDate: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  payoutValue: { fontSize: 20, fontWeight: '800', marginTop: 8, fontVariant: ['tabular-nums'] },
  payoutsGap: { paddingTop: 10 },
  payoutsNote: { fontSize: 12, marginTop: 8, marginBottom: 4 },
});
