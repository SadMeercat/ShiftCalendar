import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ThemeColors } from '../../constants/colors';
import { RuWorkStats } from '../../utils/ruWorkTime';
import { formatHoursRu } from '../../utils/ruFormat';

/** Компактная строка под календарём: норма, отработано, переработка, праздники. */
export function RuMonthStrip({ work, colors }: { work: RuWorkStats; colors: ThemeColors }) {
  const diff = work.overtimeHours > 0 ? work.overtimeHours : -work.shortfallHours;
  const items = [
    { label: 'Норма', value: formatHoursRu(work.personalNormHours), color: colors.text },
    { label: 'Отработано', value: formatHoursRu(work.workedHours), color: colors.text },
    {
      label: diff >= 0 ? 'Переработка' : 'Недоработка',
      value: formatHoursRu(Math.abs(diff)),
      color: diff > 0 ? colors.overtimeAccent : diff < 0 ? colors.textSecondary : colors.text,
    },
    { label: 'Праздники', value: formatHoursRu(work.holidayHours), color: work.holidayHours > 0 ? colors.danger : colors.text },
  ];
  return (
    <View
      style={[styles.strip, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityLabel={items.map((i) => `${i.label} ${i.value}`).join(', ')}
    >
      {items.map((i) => (
        <View key={i.label} style={styles.item}>
          <Text style={[styles.value, { color: i.color }]} numberOfLines={1}>
            {i.value}
          </Text>
          <Text style={[styles.label, { color: colors.textMuted }]} numberOfLines={1}>
            {i.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 6, marginBottom: 4 },
  item: { flex: 1, alignItems: 'center' },
  value: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  label: { fontSize: 10, fontWeight: '700', marginTop: 1 },
});
