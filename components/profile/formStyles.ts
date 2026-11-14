import { Polish } from '@/constants/theme';
import { StyleSheet } from 'react-native';

/** Styles shared by the profile form pieces and the screens that use them. */
export const formStyles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: Polish.colors.border,
    borderRadius: Polish.radius.md,
    padding: Polish.spacing.lg,
    ...Polish.typography.body,
    marginBottom: Polish.spacing.lg,
    backgroundColor: Polish.colors.surface,
  },
  inputError: { borderColor: Polish.colors.error },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  errorText: {
    ...Polish.typography.caption,
    color: Polish.colors.error,
    marginTop: -Polish.spacing.md,
    marginBottom: Polish.spacing.lg,
  },
  label: { ...Polish.typography.bodyMedium, marginBottom: Polish.spacing.md, color: Polish.colors.text },
  hint: { ...Polish.typography.caption, color: Polish.colors.textMuted, marginBottom: Polish.spacing.md },
  spaced: { marginTop: Polish.spacing.xl },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: Polish.spacing.lg, gap: Polish.spacing.sm },
  chip: {
    paddingHorizontal: Polish.spacing.md,
    paddingVertical: Polish.spacing.sm,
    borderRadius: Polish.radius.xl,
    borderWidth: 1,
    borderColor: Polish.colors.border,
    backgroundColor: Polish.colors.surface,
  },
  chipSelected: { backgroundColor: Polish.colors.primary, borderColor: Polish.colors.primary },
  chipText: { ...Polish.typography.caption, color: Polish.colors.textSecondary, fontWeight: '500' },
  chipTextSelected: { color: '#fff' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Polish.spacing.md,
  },
});
