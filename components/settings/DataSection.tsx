import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemeColors } from '../../constants/colors';
import { withAlpha } from '../../utils/color';
import { haptic } from '../../utils/haptics';
import { Tap } from '../ui/Tap';
import { Button, Chip, SectionLabel } from '../ui/primitives';
import { SettingsCard, SettingsRow } from './SettingsRow';
import { tr } from '../../utils/i18n';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Props {
  colors: ThemeColors;
  calendarName: string;
  busy: string | null;
  year: number;
  setYear: (y: number) => void;
  month: number | null;
  setMonth: (m: number | null) => void;
  onExportCSV: () => void;
  onExportPDF: () => void;
  onImportCSV: () => void;
  onBackup: () => void;
  onRestore: () => void;
  onReset: () => void;
}

export function DataSection(props: Props) {
  const { colors, busy } = props;
  const disabled = busy !== null;
  return (
    <>
      <SectionLabel colors={colors}>{`${tr('Export')} · ${props.calendarName}`}</SectionLabel>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.yearRow}>
          <Tap onPress={() => props.setYear(props.year - 1)} accessibilityLabel={tr('Previous year')} style={[styles.yearBtn, { backgroundColor: colors.surfaceVariant }]}>
            <MaterialCommunityIcons name="chevron-left" size={20} color={colors.text} />
          </Tap>
          <Text style={[styles.year, { color: colors.text }]}>{props.year}</Text>
          <Tap onPress={() => props.setYear(props.year + 1)} accessibilityLabel={tr('Next year')} style={[styles.yearBtn, { backgroundColor: colors.surfaceVariant }]}>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.text} />
          </Tap>
        </View>
        <View style={styles.months}>
          <Chip label={tr('Whole year')} icon="calendar-range" selected={props.month === null} onPress={() => props.setMonth(null)} colors={colors} compact style={styles.wholeYear} />
          {MONTHS.map((m, i) => (
            <Chip key={m} label={tr(m)} selected={props.month === i} onPress={() => { haptic.selection(); props.setMonth(i); }} colors={colors} compact style={styles.monthChip} />
          ))}
        </View>
        <View style={styles.exportRow}>
          <Button
            label={tr('Spreadsheet')}
            icon="file-delimited-outline"
            onPress={props.onExportCSV}
            colors={colors}
            variant="secondary"
            loading={busy === 'csv'}
            disabled={disabled}
            style={styles.flex}
          />
          <Button
            label="PDF"
            icon="file-pdf-box"
            onPress={props.onExportPDF}
            colors={colors}
            variant="secondary"
            loading={busy === 'pdf'}
            disabled={disabled}
            style={styles.flex}
          />
        </View>
      </View>

      <SectionLabel colors={colors} right={busy && busy !== 'csv' && busy !== 'pdf' ? <ActivityIndicator size="small" color={colors.primary} /> : undefined}>
        {tr('Backup & import')}
      </SectionLabel>
      <SettingsCard colors={colors}>
        <SettingsRow
          icon="database-export-outline"
          title={tr('Back up everything')}
          subtitle={tr('All calendars, shifts, notes and settings in one file')}
          colors={colors}
          onPress={disabled ? undefined : props.onBackup}
        />
        <SettingsRow
          icon="backup-restore"
          iconColor={colors.warning}
          title={tr('Restore from backup')}
          subtitle={tr('Replaces current data with a backup file')}
          colors={colors}
          onPress={disabled ? undefined : props.onRestore}
        />
        <SettingsRow
          icon="file-import-outline"
          iconColor={colors.info}
          title={tr('Import spreadsheet (CSV)')}
          subtitle={tr('Adds days into “{name}”', { name: props.calendarName })}
          colors={colors}
          onPress={disabled ? undefined : props.onImportCSV}
        />
      </SettingsCard>
      <Text style={[styles.footnote, { color: colors.textMuted }]}>
        {tr('Tip: you can also open CSV exports and backup files straight from your file manager.')}
      </Text>

      <SectionLabel colors={colors}>{tr('Danger zone')}</SectionLabel>
      <Tap
        onPress={props.onReset}
        accessibilityLabel={tr('Erase all data')}
        style={[styles.danger, { backgroundColor: withAlpha(colors.danger, 0.08), borderColor: withAlpha(colors.danger, 0.3) }]}
      >
        <MaterialCommunityIcons name="delete-sweep-outline" size={22} color={colors.danger} />
        <View style={styles.flex}>
          <Text style={[styles.dangerTitle, { color: colors.danger }]}>{tr('Erase all data')}</Text>
          <Text style={[styles.dangerText, { color: colors.textSecondary }]}>{tr('Deletes every calendar, shift, note and setting on this device.')}</Text>
        </View>
      </Tap>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 12 },
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  yearBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  year: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  months: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  wholeYear: { width: '100%', justifyContent: 'center' },
  monthChip: { flexGrow: 1, flexBasis: '14%', justifyContent: 'center' },
  exportRow: { flexDirection: 'row', gap: 10 },
  footnote: { fontSize: 12, marginTop: 6, marginHorizontal: 4, lineHeight: 17 },
  danger: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  dangerTitle: { fontSize: 15, fontWeight: '800' },
  dangerText: { fontSize: 12.5, marginTop: 2, lineHeight: 17 },
});
