import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts } from '@/theme';

type IconName = ComponentProps<typeof Feather>['name'];

type IconButtonProps = {
  icon: IconName;
  label: string;
  onPress: () => void;
  variant?: 'outline' | 'ghost' | 'dark';
  size?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Round 44px icon-only button (always has an accessibility label). */
export function IconButton({ icon, label, onPress, variant = 'outline', size = 44, disabled, style }: IconButtonProps) {
  const variantStyle =
    variant === 'outline' ? styles.iconOutline : variant === 'dark' ? styles.iconDark : styles.iconGhost;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      style={({ pressed }) => [
        styles.icon,
        { width: size, height: size, borderRadius: size / 2 },
        variantStyle,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Feather name={icon} size={20} color={variant === 'dark' ? '#FFFFFF' : colors.ink} />
    </Pressable>
  );
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, onPress, kind = 'primary', loading, disabled, style }: ButtonProps) {
  const isPrimary = kind === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        isPrimary ? styles.primary : kind === 'danger' ? styles.danger : styles.secondary,
        (pressed || disabled) && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.onAccent : colors.ink} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            isPrimary && styles.primaryText,
            kind === 'danger' && { color: colors.danger },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  icon: { alignItems: 'center', justifyContent: 'center' },
  iconOutline: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  iconGhost: { backgroundColor: 'transparent' },
  iconDark: { backgroundColor: 'rgba(255,255,255,0.12)' },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.35 },
  button: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primary: { backgroundColor: colors.accent },
  secondary: { borderWidth: 1, borderColor: colors.dashed, backgroundColor: 'transparent' },
  danger: { borderWidth: 1, borderColor: colors.danger, backgroundColor: 'transparent' },
  buttonText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  primaryText: { fontFamily: fonts.bold, color: colors.onAccent },
});
