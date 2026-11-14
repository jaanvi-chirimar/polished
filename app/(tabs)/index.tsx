/**
 * Home. Tech-only users get a dashboard. Customers (and dual-role users)
 * get the tech list with search and filters; dual-role users also see a status card.
 */
import { CenterMessage, Chip, ui } from "@/components/ui";
import { LOCATION_OPTIONS, NAIL_TECH_DESIGNS, NAIL_TECH_TOOLS } from "@/constants/nailTechOptions";
import { Polish } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/firebase/config";
import { byDateAsc, subscribeToAppointments } from "@/lib/appointments";
import { Tech, toTech } from "@/lib/techs";
import { dayName } from "@/lib/time";
import { formatDateTime } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

type TechStatus = {
  next: { clientName: string; dateTime: Date } | null;
  pendingCount: number;
  confirmedCount: number;
};

const SERVICE_OPTIONS = ["All", ...NAIL_TECH_TOOLS.slice(0, 5), ...NAIL_TECH_DESIGNS.slice(0, 4)];
const STYLE_OPTIONS = NAIL_TECH_DESIGNS.slice(0, 6);

const isAvailableOn = (tech: Tech, day: string) => !!tech.profile.availabilities?.schedule?.[day]?.length;
const goToBookings = () => router.push("/(tabs)/bookings");
const goToProfile = () => router.push("/(tabs)/profile");

export default function HomeScreen() {
  const { user, userProfile, isTech, isCustomer } = useAuth();
  const [techs, setTechs] = useState<Tech[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [location, setLocation] = useState("");
  const [service, setService] = useState("All");
  const [availableToday, setAvailableToday] = useState(false);
  const [status, setStatus] = useState<TechStatus>({ next: null, pendingCount: 0, confirmedCount: 0 });

  // Tech numbers: pending requests, upcoming confirmed, and the next appointment
  useEffect(() => {
    if (!user?.uid || !isTech) return;
    return subscribeToAppointments("tech", user.uid, (appts) => {
      const now = new Date();
      const upcoming = appts.filter((a) => a.dateTime >= now && a.status === "confirmed").sort(byDateAsc);
      setStatus({
        next: upcoming[0] ? { clientName: upcoming[0].otherName, dateTime: upcoming[0].dateTime } : null,
        pendingCount: appts.filter((a) => a.status === "pending").length,
        confirmedCount: upcoming.length,
      });
    });
  }, [user?.uid, isTech]);

  // Customers see every tech, filtered on the phone below
  useEffect(() => {
    if (!user || !isCustomer) return setLoading(false);
    return onSnapshot(
      query(collection(db, "users"), where("roles", "array-contains", "nailTech")),
      (snapshot) => {
        setTechs(snapshot.docs.map((d) => toTech(d.id, d.data())));
        setLoading(false);
      },
      (error) => {
        console.error("Error loading techs:", error);
        setLoading(false);
      }
    );
  }, [user, isCustomer]);

  const today = dayName(new Date());
  const filteredTechs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return techs.filter((t) => {
      if (q && !t.name.toLowerCase().includes(q) && !t.location.toLowerCase().includes(q)) return false;
      if (location && t.location !== location) return false;
      if (service !== "All" && ![...(t.profile.tools ?? []), ...(t.profile.designs ?? [])].includes(service)) return false;
      if (availableToday && !isAvailableOn(t, today)) return false;
      return true;
    });
  }, [techs, search, location, service, availableToday, today]);

  if (!user || !userProfile) return <CenterMessage loading />;

  // Tech-only: dashboard
  if (isTech && !isCustomer) {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    return (
      <ScrollView style={ui.screen} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={ui.title}>{greeting}, {userProfile.firstName || "there"} 👋</Text>
            <Text style={ui.caption}>Here’s your overview</Text>
          </View>
          <ProfileButton />
        </View>

        <View style={styles.statsRow}>
          <StatCard value={status.pendingCount} label={"Pending\nRequests"} icon="time-outline" color={Polish.colors.primary} />
          <StatCard value={status.confirmedCount} label={"Upcoming\nConfirmed"} icon="checkmark-circle-outline" color={Polish.colors.success} />
        </View>

        {status.next ? (
          <StatusCard status={status} />
        ) : (
          <View style={[ui.card, ui.row, styles.gapBelow]}>
            <Ionicons name="checkmark-circle-outline" size={24} color={Polish.colors.success} />
            <Text style={[ui.body, { flex: 1 }]}>No upcoming appointments. You’re all clear!</Text>
          </View>
        )}

        <Text style={[ui.muted, styles.gapAbove]}>Quick Actions</Text>
        <View style={styles.statsRow}>
          <QuickAction icon="calendar-outline" label="Bookings" onPress={goToBookings} />
          <QuickAction icon="mail-outline" label="Messages" onPress={() => router.push("/(tabs)/inbox")} />
          <QuickAction icon="person-outline" label="My Profile" onPress={goToProfile} />
        </View>
      </ScrollView>
    );
  }

  if (loading) return <CenterMessage loading title="Loading nail techs..." />;
  if (techs.length === 0) return <CenterMessage icon="sparkles-outline" title="No nail techs yet" subtitle="Check back soon!" />;

  const hasFilters = !!location || service !== "All" || availableToday;

  const listHeader = (
    <>
      <View style={styles.header}>
        <Text style={[ui.title, { flex: 1 }]}>Nail Techs Near You</Text>
        <ProfileButton />
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={20} color={Polish.colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or location..."
          placeholderTextColor={Polish.colors.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color={Polish.colors.textMuted} />
          </TouchableOpacity>
        ) : null}
        <Chip label="Filters" selected={hasFilters || filtersOpen} onPress={() => setFiltersOpen(!filtersOpen)} />
      </View>

      {filtersOpen && (
        <>
          <FilterRow label="Availability">
            <Chip label="Available today" selected={availableToday} onPress={() => setAvailableToday(!availableToday)} />
          </FilterRow>
          <FilterRow label="Location">
            {["All", ...LOCATION_OPTIONS].map((loc) => (
              <Chip
                key={loc}
                label={loc}
                selected={loc === "All" ? !location : location === loc}
                onPress={() => setLocation(loc === "All" || location === loc ? "" : loc)}
              />
            ))}
          </FilterRow>
          <FilterRow label="Service">
            {SERVICE_OPTIONS.map((svc) => (
              <Chip key={svc} label={svc} selected={service === svc} onPress={() => setService(svc)} />
            ))}
          </FilterRow>
          {hasFilters && (
            <View style={styles.gapBelow}>
              <Chip
                label="Clear all filters"
                onPress={() => {
                  setLocation("");
                  setService("All");
                  setAvailableToday(false);
                }}
              />
            </View>
          )}
        </>
      )}

      {isTech && (status.next || status.pendingCount > 0) && <StatusCard status={status} />}

      <FilterRow label="Browse by style">
        {STYLE_OPTIONS.map((design) => (
          <Chip key={design} label={design} selected={service === design} onPress={() => setService(service === design ? "All" : design)} />
        ))}
      </FilterRow>
    </>
  );

  return (
    <FlatList
      style={ui.screen}
      contentContainerStyle={styles.content}
      data={filteredTechs}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={styles.gridRow}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={
        <Text style={[ui.body, styles.empty]}>
          No techs match your search or filters.{hasFilters ? " Try clearing some filters." : ""}
        </Text>
      }
      renderItem={({ item }) => <TechCard tech={item} availableToday={isAvailableOn(item, today)} />}
    />
  );
}

function ProfileButton() {
  return (
    <TouchableOpacity onPress={goToProfile} hitSlop={8}>
      <Ionicons name="person-circle-outline" size={32} color={Polish.colors.text} />
    </TouchableOpacity>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.gapBelow}>
      <Text style={[ui.muted, { marginBottom: Polish.spacing.sm }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ui.row}>
        {children}
      </ScrollView>
    </View>
  );
}

function StatCard({ value, label, icon, color }: { value: number; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }) {
  return (
    <TouchableOpacity style={[ui.card, { flex: 1 }]} onPress={goToBookings} activeOpacity={0.85}>
      <Text style={styles.statNumber}>{value}</Text>
      <Text style={ui.caption}>{label}</Text>
      <Ionicons name={icon} size={18} color={color} style={styles.statIcon} />
    </TouchableOpacity>
  );
}

function QuickAction({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[ui.card, styles.quickAction]} onPress={onPress} activeOpacity={0.85}>
      <Ionicons name={icon} size={22} color={Polish.colors.primary} />
      <Text style={[ui.caption, { color: Polish.colors.text, fontWeight: "600" }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Next appointment, or the number of pending requests. Opens Bookings. */
function StatusCard({ status }: { status: TechStatus }) {
  return (
    <TouchableOpacity style={[ui.card, ui.row, styles.gapBelow]} onPress={goToBookings} activeOpacity={0.85}>
      <Ionicons name="calendar-outline" size={22} color={Polish.colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={ui.muted}>{status.next ? "Next appointment" : "Pending requests"}</Text>
        <Text style={[ui.body, { color: Polish.colors.text }]} numberOfLines={1}>
          {status.next
            ? `${status.next.clientName} · ${formatDateTime(status.next.dateTime)}`
            : `${status.pendingCount} booking${status.pendingCount !== 1 ? "s" : ""} awaiting your response`}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Polish.colors.textMuted} />
    </TouchableOpacity>
  );
}

function TechCard({ tech, availableToday }: { tech: Tech; availableToday: boolean }) {
  const cover = tech.profile.portfolio?.[0];
  return (
    <TouchableOpacity
      style={[ui.card, styles.techCard]}
      onPress={() => router.push({ pathname: "/tech/[id]", params: { id: tech.id } })}
      activeOpacity={0.85}
    >
      {cover ? (
        <Image source={{ uri: cover }} style={styles.techImage} contentFit="cover" />
      ) : (
        <View style={[styles.techImage, styles.techImagePlaceholder]}>
          <Ionicons name="person" size={28} color={Polish.colors.primary} />
        </View>
      )}
      <View style={{ padding: Polish.spacing.md, gap: Polish.spacing.xs }}>
        <Text style={[ui.label, { marginBottom: 0 }]} numberOfLines={1}>{tech.name}</Text>
        {tech.location ? (
          <View style={[ui.row, { gap: 4 }]}>
            <Ionicons name="location-outline" size={12} color={Polish.colors.textMuted} />
            <Text style={[ui.muted, { fontSize: 11 }]} numberOfLines={1}>{tech.location}</Text>
          </View>
        ) : null}
        {availableToday && <Text style={styles.badge}>Available today</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Polish.spacing.xl, paddingTop: 56, paddingBottom: Polish.spacing.xxxl },
  header: { flexDirection: "row", alignItems: "center", marginBottom: Polish.spacing.xxl },
  gapBelow: { marginBottom: Polish.spacing.lg },
  gapAbove: { marginTop: Polish.spacing.sm, marginBottom: Polish.spacing.sm },
  empty: { textAlign: "center", paddingVertical: Polish.spacing.xxl },
  searchRow: { ...StyleSheet.flatten(ui.card), ...StyleSheet.flatten(ui.row), paddingVertical: Polish.spacing.xs, marginBottom: Polish.spacing.lg },
  searchInput: { ...Polish.typography.body, color: Polish.colors.text, flex: 1, minWidth: 0, paddingVertical: Polish.spacing.sm },
  statsRow: { flexDirection: "row", gap: Polish.spacing.md, marginBottom: Polish.spacing.lg },
  statNumber: { ...Polish.typography.title, fontSize: 32, lineHeight: 36, color: Polish.colors.text },
  statIcon: { position: "absolute", top: Polish.spacing.md, right: Polish.spacing.md },
  quickAction: { flex: 1, alignItems: "center", gap: Polish.spacing.sm },
  gridRow: { gap: Polish.spacing.md, marginBottom: Polish.spacing.md },
  techCard: { flex: 1, padding: 0, overflow: "hidden" },
  techImage: { width: "100%", height: 140 },
  techImagePlaceholder: { backgroundColor: Polish.colors.accent + "40", alignItems: "center", justifyContent: "center" },
  badge: {
    ...Polish.typography.caption,
    fontSize: 10,
    fontWeight: "600",
    color: Polish.colors.success,
    backgroundColor: Polish.colors.success + "25",
    alignSelf: "flex-start",
    paddingHorizontal: Polish.spacing.sm,
    paddingVertical: 4,
    borderRadius: Polish.radius.sm,
    overflow: "hidden",
  },
});
