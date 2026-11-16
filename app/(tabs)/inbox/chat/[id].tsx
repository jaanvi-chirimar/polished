import { BackHeader, ui } from "@/components/ui";
import { Polished } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/firebase/config";
import { getUserName, otherParticipant } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

type Message = { id: string; text: string; senderId: string; createdAt: Date };

export default function ChatScreen() {
  const { id: threadId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [otherName, setOtherName] = useState("Chat");
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!user?.uid || !threadId) return;
    getUserName(otherParticipant(threadId, user.uid), "Chat").then(setOtherName);
    return onSnapshot(
      query(collection(db, "threads", threadId, "messages"), orderBy("createdAt", "asc")),
      (snapshot) =>
        setMessages(
          snapshot.docs.map((d) => ({
            id: d.id,
            text: d.data().text || "",
            senderId: d.data().senderId || "",
            createdAt: d.data().createdAt?.toDate?.() ?? new Date(),
          }))
        ),
      (err) => console.error("Chat messages listener:", err)
    );
  }, [user?.uid, threadId]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !user?.uid || !threadId || sending) return;
    setSending(true);
    setInput("");
    try {
      // Creates the thread on the first message, updates its preview after that.
      await setDoc(
        doc(db, "threads", threadId),
        { participantIds: threadId.split("_"), lastMessage: text, lastMessageAt: serverTimestamp(), lastSenderId: user.uid },
        { merge: true }
      );
      await addDoc(collection(db, "threads", threadId, "messages"), { text, senderId: user.uid, createdAt: serverTimestamp() });
    } catch (err) {
      console.error("Send message error:", err);
      setInput(text); // put the text back so it isn't lost
    } finally {
      setSending(false);
    }
  };

  if (!user) return null;
  const canSend = !!input.trim() && !sending;

  return (
    <KeyboardAvoidingView
      style={[ui.screen, { paddingTop: 56 }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={{ paddingHorizontal: Polished.spacing.lg }}>
        <BackHeader title={otherName} />
      </View>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: Polished.spacing.lg }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={<Text style={[ui.body, styles.empty]}>No messages yet. Say hi!</Text>}
        renderItem={({ item }) => {
          const isMe = item.senderId === user.uid;
          return (
            <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
              <Text style={[Polished.typography.body, { color: isMe ? "#fff" : Polished.colors.text }]}>{item.text}</Text>
              <Text style={[styles.time, { color: isMe ? "rgba(255,255,255,0.8)" : Polished.colors.textMuted }]}>
                {item.createdAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </Text>
            </View>
          );
        }}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Message..."
          placeholderTextColor={Polished.colors.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={2000}
          editable={!sending}
        />
        <TouchableOpacity style={[styles.send, !canSend && { opacity: 0.5 }]} onPress={sendMessage} disabled={!canSend}>
          {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={20} color="#fff" />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  empty: { textAlign: "center", paddingVertical: Polished.spacing.xxl },
  bubble: {
    maxWidth: "80%",
    paddingVertical: Polished.spacing.sm,
    paddingHorizontal: Polished.spacing.lg,
    borderRadius: Polished.radius.xl,
    marginBottom: Polished.spacing.sm,
  },
  bubbleMe: { alignSelf: "flex-end", backgroundColor: Polished.colors.primary },
  bubbleThem: { alignSelf: "flex-start", backgroundColor: Polished.colors.surface, borderWidth: 1, borderColor: Polished.colors.borderLight },
  time: { ...Polished.typography.caption, fontSize: 10, marginTop: 2 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Polished.spacing.sm,
    padding: Polished.spacing.md,
    paddingBottom: Polished.spacing.lg,
    backgroundColor: Polished.colors.surface,
    borderTopWidth: 1,
    borderTopColor: Polished.colors.borderLight,
  },
  input: {
    ...Polished.typography.body,
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    color: Polished.colors.text,
    borderWidth: 1,
    borderColor: Polished.colors.border,
    borderRadius: Polished.radius.xl,
    paddingHorizontal: Polished.spacing.lg,
    paddingVertical: Polished.spacing.sm,
    backgroundColor: Polished.colors.background,
  },
  send: {
    width: 44,
    height: 40,
    borderRadius: Polished.radius.lg,
    backgroundColor: Polished.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
});
