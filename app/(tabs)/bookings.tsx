import Stars from "@/components/Stars";
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
import {
    ActivityIndicator,
    Alert,
    Modal,
    SectionList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

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
  const isEmpty = sections.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bookings</Text>
        <Text style={styles.subtitle}>
          {isClient && isTech
            ? "Your bookings and requests"
            : isTech
            ? "Incoming requests and appointments"
            : "Your upcoming and past bookings"}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Polish.colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : isEmpty ? (
        <View style={styles.center}>
          <Ionicons name="calendar-outline" size={48} color={Polish.colors.textMuted} />
          <Text style={styles.emptyText}>No bookings yet</Text>
          <Text style={styles.emptySubtext}>
            {isTech
              ? "When clients book with you, they'll appear here."
              : "Book with a nail tech from Home to see them here."}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionTitle}>{section.title}</Text>
          )}
          renderItem={({ item, section }) => {
            const isTechPending = section.type === "tech" && item.status === "pending";
            const isPastClient = section.isPast && section.type === "client";
            const existingRating = reviewedMap.get(item.id);

            return (
              <View style={[styles.card, isTechPending && styles.cardPending]}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.name}>
                    {item.otherName}
                  </Text>
                  {!isTechPending && (
                    <View
                      style={[
                        styles.statusBadge,
                        item.status === "confirmed" && styles.statusBadgeConfirmed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          item.status === "confirmed" && styles.statusBadgeTextConfirmed,
                        ]}
                      >
                        {item.status}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.dateRow}>
                  <Ionicons name="calendar-outline" size={14} color={Polish.colors.textMuted} />
                  <Text style={styles.dateText}>{formatDateTime(item.dateTime)}</Text>
                </View>
                {item.appointmentType ? (
                  <Text style={styles.apptTypeText}>{item.appointmentType}</Text>
                ) : null}
                {item.note ? (
                  <Text style={styles.noteText} numberOfLines={2}>
                    “{item.note}”
                  </Text>
                ) : null}

                {isPastClient && item.status !== "declined" && (
                  <View style={styles.reviewRow}>
                    {existingRating !== undefined ? (
                      <Stars rating={existingRating} size={16} />
                    ) : (
                      <TouchableOpacity
                        style={styles.rateButton}
                        onPress={() => {
                          setReviewRating(5);
                          setReviewComment("");
                          setReviewModal({
                            appointmentId: item.id,
                            techId: item.techId,
                            techName: item.otherName,
                          });
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="star-outline" size={14} color={Polish.colors.primary} />
                        <Text style={styles.rateButtonText}>Leave a review</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {isTechPending && item.altTimeRequest ? (
                  <View style={styles.altTimeRow}>
                    <Ionicons name="time-outline" size={13} color={Polish.colors.primary} />
                    <Text style={styles.altTimeText}>Requested: {item.altTimeRequest}</Text>
                  </View>
                ) : null}

                {isTechPending && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.acceptButton}
                      onPress={() => handleAccept(item)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.acceptButtonText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.messageButton}
                      onPress={() => handleMessage(item.clientId)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="chatbubble-outline" size={14} color={Polish.colors.primary} />
                      <Text style={styles.messageButtonText}>Message</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.declineButton}
                      onPress={() => handleDecline(item.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.declineButtonText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      <Modal
        visible={!!reviewModal}
        transparent
        animationType="fade"
        onRequestClose={() => setReviewModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rate {reviewModal?.techName}</Text>
            <View style={styles.starsRow}>
              <Stars rating={reviewRating} size={40} onChange={setReviewRating} />
            </View>
            <TextInput
              style={styles.reviewInput}
              placeholder="Add a comment (optional)"
              placeholderTextColor={Polish.colors.textMuted}
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setReviewModal(null)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, reviewSubmitting && styles.submitButtonDisabled]}
                onPress={handleSubmitReview}
                disabled={reviewSubmitting}
              >
                <Text style={styles.submitButtonText}>
                  {reviewSubmitting ? "Submitting..." : "Submit"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Polish.colors.background,
    paddingHorizontal: Polish.spacing.xl,
    paddingTop: 56,
  },
  header: { marginBottom: Polish.spacing.xxl },
  title: { ...Polish.typography.title, color: Polish.colors.text },
  subtitle: { ...Polish.typography.caption, color: Polish.colors.textSecondary, marginTop: 4 },
  sectionTitle: {
    ...Polish.typography.subtitle,
    color: Polish.colors.text,
    marginTop: Polish.spacing.lg,
    marginBottom: Polish.spacing.sm,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: {
    marginTop: Polish.spacing.lg,
    ...Polish.typography.body,
    color: Polish.colors.textSecondary,
  },
  emptyText: {
    marginTop: Polish.spacing.lg,
    ...Polish.typography.subtitle,
    color: Polish.colors.textSecondary,
  },
  emptySubtext: {
    marginTop: Polish.spacing.sm,
    ...Polish.typography.caption,
    color: Polish.colors.textMuted,
    textAlign: "center",
  },
  listContent: { paddingBottom: Polish.spacing.xxxl },
  card: {
    backgroundColor: Polish.colors.surface,
    borderRadius: Polish.radius.lg,
    padding: Polish.spacing.lg,
    marginBottom: Polish.spacing.md,
    borderWidth: 1,
    borderColor: Polish.colors.borderLight,
    ...Polish.shadowSm,
  },
  cardPending: { borderColor: Polish.colors.primary + "40", borderWidth: 1.5 },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  name: {
    ...Polish.typography.subtitle,
    color: Polish.colors.text,
    flex: 1,
    marginRight: Polish.spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: Polish.spacing.md,
    paddingVertical: 3,
    borderRadius: Polish.radius.xl,
    backgroundColor: Polish.colors.textMuted + "20",
  },
  statusBadgeConfirmed: { backgroundColor: Polish.colors.success + "20" },
  statusBadgeText: {
    ...Polish.typography.caption,
    color: Polish.colors.textMuted,
    textTransform: "capitalize",
    fontWeight: "600",
  },
  statusBadgeTextConfirmed: { color: Polish.colors.success },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 },
  dateText: { ...Polish.typography.body, color: Polish.colors.textSecondary },
  noteText: {
    ...Polish.typography.caption,
    color: Polish.colors.textMuted,
    marginTop: Polish.spacing.sm,
    fontStyle: "italic",
  },
  apptTypeText: {
    ...Polish.typography.caption,
    color: Polish.colors.textSecondary,
    fontWeight: "600",
    marginTop: 2,
  },
  reviewRow: { marginTop: Polish.spacing.md, flexDirection: "row", alignItems: "center" },
  rateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: Polish.spacing.md,
    borderRadius: Polish.radius.lg,
    borderWidth: 1,
    borderColor: Polish.colors.primary,
  },
  rateButtonText: {
    ...Polish.typography.caption,
    color: Polish.colors.primary,
    fontWeight: "600",
  },
  altTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Polish.spacing.sm },
  altTimeText: { ...Polish.typography.caption, color: Polish.colors.primary, flex: 1 },
  actionRow: { flexDirection: "row", gap: Polish.spacing.sm, marginTop: Polish.spacing.md },
  acceptButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Polish.spacing.sm,
    borderRadius: Polish.radius.lg,
    backgroundColor: Polish.colors.primary,
  },
  acceptButtonText: { ...Polish.typography.caption, color: "#fff", fontWeight: "600" },
  messageButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: Polish.spacing.sm,
    borderRadius: Polish.radius.lg,
    borderWidth: 1,
    borderColor: Polish.colors.primary,
  },
  messageButtonText: {
    ...Polish.typography.caption,
    color: Polish.colors.primary,
    fontWeight: "600",
  },
  declineButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Polish.spacing.sm,
    borderRadius: Polish.radius.lg,
    borderWidth: 1,
    borderColor: Polish.colors.error,
  },
  declineButtonText: { ...Polish.typography.caption, color: Polish.colors.error, fontWeight: "600" },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: Polish.spacing.xl,
  },
  modalContent: {
    backgroundColor: Polish.colors.background,
    borderRadius: Polish.radius.lg,
    padding: Polish.spacing.xxl,
    width: "100%",
    ...Polish.shadow,
  },
  modalTitle: {
    ...Polish.typography.subtitle,
    color: Polish.colors.text,
    marginBottom: Polish.spacing.xl,
    textAlign: "center",
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Polish.spacing.md,
    marginBottom: Polish.spacing.xl,
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: Polish.colors.border,
    borderRadius: Polish.radius.md,
    padding: Polish.spacing.lg,
    ...Polish.typography.body,
    color: Polish.colors.text,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: Polish.spacing.xl,
    backgroundColor: Polish.colors.surface,
  },
  modalActions: { flexDirection: "row", gap: Polish.spacing.md },
  cancelButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Polish.spacing.lg,
    borderRadius: Polish.radius.md,
    borderWidth: 1,
    borderColor: Polish.colors.border,
  },
  cancelButtonText: { ...Polish.typography.button, color: Polish.colors.textSecondary },
  submitButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Polish.spacing.lg,
    borderRadius: Polish.radius.md,
    backgroundColor: Polish.colors.primary,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { ...Polish.typography.button, color: "#fff" },
});
