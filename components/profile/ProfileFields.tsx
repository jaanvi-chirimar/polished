/** Editable pieces of the profile form, shared by setup.tsx and ProfileEditor.tsx. */
import {
  DEFAULT_PRICING_TIERS,
  DESIGNS_HINT,
  DESIGNS_LABEL,
  LOCATION_OPTIONS,
  NAIL_TECH_DESIGNS,
  NAIL_TECH_TOOLS,
  TOOLS_HINT,
  TOOLS_LABEL,
} from '@/constants/nailTechOptions';
import { Polish } from '@/constants/theme';
import { PRICING_TIER_KEYS } from '@/contexts/AuthContext';
import type { FormErrors, ProfileForm, SetField } from '@/lib/profileForm';
import { toggleInList } from '@/lib/utils';
import { useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { formStyles as fs } from './formStyles';

type FormProps = { form: ProfileForm; set: SetField; errors?: FormErrors };

export function FieldError({ message }: { message?: string }) {
  return message ? <Text style={fs.errorText}>{message}</Text> : null;
}

/** A row of tappable chips; tap to select or unselect. */
export function ChipSelect({
  options,
  selected,
  onChange,
}: {
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <View style={fs.chipRow}>
      {options.map((option) => {
        const on = selected.includes(option);
        return (
          <TouchableOpacity
            key={option}
            style={[fs.chip, on && fs.chipSelected]}
            onPress={() => onChange(toggleInList(selected, option))}
            activeOpacity={0.8}
          >
            <Text style={[fs.chipText, on && fs.chipTextSelected]}>{option}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function NameFields({ form, set, errors = {} }: FormProps) {
  return (
    <>
      <TextInput
        style={[fs.input, errors.firstName && fs.inputError]}
        placeholder="First Name *"
        value={form.firstName}
        onChangeText={(v) => set('firstName', v)}
        autoCapitalize="words"
      />
      <FieldError message={errors.firstName} />
      <TextInput
        style={[fs.input, errors.lastName && fs.inputError]}
        placeholder="Last Name *"
        value={form.lastName}
        onChangeText={(v) => set('lastName', v)}
        autoCapitalize="words"
      />
      <FieldError message={errors.lastName} />
      <TextInput
        style={fs.input}
        placeholder="Instagram (optional, e.g. @yourhandle)"
        value={form.instagramHandle}
        onChangeText={(text) => {
          const handle = text.replace(/^@+/, '');
          set('instagramHandle', handle ? `@${handle}` : '');
        }}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </>
  );
}

const PRESET_LOCATIONS: readonly string[] = LOCATION_OPTIONS.filter((l) => l !== 'Other');

/** Preset location chips plus "Other", which opens a text box for a custom location. */
export function LocationPicker({ form, set, errors = {} }: FormProps) {
  const value = form.location;
  const [otherOpen, setOtherOpen] = useState(!!value && !PRESET_LOCATIONS.includes(value));

  return (
    <>
      <View style={fs.chipRow}>
        {LOCATION_OPTIONS.map((loc) => {
          const on = loc === 'Other' ? otherOpen : !otherOpen && value === loc;
          return (
            <TouchableOpacity
              key={loc}
              style={[fs.chip, on && fs.chipSelected]}
              onPress={() => {
                const isOther = loc === 'Other';
                setOtherOpen(isOther);
                set('location', isOther ? '' : value === loc ? '' : loc);
              }}
              activeOpacity={0.8}
            >
              <Text style={[fs.chipText, on && fs.chipTextSelected]}>{loc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {otherOpen && (
        <TextInput
          style={fs.input}
          placeholder="Enter your location"
          value={value}
          onChangeText={(v) => set('location', v)}
          autoCapitalize="words"
          autoCorrect={false}
        />
      )}
      <FieldError message={errors.location} />
    </>
  );
}

/** Bio, tools and designs. */
export function ServicesFields({ form, set }: FormProps) {
  return (
    <>
      <TextInput
        style={[fs.input, fs.textArea]}
        placeholder="Bio (optional)"
        value={form.bio}
        onChangeText={(v) => set('bio', v)}
        multiline
        numberOfLines={3}
      />
      <Text style={fs.label}>{TOOLS_LABEL}</Text>
      <Text style={fs.hint}>{TOOLS_HINT}</Text>
      <ChipSelect options={NAIL_TECH_TOOLS} selected={form.tools} onChange={(v) => set('tools', v)} />
      <Text style={[fs.label, fs.spaced]}>{DESIGNS_LABEL}</Text>
      <Text style={fs.hint}>{DESIGNS_HINT}</Text>
      <ChipSelect options={NAIL_TECH_DESIGNS} selected={form.designs} onChange={(v) => set('designs', v)} />
    </>
  );
}

/** Tiered pricing (up to three tiers) or a free-text description. */
export function PricingEditor({ form, set, errors = {} }: FormProps) {
  const updateTier = (key: (typeof PRICING_TIER_KEYS)[number], change: Partial<ProfileForm['pricingTiers']['tier1']>) =>
    set('pricingTiers', { ...form.pricingTiers, [key]: { ...form.pricingTiers[key], ...change } });

  return (
    <>
      <View style={fs.switchRow}>
        <Text style={fs.label}>Use pricing tiers</Text>
        <Switch
          value={form.usePricingTiers}
          onValueChange={(v) => set('usePricingTiers', v)}
          trackColor={{ false: Polish.colors.border, true: Polish.colors.primary + '80' }}
          thumbColor={form.usePricingTiers ? Polish.colors.primary : Polish.colors.textMuted}
        />
      </View>
      {form.usePricingTiers ? (
        <>
          <Text style={fs.hint}>Turn on the tiers you offer and give each a price.</Text>
          {PRICING_TIER_KEYS.map((key, i) => {
            const tier = form.pricingTiers[key];
            return (
              <View key={key} style={styles.tierCard}>
                <TouchableOpacity
                  style={styles.tierHeader}
                  onPress={() => updateTier(key, { enabled: !tier.enabled })}
                  activeOpacity={0.8}
                >
                  <View style={[styles.tierToggle, tier.enabled && styles.tierToggleOn]}>
                    <Text style={[styles.tierToggleText, tier.enabled && styles.tierToggleTextOn]}>
                      {tier.enabled ? 'On' : 'Off'}
                    </Text>
                  </View>
                  <Text style={styles.tierName}>Tier {i + 1}: {DEFAULT_PRICING_TIERS[key].name}</Text>
                </TouchableOpacity>
                {tier.enabled && (
                  <View style={styles.tierFields}>
                    <TextInput
                      style={fs.input}
                      value={tier.price > 0 ? String(tier.price) : ''}
                      onChangeText={(v) => updateTier(key, { price: parseFloat(v) || 0 })}
                      placeholder="Price ($)"
                      placeholderTextColor={Polish.colors.textMuted}
                      keyboardType="decimal-pad"
                    />
                    <TextInput
                      style={[fs.input, fs.textArea]}
                      value={tier.description ?? ''}
                      onChangeText={(v) => updateTier(key, { description: v })}
                      placeholder="Description (optional, e.g. Gel polish included)"
                      placeholderTextColor={Polish.colors.textMuted}
                      multiline
                      numberOfLines={2}
                    />
                  </View>
                )}
              </View>
            );
          })}
        </>
      ) : (
        <TextInput
          style={[fs.input, fs.textArea, errors.pricing && fs.inputError]}
          placeholder="e.g. Starting at $45 for basic gel, $65 for full set"
          placeholderTextColor={Polish.colors.textMuted}
          value={form.pricingDescription}
          onChangeText={(v) => set('pricingDescription', v)}
          multiline
          numberOfLines={3}
        />
      )}
      <FieldError message={errors.pricing} />
    </>
  );
}

export function RemovalAddOnEditor({ form, set }: FormProps) {
  return (
    <>
      <View style={fs.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>Gel Removal Add-on</Text>
          <Text style={fs.hint}>Offer gel removal as an extra</Text>
        </View>
        <Switch
          value={form.removalAddOnEnabled}
          onValueChange={(v) => set('removalAddOnEnabled', v)}
          trackColor={{ false: Polish.colors.border, true: Polish.colors.primary }}
          thumbColor="#fff"
        />
      </View>
      {form.removalAddOnEnabled && (
        <View style={fs.switchRow}>
          <Text style={styles.rowTitle}>Removal price</Text>
          <View style={styles.priceInputWrapper}>
            <Text style={styles.dollarSign}>$</Text>
            <TextInput
              style={styles.priceInput}
              value={form.removalAddOnPrice}
              onChangeText={(v) => set('removalAddOnPrice', v)}
              keyboardType="decimal-pad"
              placeholder="15"
              placeholderTextColor={Polish.colors.textMuted}
            />
          </View>
        </View>
      )}
    </>
  );
}

/** − / + stepper for the weekly booking limit. 0 means unlimited. */
export function BookingLimitStepper({ form, set }: FormProps) {
  const value = form.maxAppointmentsPerWeek;
  return (
    <>
      <Text style={fs.hint}>Max appointments per week. 0 = unlimited.</Text>
      <View style={styles.stepperRow}>
        <TouchableOpacity
          style={styles.stepperButton}
          onPress={() => set('maxAppointmentsPerWeek', Math.max(0, value - 1))}
          activeOpacity={0.8}
        >
          <Text style={styles.stepperButtonText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{value === 0 ? 'Unlimited' : value}</Text>
        <TouchableOpacity
          style={styles.stepperButton}
          onPress={() => set('maxAppointmentsPerWeek', value + 1)}
          activeOpacity={0.8}
        >
          <Text style={styles.stepperButtonText}>+</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

export function PoliciesEditor({ form, set }: FormProps) {
  return (
    <>
      <Text style={fs.label}>Reschedule Policy</Text>
      <TextInput
        style={[fs.input, fs.textArea]}
        placeholder="e.g. Reschedule at least 24 hours in advance"
        placeholderTextColor={Polish.colors.textMuted}
        value={form.reschedulePolicy}
        onChangeText={(v) => set('reschedulePolicy', v)}
        multiline
        numberOfLines={2}
      />
      <Text style={fs.label}>Late Policy</Text>
      <TextInput
        style={[fs.input, fs.textArea]}
        placeholder="e.g. 10+ min late may require rescheduling"
        placeholderTextColor={Polish.colors.textMuted}
        value={form.latePolicy}
        onChangeText={(v) => set('latePolicy', v)}
        multiline
        numberOfLines={2}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tierCard: {
    backgroundColor: Polish.colors.background,
    borderRadius: Polish.radius.md,
    borderWidth: 1,
    borderColor: Polish.colors.borderLight,
    padding: Polish.spacing.md,
    marginBottom: Polish.spacing.md,
  },
  tierHeader: { flexDirection: 'row', alignItems: 'center', gap: Polish.spacing.md },
  tierToggle: {
    paddingHorizontal: Polish.spacing.md,
    paddingVertical: 4,
    borderRadius: Polish.radius.xl,
    borderWidth: 1,
    borderColor: Polish.colors.border,
    backgroundColor: Polish.colors.surface,
  },
  tierToggleOn: { backgroundColor: Polish.colors.primary, borderColor: Polish.colors.primary },
  tierToggleText: { ...Polish.typography.caption, color: Polish.colors.textMuted, fontWeight: '600' },
  tierToggleTextOn: { color: '#fff' },
  tierName: { ...Polish.typography.bodyMedium, color: Polish.colors.text, flex: 1 },
  tierFields: { marginTop: Polish.spacing.md },
  rowTitle: { ...Polish.typography.bodyMedium, color: Polish.colors.text, marginBottom: 2 },
  priceInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Polish.colors.border,
    borderRadius: Polish.radius.md,
    paddingHorizontal: Polish.spacing.md,
    backgroundColor: Polish.colors.surface,
  },
  dollarSign: { ...Polish.typography.body, color: Polish.colors.textSecondary, marginRight: 2 },
  priceInput: { ...Polish.typography.body, color: Polish.colors.text, paddingVertical: Polish.spacing.sm, minWidth: 60 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: Polish.spacing.xl, marginBottom: Polish.spacing.lg },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Polish.colors.border,
    backgroundColor: Polish.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: { ...Polish.typography.title, color: Polish.colors.text, lineHeight: 28 },
  stepperValue: { ...Polish.typography.subtitle, color: Polish.colors.text, minWidth: 80, textAlign: 'center' },
});
