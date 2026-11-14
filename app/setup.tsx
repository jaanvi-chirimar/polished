import PortfolioEditor from '@/components/profile/PortfolioEditor';
import {
  BookingLimitStepper,
  ChipSelect,
  FieldError,
  LocationPicker,
  NameFields,
  PoliciesEditor,
  PricingEditor,
  RemovalAddOnEditor,
  ServicesFields,
} from '@/components/profile/ProfileFields';
import ScheduleEditor from '@/components/profile/ScheduleEditor';
import { formStyles as fs } from '@/components/profile/formStyles';
import {
  CUSTOMER_PREFERENCES_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  PREFERENCES_HINT,
  PREFERENCES_LABEL,
} from '@/constants/nailTechOptions';
import { Polish } from '@/constants/theme';
import { useAuth, UserType } from '@/contexts/AuthContext';
import { deleteRemovedPhotos } from '@/lib/portfolio';
import { ErrorKey, formFromProfile, profileFromForm, useProfileForm, validateProfile } from '@/lib/profileForm';
import { toggleInList } from '@/lib/utils';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Step = 'role' | 'basic' | 'style' | 'schedule' | 'pricing';

/** Which required fields each step checks before moving on. */
const STEP_FIELDS: Record<Step, ErrorKey[]> = {
  role: ['roles'],
  basic: ['firstName', 'lastName', 'location'],
  style: [],
  schedule: ['portfolio', 'availability'],
  pricing: ['pricing', 'payment'],
};

const ROLE_CARDS: { role: UserType; title: string; description: string }[] = [
  { role: 'user', title: '👤 Customer', description: 'Book appointments with nail techs' },
  { role: 'nailTech', title: '💅 Nail Tech', description: 'Offer your services and manage bookings' },
];

/** First-time profile wizard. New users pick their role(s) here too. */
export default function SetupScreen() {
  const { user, userProfile, saveProfile } = useAuth();
  const { form, set, errors, setErrors } = useProfileForm(formFromProfile(userProfile));
  const [saving, setSaving] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  // Ask for roles only if sign-in didn't already set them.
  const [askForRole] = useState(!userProfile?.roles.length);

  const isTech = form.roles.includes('nailTech');
  const isCustomer = form.roles.includes('user');

  const steps = useMemo(() => {
    const list: Step[] = askForRole ? ['role', 'basic', 'style'] : ['basic', 'style'];
    if (isTech) list.push('schedule', 'pricing');
    return list;
  }, [askForRole, isTech]);

  const index = Math.min(stepIndex, steps.length - 1);
  const step = steps[index];
  const isLastStep = index === steps.length - 1;

  /** Errors for the given steps only. */
  const errorsFor = (stepsToCheck: Step[]) => {
    const all = validateProfile(form);
    const keys = stepsToCheck.flatMap((s) => STEP_FIELDS[s]);
    return Object.fromEntries(keys.filter((k) => all[k]).map((k) => [k, all[k]]));
  };

  const handleNext = () => {
    const errs = errorsFor([step]);
    setErrors(errs);
    if (Object.keys(errs).length === 0) setStepIndex(index + 1);
  };

  const handleBack = () => {
    setErrors({});
    setStepIndex(Math.max(index - 1, 0));
  };

  const handleSubmit = async () => {
    const errs = errorsFor(steps);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      // Go back to the first step with a problem.
      setStepIndex(steps.findIndex((s) => STEP_FIELDS[s].some((k) => errs[k])));
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      const base = userProfile ?? { uid: user.uid, email: user.email, roles: [], profileCompleted: false };
      await saveProfile(profileFromForm(form, base));
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Setup error:', error);
      Alert.alert('Error', error.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const titles: Record<Step, [string, string]> = {
    role: ['Choose your role', 'Select one or both. You can change this later.'],
    basic: ['About you', 'Just the basics to get started.'],
    style: isTech
      ? [isCustomer ? 'Your preferences & services' : 'Your services', 'Let clients know what you offer.']
      : ['Your preferences', 'Help us match you with the right techs.'],
    schedule: ['Portfolio & availability', 'Show off your work and set your hours.'],
    pricing: ['Pricing & policies', 'Set your rates, payment methods, and booking rules.'],
  };
  const [title, subtitle] = titles[step];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Back button + progress dots */}
      <View style={styles.header}>
        <View style={styles.backBtn}>
          {index > 0 && (
            <TouchableOpacity onPress={handleBack} hitSlop={10}>
              <Ionicons name="chevron-back" size={22} color={Polish.colors.text} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.progressDots}>
          {steps.map((s, i) => (
            <View key={s} style={[styles.dot, i < index && styles.dotDone, i === index && styles.dotActive]} />
          ))}
        </View>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {step === 'role' && (
          <>
            {ROLE_CARDS.map(({ role, title: cardTitle, description }) => {
              const on = form.roles.includes(role);
              return (
                <TouchableOpacity
                  key={role}
                  style={[styles.roleButton, on && styles.roleButtonSelected]}
                  onPress={() => set('roles', toggleInList(form.roles, role))}
                >
                  <Text style={[styles.roleButtonText, on && styles.roleButtonTextSelected]}>{cardTitle}</Text>
                  <Text style={styles.roleDescription}>{description}</Text>
                </TouchableOpacity>
              );
            })}
            <FieldError message={errors.roles} />
          </>
        )}

        {step === 'basic' && (
          <>
            <NameFields form={form} set={set} errors={errors} />
            <Text style={fs.label}>Location {isTech ? '*' : '(optional)'}</Text>
            <LocationPicker form={form} set={set} errors={errors} />
          </>
        )}

        {step === 'style' && (
          <>
            {isCustomer && (
              <View style={styles.section}>
                <Text style={fs.label}>{PREFERENCES_LABEL} (optional)</Text>
                <Text style={fs.hint}>{PREFERENCES_HINT}</Text>
                <ChipSelect
                  options={CUSTOMER_PREFERENCES_OPTIONS}
                  selected={form.preferences}
                  onChange={(v) => set('preferences', v)}
                />
              </View>
            )}
            {isTech && <ServicesFields form={form} set={set} />}
          </>
        )}

        {step === 'schedule' && user && (
          <>
            <Text style={fs.label}>Portfolio Photos *</Text>
            <PortfolioEditor
              uid={user.uid}
              photos={form.portfolio}
              onChange={(photos) => {
                // Nothing is saved yet, so removed photos can be deleted right away.
                deleteRemovedPhotos(form.portfolio, photos);
                set('portfolio', photos);
              }}
            />
            <FieldError message={errors.portfolio} />

            <Text style={[fs.label, fs.spaced]}>Available Hours *</Text>
            <Text style={fs.hint}>Tap + to add hours for a day. You can add several blocks per day.</Text>
            <ScheduleEditor schedule={form.schedule} onChange={(s) => set('schedule', s)} />
            <View style={styles.gap} />
            <FieldError message={errors.availability} />
          </>
        )}

        {step === 'pricing' && (
          <>
            <PricingEditor form={form} set={set} errors={errors} />

            <Text style={[fs.label, fs.spaced]}>Add-ons</Text>
            <RemovalAddOnEditor form={form} set={set} />

            <Text style={[fs.label, fs.spaced]}>Payment Methods *</Text>
            <ChipSelect
              options={PAYMENT_METHOD_OPTIONS}
              selected={form.paymentMethods}
              onChange={(v) => set('paymentMethods', v)}
            />
            <FieldError message={errors.payment} />

            <Text style={[fs.label, fs.spaced]}>Weekly Booking Limit</Text>
            <BookingLimitStepper form={form} set={set} />

            <Text style={[fs.label, fs.spaced]}>Policies (optional)</Text>
            <PoliciesEditor form={form} set={set} />
          </>
        )}
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={isLastStep ? handleSubmit : handleNext}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{isLastStep ? 'Complete Setup' : 'Next'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Polish.colors.background },
  scrollView: { flex: 1 },
  content: { padding: Polish.spacing.xl, paddingTop: Polish.spacing.lg, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Polish.spacing.xl,
    paddingTop: 56,
    paddingBottom: Polish.spacing.lg,
  },
  backBtn: { width: 36 },
  progressDots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Polish.colors.borderLight },
  dotDone: { backgroundColor: Polish.colors.primary, opacity: 0.4 },
  dotActive: { width: 20, backgroundColor: Polish.colors.primary },
  title: { ...Polish.typography.title, marginBottom: Polish.spacing.sm, color: Polish.colors.text },
  subtitle: {
    ...Polish.typography.body,
    color: Polish.colors.textSecondary,
    marginBottom: Polish.spacing.xxxl,
    lineHeight: 22,
  },
  section: { marginBottom: Polish.spacing.xl },
  gap: { height: Polish.spacing.lg },
  roleButton: {
    borderWidth: 2,
    borderColor: Polish.colors.border,
    borderRadius: Polish.radius.md,
    padding: Polish.spacing.xl,
    marginBottom: Polish.spacing.lg,
    backgroundColor: Polish.colors.surface,
  },
  roleButtonSelected: { borderColor: Polish.colors.primary, backgroundColor: Polish.colors.accent + '30' },
  roleButtonText: { fontSize: 20, fontWeight: '600', marginBottom: 8, color: Polish.colors.textSecondary },
  roleButtonTextSelected: { color: Polish.colors.text },
  roleDescription: { ...Polish.typography.caption, color: Polish.colors.textSecondary },
  button: {
    backgroundColor: Polish.colors.primary,
    borderRadius: Polish.radius.md,
    padding: Polish.spacing.lg,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { ...Polish.typography.button, color: '#fff' },
  bottomNav: {
    paddingHorizontal: Polish.spacing.xl,
    paddingBottom: 36,
    paddingTop: Polish.spacing.md,
    backgroundColor: Polish.colors.background,
    borderTopWidth: 1,
    borderTopColor: Polish.colors.borderLight,
  },
});
