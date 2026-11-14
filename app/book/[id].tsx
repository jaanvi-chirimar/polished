import { BackHeader, Button, Chip, ui } from "@/components/ui";
import { APPOINTMENT_TYPES } from "@/constants/nailTechOptions";
import { Polish } from "@/constants/theme";
import { PricingTierKey, useAuth } from "@/contexts/AuthContext";
import { db } from "@/firebase/config";
import { enabledTiers, fetchTech, Tech, usesPricingTiers } from "@/lib/techs";
import { dateAtTime, dayName, formatTime, generateSlots } from "@/lib/time";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { addDoc, collection, getDocs, query, Timestamp, where } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Keyboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
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

  const hasSchedule = Object.keys(techSchedule).length > 0;

  return (
    <View style={[ui.screen, { paddingTop: insets.top + 24, paddingHorizontal: Polish.spacing.xl }]}>
      <BackHeader title={`Book with ${tech?.name ?? name ?? "Nail Tech"}`} />
      <ScrollView contentContainerStyle={{ paddingBottom: Polish.spacing.xxxl }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {(techTools.length > 0 || techDesigns.length > 0) && (
          <Section label="Services">
            {techTools.length > 0 && <Text style={ui.body}>{techTools.join(" · ")}</Text>}
            {techDesigns.length > 0 && <Text style={[ui.body, { marginTop: Polish.spacing.sm }]}>{techDesigns.join(" · ")}</Text>}
          </Section>
        )}

        <Section label="Service type">
          <View style={ui.chipRow}>
            {APPOINTMENT_TYPES.map((type) => (
              <Chip key={type} label={type} selected={appointmentType === type} onPress={() => setAppointmentType(type)} />
            ))}
          </View>
        </Section>

        {techUsePricingTiers && techPricingTiers.length > 0 && (
          <Section label="Select a tier">
            {techPricingTiers.map(({ key, tier }) => {
              const on = selectedTierKey === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[ui.card, ui.row, styles.option, on && styles.optionSelected]}
                  onPress={() => setSelectedTierKey(on ? "" : key)}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[ui.label, { marginBottom: 0 }, on && styles.selectedText]}>{tier.name}</Text>
                    {tier.description ? <Text style={ui.muted}>{tier.description}</Text> : null}
                  </View>
                  <Text style={[styles.price, on && styles.selectedText]}>${tier.price}</Text>
                </TouchableOpacity>
              );
            })}
          </Section>
        )}
        {!techUsePricingTiers && techPricingDescription ? (
          <Section label="Pricing">
            <Text style={ui.body}>{techPricingDescription}</Text>
          </Section>
        ) : null}

        {techRemovalAddOn && (
          <Section>
            <TouchableOpacity style={ui.row} onPress={() => setAddRemoval(!addRemoval)} activeOpacity={0.8}>
              <Ionicons name={addRemoval ? "checkbox" : "square-outline"} size={22} color={Polish.colors.primary} />
              <Text style={[ui.body, { flex: 1, color: Polish.colors.text }]}>Add gel removal</Text>
              <Text style={styles.price}>+${techRemovalAddOn.price}</Text>
            </TouchableOpacity>
          </Section>
        )}

        <Section label="Select a date">
          {!hasSchedule ? (
            <Text style={ui.body}>This tech hasn’t set their availability yet.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ui.row}>
              {upcomingDates.map((date, i) => {
                const day = dayName(date);
                const short = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
                return (
                  <Chip
                    key={short}
                    label={`${i === 0 ? "Today" : day.slice(0, 3)}\n${short}`}
                    selected={selectedDate?.toDateString() === date.toDateString()}
                    disabled={!techSchedule[day]?.length}
                    onPress={() => {
                      setSelectedDate(date);
                      setSelectedSlot(null);
                    }}
                  />
                );
              })}
            </ScrollView>
          )}
          {selectedDate && availableSlots.length > 0 && (
            <>
              <Text style={[ui.label, ui.spaced]}>Select a time</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ui.row}>
                {availableSlots.map((slot) => (
                  <Chip key={slot} label={formatTime(slot)} selected={selectedSlot === slot} onPress={() => setSelectedSlot(slot)} />
                ))}
              </ScrollView>
            </>
          )}
        </Section>

        <Section label="Notes (optional)">
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Design, color, inspo, etc."
            placeholderTextColor={Polish.colors.textMuted}
            onSubmitEditing={() => Keyboard.dismiss()}
            submitBehavior="blurAndSubmit"
            style={[ui.input, ui.textArea]}
            multiline
          />
        </Section>

        <Section label="Can’t find the right time?">
          <TextInput
            value={altTimeRequest}
            onChangeText={setAltTimeRequest}
            placeholder="Describe when you're free (e.g. 'weekday evenings after 6pm')"
            placeholderTextColor={Polish.colors.textMuted}
            style={[ui.input, ui.textArea]}
            multiline
          />
        </Section>

        {techReschedulePolicy || techLatePolicy ? (
          <View style={[ui.card, { marginBottom: Polish.spacing.xxl }]}>
            <Text style={ui.label}>Policies</Text>
            {techReschedulePolicy ? <Text style={ui.caption}>Reschedule: {techReschedulePolicy}</Text> : null}
            {techLatePolicy ? <Text style={ui.caption}>Late: {techLatePolicy}</Text> : null}
          </View>
        ) : null}

        <Button icon="checkmark-circle-outline" title="Confirm Booking" loading={submitting} onPress={handleConfirm} />

        {confirmed && (
          <View style={[ui.row, styles.confirmed]}>
            <Ionicons name="checkmark-circle" size={24} color={Polish.colors.success} />
            <Text style={[ui.label, { marginBottom: 0, color: Polish.colors.success }]}>Booking requested!</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: Polish.spacing.xxl }}>
      {label ? <Text style={ui.label}>{label}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  option: { marginBottom: Polish.spacing.sm },
  optionSelected: { borderColor: Polish.colors.primary, borderWidth: 2 },
  selectedText: { color: Polish.colors.primary },
  price: { ...Polish.typography.bodyMedium, color: Polish.colors.primary, fontWeight: "700" },
  confirmed: {
    justifyContent: "center",
    marginTop: Polish.spacing.xl,
    padding: Polish.spacing.lg,
    borderRadius: Polish.radius.md,
    backgroundColor: Polish.colors.success + "18",
  },
});
