import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import type { MealSlot } from './lib/types';

/** Every screen and the data it opens with. */
export type Route =
  | { name: 'tabs'; tab: 'today' | 'history'; date?: string; at?: number }
  | { name: 'capture'; date: string; slot?: MealSlot; note?: string; describe?: boolean }
  | {
      name: 'analyze';
      date: string;
      slot: MealSlot;
      note: string;
      photo?: { uri: string; width: number; height: number };
    }
  | { name: 'settings' };

export type RouteName = Route['name'];
type RouteOf<N extends RouteName> = Extract<Route, { name: N }>;

type Nav = {
  push: (route: Route) => void;
  /** Swap the top screen for a new one (it mounts fresh). */
  replace: (route: Route) => void;
  /** Change the top screen's route data in place, keeping its state (e.g. switching tabs). */
  update: (route: Route) => void;
  back: () => void;
};

const NavContext = createContext<Nav | null>(null);
const ScreenContext = createContext<{ route: Route; focused: boolean } | null>(null);

export function useNav(): Nav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error('useNav must be used inside <Navigator>');
  return nav;
}

/** The route this screen was opened with. */
export function useRoute<N extends RouteName>(name: N): RouteOf<N> {
  const screen = useContext(ScreenContext);
  if (!screen || screen.route.name !== name) throw new Error(`useRoute('${name}') used outside that screen`);
  return screen.route as RouteOf<N>;
}

export function useIsFocused(): boolean {
  return useContext(ScreenContext)?.focused ?? false;
}

/** Runs `effect` each time the screen comes to the front (and cleans up when it leaves). */
export function useFocusEffect(effect: () => void | (() => void)) {
  const focused = useIsFocused();
  useEffect(() => {
    if (focused) return effect();
  }, [focused, effect]);
}

/** Lets a nested area (like one tab) narrow the focus of its parent screen. */
export function FocusScope({ focused, children }: { focused: boolean; children: ReactNode }) {
  const screen = useContext(ScreenContext);
  const value = useMemo(
    () => (screen ? { route: screen.route, focused: screen.focused && focused } : null),
    [screen, focused],
  );
  return <ScreenContext.Provider value={value}>{children}</ScreenContext.Provider>;
}

type Entry = { key: number; route: Route };

/**
 * A minimal stack navigator. Screens below the top stay mounted (hidden) so
 * they keep their state, and Android's back button pops the stack.
 */
export function Navigator({
  initial,
  renderScreen,
}: {
  initial: Route;
  renderScreen: (route: Route) => ReactNode;
}) {
  const nextKey = useRef(1);
  const [stack, setStack] = useState<Entry[]>(() => [{ key: 0, route: initial }]);

  const nav = useMemo<Nav>(
    () => ({
      push: (route) => setStack((s) => [...s, { key: nextKey.current++, route }]),
      replace: (route) => setStack((s) => [...s.slice(0, -1), { key: nextKey.current++, route }]),
      update: (route) => setStack((s) => [...s.slice(0, -1), { key: s[s.length - 1].key, route }]),
      back: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
    }),
    [],
  );

  const top = stack[stack.length - 1].route;

  const onHardwareBack = useCallback(() => {
    if (stack.length > 1) {
      nav.back();
      return true;
    }
    if (top.name === 'tabs' && top.tab !== 'today') {
      nav.update({ ...top, tab: 'today' });
      return true;
    }
    return false; // let Android close the app
  }, [stack.length, top, nav]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
  }, [onHardwareBack]);

  return (
    <NavContext.Provider value={nav}>
      {stack.map((entry, i) => {
        const focused = i === stack.length - 1;
        return (
          <ScreenContext.Provider key={entry.key} value={{ route: entry.route, focused }}>
            <View style={[StyleSheet.absoluteFill, !focused && styles.hidden]}>{renderScreen(entry.route)}</View>
          </ScreenContext.Provider>
        );
      })}
    </NavContext.Provider>
  );
}

const styles = StyleSheet.create({
  hidden: { display: 'none' },
});
