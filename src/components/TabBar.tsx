import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts } from '@/theme';

export type Tab = 'today' | 'history';

const TABS: { tab: Tab; title: string; icon: ComponentProps<typeof Feather>['name'] }[] = [
  { tab: 'today', title: 'Today', icon: 'clock' },
  { tab: 'history', title: 'History', icon: 'bar-chart-2' },
];

type Props = { tab: Tab; onSelect: (tab: Tab) => void; onCamera: () => void };

/** Today · camera button · History, as in the mockups. */
export function TabBar({ tab, onSelect, onCamera }: Props) {
  const insets = useSafeAreaInsets();

  const renderTab = ({ tab: t, title, icon }: (typeof TABS)[number]) => {
    const focused = t === tab;
    const color = focused ? colors.accentText : colors.muted;
    return (
      <Pressable
        key={t}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={title}
        onPress={() => !focused && onSelect(t)}
        style={styles.tab}
      >
        <Feather name={icon} size={22} color={color} />
        <Text style={[styles.tabLabel, { color }, focused && { fontFamily: fonts.bold }]}>{title}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist">
      {renderTab(TABS[0])}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Snap a meal"
        onPress={onCamera}
        style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.95 }] }]}
      >
        <Feather name="camera" size={26} color={colors.onAccent} />
      </Pressable>
      {renderTab(TABS[1])}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 8,
  },
  tab: { width: 72, minHeight: 48, alignItems: 'center', gap: 4 },
  tabLabel: { fontFamily: fonts.semibold, fontSize: 11 },
  fab: {
    width: 64,
    height: 64,
    marginTop: -30,
    borderRadius: 32,
    backgroundColor: colors.accent,
    borderWidth: 4,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: colors.ring,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
});
