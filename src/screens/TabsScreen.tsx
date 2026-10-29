import { StyleSheet, View } from 'react-native';

import { TabBar } from '@/components/TabBar';
import { todayKey } from '@/lib/dates';
import { FocusScope, useNav, useRoute } from '@/navigation';

import { HistoryScreen } from './HistoryScreen';
import { TodayScreen } from './TodayScreen';

/** Today and History, both kept mounted so switching tabs keeps their state. */
export function TabsScreen() {
  const route = useRoute('tabs');
  const nav = useNav();

  return (
    <View style={styles.screen}>
      <View style={styles.body}>
        <FocusScope focused={route.tab === 'today'}>
          <View style={[StyleSheet.absoluteFill, route.tab !== 'today' && styles.hidden]}>
            <TodayScreen />
          </View>
        </FocusScope>
        <FocusScope focused={route.tab === 'history'}>
          <View style={[StyleSheet.absoluteFill, route.tab !== 'history' && styles.hidden]}>
            <HistoryScreen />
          </View>
        </FocusScope>
      </View>
      <TabBar
        tab={route.tab}
        onSelect={(tab) => nav.update({ ...route, tab })}
        onCamera={() => nav.push({ name: 'capture', date: todayKey() })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1 },
  hidden: { display: 'none' },
});
