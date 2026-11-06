import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ThemeColors } from '../../constants/colors';
import { ThemeMode } from '../../hooks/useSettings';
import { WeekStart } from '../../utils/dates';
import { TimeFormat } from '../../utils/time';
import { haptic } from '../../utils/haptics';
import { Segmented, SectionLabel } from '../ui/primitives';
import { SettingsCard, SettingsRow } from './SettingsRow';
import { LanguageSetting, tr } from '../../utils/i18n';

interface Props {
  colors: ThemeColors;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  weekStart: WeekStart;
  setWeekStart: (v: WeekStart) => void;
  timeFormat: TimeFormat;
  setTimeFormat: (v: TimeFormat) => void;
  showShiftTimes: boolean;
  setShowShiftTimes: (v: boolean) => void;
  hapticsEnabled: boolean;
  setHapticsEnabled: (v: boolean) => void;
  language: LanguageSetting;
  setLanguage: (v: LanguageSetting) => void;
}

function Labeled({ label, colors, children }: { label: string; colors: ThemeColors; children: React.ReactNode }) {
  return (
    <View style={styles.block}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      {children}
    </View>
  );
}

export function AppearanceSection(props: Props) {
  const { colors } = props;
  const pick = <T,>(fn: (v: T) => void) => (v: T) => {
    haptic.selection();
    fn(v);
  };
  return (
    <>
      <SectionLabel colors={colors}>{tr('Appearance')}</SectionLabel>
      <SettingsCard colors={colors}>
        <Labeled label={tr('Language')} colors={colors}>
          <Segmented
            options={[
              { value: 'system', label: tr('Auto') },
              { value: 'ru', label: 'Русский' },
              { value: 'en', label: 'English' },
            ]}
            value={props.language}
            onChange={pick(props.setLanguage)}
            colors={colors}
          />
        </Labeled>
        <Labeled label={tr('Theme')} colors={colors}>
          <Segmented
            options={[
              { value: 'light', label: tr('Light'), icon: 'white-balance-sunny' },
              { value: 'dark', label: tr('Dark'), icon: 'weather-night' },
              { value: 'system', label: tr('Auto'), icon: 'theme-light-dark' },
            ]}
            value={props.themeMode}
            onChange={pick(props.setThemeMode)}
            colors={colors}
          />
        </Labeled>
        <Labeled label={tr('Week starts on')} colors={colors}>
          <Segmented
            options={[
              { value: 6, label: tr('Saturday') },
              { value: 0, label: tr('Sunday') },
              { value: 1, label: tr('Monday') },
            ]}
            value={props.weekStart}
            onChange={pick(props.setWeekStart)}
            colors={colors}
          />
        </Labeled>
        <Labeled label={tr('Time format')} colors={colors}>
          <Segmented
            options={[
              { value: '24h', label: tr('24-hour · 15:00') },
              { value: '12h', label: tr('12-hour · 3 PM') },
            ]}
            value={props.timeFormat}
            onChange={pick(props.setTimeFormat)}
            colors={colors}
          />
        </Labeled>
        <SettingsRow
          icon="clock-time-four-outline"
          title={tr('Start times on calendar')}
          subtitle={tr('Show each shift’s start time in the month grid')}
          colors={colors}
          switchValue={props.showShiftTimes}
          onSwitch={props.setShowShiftTimes}
        />
        <SettingsRow
          icon="vibrate"
          title={tr('Haptic feedback')}
          subtitle={tr('Subtle vibrations when you tap and assign')}
          colors={colors}
          switchValue={props.hapticsEnabled}
          onSwitch={props.setHapticsEnabled}
        />
      </SettingsCard>
    </>
  );
}

const styles = StyleSheet.create({
  block: { paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  label: { fontSize: 15, fontWeight: '600' },
});
