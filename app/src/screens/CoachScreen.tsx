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
import { ProfileModal } from "../components/ProfileModal";
import {
  streamCoachReply,
  fetchPersona,
  type ChatMessage,
  type VoiceProfile,
  type AthleteProfile,
} from "../api/coach";
import { speak, stopSpeaking, drainSentences, DEFAULT_VOICE } from "../speech";
import { loadProfile, saveProfile, forRequest, EMPTY_PROFILE } from "../profile";

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
  const [voiceOn, setVoiceOn] = useState(true);
  const [profile, setProfile] = useState<AthleteProfile>(EMPTY_PROFILE);
  const [profileOpen, setProfileOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Load the saved profile once on mount.
  useEffect(() => {
    loadProfile().then(setProfile);
  }, []);

  const onSaveProfile = useCallback((p: AthleteProfile) => {
    setProfile(p);
    saveProfile(p).catch(() => {/* best-effort local persistence */});
  }, []);

  // Refs the streaming callback reads so it always sees current values (no stale closure).
  const voiceRef = useRef<VoiceProfile>(DEFAULT_VOICE);
  const voiceOnRef = useRef(true);
  const speechBufRef = useRef("");

  useEffect(() => {
    voiceOnRef.current = voiceOn;
  }, [voiceOn]);

  // Keep the persona label + voice in sync with the dial. Debounced so dragging the
  // slider doesn't hammer the endpoint.
  useEffect(() => {
    const t = setTimeout(() => {
      fetchPersona(intensity)
        .then((p) => {
          setLabel(p.label);
          voiceRef.current = p.voice;
        })
        .catch(() => {/* keep last known persona offline */});
    }, 150);
    return () => clearTimeout(t);
  }, [intensity]);

  const toggleVoice = useCallback(() => {
    setVoiceOn((on) => {
      const next = !on;
      if (!next) stopSpeaking();
      return next;
    });
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;

    stopSpeaking(); // cut off any previous reply still being read
    speechBufRef.current = "";

    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);

    try {
      await streamCoachReply(
        {
          intensity,
          profile: forRequest(profile),
          messages: history.filter((m) => m.content.length > 0),
        },
        (delta) => {
          // Render the token.
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = {
              role: "assistant",
              content: next[next.length - 1].content + delta,
            };
            return next;
          });
          scrollRef.current?.scrollToEnd({ animated: true });

          // Speak complete sentences as they finish, so the coach talks live.
          if (voiceOnRef.current) {
            speechBufRef.current += delta;
            const { sentences, rest } = drainSentences(speechBufRef.current);
            speechBufRef.current = rest;
            for (const s of sentences) speak(s, voiceRef.current);
          }
        },
      );
      // Flush any trailing partial sentence.
      if (voiceOnRef.current && speechBufRef.current.trim()) {
        speak(speechBufRef.current, voiceRef.current);
      }
      speechBufRef.current = "";
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
  }, [input, busy, messages, intensity, profile]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>FitCoach</Text>
          <View style={styles.headerBtns}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setProfileOpen(true)}
              accessibilityLabel="Edit your profile"
            >
              <Text style={styles.iconBtnText}>👤 Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, !voiceOn && styles.iconBtnOff]}
              onPress={toggleVoice}
              accessibilityLabel={voiceOn ? "Mute coach voice" : "Unmute coach voice"}
            >
              <Text style={styles.iconBtnText}>{voiceOn ? "🔊 Voice" : "🔇 Muted"}</Text>
            </TouchableOpacity>
          </View>
        </View>
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

      <ProfileModal
        visible={profileOpen}
        initial={profile}
        onSave={onSaveProfile}
        onClose={() => setProfileOpen(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  header: { paddingTop: theme.spacing(7), paddingHorizontal: theme.spacing(2), gap: theme.spacing(1.5) },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: theme.colors.text, fontSize: 28, fontWeight: "800", letterSpacing: 0.5 },
  headerBtns: { flexDirection: "row", gap: theme.spacing(1) },
  iconBtn: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius,
    paddingHorizontal: theme.spacing(1.5),
    paddingVertical: theme.spacing(0.75),
  },
  iconBtnOff: { opacity: 0.6 },
  iconBtnText: { color: theme.colors.text, fontWeight: "700", fontSize: 13 },
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
