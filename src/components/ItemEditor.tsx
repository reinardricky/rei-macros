import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Buttons';
import { fmtAmount, fmtInt } from '@/lib/format';
import type { Confidence, MealItem } from '@/lib/types';
import { colors, fonts } from '@/theme';

const CONFIDENCE: Record<Confidence, { label: string; color: string }> = {
  high: { label: 'High confidence', color: colors.accentText },
  medium: { label: 'Medium confidence', color: colors.carbsInk },
  low: { label: 'Low confidence, please check', color: colors.danger },
};

type ItemCardProps = {
  item: MealItem; // already scaled
  onLess: () => void;
  onMore: () => void;
  onRemove: () => void;
};

export function ItemCard({ item, onLess, onMore, onRemove }: ItemCardProps) {
  const conf = CONFIDENCE[item.confidence];
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.macros}>
            P {Math.round(item.protein)}g · C {Math.round(item.carbs)}g · F {Math.round(item.fat)}g
          </Text>
        </View>
        <Text style={styles.kcal}>{fmtInt(item.kcal)} kcal</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.name}`}
          onPress={onRemove}
          hitSlop={8}
          style={styles.remove}
        >
          <Feather name="trash-2" size={16} color={colors.muted} />
        </Pressable>
      </View>
      <View style={styles.bottom}>
        <Text style={[styles.conf, { color: conf.color }]}>{conf.label}</Text>
        <View style={styles.stepper}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Less ${item.name}`} onPress={onLess} style={styles.step}>
            <Feather name="minus" size={18} color={colors.ink} />
          </Pressable>
          <Text style={styles.amount}>{fmtAmount(item.amount, item.unit)}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`More ${item.name}`} onPress={onMore} style={styles.step}>
            <Feather name="plus" size={18} color={colors.ink} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

type AddItemFormProps = { onAdd: (item: MealItem) => void; onCancel: () => void };

const num = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/** Manual entry for something the AI missed. */
export function AddItemForm({ onAdd, onCancel }: AddItemFormProps) {
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const fields = [
    { label: 'kcal', value: kcal, set: setKcal },
    { label: 'Protein g', value: protein, set: setProtein },
    { label: 'Carbs g', value: carbs, set: setCarbs },
    { label: 'Fat g', value: fat, set: setFat },
  ];

  return (
    <View style={[styles.card, { gap: 12 }]}>
      <TextInput
        autoFocus
        value={name}
        onChangeText={setName}
        placeholder="Item name, e.g. Diet Coke"
        placeholderTextColor={colors.muted}
        style={styles.input}
        accessibilityLabel="Item name"
      />
      <View style={styles.grid}>
        {fields.map((f) => (
          <View key={f.label} style={styles.cell}>
            <Text style={styles.cellLabel}>{f.label}</Text>
            <TextInput
              value={f.value}
              onChangeText={f.set}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.muted}
              style={styles.input}
              accessibilityLabel={f.label}
            />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button title="Cancel" kind="secondary" onPress={onCancel} style={{ flex: 1, height: 44 }} />
        <Button
          title="Add item"
          disabled={!name.trim()}
          onPress={() =>
            onAdd({
              name: name.trim(),
              amount: 1,
              unit: 'serving',
              kcal: num(kcal),
              protein: num(protein),
              carbs: num(carbs),
              fat: num(fat),
              confidence: 'high',
            })
          }
          style={{ flex: 1, height: 44 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 18, padding: 14, gap: 10 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  name: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  macros: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  kcal: { fontFamily: fonts.displaySemibold, fontSize: 16, color: colors.ink },
  remove: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  conf: { fontFamily: fonts.semibold, fontSize: 12, flexShrink: 1 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bg,
    borderRadius: 22,
    padding: 2,
  },
  step: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amount: { minWidth: 76, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  grid: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1, gap: 4 },
  cellLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.muted },
  input: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.field,
    paddingHorizontal: 12,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
  },
});
