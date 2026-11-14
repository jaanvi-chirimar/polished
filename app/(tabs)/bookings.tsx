import { Button, CenterMessage, Stars, ui } from "@/components/ui";
import { Polish } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/firebase/config";
import { Appointment, byDateAsc, byDateDesc, subscribeToAppointments } from "@/lib/appointments";
import { createCalendarEvent, getValidAccessToken } from "@/lib/googleCalendar";
import { buildFullName, formatDateTime, getThreadId } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { addDoc, collection, doc, onSnapshot, query, Timestamp, updateDoc, where } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Modal, SectionList, StyleSheet, Text, TextInput, View } from "react-native";

type BookingsSection = {
  title: string;
  data: Appointment[];
  type: "client" | "tech";
  isPast?: boolean;
};

export default function BookingsScreen() {
  const { user, userProfile, isTech, isCustomer: isClient } = useAuth();
  const [clientAppts, setClientAppts] = useState<Appointment[]>([]);
  const [techAppts, setTechAppts] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewedMap, setReviewedMap] = useState<Map<string, number>>(new Map());
  const [reviewModal, setReviewModal] = useState<{
    appointmentId: string;
    techId: string;
    techName: string;
  } | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const myName = buildFullName(userProfile?.firstName, userProfile?.lastName, "");

  async function handleAccept(appt: Appointment) {
    await updateDoc(doc(db, "appointments", appt.id), { status: "confirmed" });
    // Add it to the tech's own calendar. The client's event is added from their own app (see below).
    const token = await getValidAccessToken(user!.uid);
    if (token) {
      const eventId = await createCalendarEvent(token, appt, myName || "Nail Tech", appt.otherName);
      if (eventId) updateDoc(doc(db, "appointments", appt.id), { techCalendarEventId: eventId });
    }
  }

  async function handleDecline(appointmentId: string) {
    await updateDoc(doc(db, "appointments", appointmentId), { status: "declined" });
  }

  function handleMessage(clientId: string) {
    if (!user?.uid) return;
    router.push(`/(tabs)/inbox/chat/${getThreadId(user.uid, clientId)}`);
  }

  async function handleSubmitReview() {
    if (!reviewModal || !user?.uid) return;
    setReviewSubmitting(true);
    try {
      await addDoc(collection(db, "reviews"), {
        techId: reviewModal.techId,
        clientId: user.uid,
        appointmentId: reviewModal.appointmentId,
        rating: reviewRating,
        comment: reviewComment.trim(),
        createdAt: Timestamp.now(),
      });
      setReviewModal(null);
    } catch {
      Alert.alert("Error", "Failed to submit review. Please try again.");
    } finally {
      setReviewSubmitting(false);
    }
  }

  // Live appointment lists (as client and/or as tech)
  useEffect(() => {
    if (!user?.uid) return;
    const done = () => setLoading(false);
    const unsubs: (() => void)[] = [];
    if (isClient) unsubs.push(subscribeToAppointments("client", user.uid, (a) => { setClientAppts(a); done(); }, done));
    if (isTech) unsubs.push(subscribeToAppointments("tech", user.uid, (a) => { setTechAppts(a); done(); }, done));
    if (!isClient && !isTech) done();
    return () => unsubs.forEach((u) => u());
  }, [user?.uid, isClient, isTech]);

  // Which appointments the client has already reviewed
  useEffect(() => {
    if (!user?.uid || !isClient) return;
    const q = query(collection(db, "reviews"), where("clientId", "==", user.uid));
    return onSnapshot(q, (snap) => {
      const map = new Map<string, number>();
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.appointmentId) map.set(data.appointmentId, data.rating);
      });
      setReviewedMap(map);
    });
  }, [user?.uid, isClient]);

  const { clientUpcoming, clientPast, techRequests, techUpcoming } = useMemo(() => {
    const now = new Date();
    return {
      clientUpcoming: clientAppts.filter((a) => a.dateTime >= now && a.status !== "declined").sort(byDateAsc),
      clientPast: clientAppts.filter((a) => a.dateTime < now).sort(byDateDesc),
      techRequests: techAppts.filter((a) => a.status === "pending").sort(byDateAsc),
      techUpcoming: techAppts.filter((a) => a.dateTime >= now && a.status === "confirmed").sort(byDateAsc),
    };
  }, [clientAppts, techAppts]);

  // Each person can only write to their own Google Calendar, so the client's app
  // adds confirmed appointments to the client's calendar.
  useEffect(() => {
    if (!user?.uid || !isClient) return;
    const needsEvent = clientUpcoming.filter((a) => a.status === "confirmed" && !a.clientCalendarEventId);
    if (needsEvent.length === 0) return;
    (async () => {
      const token = await getValidAccessToken(user.uid);
      if (!token) return;
      for (const appt of needsEvent) {
        const eventId = await createCalendarEvent(token, appt, appt.otherName, myName || "Client");
        if (eventId) updateDoc(doc(db, "appointments", appt.id), { clientCalendarEventId: eventId });
      }
    })();
  }, [clientUpcoming, user?.uid, isClient, myName]);

  if (!user) return null;

  const sections: BookingsSection[] = [];
  if (isClient) {
    if (clientUpcoming.length > 0)
      sections.push({ title: "Upcoming (as client)", data: clientUpcoming, type: "client" });
    if (clientPast.length > 0)
      sections.push({ title: "Past bookings", data: clientPast, type: "client", isPast: true });
  }
  if (isTech) {
    if (techRequests.length > 0)
      sections.push({ title: "Incoming requests", data: techRequests, type: "tech" });
    if (techUpcoming.length > 0)
      sections.push({ title: "Upcoming (as tech)", data: techUpcoming, type: "tech" });
  }

  return (
    <View style={[ui.screen, styles.container]}>
      <Text style={ui.title}>Bookings</Text>
      <Text style={[ui.caption, styles.subtitle]}>
        {isClient && isTech
          ? "Your bookings and requests"
          : isTech
            ? "Incoming requests and appointments"
            : "Your upcoming and past bookings"}
      </Text>

      {loading ? (
        <CenterMessage loading />
      ) : sections.length === 0 ? (
        <CenterMessage
          icon="calendar-outline"
          title="No bookings yet"
          subtitle={isTech ? "When clients book with you, they’ll appear here." : "Book with a nail tech from Home to see them here."}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: Polish.spacing.xxxl }}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => <Text style={[ui.subtitle, styles.sectionTitle]}>{section.title}</Text>}
          renderItem={({ item, section }) => {
            const isRequest = section.type === "tech" && item.status === "pending";
            const canReview = section.isPast && item.status !== "declined";
            const rating = reviewedMap.get(item.id);
            return (
              <View style={[ui.card, styles.card, isRequest && styles.cardPending]}>
                <View style={ui.row}>
                  <Text style={[ui.subtitle, { flex: 1 }]}>{item.otherName}</Text>
                  {!isRequest && (
                    <Text style={[styles.badge, item.status === "confirmed" && styles.badgeConfirmed]}>{item.status}</Text>
                  )}
                </View>
                <View style={[ui.row, { gap: 4 }]}>
                  <Ionicons name="calendar-outline" size={14} color={Polish.colors.textMuted} />
                  <Text style={ui.body}>{formatDateTime(item.dateTime)}</Text>
                </View>
                {item.appointmentType ? <Text style={[ui.caption, { fontWeight: "600" }]}>{item.appointmentType}</Text> : null}
                {item.note ? <Text style={[ui.muted, styles.note]} numberOfLines={2}>“{item.note}”</Text> : null}

                {canReview && (
                  <View style={styles.actions}>
                    {rating !== undefined ? (
                      <Stars rating={rating} size={16} />
                    ) : (
                      <Button
                        small
                        variant="outline"
                        icon="star-outline"
                        title="Leave a review"
                        onPress={() => {
                          setReviewRating(5);
                          setReviewComment("");
                          setReviewModal({ appointmentId: item.id, techId: item.techId, techName: item.otherName });
                        }}
                      />
                    )}
                  </View>
                )}

                {isRequest && item.altTimeRequest ? (
                  <View style={[ui.row, styles.note]}>
                    <Ionicons name="time-outline" size={13} color={Polish.colors.primary} />
                    <Text style={[ui.caption, { color: Polish.colors.primary, flex: 1 }]}>Requested: {item.altTimeRequest}</Text>
                  </View>
                ) : null}

                {isRequest && (
                  <View style={styles.actions}>
                    <Button small title="Accept" onPress={() => handleAccept(item)} style={{ flex: 1 }} />
                    <Button small variant="outline" icon="chatbubble-outline" title="Message" onPress={() => handleMessage(item.clientId)} style={{ flex: 1 }} />
                    <Button small variant="dangerOutline" title="Decline" onPress={() => handleDecline(item.id)} style={{ flex: 1 }} />
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      <Modal visible={!!reviewModal} transparent animationType="fade" onRequestClose={() => setReviewModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[ui.subtitle, { textAlign: "center" }]}>Rate {reviewModal?.techName}</Text>
            <View style={{ alignItems: "center", marginVertical: Polish.spacing.xl }}>
              <Stars rating={reviewRating} size={40} onChange={setReviewRating} />
            </View>
            <TextInput
              style={[ui.input, ui.textArea]}
              placeholder="Add a comment (optional)"
              placeholderTextColor={Polish.colors.textMuted}
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
            />
            <View style={styles.actions}>
              <Button variant="secondary" title="Cancel" onPress={() => setReviewModal(null)} style={{ flex: 1 }} />
              <Button title="Submit" loading={reviewSubmitting} onPress={handleSubmitReview} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Polish.spacing.xl, paddingTop: 56 },
  subtitle: { marginTop: 4, marginBottom: Polish.spacing.lg },
  sectionTitle: { marginTop: Polish.spacing.lg, marginBottom: Polish.spacing.sm },
  card: { marginBottom: Polish.spacing.md, gap: 4 },
  cardPending: { borderColor: Polish.colors.primary + "40", borderWidth: 1.5 },
  note: { marginTop: Polish.spacing.sm, fontStyle: "italic" },
  actions: { flexDirection: "row", gap: Polish.spacing.sm, marginTop: Polish.spacing.md },
  badge: {
    ...Polish.typography.caption,
    fontWeight: "600",
    textTransform: "capitalize",
    color: Polish.colors.textMuted,
    backgroundColor: Polish.colors.textMuted + "20",
    paddingHorizontal: Polish.spacing.md,
    paddingVertical: 3,
    borderRadius: Polish.radius.xl,
    overflow: "hidden",
  },
  badgeConfirmed: { color: Polish.colors.success, backgroundColor: Polish.colors.success + "20" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: Polish.spacing.xl },
  modalContent: { backgroundColor: Polish.colors.background, borderRadius: Polish.radius.lg, padding: Polish.spacing.xxl, ...Polish.shadow },
});
