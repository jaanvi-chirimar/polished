import Stars from "@/components/Stars";
import { Polish } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/firebase/config";
import { enabledTiers, fetchTech, Tech } from "@/lib/techs";
import { formatSchedule } from "@/lib/time";
import { getThreadId, getUserName } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SCREEN_WIDTH = Dimensions.get("window").width;

type Review = { id: string; clientName: string; rating: number; comment: string };

export default function TechProfile() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { id, name } = useLocalSearchParams<{ id?: string; name?: string }>();
  const router = useRouter();

  const [tech, setTech] = useState<Tech | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!id) {
        setError("No ID provided");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const loaded = await fetchTech(id);
        if (!mounted) return;
        if (!loaded) return setError("Tech not found");
        if (!loaded.isTech) return setError("User is not a nail tech");
        setTech(loaded);

        const reviewsSnap = await getDocs(query(collection(db, "reviews"), where("techId", "==", id)));
        if (!mounted) return;
        const all = reviewsSnap.docs.map((d) => d.data());
        setReviewCount(all.length);
        if (all.length > 0) setAvgRating(all.reduce((sum, r) => sum + (r.rating ?? 0), 0) / all.length);

        // Show the 10 newest, with reviewer names
        const newest = reviewsSnap.docs
          .sort((a, b) => (b.data().createdAt?.toMillis?.() ?? 0) - (a.data().createdAt?.toMillis?.() ?? 0))
          .slice(0, 10);
        const withNames = await Promise.all(
          newest.map(async (d) => {
            const r = d.data();
            return {
              id: d.id,
              clientName: await getUserName(r.clientId, "Client"),
              rating: r.rating,
              comment: r.comment || "",
            };
          })
        );
        if (mounted) setReviews(withNames);
      } catch (e: any) {
        if (mounted) setError(String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [id]);

  const techName = tech?.name ?? name ?? "Nail Tech";
  const isOwnProfile = user?.uid === id;
  const profile = tech?.profile;

  function handleBookPress() {
    if (!id) return;
    router.push({ pathname: "/book/[id]", params: { id, name: techName } });
  }

  function handleMessagePress() {
    if (!id || !user?.uid) return;
    router.push(`/(tabs)/inbox/chat/${getThreadId(user.uid, id)}`);
  }

  const topPadding = insets.top + 24;
  const schedule = formatSchedule(profile?.availabilities?.schedule);
  const tiers = enabledTiers(profile);
  const policies = profile?.policies;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={Polish.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        {isOwnProfile ? (
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/profile")}
            style={styles.editButton}
            activeOpacity={0.7}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Polish.colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={Polish.colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <Text style={styles.title}>{techName}</Text>
            {avgRating !== null && (
              <View style={styles.ratingRow}>
                <Stars rating={avgRating} size={16} />
                <Text style={styles.ratingText}>
                  {avgRating.toFixed(1)} ({reviewCount} review{reviewCount !== 1 ? "s" : ""})
                </Text>
              </View>
            )}
          </View>

          {profile?.portfolio?.length ? (
            <View style={styles.portfolioSection}>
              <Text style={styles.label}>Portfolio</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.portfolioScroll}>
                {profile.portfolio.map((url, idx) => (
                  <Image
                    key={idx}
                    source={{ uri: url }}
                    style={[styles.portfolioPhoto, { width: SCREEN_WIDTH * 0.55 }]}
                    contentFit="cover"
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.section}>
            {tech?.location ? (
              <View style={styles.row}>
                <Ionicons name="location-outline" size={20} color={Polish.colors.textSecondary} />
                <Text style={styles.bodyText}>{tech.location}</Text>
              </View>
            ) : null}
            {profile?.bio ? (
              <View style={styles.bioRow}>
                <Text style={styles.label}>About</Text>
                <Text style={styles.bodyText}>{profile.bio}</Text>
              </View>
            ) : null}
            <View style={styles.availRow}>
              <Text style={styles.label}>Tools / Techniques</Text>
              {profile?.tools?.length ? (
                <Text style={styles.bodyText}>{profile.tools.join(", ")}</Text>
              ) : (
                <Text style={styles.mutedText}>Not specified</Text>
              )}
            </View>
            <View style={styles.availRow}>
              <Text style={styles.label}>Designs</Text>
              {profile?.designs?.length ? (
                <Text style={styles.bodyText}>{profile.designs.join(", ")}</Text>
              ) : (
                <Text style={styles.mutedText}>Not specified</Text>
              )}
            </View>
            {schedule ? (
              <View style={styles.availRow}>
                <Text style={styles.label}>Available</Text>
                <Text style={styles.bodyText}>{schedule}</Text>
              </View>
            ) : null}
          </View>

          {/* Pricing */}
          {tiers.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.label}>Pricing Tiers</Text>
              {tiers.map(({ key, label, tier }) => (
                <View key={key} style={styles.pricingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pricingTierName}>{label}</Text>
                    {tier.description ? <Text style={styles.mutedText}>{tier.description}</Text> : null}
                  </View>
                  {tier.price > 0 ? <Text style={styles.pricingAmount}>${tier.price}</Text> : null}
                </View>
              ))}
            </View>
          )}

          {/* Payment Methods */}
          {profile?.paymentMethods?.length ? (
            <View style={styles.section}>
              <Text style={styles.label}>Accepted Payment</Text>
              <View style={styles.dayChips}>
                {profile.paymentMethods.map((m) => (
                  <View key={m} style={styles.dayChip}>
                    <Text style={styles.dayChipText}>{m}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Policies */}
          {policies?.reschedule || policies?.late ? (
            <View style={styles.section}>
              <Text style={styles.label}>Policies</Text>
              {policies.reschedule ? (
                <View style={styles.policyBlock}>
                  <Text style={styles.policyLabel}>Reschedule</Text>
                  <Text style={styles.bodyText}>{policies.reschedule}</Text>
                </View>
              ) : null}
              {policies.late ? (
                <View style={styles.policyBlock}>
                  <Text style={styles.policyLabel}>Late</Text>
                  <Text style={styles.bodyText}>{policies.late}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.label}>Reviews</Text>
            {reviews.length > 0 ? reviews.map((r) => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewAuthor}>{r.clientName}</Text>
                  <Stars rating={r.rating} size={13} />
                </View>
                {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
              </View>
            )) : (
              <Text style={styles.reviewComment}>No reviews yet.</Text>
            )}
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary]}
              onPress={handleBookPress}
              activeOpacity={0.85}
            >
              <Ionicons name="calendar-outline" size={20} color="#fff" />
              <Text style={styles.buttonText}>Book</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={handleMessagePress}
              activeOpacity={0.85}
              disabled={!user?.uid}
            >
              <Ionicons name="chatbubble-outline" size={20} color={Polish.colors.primary} />
              <Text style={[styles.buttonText, styles.buttonTextSecondary]}>Message</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Polish.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Polish.spacing.lg,
    paddingHorizontal: Polish.spacing.sm,
  },
  backButton: {
    padding: Polish.spacing.sm,
    marginRight: Polish.spacing.sm,
  },
  headerTitle: {
    ...Polish.typography.title,
    color: Polish.colors.text,
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: { width: 44 },
  editButton: { padding: Polish.spacing.sm },
  editButtonText: {
    ...Polish.typography.button,
    color: Polish.colors.primary,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Polish.spacing.xxl,
  },
  loadingText: {
    ...Polish.typography.body,
    color: Polish.colors.textSecondary,
    marginTop: Polish.spacing.lg,
  },
  errorText: {
    ...Polish.typography.body,
    color: Polish.colors.error,
    marginTop: Polish.spacing.lg,
    textAlign: "center",
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Polish.spacing.xl,
    paddingTop: Polish.spacing.xl,
    paddingBottom: Polish.spacing.xxxl,
  },
  hero: {
    alignItems: "center",
    marginBottom: Polish.spacing.xxl,
  },
  title: {
    ...Polish.typography.title,
    color: Polish.colors.text,
    textAlign: "center",
  },
  section: {
    backgroundColor: Polish.colors.surface,
    borderRadius: Polish.radius.lg,
    padding: Polish.spacing.xl,
    marginBottom: Polish.spacing.xxl,
    borderWidth: 1,
    borderColor: Polish.colors.borderLight,
    ...Polish.shadowSm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Polish.spacing.md,
    marginBottom: Polish.spacing.md,
  },
  bioRow: { marginBottom: Polish.spacing.lg },
  availRow: { marginTop: Polish.spacing.sm },
  label: {
    ...Polish.typography.label,
    color: Polish.colors.textSecondary,
    marginBottom: Polish.spacing.sm,
  },
  bodyText: {
    ...Polish.typography.body,
    color: Polish.colors.text,
    lineHeight: 22,
  },
  mutedText: {
    ...Polish.typography.body,
    color: Polish.colors.textMuted,
    lineHeight: 22,
  },
  dayChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Polish.spacing.sm,
  },
  dayChip: {
    paddingHorizontal: Polish.spacing.md,
    paddingVertical: Polish.spacing.sm,
    borderRadius: Polish.radius.full,
    backgroundColor: Polish.colors.accent + "40",
  },
  dayChipText: {
    ...Polish.typography.caption,
    fontWeight: "600",
    color: Polish.colors.text,
  },
  buttonRow: {
    flexDirection: "row",
    gap: Polish.spacing.md,
    marginBottom: Polish.spacing.lg,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Polish.spacing.sm,
    paddingVertical: Polish.spacing.lg,
    paddingHorizontal: Polish.spacing.lg,
    borderRadius: Polish.radius.lg,
    ...Polish.shadow,
  },
  buttonPrimary: { backgroundColor: Polish.colors.primary },
  buttonSecondary: {
    backgroundColor: Polish.colors.surface,
    borderWidth: 2,
    borderColor: Polish.colors.primary,
  },
  buttonText: {
    ...Polish.typography.button,
    color: "#fff",
  },
  buttonTextSecondary: { color: Polish.colors.primary },
  pricingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: Polish.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Polish.colors.borderLight,
  },
  pricingTierName: {
    ...Polish.typography.bodyMedium,
    color: Polish.colors.text,
    marginBottom: 2,
  },
  pricingAmount: {
    ...Polish.typography.bodyMedium,
    color: Polish.colors.primary,
    fontWeight: "700",
  },
  policyBlock: {
    marginBottom: Polish.spacing.md,
  },
  policyLabel: {
    ...Polish.typography.caption,
    color: Polish.colors.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Polish.spacing.sm,
    marginTop: Polish.spacing.sm,
  },
  ratingText: {
    ...Polish.typography.caption,
    color: Polish.colors.textSecondary,
    fontWeight: "600",
  },
  reviewCard: {
    paddingVertical: Polish.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Polish.colors.borderLight,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  reviewAuthor: {
    ...Polish.typography.caption,
    color: Polish.colors.text,
    fontWeight: "600",
  },
  reviewComment: {
    ...Polish.typography.caption,
    color: Polish.colors.textSecondary,
    lineHeight: 18,
  },
  portfolioSection: {
    paddingHorizontal: Polish.spacing.xl,
    marginBottom: Polish.spacing.lg,
  },
  portfolioScroll: {
    marginTop: Polish.spacing.sm,
  },
  portfolioPhoto: {
    height: 200,
    borderRadius: Polish.radius.md,
    marginRight: Polish.spacing.sm,
    backgroundColor: Polish.colors.surface,
  },
});
