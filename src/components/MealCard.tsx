import Feather from '@expo/vector-icons/Feather';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { clockTime } from '@/lib/dates';
import { fmtInt } from '@/lib/format';
import { sumMacros, type Meal } from '@/lib/types';
import { colors, fonts } from '@/theme';

type Props = { meal: Meal; onPress: () => void };

export function MealCard({ meal, onPress }: Props) {
  const totals = sumMacros(meal.items);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${meal.slot}, ${meal.name}, ${fmtInt(totals.kcal)} kcal`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.thumb}>
        {meal.photoUri ? (
          <Image source={{ uri: meal.photoUri }} style={styles.photo} />
        ) : (
          <Feather name="disc" size={22} color={colors.softInk} />
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.slot}>
          {meal.slot} · {clockTime(meal.eatenAt)}
        </Text>
        <Text style={styles.name} numberOfLines={1}>
          {meal.name}
        </Text>
        <Text style={styles.macros}>
          P {Math.round(totals.protein)}g · C {Math.round(totals.carbs)}g · F {Math.round(totals.fat)}g
        </Text>
      </View>
      <Text style={styles.kcal}>{fmtInt(totals.kcal)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: { width: 52, height: 52 },
  body: { flex: 1, minWidth: 0, gap: 2 },
  slot: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  name: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  macros: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  kcal: { fontFamily: fonts.displaySemibold, fontSize: 16, color: colors.ink },
});
