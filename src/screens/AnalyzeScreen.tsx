import Feather from '@expo/vector-icons/Feather';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/Buttons';
import { AddItemForm, ItemCard } from '@/components/ItemEditor';
import { aiProvider, AnalysisError, analyzeMeal, type MealAnalysis } from '@/lib/ai';
import { timestampOn, todayKey } from '@/lib/dates';
import { getSettings, insertMeal } from '@/lib/db';
import { fmtInt } from '@/lib/format';
import { keepPhoto, preparePhoto, type PreparedPhoto } from '@/lib/photos';
import { sumMacros, type MealItem } from '@/lib/types';
import { useNav, useRoute } from '@/navigation';
import { colors, fonts } from '@/theme';

type Phase = 'preparing' | 'asking' | 'review' | 'error';
type EditableItem = { base: MealItem; mult: number };

const round1 = (n: number) => Math.round(n * 10) / 10;

function scale({ base, mult }: EditableItem): MealItem {
  return {
    ...base,
    amount: round1(base.amount * mult),
    kcal: round1(base.kcal * mult),
    protein: round1(base.protein * mult),
    carbs: round1(base.carbs * mult),
    fat: round1(base.fat * mult),
  };
}

export function AnalyzeScreen() {
  const db = useSQLiteContext();
  const nav = useNav();
  const route = useRoute('analyze');
  const { date, slot, note, photo: source, result } = route;
  const photoUri = source?.uri;

  // With a `result` (pasted from the Claude app) there's nothing to analyze: start at review.
  const [phase, setPhase] = useState<Phase>(result ? 'review' : photoUri ? 'preparing' : 'asking');
  const [error, setError] = useState<AnalysisError | null>(null);
  const [photo, setPhoto] = useState<{ uri: string } | null>(result && source ? { uri: source.uri } : null);
  const [mealName, setMealName] = useState(result?.mealName ?? '');
  const [notes, setNotes] = useState(result?.notes ?? '');
  const [items, setItems] = useState<EditableItem[]>(() => result?.items.map((base) => ({ base, mult: 1 })) ?? []);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const save = useCallback(
    async (analysis: { mealName: string; items: MealItem[] }, prepared: { uri: string } | null) => {
      const settings = await getSettings(db);
      await insertMeal(db, {
        date,
        slot,
        name: analysis.mealName.trim() || slot,
        eatenAt: date === todayKey() ? new Date().toISOString() : timestampOn(date),
        photoUri: settings.keepPhotos && prepared ? keepPhoto(prepared.uri) : null,
        note: note || null,
        items: analysis.items,
      });
    },
    [db, date, slot, note],
  );

  /** Resize the photo (if any), then ask the AI. Reports the prepared photo as soon as it's ready. */
  const runAnalysis = useCallback(
    async (signal: AbortSignal, onPrepared: (photo: PreparedPhoto) => void) => {
      let prepared: PreparedPhoto | null = null;
      if (source) {
        prepared = await preparePhoto(source.uri, source.width, source.height);
        onPrepared(prepared);
      }
      const analysis = await analyzeMeal({ imageBase64: prepared?.base64, note, slot }, signal);
      return { prepared, analysis };
    },
    [note, slot, source],
  );

  // Expects `phase` to already be 'preparing' (photo) or 'asking' (description).
  const analyze = useCallback(
    (controller: AbortController) =>
      runAnalysis(controller.signal, (prepared) => {
        setPhoto(prepared);
        setPhase('asking');
      })
        .then(async ({ prepared, analysis }: { prepared: PreparedPhoto | null; analysis: MealAnalysis }) => {
          if (controller.signal.aborted) return;
          const settings = await getSettings(db);
          if (!settings.reviewBeforeLogging) {
            await save(analysis, prepared);
            nav.back();
            return;
          }
          setMealName(analysis.mealName);
          setNotes(analysis.notes);
          setItems(analysis.items.map((base) => ({ base, mult: 1 })));
          setPhase('review');
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted) return;
          setError(e instanceof AnalysisError ? e : new AnalysisError('api', e instanceof Error ? e.message : String(e)));
          setPhase('error');
        }),
    [db, nav, runAnalysis, save],
  );

  useEffect(() => {
    if (result) return;
    const controller = new AbortController();
    abortRef.current = controller;
    analyze(controller);
    return () => controller.abort();
  }, [analyze, result]);

  const retry = () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setPhase(photoUri ? 'preparing' : 'asking');
    analyze(controller);
  };

  const cancel = () => {
    abortRef.current?.abort();
    nav.back();
  };

  const retake = () => {
    abortRef.current?.abort();
    nav.replace({ name: 'capture', date, slot, note, describe: !photoUri });
  };

  const switchToClaudeApp = () => {
    abortRef.current?.abort();
    nav.replace({ name: 'claudeApp', date, slot, note, photo: source });
  };

  const scaled = items.map(scale);
  const totals = sumMacros(scaled);

  const onSave = async () => {
    setSaving(true);
    try {
      await save({ mealName, items: scaled }, photo);
      nav.back();
    } catch (e) {
      setSaving(false);
      setError(new AnalysisError('api', e instanceof Error ? e.message : 'Could not save the meal.'));
    }
  };

  const nudge = (index: number, delta: number) =>
    setItems((list) =>
      list.map((it, i) => (i === index ? { ...it, mult: Math.max(0.25, Math.round((it.mult + delta) * 100) / 100) } : it)),
    );

  if (phase === 'preparing' || phase === 'asking' || phase === 'error') {
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.waitContent}>
          <View style={styles.preview}>
            {photoUri ? (
              <Image source={{ uri: photo?.uri ?? photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <Text style={styles.previewText}>“{note}”</Text>
            )}
          </View>

          {phase === 'error' && error ? (
            <View style={{ gap: 14 }}>
              <Text style={styles.waitTitle} accessibilityRole="header">
                {error.kind === 'not_food' ? 'No food found' : "That didn't work"}
              </Text>
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={18} color={colors.danger} />
                <Text style={styles.errorText}>{error.message}</Text>
              </View>
            </View>
          ) : (
            <>
              <View style={{ gap: 6 }}>
                <Text style={styles.waitTitle} accessibilityRole="header">
                  {aiProvider.name} is reading your {photoUri ? 'plate' : 'description'}
                </Text>
                <Text style={styles.waitSub}>
                  This usually takes 5–30 seconds, longer when Google&apos;s free tier is busy. You can edit
                  anything before it&apos;s logged.
                </Text>
              </View>
              <View style={styles.steps}>
                {photoUri && <Step label="Preparing photo" state={phase === 'preparing' ? 'active' : 'done'} />}
                <Step
                  label="Identifying foods & portions"
                  state={phase === 'asking' ? 'active' : 'pending'}
                  detail={phase === 'asking' ? <ElapsedSeconds /> : null}
                />
                <Step label="Calculating macros" state="pending" last />
              </View>
            </>
          )}
        </ScrollView>
        <View style={styles.waitFooter}>
          <Pressable accessibilityRole="button" onPress={switchToClaudeApp} style={styles.altButton}>
            <Feather name="share" size={16} color={colors.accentText} />
            <Text style={styles.altText}>Use the Claude app instead</Text>
          </Pressable>
          <View style={styles.footerRow}>
            {phase === 'error' ? (
              <>
                <Button title={photoUri ? 'Retake' : 'Edit'} kind="secondary" onPress={retake} style={{ flex: 1 }} />
                {error?.kind !== 'missing_key' && error?.kind !== 'not_food' && (
                  <Button title="Try again" onPress={retry} style={{ flex: 1 }} />
                )}
              </>
            ) : (
              <Button title="Cancel" kind="secondary" onPress={cancel} style={{ flex: 1 }} />
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={styles.header}>
          <IconButton icon="x" label="Discard and close" variant="ghost" onPress={cancel} />
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} accessibilityRole="header">
              Review {slot.toLowerCase()}
            </Text>
            <Text style={styles.headerSub}>Tap − / + to adjust portions</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.reviewContent} keyboardShouldPersistTaps="handled">
          <View style={styles.totalCard}>
            {photo && <Image source={{ uri: photo.uri }} style={styles.thumb} accessibilityLabel="Meal photo" />}
            <View style={{ flex: 1, gap: 8 }}>
              <TextInput
                value={mealName}
                onChangeText={setMealName}
                style={styles.mealName}
                accessibilityLabel="Meal name"
                placeholder={slot}
                placeholderTextColor={colors.muted}
              />
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Text style={styles.totalKcal}>{fmtInt(totals.kcal)}</Text>
                <Text style={styles.totalUnit}>kcal</Text>
              </View>
              <View style={styles.chips}>
                <Text style={[styles.chip, { backgroundColor: colors.proteinSoft, color: colors.proteinInk }]}>
                  P {Math.round(totals.protein)}g
                </Text>
                <Text style={[styles.chip, { backgroundColor: colors.carbsSoft, color: colors.carbsInk }]}>
                  C {Math.round(totals.carbs)}g
                </Text>
                <Text style={[styles.chip, { backgroundColor: colors.fatSoft, color: colors.fatInk }]}>
                  F {Math.round(totals.fat)}g
                </Text>
              </View>
            </View>
          </View>

          {notes ? (
            <View style={styles.callout}>
              <Feather name="info" size={16} color={colors.softInk} style={{ marginTop: 2 }} />
              <Text style={styles.calloutText}>{notes}</Text>
            </View>
          ) : null}

          {error && (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{error.message}</Text>
            </View>
          )}

          {scaled.map((item, i) => (
            <ItemCard
              key={`${items[i].base.name}-${i}`}
              item={item}
              onLess={() => nudge(i, -0.25)}
              onMore={() => nudge(i, 0.25)}
              onRemove={() => setItems((list) => list.filter((_, j) => j !== i))}
            />
          ))}

          {adding ? (
            <AddItemForm
              onCancel={() => setAdding(false)}
              onAdd={(base) => {
                setItems((list) => [...list, { base, mult: 1 }]);
                setAdding(false);
              }}
            />
          ) : (
            <Pressable accessibilityRole="button" onPress={() => setAdding(true)} style={styles.addButton}>
              <Text style={styles.addText}>+ Add a missed item</Text>
            </Pressable>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Button title="Retake" kind="secondary" onPress={retake} style={{ flex: 1 }} />
          <Button
            title={`Add to ${slot}`}
            onPress={onSave}
            loading={saving}
            disabled={items.length === 0}
            style={{ flex: 2 }}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Seconds since it mounted, so a slow answer doesn't look frozen. */
function ElapsedSeconds() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return <Text style={styles.stepDetail}>{seconds}s</Text>;
}

function Step({
  label,
  state,
  last,
  detail,
}: {
  label: string;
  state: 'done' | 'active' | 'pending';
  last?: boolean;
  detail?: React.ReactNode;
}) {
  return (
    <View style={[styles.step, !last && styles.stepDivider]}>
      {state === 'done' ? (
        <View style={styles.stepDone}>
          <Feather name="check" size={16} color={colors.onAccent} />
        </View>
      ) : state === 'active' ? (
        <ActivityIndicator color={colors.ring} style={{ width: 28, height: 28 }} />
      ) : (
        <View style={styles.stepPending} />
      )}
      <Text style={[styles.stepLabel, state === 'pending' && { color: colors.muted }]}>{label}</Text>
      {detail}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  waitContent: { padding: 20, gap: 24 },
  preview: {
    height: 300,
    borderRadius: 28,
    backgroundColor: colors.cameraPanel,
    overflow: 'hidden',
    justifyContent: 'center',
    padding: 24,
  },
  previewText: { fontFamily: fonts.medium, fontSize: 18, lineHeight: 26, color: '#FFFFFF' },
  waitTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.ink, letterSpacing: -0.3 },
  waitSub: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
  steps: { backgroundColor: colors.surface, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 6 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  stepDivider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  stepDone: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPending: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.track },
  stepLabel: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  stepDetail: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  waitFooter: { gap: 6, padding: 20, paddingTop: 8 },
  footerRow: { flexDirection: 'row', gap: 10 },
  altButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  altText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.accentText },
  errorBox: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.dangerSoft,
  },
  errorText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.danger },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  headerSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  reviewContent: { padding: 20, paddingTop: 8, gap: 12 },
  totalCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  thumb: { width: 84, height: 84, borderRadius: 18, backgroundColor: colors.cameraPanel },
  mealName: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.ink,
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingBottom: 4,
  },
  totalKcal: { fontFamily: fonts.display, fontSize: 34, color: colors.ink, lineHeight: 38 },
  totalUnit: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  chips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: {
    fontFamily: fonts.bold,
    fontSize: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  callout: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 16, backgroundColor: colors.soft },
  calloutText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.softInk },
  addButton: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.accentText },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
