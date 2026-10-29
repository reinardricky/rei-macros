import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { DEFAULT_SETTINGS, getSettings, saveSetting } from '@/lib/db';
import type { Settings } from '@/lib/types';
import { useFocusEffect } from '@/navigation';

/** Settings from SQLite, reloaded whenever the screen gains focus. */
export function useSettings() {
  const db = useSQLiteContext();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getSettings(db).then((s) => {
        if (!active) return;
        setSettings(s);
        setLoaded(true);
      });
      return () => {
        active = false;
      };
    }, [db]),
  );

  const update = useCallback(
    async <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setSettings((s) => ({ ...s, [key]: value }));
      await saveSetting(db, key, value);
    },
    [db],
  );

  return { settings, loaded, update };
}
