import Feather from '@expo/vector-icons/Feather';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/components/Buttons';
import { useSettings } from '@/hooks/useSettings';
import { aiProvider } from '@/lib/ai';
import { MEAL_SLOTS, slotForTime, type Analyzer, type MealSlot } from '@/lib/types';
import { useNav, useRoute } from '@/navigation';
import { colors, fonts } from '@/theme';

type Photo = { uri: string; width: number; height: number };

const ANALYZERS: { value: Analyzer; label: string; icon: 'cpu' | 'share' }[] = [
  { value: 'api', label: aiProvider.name, icon: 'cpu' },
  { value: 'claude-app', label: 'Claude app', icon: 'share' },
];

export function CaptureScreen() {
  const nav = useNav();
  const route = useRoute('capture');
  const date = route.date;
  const { settings, update } = useSettings();
  const analyzer = settings.analyzer;
  const analyzerName = analyzer === 'claude-app' ? 'Claude' : aiProvider.name;
  const [slot, setSlot] = useState<MealSlot>(route.slot ?? slotForTime(new Date()));
  const [note, setNote] = useState(route.note ?? '');
  const [describing, setDescribing] = useState(route.describe ?? false);
  const [flashOn, setFlashOn] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [taking, setTaking] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const goAnalyze = (photo?: Photo) => {
    nav.replace({
      name: analyzer === 'claude-app' ? 'claudeApp' : 'analyze',
      date,
      slot,
      note: note.trim(),
      ...(photo && { photo: { uri: photo.uri, width: photo.width, height: photo.height } }),
    });
  };

  const takePhoto = async () => {
    if (!cameraRef.current || !cameraReady || taking) return;
    setTaking(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const picture = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      goAnalyze(picture);
    } catch {
      setTaking(false);
    }
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!result.canceled && result.assets[0]) goAnalyze(result.assets[0]);
  };

  const granted = permission?.granted ?? false;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={styles.header}>
          <IconButton icon="x" label="Close camera" variant="dark" onPress={nav.back} />
          <Text style={styles.title} accessibilityRole="header">
            {describing ? 'Describe your meal' : 'Snap your meal'}
          </Text>
          {describing ? (
            <View style={{ width: 44 }} />
          ) : (
            <IconButton
              icon={flashOn ? 'zap' : 'zap-off'}
              label={flashOn ? 'Turn flash off' : 'Turn flash on'}
              variant="dark"
              onPress={() => setFlashOn((on) => !on)}
            />
          )}
        </View>

        <View style={styles.viewfinder}>
          {describing ? (
            <TextInput
              autoFocus
              multiline
              value={note}
              onChangeText={setNote}
              placeholder="e.g. Two scrambled eggs on sourdough toast with butter, and a flat white"
              placeholderTextColor={colors.cameraSub}
              style={styles.describeInput}
              accessibilityLabel="Meal description"
            />
          ) : permission === null ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : granted ? (
            <>
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing="back"
                flash={flashOn ? 'on' : 'off'}
                onCameraReady={() => setCameraReady(true)}
              />
              <View pointerEvents="none" style={styles.frame}>
                <View style={[styles.corner, styles.tl]} />
                <View style={[styles.corner, styles.tr]} />
                <View style={[styles.corner, styles.bl]} />
                <View style={[styles.corner, styles.br]} />
              </View>
            </>
          ) : (
            <View style={styles.permission}>
              <Feather name="camera-off" size={28} color={colors.cameraText} />
              <Text style={styles.permissionText}>
                Rei Macros needs the camera to photograph meals. You can still pick a photo or describe the meal.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
                style={styles.permissionButton}
              >
                <Text style={styles.permissionButtonText}>
                  {permission.canAskAgain ? 'Allow camera' : 'Open settings'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.controls}>
          <View style={styles.analyzerRow} accessibilityRole="radiogroup" accessibilityLabel="Analyze with">
            <Text style={styles.analyzerLabel}>Analyze with</Text>
            {ANALYZERS.map((a) => {
              const on = a.value === analyzer;
              return (
                <Pressable
                  key={a.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => update('analyzer', a.value)}
                  style={[styles.analyzer, on && styles.analyzerOn]}
                >
                  <Feather name={a.icon} size={14} color={on ? colors.onAccent : colors.cameraText} />
                  <Text style={[styles.slotText, on && styles.slotTextOn]}>{a.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.slots} accessibilityRole="radiogroup" accessibilityLabel="Meal">
            {MEAL_SLOTS.map((s) => {
              const on = s === slot;
              return (
                <Pressable
                  key={s}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => setSlot(s)}
                  style={[styles.slot, on && styles.slotOn]}
                >
                  <Text style={[styles.slotText, on && styles.slotTextOn]}>{s}</Text>
                </Pressable>
              );
            })}
          </View>

          {!describing && (
            <View style={{ gap: 6 }}>
              <Text style={styles.noteLabel}>Note for {analyzerName} (optional)</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="e.g. cooked in olive oil, about 1.5 cups rice"
                placeholderTextColor="#8A96A1"
                style={styles.noteInput}
                accessibilityLabel={`Note for ${analyzerName}`}
                returnKeyType="done"
              />
            </View>
          )}
        </View>

        <View style={styles.bottom}>
          <IconButton
            icon="image"
            label="Choose from photos"
            variant="dark"
            size={52}
            onPress={pickFromLibrary}
          />
          {describing ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !note.trim() }}
              disabled={!note.trim()}
              onPress={() => goAnalyze()}
              style={[styles.analyzeButton, !note.trim() && { opacity: 0.4 }]}
            >
              <Text style={styles.analyzeText}>Analyze</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Take photo"
              accessibilityState={{ disabled: !cameraReady, busy: taking }}
              disabled={!cameraReady || taking}
              onPress={takePhoto}
              style={({ pressed }) => [styles.shutter, (pressed || taking) && { opacity: 0.7 }]}
            >
              <View style={styles.shutterInner} />
            </Pressable>
          )}
          <IconButton
            icon={describing ? 'camera' : 'edit-3'}
            label={describing ? 'Use the camera instead' : 'Type a meal instead'}
            variant="dark"
            size={52}
            onPress={() => setDescribing((d) => !d)}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const CORNER = 32;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.camera },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  title: { fontFamily: fonts.displaySemibold, fontSize: 17, color: '#FFFFFF' },
  viewfinder: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 28,
    backgroundColor: colors.cameraPanel,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: { ...StyleSheet.absoluteFill, margin: 24 },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: colors.accent },
  tl: { left: 0, top: 0, borderLeftWidth: 3, borderTopWidth: 3, borderTopLeftRadius: 12 },
  tr: { right: 0, top: 0, borderRightWidth: 3, borderTopWidth: 3, borderTopRightRadius: 12 },
  bl: { left: 0, bottom: 0, borderLeftWidth: 3, borderBottomWidth: 3, borderBottomLeftRadius: 12 },
  br: { right: 0, bottom: 0, borderRightWidth: 3, borderBottomWidth: 3, borderBottomRightRadius: 12 },
  hint: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.cameraText,
  },
  describeInput: {
    alignSelf: 'stretch',
    flex: 1,
    padding: 20,
    fontFamily: fonts.regular,
    fontSize: 17,
    lineHeight: 24,
    color: '#FFFFFF',
    textAlignVertical: 'top',
  },
  permission: { alignItems: 'center', gap: 14, padding: 28 },
  permissionText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.cameraText,
    textAlign: 'center',
  },
  permissionButton: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: colors.accent,
    justifyContent: 'center',
  },
  permissionButtonText: { fontFamily: fonts.bold, fontSize: 14, color: colors.onAccent },
  controls: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },
  analyzerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  analyzerLabel: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.cameraSub,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  analyzer: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.cameraLine,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  analyzerOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  slots: { flexDirection: 'row', gap: 8 },
  slot: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.cameraLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  slotText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.cameraText },
  slotTextOn: { color: colors.onAccent },
  noteLabel: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.cameraSub,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  noteInput: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cameraLine,
    backgroundColor: colors.cameraField,
    color: '#FFFFFF',
    paddingHorizontal: 14,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingVertical: 20,
  },
  shutter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#FFFFFF' },
  analyzeButton: {
    height: 56,
    paddingHorizontal: 32,
    borderRadius: 28,
    backgroundColor: colors.accent,
    justifyContent: 'center',
  },
  analyzeText: { fontFamily: fonts.bold, fontSize: 16, color: colors.onAccent },
});
