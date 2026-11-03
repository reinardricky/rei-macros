import Feather from '@expo/vector-icons/Feather';
import { useEffect, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/Buttons';
import { clockTime } from '@/lib/dates';
import { fmtAmount, fmtGrams1, fmtInt } from '@/lib/format';
import { sumMacros, type Macros, type Meal } from '@/lib/types';
import { colors, fonts } from '@/theme';

type Props = {
  /** The meal to show; null hides the sheet. */
  meal: Meal | null;
  onClose: () => void;
  onDelete: (meal: Meal) => void;
};

/** Pull at least this far (or flick down) to close. */
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 1;

/** Bottom sheet with a logged meal's totals and every item's macros. Drag the top part down to close. */
export function MealSheet({ meal, onClose, onDelete }: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  // Keep showing the last meal while the sheet slides out after `meal` goes null.
  const [shown, setShown] = useState(meal);
  const [confirming, setConfirming] = useState(false);
  if (meal && meal !== shown) {
    setShown(meal);
    setConfirming(false);
  }

  // How far the sheet sits below its resting place, in px. The backdrop dims with it.
  const [offset] = useState(() => new Animated.Value(windowHeight));
  const [sheetHeight, setSheetHeight] = useState(windowHeight);
  const visible = meal !== null;
  useEffect(() => {
    if (!visible) {
      offset.setValue(windowHeight);
      return;
    }
    Animated.spring(offset, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
  }, [visible, offset, windowHeight]);

  /** Slide out, then tell the parent (which hides the modal). */
  const dismiss = (then: () => void = onClose) => {
    Animated.timing(offset, { toValue: sheetHeight, duration: 200, useNativeDriver: true }).start(() => {
      // Reopening the same meal shouldn't land on a half-finished delete.
      setConfirming(false);
      then();
    });
  };

  // Recreated each render so it always sees the current `dismiss`; nothing re-renders mid-drag.
  const pan = PanResponder.create({
    // Claim only real vertical drags, so taps still reach the close button.
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => offset.setValue(Math.max(0, g.dy)),
    onPanResponderRelease: (_, g) => {
      if (g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY) dismiss();
      else Animated.spring(offset, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
    },
    onPanResponderTerminate: () =>
      Animated.spring(offset, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start(),
  });

  if (!shown) return null;
  const totals = sumMacros(shown.items);
  const close = () => dismiss();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}
    >
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.backdrop,
            { opacity: offset.interpolate({ inputRange: [0, sheetHeight], outputRange: [1, 0], extrapolate: 'clamp' }) },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close meal details" />
        </Animated.View>
        <Animated.View
          onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
          style={[styles.sheet, { paddingBottom: insets.bottom + 16 }, { transform: [{ translateY: offset }] }]}
        >
          {/* The drag area: handle plus header. The item list below scrolls normally. */}
          <View {...pan.panHandlers} style={styles.grab}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <View style={styles.thumb}>
                {shown.photoUri ? (
                  <Image source={{ uri: shown.photoUri }} style={styles.photo} accessibilityLabel="Meal photo" />
                ) : (
                  <Feather name="disc" size={24} color={colors.softInk} />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={styles.slot}>
                  {shown.slot} · {clockTime(shown.eatenAt)}
                </Text>
                <Text style={styles.name} accessibilityRole="header">
                  {shown.name}
                </Text>
              </View>
              <IconButton icon="x" label="Close" variant="ghost" size={40} onPress={close} />
            </View>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <View style={styles.totalCard}>
              <View style={styles.kcalRow}>
                <Text style={styles.totalKcal}>{fmtInt(totals.kcal)}</Text>
                <Text style={styles.totalUnit}>kcal</Text>
              </View>
              <MacroChips macros={totals} />
            </View>

            {shown.note ? (
              <View style={styles.callout}>
                <Feather name="message-square" size={16} color={colors.softInk} style={{ marginTop: 2 }} />
                <Text style={styles.calloutText}>{shown.note}</Text>
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>
              {shown.items.length} {shown.items.length === 1 ? 'item' : 'items'}
            </Text>
            <View style={styles.items}>
              {shown.items.map((item, i) => (
                <View key={`${item.name}-${i}`} style={[styles.item, i < shown.items.length - 1 && styles.divider]}>
                  <View style={styles.itemTop}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemAmount}>{fmtAmount(item.amount, item.unit)}</Text>
                    </View>
                    <Text style={styles.itemKcal}>{fmtInt(item.kcal)} kcal</Text>
                  </View>
                  <MacroChips macros={item} small />
                </View>
              ))}
            </View>
          </ScrollView>

          {confirming ? (
            <View style={{ gap: 10 }}>
              <Text style={styles.confirmText}>Delete this meal? This can&apos;t be undone.</Text>
              <View style={styles.footer}>
                <Button title="Keep it" kind="secondary" onPress={() => setConfirming(false)} style={{ flex: 1 }} />
                <Button title="Delete" kind="danger" onPress={() => dismiss(() => onDelete(shown))} style={{ flex: 1 }} />
              </View>
            </View>
          ) : (
            <View style={styles.footer}>
              <Button title="Delete" kind="danger" onPress={() => setConfirming(true)} style={{ flex: 1 }} />
              <Button title="Done" onPress={close} style={{ flex: 2 }} />
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const MACROS: { key: keyof Omit<Macros, 'kcal'>; label: string; bg: string; ink: string; dot: string }[] = [
  { key: 'protein', label: 'Protein', bg: colors.proteinSoft, ink: colors.proteinInk, dot: colors.protein },
  { key: 'carbs', label: 'Carbs', bg: colors.carbsSoft, ink: colors.carbsInk, dot: colors.carbs },
  { key: 'fat', label: 'Fat', bg: colors.fatSoft, ink: colors.fatInk, dot: colors.fat },
];

function MacroChips({ macros, small }: { macros: Macros; small?: boolean }) {
  return (
    <View style={styles.chips}>
      {MACROS.map((m) => (
        <View
          key={m.key}
          style={[styles.chip, small && styles.chipSmall, { backgroundColor: m.bg }]}
          accessibilityLabel={`${m.label} ${fmtGrams1(macros[m.key])}`}
        >
          <View style={[styles.chipDot, { backgroundColor: m.dot }]} />
          <Text style={[styles.chipLabel, { color: m.ink }]}>{small ? m.label[0] : m.label}</Text>
          <Text style={[styles.chipValue, small && styles.chipValueSmall, { color: m.ink }]}>
            {fmtGrams1(macros[m.key])}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(14, 28, 42, 0.45)' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    gap: 14,
  },
  // Padded up to the sheet's top edge so the whole strip is easy to grab.
  grab: { paddingTop: 10, gap: 14 },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.dashed },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: { width: 60, height: 60 },
  slot: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  name: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, letterSpacing: -0.3 },
  scroll: { flexGrow: 0 },
  scrollContent: { gap: 12, paddingBottom: 4 },
  totalCard: { backgroundColor: colors.surface, borderRadius: 22, padding: 16, gap: 12 },
  kcalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  totalKcal: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: colors.ink },
  totalUnit: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  chips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipSmall: { paddingHorizontal: 8, paddingVertical: 3 },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipLabel: { fontFamily: fonts.medium, fontSize: 12 },
  chipValue: { fontFamily: fonts.bold, fontSize: 13 },
  chipValueSmall: { fontSize: 12 },
  callout: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 16, backgroundColor: colors.soft },
  calloutText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.softInk },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 4,
  },
  items: { backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 16 },
  item: { paddingVertical: 14, gap: 8 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  itemName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  itemAmount: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  itemKcal: { fontFamily: fonts.displaySemibold, fontSize: 15, color: colors.ink },
  confirmText: { fontFamily: fonts.medium, fontSize: 14, color: colors.danger, textAlign: 'center' },
  footer: { flexDirection: 'row', gap: 10 },
});
