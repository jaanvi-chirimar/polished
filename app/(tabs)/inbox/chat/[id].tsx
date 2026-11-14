import { Polish } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/firebase/config";
import { getUserName, otherParticipant } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

type Message = {
  id: string;
  text: string;
  senderId: string;
  createdAt: Date;
};

export default function ChatScreen() {
  const { id: threadId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [otherName, setOtherName] = useState("Chat");
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!user?.uid || !threadId) return;
    getUserName(otherParticipant(threadId, user.uid), "Chat").then(setOtherName);

    const q = query(collection(db, "threads", threadId, "messages"), orderBy("createdAt", "asc"));
    return onSnapshot(
      q,
      (snapshot) => {
        setMessages(
          snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              text: data.text || "",
              senderId: data.senderId || "",
              createdAt: data.createdAt?.toDate?.() ?? new Date(),
            };
          })
        );
      },
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
        {
          participantIds: threadId.split("_"),
          lastMessage: text,
          lastMessageAt: serverTimestamp(),
          lastSenderId: user.uid,
        },
        { merge: true }
      );
      await addDoc(collection(db, "threads", threadId, "messages"), {
        text,
        senderId: user.uid,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Send message error:", err);
      setInput(text); // put the text back so it isn't lost
    } finally {
      setSending(false);
    }
  };

  if (!user) return null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={Polish.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{otherName}</Text>
      </View>

      <>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No messages yet. Say hi!</Text>
              </View>
            }
            renderItem={({ item }) => {
              const isMe = item.senderId === user.uid;
              return (
                <View
                  style={[
                    styles.bubble,
                    isMe ? styles.bubbleMe : styles.bubbleThem,
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      isMe ? styles.bubbleTextMe : styles.bubbleTextThem,
                    ]}
                  >
                    {item.text}
                  </Text>
                  <Text
                    style={[
                      styles.time,
                      isMe ? styles.timeMe : styles.timeThem,
                    ]}
                  >
                    {item.createdAt.toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              );
            }}
          />
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Message..."
              placeholderTextColor={Polish.colors.textMuted}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={2000}
              editable={!sending}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!input.trim() || sending) && styles.sendButtonDisabled,
              ]}
              onPress={sendMessage}
              disabled={!input.trim() || sending}
              activeOpacity={0.7}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
      </>
    </KeyboardAvoidingView>
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
    paddingHorizontal: Polish.spacing.md,
    paddingTop: 56,
    paddingBottom: Polish.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Polish.colors.borderLight,
    backgroundColor: Polish.colors.surface,
  },
  backButton: {
    padding: Polish.spacing.sm,
    marginRight: Polish.spacing.sm,
  },
  title: {
    ...Polish.typography.subtitle,
    color: Polish.colors.text,
    flex: 1,
  },
  messagesList: {
    padding: Polish.spacing.lg,
    paddingBottom: Polish.spacing.xl,
  },
  empty: {
    paddingVertical: Polish.spacing.xxl,
    alignItems: "center",
  },
  emptyText: {
    ...Polish.typography.body,
    color: Polish.colors.textMuted,
  },
  bubble: {
    maxWidth: "80%",
    paddingVertical: Polish.spacing.sm,
    paddingHorizontal: Polish.spacing.lg,
    borderRadius: Polish.radius.xl,
    marginBottom: Polish.spacing.sm,
  },
  bubbleMe: {
    alignSelf: "flex-end",
    backgroundColor: Polish.colors.primary,
  },
  bubbleThem: {
    alignSelf: "flex-start",
    backgroundColor: Polish.colors.surface,
    borderWidth: 1,
    borderColor: Polish.colors.borderLight,
  },
  bubbleText: {
    ...Polish.typography.body,
  },
  bubbleTextMe: {
    color: "#fff",
  },
  bubbleTextThem: {
    color: Polish.colors.text,
  },
  time: {
    ...Polish.typography.caption,
    marginTop: 2,
    fontSize: 10,
  },
  timeMe: {
    color: "rgba(255,255,255,0.8)",
  },
  timeThem: {
    color: Polish.colors.textMuted,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: Polish.spacing.md,
    paddingBottom: Polish.spacing.lg,
    backgroundColor: Polish.colors.surface,
    borderTopWidth: 1,
    borderTopColor: Polish.colors.borderLight,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Polish.colors.border,
    borderRadius: Polish.radius.xl,
    paddingHorizontal: Polish.spacing.lg,
    paddingVertical: Polish.spacing.sm,
    ...Polish.typography.body,
    color: Polish.colors.text,
    backgroundColor: Polish.colors.background,
  },
  sendButton: {
    width: 44,
    height: 40,
    borderRadius: Polish.radius.lg,
    backgroundColor: Polish.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: Polish.spacing.sm,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
