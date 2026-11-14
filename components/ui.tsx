/** Small building blocks and shared styles used across screens. */
import { Polish } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';

const c = Polish.colors;
const s = Polish.spacing;
type IconName = keyof typeof Ionicons.glyphMap;

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  card: {
    backgroundColor: c.surface,
    borderRadius: Polish.radius.lg,
    padding: s.lg,
    borderWidth: 1,
    borderColor: c.borderLight,
    ...Polish.shadowSm,
  },
  title: { ...Polish.typography.title, color: c.text },
  subtitle: { ...Polish.typography.subtitle, color: c.text },
  body: { ...Polish.typography.body, color: c.textSecondary },
  caption: { ...Polish.typography.caption, color: c.textSecondary },
  muted: { ...Polish.typography.caption, color: c.textMuted },
  label: { ...Polish.typography.bodyMedium, color: c.text, marginBottom: s.md },
  hint: { ...Polish.typography.caption, color: c.textMuted, marginBottom: s.md },
  spaced: { marginTop: s.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: s.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: s.sm, marginBottom: s.lg },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: s.md },
  input: {
    ...Polish.typography.body,
    color: c.text,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: Polish.radius.md,
    padding: s.lg,
    marginBottom: s.lg,
    backgroundColor: c.surface,
  },
  inputError: { borderColor: c.error },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  errorText: { ...Polish.typography.caption, color: c.error, marginTop: -s.md, marginBottom: s.lg },
});

/** A rounded, tappable pill that can be selected. */
export function Chip({ label, selected, onPress, disabled }: { label: string; selected?: boolean; onPress?: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected, disabled && styles.chipDisabled]}
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected, disabled && { color: c.textMuted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

type ButtonVariant = 'primary' | 'outline' | 'danger' | 'dangerOutline' | 'secondary';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  small,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const filled = variant === 'primary' || variant === 'danger';
  const color = filled ? '#fff' : variant === 'secondary' ? c.text : variant === 'dangerOutline' ? c.error : c.primary;
  return (
    <TouchableOpacity
      style={[styles.button, styles[variant], small && styles.buttonSmall, (disabled || loading) && { opacity: 0.6 }, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={small ? 14 : 20} color={color} />}
          <Text style={[small ? styles.buttonTextSmall : styles.buttonText, { color }]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

/** Centered spinner or icon with a message, for loading, empty and error states. */
export function CenterMessage({ loading, icon, title, subtitle }: { loading?: boolean; icon?: IconName; title?: string; subtitle?: string }) {
  return (
    <View style={styles.center}>
      {loading ? (
        <ActivityIndicator size="large" color={c.primary} />
      ) : icon ? (
        <Ionicons name={icon} size={48} color={c.textMuted} />
      ) : null}
      {title ? <Text style={styles.centerTitle}>{title}</Text> : null}
      {subtitle ? <Text style={styles.centerSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/** Back arrow, centered title, and an optional item on the right. */
export function BackHeader({ title, right }: { title?: string; right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.headerSide} hitSlop={10}>
        <Ionicons name="arrow-back" size={24} color={c.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={[styles.headerSide, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

/** A 1–5 star rating. Pass `onChange` to make the stars tappable. */
export function Stars({ rating, size = 14, onChange }: { rating: number; size?: number; onChange?: (rating: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: onChange ? s.md : 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <TouchableOpacity key={i} onPress={() => onChange?.(i)} disabled={!onChange} activeOpacity={0.7}>
          <Ionicons name={i <= Math.round(rating) ? 'star' : 'star-outline'} size={size} color="#F5A623" />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: s.md,
    paddingVertical: s.sm,
    borderRadius: Polish.radius.xl,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  chipSelected: { backgroundColor: c.primary, borderColor: c.primary },
  chipDisabled: { backgroundColor: c.borderLight, borderColor: c.borderLight },
  chipText: { ...Polish.typography.caption, color: c.textSecondary, fontWeight: '500' },
  chipTextSelected: { color: '#fff' },

  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.sm,
    paddingVertical: s.lg,
    paddingHorizontal: s.lg,
    borderRadius: Polish.radius.lg,
  },
  buttonSmall: { paddingVertical: s.sm, paddingHorizontal: s.md, gap: 4 },
  buttonText: Polish.typography.button,
  buttonTextSmall: { ...Polish.typography.caption, fontWeight: '600' },
  primary: { backgroundColor: c.primary, ...Polish.shadow },
  danger: { backgroundColor: c.error },
  outline: { borderWidth: 1, borderColor: c.primary },
  dangerOutline: { borderWidth: 1, borderColor: c.error },
  secondary: { borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: s.xl, gap: s.sm },
  centerTitle: { ...Polish.typography.subtitle, color: c.textSecondary, textAlign: 'center', marginTop: s.sm },
  centerSubtitle: { ...Polish.typography.caption, color: c.textMuted, textAlign: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: s.lg },
  headerSide: { width: 50 },
  headerTitle: { ...Polish.typography.subtitle, color: c.text, flex: 1, textAlign: 'center' },
});
