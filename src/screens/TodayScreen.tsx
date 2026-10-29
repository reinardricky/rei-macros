import Feather from '@expo/vector-icons/Feather';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/components/Buttons';
import { CalorieRing } from '@/components/CalorieRing';
import { MacroBar } from '@/components/MacroBar';
import { MealCard } from '@/components/MealCard';
import { useSettings } from '@/hooks/useSettings';
import { aiProvider, hasApiKey } from '@/lib/ai';
import { addDays, isDateKey, longDate, relativeDayName, todayKey } from '@/lib/dates';
import { deleteMeal, getMealsForDate } from '@/lib/db';
import { fmtAmount, fmtInt } from '@/lib/format';
import { deletePhoto } from '@/lib/photos';
import { MEAL_SLOTS, slotForTime, sumMacros, type Meal } from '@/lib/types';
import { useFocusEffect, useNav, useRoute } from '@/navigation';
import { colors, fonts } from '@/theme';

export function TodayScreen() {
  const db = useSQLiteContext();
  const nav = useNav();
  // History opens a day by setting `date` and `at` (`at` makes repeat taps on the same day count).
  const route = useRoute('tabs');
  const [date, setDate] = useState(() => (isDateKey(route.date) ? route.date : todayKey()));
  const [meals, setMeals] = useState<Meal[]>([]);
  const { settings } = useSettings();
  const goals = settings.goals;

  const linkKey = `${route.date}|${route.at}`;
  const [seenLinkKey, setSeenLinkKey] = useState(linkKey);
  if (linkKey !== seenLinkKey) {
    setSeenLinkKey(linkKey);
    if (isDateKey(route.date)) setDate(route.date);
  }

  const load = useCallback(async () => {
    setMeals(await getMealsForDate(db, date));
  }, [db, date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const totals = sumMacros(meals.flatMap((m) => m.items));
  const isToday = date === todayKey();
  const nextSlot = isToday ? slotForTime(new Date()) : (MEAL_SLOTS.find((s) => !meals.some((m) => m.slot === s)) ?? 'Snack');

  const openMeal = (meal: Meal) => {
    const lines = meal.items.map((it) => `• ${it.name}, ${fmtAmount(it.amount, it.unit)}: ${fmtInt(it.kcal)} kcal`);
    Alert.alert(meal.name, lines.join('\n'), [
      { text: 'Close', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteMeal(db, meal.id);
          deletePhoto(meal.photoUri);
          load();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dateLabel}>{longDate(date)}</Text>
            <Text style={styles.title} accessibilityRole="header">
              {relativeDayName(date)}
            </Text>
          </View>
          <View style={styles.headerButtons}>
            <IconButton icon="chevron-left" label="Previous day" onPress={() => setDate(addDays(date, -1))} />
            <IconButton icon="chevron-right" label="Next day" onPress={() => setDate(addDays(date, 1))} disabled={isToday} />
            <IconButton icon="sliders" label="Goals and settings" onPress={() => nav.push({ name: 'settings' })} />
          </View>
        </View>

        {!hasApiKey() && (
          <View style={styles.banner}>
            <Feather name="key" size={18} color={colors.carbsInk} />
            <Text style={styles.bannerText}>
              No API key yet. Add {aiProvider.keyVar} to .env and restart Expo to enable photo analysis.
            </Text>
          </View>
        )}

        <View style={styles.totalsCard}>
          <CalorieRing eaten={totals.kcal} goal={goals.kcal} />
          <View style={styles.bars}>
            <MacroBar label="Protein" value={totals.protein} goal={goals.protein} color={colors.protein} />
            <MacroBar label="Carbs" value={totals.carbs} goal={goals.carbs} color={colors.carbs} />
            <MacroBar label="Fat" value={totals.fat} goal={goals.fat} color={colors.fat} />
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Meals
          </Text>
          <Text style={styles.sectionMeta}>{fmtInt(totals.kcal)} kcal logged</Text>
        </View>

        <View style={styles.meals}>
          {meals.map((meal) => (
            <MealCard key={meal.id} meal={meal} onPress={() => openMeal(meal)} />
          ))}

          {meals.length === 0 && (
            <Text style={styles.empty}>
              Nothing logged {isToday ? 'yet today' : 'on this day'}. Snap a photo of your meal to get started.
            </Text>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={() => nav.push({ name: 'capture', date, slot: nextSlot })}
            style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.6 }]}
          >
            <Feather name="plus" size={18} color={colors.accentText} />
            <Text style={styles.addText}>Add {nextSlot.toLowerCase()}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingTop: 16, gap: 20 },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  headerButtons: { flexDirection: 'row', gap: 8 },
  dateLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.ink, letterSpacing: -0.5 },
  banner: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.carbsSoft,
  },
  bannerText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.carbsInk },
  totalsCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  bars: { flex: 1, gap: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: -10 },
  sectionTitle: { fontFamily: fonts.displaySemibold, fontSize: 18, color: colors.ink },
  sectionMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  meals: { gap: 10 },
  empty: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted, paddingVertical: 8 },
  addButton: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  addText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.accentText },
});
