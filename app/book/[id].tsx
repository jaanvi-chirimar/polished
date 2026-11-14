import { APPOINTMENT_TYPES } from "@/constants/nailTechOptions";
import { Polish } from "@/constants/theme";
import { PricingTierKey, useAuth } from "@/contexts/AuthContext";
import { db } from "@/firebase/config";
import { enabledTiers, fetchTech, Tech, usesPricingTiers } from "@/lib/techs";
import { dateAtTime, dayName, formatTime, generateSlots } from "@/lib/time";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { addDoc, collection, getDocs, query, Timestamp, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DAYS_AHEAD = 21;

/** Today plus the next `count - 1` days, at midnight. */
function getUpcomingDates(count: number): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
}

/** Monday 00:00 → Sunday 23:59 of the week containing `date`. */
function weekRange(date: Date): [Date, Date] {
  const start = new Date(date);
  start.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return [start, end];
}

export default function BookScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { id, name } = useLocalSearchParams<{ id?: string; name?: string }>();
  const router = useRouter();

  const [tech, setTech] = useState<Tech | null>(null);
  const [note, setNote] = useState("");
  const [altTimeRequest, setAltTimeRequest] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [addRemoval, setAddRemoval] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [appointmentType, setAppointmentType] = useState("");
  const [selectedTierKey, setSelectedTierKey] = useState<PricingTierKey | "">("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const upcomingDates = useMemo(() => getUpcomingDates(DAYS_AHEAD), []);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    fetchTech(id)
      .then((t) => { if (mounted) setTech(t); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [id]);

  const techName = tech?.name ?? name ?? "this tech";
  const profile = tech?.profile;
  const techSchedule = useMemo(() => profile?.availabilities?.schedule ?? {}, [profile]);
  const techTools = profile?.tools ?? [];
  const techDesigns = profile?.designs ?? [];
  const techUsePricingTiers = usesPricingTiers(profile);
  const techPricingTiers = enabledTiers(profile);
  const techPricingDescription = profile?.pricingDescription ?? "";
  const techRemovalAddOn = profile?.removalAddOn?.enabled ? profile.removalAddOn : null;
  const techMaxPerWeek = profile?.maxAppointmentsPerWeek ?? 0;
  const techReschedulePolicy = profile?.policies?.reschedule;
  const techLatePolicy = profile?.policies?.late;

  const availableSlots = useMemo(() => {
    if (!selectedDate) return [];
    // Skip slots that have already started today.
    const now = new Date();
    return generateSlots(techSchedule[dayName(selectedDate)] ?? []).filter(
      (slot) => dateAtTime(slot, selectedDate) > now
    );
  }, [selectedDate, techSchedule]);

  async function handleConfirm() {
    if (!id) { Alert.alert("Error", "No nail tech selected."); return; }
    if (!appointmentType) { Alert.alert("Select service", "Please choose an appointment type."); return; }
    if (!selectedDate || !selectedSlot) { Alert.alert("Select time", "Please choose a date and time slot."); return; }
    if (!user?.uid) { Alert.alert("Sign in required", "Please sign in to book."); return; }

    const dateTime = dateAtTime(selectedSlot, selectedDate);

    try {
      setSubmitting(true);

      // Weekly limit: count the tech's active bookings in the week being booked.
      if (techMaxPerWeek > 0) {
        const [startOfWeek, endOfWeek] = weekRange(dateTime);
        const snap = await getDocs(
          query(
            collection(db, "appointments"),
            where("techId", "==", id),
            where("dateTime", ">=", Timestamp.fromDate(startOfWeek)),
            where("dateTime", "<=", Timestamp.fromDate(endOfWeek))
          )
        );
        const activeCount = snap.docs.filter((d) => d.data().status !== "declined").length;
        if (activeCount >= techMaxPerWeek) {
          Alert.alert(
            "Fully booked that week",
            `${techName} is fully booked for the week of ${startOfWeek.toLocaleDateString(undefined, { month: "short", day: "numeric" })}. Try another week.`
          );
          return;
        }
      }

      await addDoc(collection(db, "appointments"), {
        techId: id,
        clientId: user.uid,
        dateTime: Timestamp.fromDate(dateTime),
        note: note.trim(),
        status: "pending",
        appointmentType,
        ...(selectedTierKey ? { pricingTier: selectedTierKey } : {}),
        ...(altTimeRequest.trim() ? { altTimeRequest: altTimeRequest.trim() } : {}),
        ...(addRemoval && techRemovalAddOn ? { addOns: ["removal"], removalPrice: techRemovalAddOn.price } : {}),
        createdAt: Timestamp.now(),
      });

      setConfirmed(true);
      setTimeout(() => router.back(), 800);
    } catch (err) {
      console.error("Error creating appointment:", err);
      Alert.alert("Booking failed", "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const topPadding = insets.top + 24;
  const hasPolicies = techReschedulePolicy || techLatePolicy;
  const hasSchedule = Object.keys(techSchedule).length > 0;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={24} color={Polish.colors.text} />
      </TouchableOpacity>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="calendar-outline" size={28} color={Polish.colors.primary} />
          </View>
          <Text style={styles.title}>
            Book with {tech?.name ?? name ?? "Nail Tech"}
          </Text>
        </View>

        {(techTools.length > 0 || techDesigns.length > 0) && (
          <View style={styles.section}>
            {techTools.length > 0 && (
              <>
                <Text style={styles.label}>Tools / Techniques</Text>
                <Text style={styles.techTags}>{techTools.join(" · ")}</Text>
              </>
            )}
            {techDesigns.length > 0 && (
              <>
                <Text style={[styles.label, techTools.length > 0 && { marginTop: Polish.spacing.lg }]}>Designs</Text>
                <Text style={styles.techTags}>{techDesigns.join(" · ")}</Text>
              </>
            )}
          </View>
        )}

        {/* Appointment Type */}
        <View style={styles.section}>
          <Text style={styles.label}>Service type</Text>
          <View style={styles.typeRow}>
            {(APPOINTMENT_TYPES as readonly string[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeButton, appointmentType === type && styles.typeButtonSelected]}
                onPress={() => setAppointmentType(type)}
                activeOpacity={0.8}
              >
                <Text style={[styles.typeButtonText, appointmentType === type && styles.typeButtonTextSelected]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Pricing */}
        {techUsePricingTiers ? (
          techPricingTiers.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.label}>Select a tier</Text>
              {techPricingTiers.map(({ key, tier }) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.tierOption, selectedTierKey === key && styles.tierOptionSelected]}
                  onPress={() => setSelectedTierKey(selectedTierKey === key ? "" : key)}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tierName, selectedTierKey === key && styles.tierNameSelected]}>
                      {tier.name}
                    </Text>
                    {tier.description ? <Text style={styles.tierDesc}>{tier.description}</Text> : null}
                  </View>
                  <Text style={[styles.tierPrice, selectedTierKey === key && styles.tierPriceSelected]}>
                    ${tier.price}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )
        ) : (
          techPricingDescription ? (
            <View style={styles.section}>
              <Text style={styles.label}>Pricing</Text>
              <Text style={styles.techTags}>{techPricingDescription}</Text>
            </View>
          ) : null
        )}

        {/* Gel removal add-on */}
        {techRemovalAddOn && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.removalRow}
              onPress={() => setAddRemoval(!addRemoval)}
              activeOpacity={0.8}
            >
              <View style={[styles.removalCheckbox, addRemoval && styles.removalCheckboxChecked]}>
                {addRemoval && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={styles.removalLabel}>Add gel removal</Text>
              <Text style={styles.removalPrice}>+${techRemovalAddOn.price}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Date & Time */}
        <View style={styles.section}>
          <Text style={styles.label}>Select a date</Text>
          {!hasSchedule ? (
            <Text style={styles.noScheduleText}>This tech hasn’t set their availability yet.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
              {upcomingDates.map((date, i) => {
                const day = dayName(date);
                const available = !!techSchedule[day]?.length;
                const isSelected = selectedDate?.toDateString() === date.toDateString();
                const isToday = i === 0;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.dateChip,
                      isSelected && styles.dateChipSelected,
                      !available && styles.dateChipDisabled,
                    ]}
                    onPress={() => {
                      if (!available) return;
                      setSelectedDate(date);
                      setSelectedSlot(null);
                    }}
                    activeOpacity={available ? 0.8 : 1}
                  >
                    <Text style={[
                      styles.dateChipDay,
                      isSelected && styles.dateChipTextSelected,
                      !available && styles.dateChipTextDisabled,
                    ]}>
                      {isToday ? 'Today' : day.slice(0, 3)}
                    </Text>
                    <Text style={[
                      styles.dateChipNum,
                      isSelected && styles.dateChipTextSelected,
                      !available && styles.dateChipTextDisabled,
                    ]}>
                      {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {selectedDate && availableSlots.length > 0 && (
            <View style={{ marginTop: Polish.spacing.lg }}>
              <Text style={[styles.label, { marginBottom: Polish.spacing.md }]}>Select a time</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.slotRow}>
                  {availableSlots.map((slot) => (
                    <TouchableOpacity
                      key={slot}
                      style={[styles.slotChip, selectedSlot === slot && styles.slotChipSelected]}
                      onPress={() => setSelectedSlot(slot)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.slotText, selectedSlot === slot && styles.slotTextSelected]}>
                        {formatTime(slot)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Design, color, inspo, etc."
            placeholderTextColor={Polish.colors.textMuted}
            onSubmitEditing={() => Keyboard.dismiss()}
            submitBehavior="blurAndSubmit"
            style={styles.textArea}
            multiline
          />
        </View>

        {/* Alternative time request */}
        <View style={styles.section}>
          <Text style={styles.label}>Can’t find the right time?</Text>
          <TextInput
            value={altTimeRequest}
            onChangeText={setAltTimeRequest}
            placeholder="Describe when you're free (e.g. 'weekday evenings after 6pm')"
            placeholderTextColor={Polish.colors.textMuted}
            style={styles.textArea}
            multiline
            numberOfLines={2}
          />
        </View>

        {/* Policies */}
        {hasPolicies ? (
          <View style={styles.policiesBox}>
            <Text style={styles.policiesTitle}>Policies</Text>
            {techReschedulePolicy ? (
              <View style={styles.policyItem}>
                <Text style={styles.policyLabel}>Reschedule</Text>
                <Text style={styles.policyText}>{techReschedulePolicy}</Text>
              </View>
            ) : null}
            {techLatePolicy ? (
              <View style={styles.policyItem}>
                <Text style={styles.policyLabel}>Late</Text>
                <Text style={styles.policyText}>{techLatePolicy}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={handleConfirm}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <Text style={styles.buttonText}>Booking...</Text>
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
              <Text style={styles.buttonText}>Confirm Booking</Text>
            </>
          )}
        </TouchableOpacity>

        {confirmed && (
          <View style={styles.confirmBanner}>
            <Ionicons name="checkmark-circle" size={24} color={Polish.colors.success} />
            <Text style={styles.confirmText}>Booking requested!</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Polish.colors.background },
  backButton: { paddingHorizontal: Polish.spacing.lg, paddingVertical: Polish.spacing.sm, alignSelf: 'flex-start' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Polish.spacing.xl, paddingTop: Polish.spacing.xl, paddingBottom: Polish.spacing.xxxl },
  header: { alignItems: "center", marginBottom: Polish.spacing.xxl },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: Polish.radius.lg,
    backgroundColor: Polish.colors.accent + "50",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Polish.spacing.lg,
  },
  title: { ...Polish.typography.title, color: Polish.colors.text, textAlign: "center" },
  section: { marginBottom: Polish.spacing.xxl },
  label: { ...Polish.typography.label, color: Polish.colors.text, marginBottom: Polish.spacing.md },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: Polish.spacing.sm },
  typeButton: {
    paddingHorizontal: Polish.spacing.md,
    paddingVertical: Polish.spacing.sm,
    borderRadius: Polish.radius.xl,
    borderWidth: 1,
    borderColor: Polish.colors.border,
    backgroundColor: Polish.colors.surface,
  },
  typeButtonSelected: { backgroundColor: Polish.colors.primary, borderColor: Polish.colors.primary },
  typeButtonText: { ...Polish.typography.caption, color: Polish.colors.textSecondary, fontWeight: "600" },
  typeButtonTextSelected: { color: "#fff" },
  tierOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Polish.spacing.lg,
    borderRadius: Polish.radius.md,
    borderWidth: 1,
    borderColor: Polish.colors.border,
    backgroundColor: Polish.colors.surface,
    marginBottom: Polish.spacing.sm,
  },
  tierOptionSelected: { borderColor: Polish.colors.primary, borderWidth: 2, backgroundColor: Polish.colors.primary + "08" },
  tierName: { ...Polish.typography.bodyMedium, color: Polish.colors.text },
  tierNameSelected: { color: Polish.colors.primary },
  tierDesc: { ...Polish.typography.caption, color: Polish.colors.textMuted, marginTop: 2 },
  tierPrice: { ...Polish.typography.bodyMedium, color: Polish.colors.textSecondary, fontWeight: "700" },
  tierPriceSelected: { color: Polish.colors.primary },
  noScheduleText: { ...Polish.typography.body, color: Polish.colors.textMuted, fontStyle: 'italic' },
  dateScroll: { marginBottom: Polish.spacing.sm },
  dateChip: {
    alignItems: 'center',
    paddingHorizontal: Polish.spacing.md,
    paddingVertical: Polish.spacing.md,
    borderRadius: Polish.radius.md,
    borderWidth: 1,
    borderColor: Polish.colors.border,
    backgroundColor: Polish.colors.surface,
    marginRight: Polish.spacing.sm,
    minWidth: 64,
  },
  dateChipSelected: { backgroundColor: Polish.colors.primary, borderColor: Polish.colors.primary },
  dateChipDisabled: { backgroundColor: Polish.colors.borderLight, borderColor: Polish.colors.borderLight },
  dateChipDay: { ...Polish.typography.caption, fontWeight: '600', color: Polish.colors.text, marginBottom: 2 },
  dateChipNum: { ...Polish.typography.caption, color: Polish.colors.textSecondary },
  dateChipTextSelected: { color: '#fff' },
  dateChipTextDisabled: { color: Polish.colors.textMuted },
  slotRow: { flexDirection: 'row', gap: Polish.spacing.sm },
  slotChip: {
    paddingHorizontal: Polish.spacing.md,
    paddingVertical: Polish.spacing.sm,
    borderRadius: Polish.radius.xl,
    borderWidth: 1,
    borderColor: Polish.colors.border,
    backgroundColor: Polish.colors.surface,
  },
  slotChipSelected: { backgroundColor: Polish.colors.primary, borderColor: Polish.colors.primary },
  slotText: { ...Polish.typography.caption, color: Polish.colors.text, fontWeight: '500' },
  slotTextSelected: { color: '#fff' },
  textArea: {
    ...Polish.typography.body,
    padding: Polish.spacing.lg,
    borderRadius: Polish.radius.md,
    backgroundColor: Polish.colors.surface,
    borderWidth: 1,
    borderColor: Polish.colors.border,
    color: Polish.colors.text,
    minHeight: 96,
    textAlignVertical: "top",
  },
  policiesBox: {
    backgroundColor: Polish.colors.surface,
    borderRadius: Polish.radius.md,
    padding: Polish.spacing.lg,
    borderWidth: 1,
    borderColor: Polish.colors.borderLight,
    marginBottom: Polish.spacing.xxl,
  },
  policiesTitle: {
    ...Polish.typography.caption,
    color: Polish.colors.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Polish.spacing.md,
  },
  policyItem: { marginBottom: Polish.spacing.sm },
  policyLabel: { ...Polish.typography.caption, color: Polish.colors.textSecondary, fontWeight: "600", marginBottom: 2 },
  policyText: { ...Polish.typography.caption, color: Polish.colors.text, lineHeight: 18 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Polish.spacing.sm,
    paddingVertical: Polish.spacing.lg,
    borderRadius: Polish.radius.lg,
    backgroundColor: Polish.colors.primary,
    ...Polish.shadow,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { ...Polish.typography.button, color: "#fff" },
  confirmBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Polish.spacing.sm,
    marginTop: Polish.spacing.xl,
    padding: Polish.spacing.lg,
    borderRadius: Polish.radius.md,
    backgroundColor: Polish.colors.success + "18",
  },
  confirmText: { ...Polish.typography.bodyMedium, color: Polish.colors.success },
  techTags: { ...Polish.typography.body, color: Polish.colors.textSecondary, lineHeight: 22 },
  removalRow: { flexDirection: 'row', alignItems: 'center', gap: Polish.spacing.md },
  removalCheckbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Polish.colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Polish.colors.surface },
  removalCheckboxChecked: { backgroundColor: Polish.colors.primary, borderColor: Polish.colors.primary },
  removalLabel: { ...Polish.typography.body, color: Polish.colors.text, flex: 1 },
  removalPrice: { ...Polish.typography.bodyMedium, color: Polish.colors.primary, fontWeight: '700' },
});
