import { CenterMessage, ui } from "@/components/ui";
import { Polish } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/firebase/config";
import { getUserName, otherParticipant } from "@/lib/utils";
import { router } from "expo-router";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Thread = { id: string; otherName: string; lastMessage: string; lastMessageAt: Date | null };

export default function InboxListScreen() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<Thread[] | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, "threads"), where("participantIds", "array-contains", user.uid));
    return onSnapshot(
      q,
      async (snapshot) => {
        const list = await Promise.all(
          snapshot.docs.map(async (d) => ({
            id: d.id,
            otherName: await getUserName(otherParticipant(d.id, user.uid)),
            lastMessage: d.data().lastMessage || "",
            lastMessageAt: d.data().lastMessageAt?.toDate?.() ?? null,
          }))
        );
        setThreads(list.sort((a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0)));
      },
      (err) => {
        console.error("Inbox threads listener:", err);
        setThreads([]);
      }
    );
  }, [user?.uid]);

  return (
    <View style={[ui.screen, styles.container]}>
      <Text style={ui.title}>Inbox</Text>
      <Text style={[ui.caption, styles.subtitle]}>Messages</Text>
      {!threads ? (
        <CenterMessage loading />
      ) : threads.length === 0 ? (
        <CenterMessage
          icon="chatbubbles-outline"
          title="No conversations yet"
          subtitle="Message a nail tech from their profile or start a chat after booking."
        />
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: Polish.spacing.xxxl }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[ui.card, ui.row, styles.card]}
              activeOpacity={0.7}
              onPress={() => router.push(`/(tabs)/inbox/chat/${item.id}`)}
            >
              <View style={styles.avatar}>
                <Text style={[ui.subtitle, { color: Polish.colors.primary }]}>{item.otherName.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={ui.row}>
                  <Text style={[ui.subtitle, { flex: 1 }]} numberOfLines={1}>{item.otherName}</Text>
                  {item.lastMessageAt ? (
                    <Text style={ui.muted}>{item.lastMessageAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</Text>
                  ) : null}
                </View>
                <Text style={ui.body} numberOfLines={1}>{item.lastMessage || "No messages yet"}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Polish.spacing.xl, paddingTop: 56 },
  subtitle: { marginTop: 4, marginBottom: Polish.spacing.xxl },
  card: { marginBottom: Polish.spacing.md, gap: Polish.spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Polish.colors.accent + "40", alignItems: "center", justifyContent: "center" },
});
