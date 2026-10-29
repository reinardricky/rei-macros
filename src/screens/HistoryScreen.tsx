import Feather from '@expo/vector-icons/Feather';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSettings } from '@/hooks/useSettings';
import { addDays, fromDateKey, longDate, shortWeekday, todayKey } from '@/lib/dates';
import { getDailyTotals } from '@/lib/db';
import { fmtInt } from '@/lib/format';
import type { DayTotals } from '@/lib/types';
import { useFocusEffect, useNav, useRoute } from '@/navigation';
import { colors, fonts } from '@/theme';

type Range = 'week' | 'month';
const RANGE_DAYS: Record<Range, number> = { week: 7, month: 30 };
const CHART_HEIGHT = 160;

export function HistoryScreen() {
  const db = useSQLiteContext();
  const nav = useNav();
  const route = useRoute('tabs');
  const { settings } = useSettings();
  const goals = settings.goals;
  const [range, setRange] = useState<Range>('week');
  const [totals, setTotals] = useState<DayTotals[]>([]);

  const today = todayKey();
  const dayCount = RANGE_DAYS[range];
  const from = addDays(today, -(dayCount - 1));

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getDailyTotals(db, from, today).then((rows) => active && setTotals(rows));
      return () => {
        active = false;
      };
    }, [db, from, today]),
  );

  const byDate = new Map(totals.map((t) => [t.date, t]));
  const days = Array.from({ length: dayCount }, (_, i) => addDays(from, i));

  // Average over finished days that have logs; fall back to today if that's all there is.
  const finished = totals.filter((t) => t.date !== today);
  const basis = finished.length > 0 ? finished : totals;
  const avg = (key: 'kcal' | 'protein' | 'carbs' | 'fat') =>
    basis.length ? basis.reduce((s, t) => s + t[key], 0) / basis.length : 0;

  const maxKcal = Math.max(goals.kcal * 1.15, ...totals.map((t) => t.kcal));
  const barHeight = (kcal: number) => (kcal > 0 ? Math.max(4, (kcal / maxKcal) * CHART_HEIGHT) : 0);
  const goalOffset = (goals.kcal / maxKcal) * CHART_HEIGHT;

  const label = (key: string, i: number) => {
    if (range === 'week') return key === today ? 'Now' : shortWeekday(key);
    return i % 5 === 4 || key === today ? String(fromDateKey(key).getDate()) : '';
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            History
          </Text>
          <View style={styles.segment} accessibilityRole="tablist">
            {(['week', 'month'] as const).map((r) => (
              <Pressable
                key={r}
                accessibilityRole="tab"
                accessibilityState={{ selected: range === r }}
                onPress={() => setRange(r)}
                style={[styles.segmentItem, range === r && styles.segmentOn]}
              >
                <Text style={[styles.segmentText, range === r && { color: colors.ink }]}>
                  {r === 'week' ? 'Week' : 'Month'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.eyebrow}>Daily average</Text>
              <Text style={styles.avg}>
                {fmtInt(avg('kcal'))} <Text style={styles.avgUnit}>kcal</Text>
              </Text>
            </View>
            <Text style={styles.goalLabel}>Goal {fmtInt(goals.kcal)}</Text>
          </View>

          <View
            style={styles.chart}
            accessible
            accessibilityLabel={`Calories per day for the last ${dayCount} days`}
          >
            <View style={[styles.goalLine, { bottom: goalOffset }]} />
            {days.map((key) => {
              const kcal = byDate.get(key)?.kcal ?? 0;
              return (
                <View key={key} style={styles.barSlot}>
                  <View
                    style={[
                      styles.bar,
                      range === 'month' && styles.barThin,
                      { height: barHeight(kcal), backgroundColor: key === today ? colors.today : colors.ring },
                    ]}
                  />
                </View>
              );
            })}
          </View>
          <View style={styles.labels}>
            {days.map((key, i) => (
              <Text key={key} style={styles.dayLabel} numberOfLines={1}>
                {label(key, i)}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.macroGrid}>
          <MacroAvg label="Protein" color={colors.proteinInk} value={avg('protein')} goal={goals.protein} />
          <MacroAvg label="Carbs" color={colors.carbsInk} value={avg('carbs')} goal={goals.carbs} />
          <MacroAvg label="Fat" color={colors.fatInk} value={avg('fat')} goal={goals.fat} />
        </View>

        <View style={styles.list}>
          {totals.length === 0 ? (
            <Text style={styles.empty}>No meals logged in the last {dayCount} days.</Text>
          ) : (
            totals.map((t, i) => (
              <Pressable
                key={t.date}
                accessibilityRole="button"
                accessibilityLabel={`${longDate(t.date)}, ${fmtInt(t.kcal)} kcal`}
                onPress={() => nav.update({ ...route, tab: 'today', date: t.date, at: Date.now() })}
                style={({ pressed }) => [
                  styles.row,
                  i < totals.length - 1 && styles.rowDivider,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.rowTitle}>{longDate(t.date)}</Text>
                  <Text style={styles.rowSub}>
                    {t.meals} {t.meals === 1 ? 'meal' : 'meals'} · P {Math.round(t.protein)}g
                  </Text>
                </View>
                <Text style={styles.rowKcal}>{fmtInt(t.kcal)}</Text>
                <Feather name="chevron-right" size={18} color={colors.muted} />
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MacroAvg({ label, color, value, goal }: { label: string; color: string; value: number; goal: number }) {
  return (
    <View style={styles.macroCard}>
      <Text style={[styles.macroLabel, { color }]}>{label}</Text>
      <Text style={styles.macroValue}>{Math.round(value)}g</Text>
      <Text style={styles.macroGoal}>goal {goal}g</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingTop: 16, gap: 18 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.ink, letterSpacing: -0.5 },
  segment: { flexDirection: 'row', backgroundColor: colors.track, borderRadius: 22, padding: 3 },
  segmentItem: { height: 38, paddingHorizontal: 14, borderRadius: 19, justifyContent: 'center' },
  segmentOn: { backgroundColor: colors.surface },
  segmentText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
  card: { backgroundColor: colors.surface, borderRadius: 24, padding: 18, gap: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrow: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  avg: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  avgUnit: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  goalLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  chart: {
    height: CHART_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  goalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.muted,
  },
  barSlot: { flex: 1, alignItems: 'center' },
  bar: { width: '70%', maxWidth: 28, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderRadius: 3 },
  barThin: { width: '60%', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  labels: { flexDirection: 'row', marginTop: -6 },
  dayLabel: { flex: 1, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 12, color: colors.muted },
  macroGrid: { flexDirection: 'row', gap: 10 },
  macroCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 18, padding: 14, gap: 4 },
  macroLabel: { fontFamily: fonts.bold, fontSize: 12 },
  macroValue: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  macroGoal: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  list: { backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 16 },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  rowSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  rowKcal: { fontFamily: fonts.displaySemibold, fontSize: 16, color: colors.ink },
  empty: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, paddingVertical: 18 },
});
