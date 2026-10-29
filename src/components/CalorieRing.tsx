import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { fmtInt } from '@/lib/format';
import { colors, fonts } from '@/theme';

type Props = { eaten: number; goal: number; size?: number };

export function CalorieRing({ eaten, goal, size = 132 }: Props) {
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = goal > 0 ? Math.min(eaten / goal, 1) : 0;
  const left = goal - eaten;
  const over = left < 0;

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityLabel={`${fmtInt(eaten)} of ${fmtInt(goal)} kcal eaten`}
    >
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={colors.track} strokeWidth={stroke} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={over ? colors.carbs : colors.ring}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * progress} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={styles.value}>{fmtInt(Math.abs(left))}</Text>
        <Text style={styles.label}>{over ? 'kcal over' : 'kcal left'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  value: { fontFamily: fonts.display, fontSize: 28, color: colors.ink, lineHeight: 32 },
  label: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
});
