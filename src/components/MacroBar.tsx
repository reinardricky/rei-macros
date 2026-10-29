import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

type Props = { label: string; value: number; goal: number; color: string };

export function MacroBar({ label, value, goal, color }: Props) {
  const pct = goal > 0 ? Math.min(value / goal, 1) * 100 : 0;
  return (
    <View style={styles.wrap} accessible accessibilityLabel={`${label}: ${Math.round(value)} of ${goal} grams`}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>
          {Math.round(value)} / {goal}g
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  value: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
});
