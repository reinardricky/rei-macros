import Feather from '@expo/vector-icons/Feather';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/components/Buttons';
import { useSettings } from '@/hooks/useSettings';
import { aiProvider, hasApiKey } from '@/lib/ai';
import { exportLogAsCsv } from '@/lib/exportCsv';
import type { Goals } from '@/lib/types';
import { useNav } from '@/navigation';
import { colors, fonts } from '@/theme';

const GOAL_FIELDS: { key: keyof Goals; label: string; unit: string; dot?: string }[] = [
  { key: 'kcal', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g', dot: colors.protein },
  { key: 'carbs', label: 'Carbs', unit: 'g', dot: colors.carbs },
  { key: 'fat', label: 'Fat', unit: 'g', dot: colors.fat },
];

export function SettingsScreen() {
  const db = useSQLiteContext();
  const nav = useNav();
  const { settings, update } = useSettings();
  // Text being typed into a goal field; cleared once committed so the saved value shows.
  const [draft, setDraft] = useState<Partial<Record<keyof Goals, string>>>({});
  const [exporting, setExporting] = useState(false);
  const keyFound = hasApiKey();

  const commitGoal = (key: keyof Goals) => {
    const text = draft[key];
    setDraft(({ [key]: _committed, ...rest }) => rest);
    if (text === undefined) return;
    const value = Math.round(Number(text));
    if (Number.isFinite(value) && value > 0 && value !== settings.goals[key]) {
      update('goals', { ...settings.goals, [key]: value });
    }
  };

  const onExport = async () => {
    setExporting(true);
    try {
      const result = await exportLogAsCsv(db);
      if (result === 'empty') Alert.alert('Nothing to export', 'Log a meal first.');
      if (result === 'unavailable') Alert.alert('Sharing unavailable', 'This device cannot share files.');
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={styles.header}>
          <IconButton icon="chevron-left" label="Back" variant="ghost" onPress={nav.back} />
          <Text style={styles.title} accessibilityRole="header">
            Goals &amp; settings
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Section title="Daily goals">
            {GOAL_FIELDS.map((f, i) => (
              <View key={f.key} style={[styles.row, i < GOAL_FIELDS.length - 1 && styles.divider]}>
                <View style={styles.rowLabel}>
                  {f.dot && <View style={[styles.dot, { backgroundColor: f.dot }]} />}
                  <Text style={styles.rowTitle}>{f.label}</Text>
                </View>
                <View style={styles.goalInputWrap}>
                  <TextInput
                    value={draft[f.key] ?? String(settings.goals[f.key])}
                    onChangeText={(text) => setDraft((d) => ({ ...d, [f.key]: text.replace(/[^0-9]/g, '') }))}
                    onEndEditing={() => commitGoal(f.key)}
                    keyboardType="number-pad"
                    style={styles.goalInput}
                    accessibilityLabel={`${f.label} goal in ${f.unit}`}
                    selectTextOnFocus
                  />
                  <Text style={styles.unit}>{f.unit}</Text>
                </View>
              </View>
            ))}
          </Section>

          <Section title="AI analysis">
            <View style={styles.aiCard}>
              <View style={styles.aiRow}>
                <View style={styles.aiIcon}>
                  <Feather name="cpu" size={20} color={colors.softInk} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.rowTitle}>{aiProvider.name}</Text>
                  <Text style={styles.rowSub}>{aiProvider.model}</Text>
                </View>
                <View style={styles.status}>
                  <View style={[styles.statusDot, { backgroundColor: keyFound ? colors.ring : colors.danger }]} />
                  <Text style={[styles.statusText, { color: keyFound ? colors.accentText : colors.danger }]}>
                    {keyFound ? 'Key found' : 'No key'}
                  </Text>
                </View>
              </View>
              <Text style={styles.aiNote}>
                The API key (<Text style={styles.code}>{aiProvider.keyVar}</Text>) is read from the app&apos;s{' '}
                <Text style={styles.code}>.env</Text> file when Expo starts. Change it there, not here.
              </Text>
              {aiProvider.name === 'Gemini' && (
                <Text style={styles.aiNote}>
                  On Gemini&apos;s free tier, Google may use what you send, including meal photos, to improve its
                  products, and people may review it.
                </Text>
              )}
            </View>
          </Section>

          <Section title="Preferences">
            <ToggleRow
              title="Keep meal photos"
              subtitle="Stored on this phone only"
              value={settings.keepPhotos}
              onChange={(v) => update('keepPhotos', v)}
            />
            <ToggleRow
              title="Always review before logging"
              subtitle={`Turn off to log ${aiProvider.name}'s estimate straight away`}
              value={settings.reviewBeforeLogging}
              onChange={(v) => update('reviewBeforeLogging', v)}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: exporting }}
              disabled={exporting}
              onPress={onExport}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.rowTitle}>Export log as CSV</Text>
              <Feather name="download" size={18} color={colors.muted} />
            </Pressable>
          </Section>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function ToggleRow(props: { title: string; subtitle: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={[styles.row, styles.divider]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowTitle}>{props.title}</Text>
        <Text style={styles.rowSub}>{props.subtitle}</Text>
      </View>
      <Switch
        value={props.value}
        onValueChange={props.onChange}
        accessibilityLabel={props.title}
        trackColor={{ true: colors.ring, false: colors.dashed }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8 },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  content: { padding: 20, paddingTop: 8, gap: 22 },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionCard: { backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 16 },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  rowLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  rowSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  goalInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  goalInput: {
    width: 80,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.field,
    textAlign: 'right',
    paddingHorizontal: 10,
    fontFamily: fonts.displaySemibold,
    fontSize: 16,
    color: colors.ink,
  },
  unit: { width: 32, fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  aiCard: { paddingVertical: 16, gap: 12 },
  aiRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontFamily: fonts.semibold, fontSize: 13 },
  aiNote: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.muted },
  code: { fontFamily: 'monospace', fontSize: 12, color: colors.ink },
});
