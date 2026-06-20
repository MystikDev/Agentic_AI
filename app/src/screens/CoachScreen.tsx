import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { theme } from "../theme";
import { IntensityDial } from "../components/IntensityDial";
import {
  streamCoachReply,
  fetchPersonaLabel,
  type ChatMessage,
} from "../api/coach";

const GREETING: ChatMessage = {
  role: "assistant",
  content: "Ready when you are. Tell me what we're training today.",
};

export function CoachScreen() {
  const [intensity, setIntensity] = useState(5);
  const [label, setLabel] = useState("The Steady Coach");
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Keep the persona label in sync with the dial. Debounced to avoid hammering the
  // endpoint while the user drags the slider.
  useEffect(() => {
    const t = setTimeout(() => {
      fetchPersonaLabel(intensity)
        .then(setLabel)
        .catch(() => {/* keep last known label offline */});
    }, 150);
    return () => clearTimeout(t);
  }, [intensity]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;

    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);

    try {
      await streamCoachReply(
        { intensity, messages: history.filter((m) => m.content.length > 0) },
        (delta) => {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = {
              role: "assistant",
              content: next[next.length - 1].content + delta,
            };
            return next;
          });
          scrollRef.current?.scrollToEnd({ animated: true });
        },
      );
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: `⚠️ ${err instanceof Error ? err.message : "Something went wrong."}`,
        };
        return next;
      });
    } finally {
      setBusy(false);
    }
  }, [input, busy, messages, intensity]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.title}>FitCoach</Text>
        <IntensityDial intensity={intensity} label={label} onChange={setIntensity} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.chat}
        contentContainerStyle={styles.chatContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((m, i) => (
          <View
            key={i}
            style={[styles.bubble, m.role === "user" ? styles.userBubble : styles.coachBubble]}
          >
            <Text style={styles.bubbleText}>
              {m.content || (busy && i === messages.length - 1 ? "…" : "")}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Talk to your coach…"
          placeholderTextColor={theme.colors.textDim}
          onSubmitEditing={send}
          editable={!busy}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendBtn, busy && styles.sendBtnDisabled]}
          onPress={send}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={theme.colors.text} />
          ) : (
            <Text style={styles.sendText}>Go</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  header: { paddingTop: theme.spacing(7), paddingHorizontal: theme.spacing(2), gap: theme.spacing(1.5) },
  title: { color: theme.colors.text, fontSize: 28, fontWeight: "800", letterSpacing: 0.5 },
  chat: { flex: 1, marginTop: theme.spacing(1) },
  chatContent: { padding: theme.spacing(2), gap: theme.spacing(1.5) },
  bubble: { maxWidth: "85%", borderRadius: theme.radius, padding: theme.spacing(1.5) },
  userBubble: { alignSelf: "flex-end", backgroundColor: theme.colors.user },
  coachBubble: { alignSelf: "flex-start", backgroundColor: theme.colors.coach },
  bubbleText: { color: theme.colors.text, fontSize: 16, lineHeight: 22 },
  inputRow: {
    flexDirection: "row",
    padding: theme.spacing(1.5),
    gap: theme.spacing(1),
    backgroundColor: theme.colors.surface,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius,
    paddingHorizontal: theme.spacing(2),
    color: theme.colors.text,
    fontSize: 16,
  },
  sendBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius,
    paddingHorizontal: theme.spacing(2.5),
    justifyContent: "center",
    alignItems: "center",
    minWidth: 60,
  },
  sendBtnDisabled: { backgroundColor: theme.colors.accentDim },
  sendText: { color: theme.colors.text, fontWeight: "800", fontSize: 16 },
});
