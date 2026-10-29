import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DATABASE_NAME, migrateDbIfNeeded } from './src/lib/db';
import { Navigator, type Route } from './src/navigation';
import { AnalyzeScreen } from './src/screens/AnalyzeScreen';
import { CaptureScreen } from './src/screens/CaptureScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { TabsScreen } from './src/screens/TabsScreen';
import { colors } from './src/theme';

function renderScreen(route: Route) {
  switch (route.name) {
    case 'tabs':
      return <TabsScreen />;
    case 'capture':
      return <CaptureScreen />;
    case 'analyze':
      return <AnalyzeScreen />;
    case 'settings':
      return <SettingsScreen />;
  }
}

export default function App() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View style={styles.root}>
        {fontsLoaded && (
          <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded}>
            <Navigator initial={{ name: 'tabs', tab: 'today' }} renderScreen={renderScreen} />
          </SQLiteProvider>
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
