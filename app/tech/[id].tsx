import { BackHeader, Button, CenterMessage, Chip, Stars, ui } from "@/components/ui";
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
import { Dimensions, ScrollView, StyleSheet, Text, View } from "react-native";
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

  const schedule = formatSchedule(profile?.availabilities?.schedule);
  const tiers = enabledTiers(profile);
  const policies = profile?.policies;

  return (
    <View style={[ui.screen, { paddingTop: insets.top + 24, paddingHorizontal: Polish.spacing.xl }]}>
      <BackHeader
        title="Profile"
        right={isOwnProfile ? <Button small variant="outline" title="Edit" onPress={() => router.push("/(tabs)/profile")} /> : null}
      />
      {loading ? (
        <CenterMessage loading />
      ) : error ? (
        <CenterMessage icon="alert-circle-outline" title={error} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: Polish.spacing.xxxl }} showsVerticalScrollIndicator={false}>
          <Text style={[ui.title, styles.center]}>{techName}</Text>
          {avgRating !== null && (
            <View style={[ui.row, styles.ratingRow]}>
              <Stars rating={avgRating} size={16} />
              <Text style={ui.caption}>
                {avgRating.toFixed(1)} ({reviewCount} review{reviewCount !== 1 ? "s" : ""})
              </Text>
            </View>
          )}

          {profile?.portfolio?.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.section}>
              {profile.portfolio.map((url) => (
                <Image key={url} source={{ uri: url }} style={styles.photo} contentFit="cover" />
              ))}
            </ScrollView>
          ) : null}

          <View style={[ui.card, styles.section]}>
            {tech?.location ? (
              <View style={ui.row}>
                <Ionicons name="location-outline" size={20} color={Polish.colors.textSecondary} />
                <Text style={ui.body}>{tech.location}</Text>
              </View>
            ) : null}
            <Info label="About" text={profile?.bio} />
            <Info label="Tools / Techniques" text={profile?.tools?.join(", ") || "Not specified"} />
            <Info label="Designs" text={profile?.designs?.join(", ") || "Not specified"} />
            <Info label="Available" text={schedule} />
          </View>

          {tiers.length > 0 && (
            <View style={[ui.card, styles.section]}>
              <Text style={ui.label}>Pricing Tiers</Text>
              {tiers.map(({ key, label, tier }) => (
                <View key={key} style={[ui.row, styles.tierRow]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[ui.body, { color: Polish.colors.text }]}>{label}</Text>
                    {tier.description ? <Text style={ui.muted}>{tier.description}</Text> : null}
                  </View>
                  {tier.price > 0 ? <Text style={styles.price}>${tier.price}</Text> : null}
                </View>
              ))}
            </View>
          )}

          {profile?.paymentMethods?.length ? (
            <View style={[ui.card, styles.section]}>
              <Text style={ui.label}>Accepted Payment</Text>
              <View style={[ui.chipRow, { marginBottom: 0 }]}>
                {profile.paymentMethods.map((m) => <Chip key={m} label={m} />)}
              </View>
            </View>
          ) : null}

          {policies?.reschedule || policies?.late ? (
            <View style={[ui.card, styles.section]}>
              <Text style={ui.label}>Policies</Text>
              <Info label="Reschedule" text={policies.reschedule} />
              <Info label="Late" text={policies.late} />
            </View>
          ) : null}

          <View style={[ui.card, styles.section]}>
            <Text style={ui.label}>Reviews</Text>
            {reviews.length === 0 && <Text style={ui.body}>No reviews yet.</Text>}
            {reviews.map((r) => (
              <View key={r.id} style={styles.review}>
                <View style={[ui.row, { justifyContent: "space-between" }]}>
                  <Text style={[ui.caption, { fontWeight: "600" }]}>{r.clientName}</Text>
                  <Stars rating={r.rating} size={13} />
                </View>
                {r.comment ? <Text style={ui.body}>{r.comment}</Text> : null}
              </View>
            ))}
          </View>

          <View style={styles.buttons}>
            <Button icon="calendar-outline" title="Book" onPress={handleBookPress} style={{ flex: 1 }} />
            <Button variant="outline" icon="chatbubble-outline" title="Message" onPress={handleMessagePress} disabled={!user?.uid} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

/** A small label with text under it. Renders nothing if there's no text. */
function Info({ label, text }: { label: string; text?: string }) {
  if (!text) return null;
  return (
    <View style={{ marginTop: Polish.spacing.md }}>
      <Text style={[ui.muted, { fontWeight: "600" }]}>{label}</Text>
      <Text style={ui.body}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: "center" },
  ratingRow: { justifyContent: "center", marginTop: Polish.spacing.sm },
  section: { marginTop: Polish.spacing.lg },
  photo: { width: SCREEN_WIDTH * 0.55, height: 220, borderRadius: Polish.radius.lg, marginRight: Polish.spacing.md },
  tierRow: { paddingVertical: Polish.spacing.sm },
  price: { ...Polish.typography.bodyMedium, color: Polish.colors.primary, fontWeight: "700" },
  review: { paddingVertical: Polish.spacing.sm, borderTopWidth: 1, borderTopColor: Polish.colors.borderLight, gap: 4 },
  buttons: { flexDirection: "row", gap: Polish.spacing.md, marginTop: Polish.spacing.xl },
});
