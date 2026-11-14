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
import { Button, ui as fs } from '@/components/ui';
import {
  CUSTOMER_PREFERENCES_OPTIONS,
  DESIGNS_LABEL,
  PAYMENT_METHOD_OPTIONS,
  PREFERENCES_HINT,
  TOOLS_LABEL,
} from '@/constants/nailTechOptions';
import { Polish } from '@/constants/theme';
import { PRICING_TIER_KEYS, useAuth, UserType } from '@/contexts/AuthContext';
import { auth } from '@/firebase/config';
import { disconnectGoogleCalendar } from '@/lib/googleCalendar';
import { deleteRemovedPhotos } from '@/lib/portfolio';
import {
  ERROR_LABELS,
  ErrorKey,
  formFromProfile,
  profileFromForm,
  useProfileForm,
  validateProfile,
} from '@/lib/profileForm';
import { formatSchedule } from '@/lib/time';
import { buildFullName, toggleInList } from '@/lib/utils';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { signOut } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SectionId =
  | 'role' | 'basic' | 'location' | 'prefs' | 'services' | 'hours' | 'portfolio'
  | 'pricing' | 'addons' | 'policies' | 'payment' | 'limit' | 'gcal';

/** Which section to open when a required field is missing. */
const ERROR_SECTIONS: Record<ErrorKey, SectionId> = {
  roles: 'role',
  firstName: 'basic',
  lastName: 'basic',
  location: 'location',
  portfolio: 'portfolio',
  availability: 'hours',
  pricing: 'pricing',
  payment: 'payment',
};

const ROLE_CHIPS: { role: UserType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { role: 'user', label: 'Customer', icon: 'person-outline' },
  { role: 'nailTech', label: 'Nail Tech', icon: 'sparkles-outline' },
];

/**
 * The Profile tab. View mode shows the profile read-only; Edit turns each
 * section into a collapsible editor (one open at a time).
 */
export default function ProfileEditor() {
  const insets = useSafeAreaInsets();
  const { user, userProfile, saveProfile, refreshProfile } = useAuth();
  const { form, set, setForm, errors, setErrors } = useProfileForm(formFromProfile(userProfile));
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState<SectionId | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Re-read the profile when the tab opens so the form isn't stale.
  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  // Outside edit mode, the form always mirrors the saved profile.
  useEffect(() => {
    if (!editing) setForm(formFromProfile(userProfile));
  }, [userProfile, editing, setForm]);

  if (!user || !userProfile) return null;

  const isTech = form.roles.includes('nailTech');
  const isCustomer = form.roles.includes('user');
  const savedPortfolio = userProfile.nailTechProfile?.portfolio ?? [];

  const startEditing = () => {
    setExpanded(null);
    setErrors({});
    setNotice(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    // Photos uploaded during this edit were never saved, so delete them.
    deleteRemovedPhotos(form.portfolio, savedPortfolio);
    setErrors({});
    setNotice(null);
    setEditing(false);
  };

  const handleSave = async () => {
    const errs = validateProfile(form);
    const missing = Object.keys(errs) as ErrorKey[];
    if (missing.length > 0) {
      setErrors(errs);
      setExpanded(ERROR_SECTIONS[missing[0]]);
      setNotice({ type: 'error', text: `Please fill in: ${missing.map((k) => ERROR_LABELS[k]).join(', ')}` });
      return;
    }
    setSaving(true);
    try {
      await saveProfile(profileFromForm(form, userProfile));
      deleteRemovedPhotos(savedPortfolio, form.portfolio);
      setEditing(false);
      setNotice({ type: 'success', text: 'Profile saved!' });
      setTimeout(() => setNotice(null), 3000);
    } catch (error) {
      console.error('Profile update error:', error);
      setNotice({ type: 'error', text: 'Something went wrong. Please check your connection and try again.' });
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = (role: UserType) => {
    const next = toggleInList(form.roles, role);
    if (next.length > 0) set('roles', next); // must keep at least one role
  };

  const handleLogout = () => {
    const logOut = () =>
      signOut(auth).catch((error) => Alert.alert('Error', error.message || 'Failed to log out. Please try again.'));
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to log out?')) logOut();
      return;
    }
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logOut },
    ]);
  };

  const handleCalendarDisconnect = async () => {
    await disconnectGoogleCalendar(user.uid);
    await refreshProfile();
  };

  /** A profile card. In edit mode its header collapses/expands it and shows `preview` when closed. */
  const section = (id: SectionId, title: string, preview: string, body: React.ReactNode) => {
    const open = !editing || expanded === id;
    return (
      <View style={[fs.card, styles.section]}>
        {editing ? (
          <TouchableOpacity
            style={styles.collapsibleHeader}
            onPress={() => setExpanded(expanded === id ? null : id)}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionLabel}>{title}</Text>
              {!open && <Text style={styles.sectionPreview} numberOfLines={1}>{preview}</Text>}
            </View>
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={Polish.colors.textMuted} />
          </TouchableOpacity>
        ) : (
          <Text style={styles.sectionLabel}>{title}</Text>
        )}
        {open && body}
      </View>
    );
  };

  const fullName = buildFullName(form.firstName, form.lastName, '');
  const schedule = formatSchedule(form.schedule);
  const tierSummary = PRICING_TIER_KEYS.filter((k) => form.pricingTiers[k].enabled);
  const googleConnected = !!userProfile.googleCalendar;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Polish.spacing.lg }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.headerSide} />
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerSide}>
          {!editing && (
            <TouchableOpacity onPress={startEditing} activeOpacity={0.7}>
              <Text style={styles.editButton}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {notice && (
        <View style={[styles.notice, notice.type === 'success' ? styles.noticeSuccess : styles.noticeError]}>
          <Ionicons
            name={notice.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
            size={16}
            color={notice.type === 'success' ? Polish.colors.success : Polish.colors.error}
          />
          <Text style={[styles.noticeText, { color: notice.type === 'success' ? Polish.colors.success : Polish.colors.error }]}>
            {notice.text}
          </Text>
        </View>
      )}

      {!editing && (
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{fullName || 'Profile'}</Text>
          {form.location ? (
            <View style={styles.heroLocationRow}>
              <Ionicons name="location-outline" size={13} color={Polish.colors.textMuted} />
              <Text style={styles.heroLocation}>{form.location}</Text>
            </View>
          ) : null}
          <View style={styles.heroBadgeRow}>
            {isCustomer && (
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>Customer</Text>
              </View>
            )}
            {isTech && (
              <View style={[styles.heroBadge, styles.heroBadgeTech]}>
                <Text style={[styles.heroBadgeText, styles.heroBadgeTextTech]}>Nail Tech</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {editing &&
        section('role', 'Role', ROLE_CHIPS.filter((c) => form.roles.includes(c.role)).map((c) => c.label).join(' & '), (
          <>
            <View style={styles.roleRow}>
              {ROLE_CHIPS.map(({ role, label, icon }) => {
                const on = form.roles.includes(role);
                return (
                  <TouchableOpacity
                    key={role}
                    style={[styles.roleChip, on && styles.roleChipSelected]}
                    onPress={() => toggleRole(role)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={icon} size={20} color={on ? '#fff' : Polish.colors.textSecondary} />
                    <Text style={[styles.roleChipText, on && styles.roleChipTextSelected]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={fs.hint}>Choose at least one. You can be both.</Text>
          </>
        ))}

      {section('basic', 'Contact', fullName || 'Name', editing ? (
        <NameFields form={form} set={set} errors={errors} />
      ) : (
        <>
          <InfoRow icon="person-outline" text={fullName || '—'} />
          {userProfile.email ? <InfoRow icon="mail-outline" text={userProfile.email} /> : null}
          {form.instagramHandle ? <InfoRow icon="logo-instagram" text={form.instagramHandle} /> : null}
        </>
      ))}

      {section('location', 'Location', form.location || 'Not set', editing ? (
        <LocationPicker form={form} set={set} errors={errors} />
      ) : (
        <InfoRow icon="location-outline" text={form.location || 'Not specified'} />
      ))}

      {isCustomer &&
        section('prefs', 'Style', form.preferences.join(', ') || 'None selected', editing ? (
          <>
            <Text style={fs.hint}>{PREFERENCES_HINT}</Text>
            <ChipSelect options={CUSTOMER_PREFERENCES_OPTIONS} selected={form.preferences} onChange={(v) => set('preferences', v)} />
          </>
        ) : (
          <ReadOnlyChips items={form.preferences} empty="None selected" />
        ))}

      {isTech && (
        <>
          {section('services', 'Services', form.bio || [...form.tools, ...form.designs].slice(0, 2).join(', ') || 'Bio, tools & designs', editing ? (
            <ServicesFields form={form} set={set} />
          ) : (
            <>
              {form.bio ? <Text style={styles.bioText}>{form.bio}</Text> : null}
              <Text style={styles.viewLabel}>{TOOLS_LABEL}</Text>
              <ReadOnlyChips items={form.tools} empty="None selected" />
              <Text style={styles.viewLabel}>{DESIGNS_LABEL}</Text>
              <ReadOnlyChips items={form.designs} empty="None selected" />
            </>
          ))}

          {section('hours', 'Available Hours', schedule || 'Not set', editing ? (
            <>
              <Text style={fs.hint}>Tap + to add hours for a day. Tap a time to change it.</Text>
              <ScheduleEditor schedule={form.schedule} onChange={(s) => set('schedule', s)} />
              <View style={{ height: Polish.spacing.lg }} />
              <FieldError message={errors.availability} />
            </>
          ) : (
            <Text style={schedule ? styles.readOnlyText : styles.readOnlyTextMuted}>{schedule || 'Not set'}</Text>
          ))}

          {section('portfolio', 'Portfolio', form.portfolio.length ? `${form.portfolio.length} photo${form.portfolio.length !== 1 ? 's' : ''}` : 'No photos yet', editing ? (
            <>
              <PortfolioEditor uid={user.uid} photos={form.portfolio} onChange={(p) => set('portfolio', p)} />
              <FieldError message={errors.portfolio} />
            </>
          ) : form.portfolio.length > 0 ? (
            <View style={styles.portfolioGrid}>
              {form.portfolio.map((url) => (
                <Image key={url} source={{ uri: url }} style={styles.portfolioThumb} contentFit="cover" />
              ))}
            </View>
          ) : (
            <Text style={styles.readOnlyTextMuted}>No photos yet. Tap Edit to add your work.</Text>
          ))}

          {section('pricing', 'Pricing', form.usePricingTiers ? 'Tiered pricing' : form.pricingDescription || 'Not set', editing ? (
            <PricingEditor form={form} set={set} errors={errors} />
          ) : form.usePricingTiers ? (
            tierSummary.length ? (
              tierSummary.map((k) => {
                const tier = form.pricingTiers[k];
                return (
                  <View key={k} style={styles.tierRow}>
                    <Text style={styles.readOnlyText}>{tier.name}</Text>
                    <Text style={styles.tierPrice}>${tier.price}</Text>
                  </View>
                );
              })
            ) : (
              <Text style={styles.readOnlyTextMuted}>No tiers turned on</Text>
            )
          ) : (
            <Text style={form.pricingDescription ? styles.readOnlyText : styles.readOnlyTextMuted}>
              {form.pricingDescription || 'Not set'}
            </Text>
          ))}

          {section('addons', 'Add-ons', form.removalAddOnEnabled ? `Gel removal $${form.removalAddOnPrice}` : 'None', editing ? (
            <RemovalAddOnEditor form={form} set={set} />
          ) : (
            <Text style={styles.readOnlyText}>
              {form.removalAddOnEnabled ? `Gel removal: $${form.removalAddOnPrice}` : 'None'}
            </Text>
          ))}

          {section('policies', 'Policies', form.reschedulePolicy || form.latePolicy ? 'Set' : 'Not set', editing ? (
            <PoliciesEditor form={form} set={set} />
          ) : (
            <>
              <Text style={styles.viewLabel}>Reschedule</Text>
              <Text style={styles.readOnlyText}>{form.reschedulePolicy || 'Not set'}</Text>
              <Text style={styles.viewLabel}>Late</Text>
              <Text style={styles.readOnlyText}>{form.latePolicy || 'Not set'}</Text>
            </>
          ))}

          {section('payment', 'Payment', form.paymentMethods.join(', ') || 'Not specified', editing ? (
            <>
              <ChipSelect options={PAYMENT_METHOD_OPTIONS} selected={form.paymentMethods} onChange={(v) => set('paymentMethods', v)} />
              <FieldError message={errors.payment} />
            </>
          ) : (
            <Text style={form.paymentMethods.length ? styles.readOnlyText : styles.readOnlyTextMuted}>
              {form.paymentMethods.join(', ') || 'Not specified'}
            </Text>
          ))}

          {section('limit', 'Booking Limit', form.maxAppointmentsPerWeek ? `${form.maxAppointmentsPerWeek}/week` : 'Unlimited', editing ? (
            <BookingLimitStepper form={form} set={set} />
          ) : (
            <Text style={styles.readOnlyText}>
              {form.maxAppointmentsPerWeek ? `${form.maxAppointmentsPerWeek} per week` : 'Unlimited'}
            </Text>
          ))}
        </>
      )}

      {section('gcal', 'Calendar', googleConnected ? 'Connected' : 'Not connected', googleConnected ? (
        <View style={styles.calendarRow}>
          <Ionicons name="checkmark-circle" size={18} color={Polish.colors.success} />
          <Text style={styles.calendarConnectedText}>Connected</Text>
          {editing && (
            <TouchableOpacity onPress={handleCalendarDisconnect} style={styles.disconnectButton}>
              <Text style={styles.disconnectText}>Disconnect</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <Text style={styles.readOnlyTextMuted}>
          Not connected. Sign out and sign back in with Google to link your calendar.
        </Text>
      ))}

      {editing && (
        <View style={styles.buttonRow}>
          <Button title="Save" loading={saving} onPress={handleSave} style={{ flex: 1 }} />
          <Button variant="secondary" title="Cancel" onPress={cancelEditing} style={{ flex: 1 }} />
        </View>
      )}

      {!editing && isCustomer && !isTech && (
        <TouchableOpacity style={[fs.card, fs.row, styles.becomeTechCard]} onPress={() => router.push('/apply')} activeOpacity={0.85}>
          <View style={styles.becomeTechIcon}>
            <Ionicons name="sparkles" size={22} color={Polish.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[fs.label, { marginBottom: 2 }]}>Become a Nail Tech</Text>
            <Text style={fs.muted}>Apply to offer your services on Polish</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Polish.colors.textMuted} />
        </TouchableOpacity>
      )}

      <Button variant="danger" title="Log Out" onPress={handleLogout} />
    </ScrollView>
  );
}

function InfoRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={Polish.colors.textMuted} />
      <Text style={styles.infoRowText}>{text}</Text>
    </View>
  );
}

function ReadOnlyChips({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <Text style={styles.readOnlyTextMuted}>{empty}</Text>;
  return (
    <View style={styles.chipRowCompact}>
      {items.map((item) => (
        <View key={item} style={styles.chipReadOnly}>
          <Text style={styles.chipReadOnlyText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const c = Polish.colors;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { paddingHorizontal: Polish.spacing.xl, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Polish.spacing.xl },
  headerSide: { width: 50, alignItems: 'flex-end' },
  headerTitle: { ...Polish.typography.title, color: c.text, flex: 1, textAlign: 'center' },
  editButton: { ...Polish.typography.button, color: c.primary },
  notice: { flexDirection: 'row', alignItems: 'center', gap: Polish.spacing.sm, padding: Polish.spacing.md, borderRadius: Polish.radius.md, marginBottom: Polish.spacing.lg, borderWidth: 1 },
  noticeSuccess: { backgroundColor: c.success + '15', borderColor: c.success + '40' },
  noticeError: { backgroundColor: c.error + '15', borderColor: c.error + '40' },
  noticeText: { ...Polish.typography.caption, fontWeight: '500', flex: 1 },
  hero: { alignItems: 'center', gap: Polish.spacing.sm, paddingVertical: Polish.spacing.lg, marginBottom: Polish.spacing.lg },
  heroTitle: { ...Polish.typography.title, color: c.text, textAlign: 'center' },
  heroLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroLocation: { ...Polish.typography.caption, color: c.textMuted },
  heroBadgeRow: { flexDirection: 'row', gap: Polish.spacing.sm },
  heroBadge: { paddingHorizontal: Polish.spacing.md, paddingVertical: 4, borderRadius: Polish.radius.xl, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  heroBadgeTech: { backgroundColor: c.primary + '15', borderColor: c.primary + '60' },
  heroBadgeText: { ...Polish.typography.caption, color: c.textSecondary, fontWeight: '600' },
  heroBadgeTextTech: { color: c.primary },
  section: { padding: Polish.spacing.xl, marginBottom: Polish.spacing.xxl },
  collapsibleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Polish.spacing.sm },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Polish.spacing.md },
  sectionPreview: { ...Polish.typography.caption, color: c.text, marginTop: -Polish.spacing.sm },
  viewLabel: { fontSize: 12, fontWeight: '600', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: Polish.spacing.lg, marginBottom: Polish.spacing.sm },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Polish.spacing.sm, paddingVertical: Polish.spacing.sm, borderBottomWidth: 1, borderBottomColor: c.borderLight },
  infoRowText: { ...Polish.typography.body, color: c.textSecondary, flex: 1 },
  readOnlyText: { ...Polish.typography.body, color: c.textSecondary },
  readOnlyTextMuted: { ...Polish.typography.body, color: c.textMuted },
  bioText: { ...Polish.typography.body, color: c.textSecondary, lineHeight: 22 },
  chipRowCompact: { flexDirection: 'row', flexWrap: 'wrap', gap: Polish.spacing.sm },
  chipReadOnly: { paddingHorizontal: Polish.spacing.md, paddingVertical: 5, borderRadius: Polish.radius.xl, backgroundColor: c.accent + '25', borderWidth: 1, borderColor: c.accent + '60' },
  chipReadOnlyText: { fontSize: 13, fontWeight: '500', color: c.primaryDark },
  tierRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Polish.spacing.xs },
  tierPrice: { ...Polish.typography.bodyMedium, color: c.primary, fontWeight: '700' },
  portfolioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Polish.spacing.sm },
  portfolioThumb: { width: 100, height: 100, borderRadius: Polish.radius.md, backgroundColor: c.surface },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Polish.spacing.md, marginBottom: Polish.spacing.sm },
  roleChip: { flexDirection: 'row', alignItems: 'center', gap: Polish.spacing.sm, paddingVertical: Polish.spacing.md, paddingHorizontal: Polish.spacing.lg, borderRadius: Polish.radius.xl, borderWidth: 2, borderColor: c.border, backgroundColor: c.surface },
  roleChipSelected: { borderColor: c.primary, backgroundColor: c.primary },
  roleChipText: { ...Polish.typography.bodyMedium, color: c.textSecondary },
  roleChipTextSelected: { color: '#fff' },
  calendarRow: { flexDirection: 'row', alignItems: 'center', gap: Polish.spacing.sm },
  calendarConnectedText: { ...Polish.typography.body, color: c.success, fontWeight: '600', flex: 1 },
  disconnectButton: { paddingHorizontal: Polish.spacing.md, paddingVertical: Polish.spacing.sm },
  disconnectText: { ...Polish.typography.caption, color: c.error, fontWeight: '600' },
  buttonRow: { flexDirection: 'row', gap: Polish.spacing.md, marginBottom: Polish.spacing.lg },
  becomeTechCard: { gap: Polish.spacing.md, marginBottom: Polish.spacing.xxl, borderColor: c.primary + '40' },
  becomeTechIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.primary + '15', alignItems: 'center', justifyContent: 'center' },
});
