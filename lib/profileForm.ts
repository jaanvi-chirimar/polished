/**
 * The profile form shared by setup.tsx and ProfileEditor.tsx:
 * its fields, how it's filled from a saved profile, how it turns back
 * into a profile, and the rules for required fields.
 */
import { DEFAULT_PRICING_TIERS } from '@/constants/nailTechOptions';
import { PRICING_TIER_KEYS, PricingTier, PricingTierKey, UserProfile, UserType } from '@/contexts/AuthContext';
import { usesPricingTiers } from '@/lib/techs';
import type { Schedule } from '@/lib/time';
import { useCallback, useState } from 'react';

export type ProfileForm = {
  roles: UserType[];
  firstName: string;
  lastName: string;
  instagramHandle: string;
  location: string;
  preferences: string[];
  // Tech-only
  bio: string;
  tools: string[];
  designs: string[];
  schedule: Schedule;
  portfolio: string[];
  usePricingTiers: boolean;
  pricingTiers: Record<PricingTierKey, PricingTier>;
  pricingDescription: string;
  removalAddOnEnabled: boolean;
  removalAddOnPrice: string;
  paymentMethods: string[];
  maxAppointmentsPerWeek: number;
  reschedulePolicy: string;
  latePolicy: string;
};

export type SetField = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => void;

export type ErrorKey = 'roles' | 'firstName' | 'lastName' | 'location' | 'portfolio' | 'availability' | 'pricing' | 'payment';
export type FormErrors = Partial<Record<ErrorKey, string>>;

/** Short names for the "Please fill in: …" message. */
export const ERROR_LABELS: Record<ErrorKey, string> = {
  roles: 'role',
  firstName: 'first name',
  lastName: 'last name',
  location: 'location',
  portfolio: 'portfolio photo',
  availability: 'available hours',
  pricing: 'pricing',
  payment: 'payment method',
};

export function formFromProfile(profile: UserProfile | null): ProfileForm {
  const tech = profile?.nailTechProfile;
  return {
    roles: profile?.roles ?? [],
    firstName: profile?.firstName ?? '',
    lastName: profile?.lastName ?? '',
    instagramHandle: profile?.instagramHandle ?? '',
    location: profile?.location || tech?.location || '',
    preferences: profile?.preferences ?? [],
    bio: tech?.bio ?? '',
    tools: tech?.tools ?? [],
    designs: tech?.designs ?? [],
    schedule: tech?.availabilities?.schedule ?? {},
    portfolio: tech?.portfolio ?? [],
    usePricingTiers: usesPricingTiers(tech),
    pricingTiers: Object.fromEntries(
      PRICING_TIER_KEYS.map((k) => [k, tech?.pricingTiers?.[k] ?? { ...DEFAULT_PRICING_TIERS[k] }])
    ) as Record<PricingTierKey, PricingTier>,
    pricingDescription: tech?.pricingDescription ?? '',
    removalAddOnEnabled: tech?.removalAddOn?.enabled ?? false,
    removalAddOnPrice: String(tech?.removalAddOn?.price ?? 15),
    paymentMethods: tech?.paymentMethods ?? [],
    maxAppointmentsPerWeek: tech?.maxAppointmentsPerWeek ?? 0,
    reschedulePolicy: tech?.policies?.reschedule ?? '',
    latePolicy: tech?.policies?.late ?? '',
  };
}

const text = (s: string) => s.trim() || undefined;
const list = (items: string[]) => (items.length ? [...items] : undefined);

/** Builds the profile to save. Empty fields become undefined, which saveProfile removes. */
export function profileFromForm(form: ProfileForm, base: UserProfile): UserProfile {
  const isTech = form.roles.includes('nailTech');
  const isCustomer = form.roles.includes('user');
  return {
    ...base,
    roles: form.roles,
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    instagramHandle: text(form.instagramHandle),
    location: text(form.location),
    preferences: isCustomer ? list(form.preferences) : undefined,
    profileCompleted: true,
    // If the tech role was turned off, keep the old tech profile so it comes back later.
    nailTechProfile: isTech
      ? {
          ...base.nailTechProfile,
          bio: text(form.bio),
          location: text(form.location),
          tools: list(form.tools),
          designs: list(form.designs),
          portfolio: list(form.portfolio),
          availabilities: { schedule: form.schedule },
          usePricingTiers: form.usePricingTiers,
          pricingTiers: form.pricingTiers,
          pricingDescription: text(form.pricingDescription),
          removalAddOn: { enabled: form.removalAddOnEnabled, price: parseFloat(form.removalAddOnPrice) || 0 },
          paymentMethods: list(form.paymentMethods),
          maxAppointmentsPerWeek: form.maxAppointmentsPerWeek,
          policies: { reschedule: text(form.reschedulePolicy), late: text(form.latePolicy) },
        }
      : base.nailTechProfile,
  };
}

/** Required fields. Techs need a location, a photo, hours, pricing and a payment method. */
export function validateProfile(form: ProfileForm): FormErrors {
  const errors: FormErrors = {};
  if (form.roles.length === 0) errors.roles = 'Choose at least one role';
  if (!form.firstName.trim()) errors.firstName = 'First name is required';
  if (!form.lastName.trim()) errors.lastName = 'Last name is required';

  if (form.roles.includes('nailTech')) {
    if (!form.location.trim()) errors.location = 'Location is required for nail techs';
    if (form.portfolio.length === 0) errors.portfolio = 'Add at least one portfolio photo';
    if (Object.keys(form.schedule).length === 0) errors.availability = 'Set your hours for at least one day';
    const hasPricing = form.usePricingTiers
      ? PRICING_TIER_KEYS.some((k) => form.pricingTiers[k].enabled && form.pricingTiers[k].price > 0)
      : !!form.pricingDescription.trim();
    if (!hasPricing) {
      errors.pricing = form.usePricingTiers ? 'Turn on at least one tier with a price' : 'Describe your pricing';
    }
    if (form.paymentMethods.length === 0) errors.payment = 'Choose at least one payment method';
  }
  return errors;
}

/** Form state plus errors. Changing a field clears its error. */
export function useProfileForm(initial: ProfileForm) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<FormErrors>({});

  const set: SetField = useCallback((key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    const errorKey = key === 'schedule' ? 'availability'
      : key === 'paymentMethods' ? 'payment'
      : key === 'pricingTiers' || key === 'pricingDescription' || key === 'usePricingTiers' ? 'pricing'
      : key;
    setErrors((e) => (errorKey in e ? { ...e, [errorKey]: undefined } : e));
  }, []);

  return { form, set, setForm, errors, setErrors };
}
