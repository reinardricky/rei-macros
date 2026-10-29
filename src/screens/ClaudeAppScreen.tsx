import Feather from '@expo/vector-icons/Feather';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/Buttons';
import { AnalysisError } from '@/lib/ai';
import { buildClaudeAppPrompt, parseClaudeReply } from '@/lib/ai/claudeApp';
import { preparePhoto } from '@/lib/photos';
import { useNav, useRoute, type PhotoRef } from '@/navigation';
import { colors, fonts } from '@/theme';

/** Analyze a meal with the user's own Claude plan by handing off to the Claude app. */
export function ClaudeAppScreen() {
  const nav = useNav();
  const route = useRoute('claudeApp');
  const { date, slot, note, photo } = route;

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [prepared, setPrepared] = useState<PhotoRef | null>(null);
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);

  const prompt = buildClaudeAppPrompt({ slot, note, hasPhoto: Boolean(photo) });

  const send = async () => {
    setError(null);
    setSending(true);
    try {
      await Clipboard.setStringAsync(prompt);
      if (photo) {
        // Share the same resized JPEG the app would send to Gemini.
        const small = prepared ?? { ...photo, uri: (await preparePhoto(photo.uri, photo.width, photo.height)).uri };
        setPrepared(small);
        await Sharing.shareAsync(small.uri, { mimeType: 'image/jpeg', dialogTitle: 'Send the photo to Claude' });
      } else {
        await Share.share({ message: prompt });
      }
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the share menu.');
    } finally {
      setSending(false);
    }
  };

  const applyReply = (text: string) => {
    setError(null);
    try {
      const result = parseClaudeReply(text);
      nav.replace({ name: 'analyze', date, slot, note, photo: prepared ?? photo, result });
    } catch (e) {
      setError(e instanceof AnalysisError ? e.message : String(e));
    }
  };

  const pasteFromClipboard = async () => {
    const text = await Clipboard.getStringAsync();
    if (!text.trim()) {
      setError("The clipboard is empty. In Claude, tap Copy under its reply, then come back.");
      return;
    }
    setReply(text);
    applyReply(text);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={styles.header}>
          <IconButton icon="x" label="Close" variant="ghost" onPress={nav.back} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title} accessibilityRole="header">
              Ask the Claude app
            </Text>
            <Text style={styles.sub}>Uses your own Claude plan · no API key</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.preview}>
            {photo ? (
              <Image source={{ uri: (prepared ?? photo).uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <Text style={styles.previewText}>“{note}”</Text>
            )}
          </View>

          <View style={styles.card}>
            <StepTitle n={1} done={sent} title="Send it to Claude" />
            <Text style={styles.body}>
              {photo
                ? 'The prompt gets copied. Pick Claude in the share menu, then long-press the message box, tap Paste, and send.'
                : 'Pick Claude in the share menu and send the message.'}
            </Text>
            <Button
              title={sent ? 'Send again' : photo ? 'Copy prompt & share photo' : 'Share with Claude'}
              kind={sent ? 'secondary' : 'primary'}
              loading={sending}
              onPress={send}
            />
          </View>

          <View style={styles.card}>
            <StepTitle n={2} done={false} title="Bring Claude's answer back" />
            <Text style={styles.body}>When Claude replies, tap Copy under its answer, then come back here.</Text>
            <Button title="Paste Claude's reply" kind={sent ? 'primary' : 'secondary'} onPress={pasteFromClipboard} />
            <TextInput
              value={reply}
              onChangeText={setReply}
              multiline
              placeholder="…or paste the reply here yourself"
              placeholderTextColor={colors.muted}
              style={styles.replyInput}
              accessibilityLabel="Claude's reply"
            />
            {reply.trim() !== '' && <Button title="Use this reply" kind="secondary" onPress={() => applyReply(reply)} />}
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StepTitle({ n, done, title }: { n: number; done: boolean; title: string }) {
  return (
    <View style={styles.stepTitle}>
      <View style={[styles.badge, done && styles.badgeDone]}>
        {done ? (
          <Feather name="check" size={14} color={colors.onAccent} />
        ) : (
          <Text style={styles.badgeText}>{n}</Text>
        )}
      </View>
      <Text style={styles.stepText}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8 },
  title: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  content: { padding: 20, paddingTop: 8, gap: 14 },
  preview: {
    height: 180,
    borderRadius: 24,
    backgroundColor: colors.cameraPanel,
    overflow: 'hidden',
    justifyContent: 'center',
    padding: 20,
  },
  previewText: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 23, color: '#FFFFFF' },
  card: { backgroundColor: colors.surface, borderRadius: 22, padding: 16, gap: 12 },
  stepTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDone: { backgroundColor: colors.accent },
  badgeText: { fontFamily: fonts.bold, fontSize: 13, color: colors.softInk },
  stepText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
  replyInput: {
    minHeight: 80,
    maxHeight: 180,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.field,
    padding: 12,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  errorBox: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 16, backgroundColor: colors.dangerSoft },
  errorText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.danger },
});
