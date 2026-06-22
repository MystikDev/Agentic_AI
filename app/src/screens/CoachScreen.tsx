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
  streamCoachTurn,
  fetchPersona,
  getProfile,
  saveProfile,
  listConversations,
  getConversationMessages,
  type ChatMessage,
  type VoiceProfile,
  type AthleteProfile,
} from "../api/coach";
import { speak, stopSpeaking, drainSentences, DEFAULT_VOICE } from "../speech";
import { forRequest, EMPTY_PROFILE } from "../profile";
import { supabase, supabaseConfigured } from "../supabase";

/** Chat items: user/assistant turns, plus local-only "system" notes for logging. */
type Msg = { role: "user" | "assistant" | "system"; content: string };

const GREETING: Msg = {
  role: "assistant",
  content: "Ready when you are. Tell me what we're training today.",
};

export function CoachScreen() {
  const [intensity, setIntensity] = useState(5);
  const [label, setLabel] = useState("The Steady Coach");
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [voiceOn, setVoiceOn] = useState(true);
  const [profile, setProfile] = useState<AthleteProfile>(EMPTY_PROFILE);
  const [profileOpen, setProfileOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const scrollRef = useRef<ScrollView>(null);

  // Refs the streaming callback reads so it always sees current values (no stale closure).
  const voiceRef = useRef<VoiceProfile>(DEFAULT_VOICE);
  const voiceOnRef = useRef(true);
  const speechBufRef = useRef("");

  useEffect(() => {
    voiceOnRef.current = voiceOn;
  }, [voiceOn]);

  // On mount: load the server-side profile and the most recent conversation.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [p, convos] = await Promise.all([getProfile(), listConversations()]);
        if (!active) return;
        setProfile({ ...EMPTY_PROFILE, ...p });
        if (convos.length) {
          const recent = convos[0];
          setConversationId(recent.id);
          if (recent.intensity) setIntensity(recent.intensity);
          const history = await getConversationMessages(recent.id);
          if (active) setMessages(history.length ? history : [GREETING]);
        }
      } catch {
        /* offline / not configured — start fresh with the greeting */
      } finally {
        if (active) setLoadingHistory(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Keep the persona label + voice in sync with the dial (debounced).
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

  const onSaveProfile = useCallback((p: AthleteProfile) => {
    setProfile(p);
    saveProfile(forRequest(p) ?? {}).catch(() => {/* best-effort */});
  }, []);

  const startNewConversation = useCallback(() => {
    stopSpeaking();
    setConversationId(undefined);
    setMessages([GREETING]);
  }, []);

  const signOut = useCallback(() => {
    stopSpeaking();
    supabase.auth.signOut();
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;

    stopSpeaking();
    speechBufRef.current = "";

    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ]);
    setInput("");
    setBusy(true);

    try {
      await streamCoachTurn(
        { conversationId, intensity, message: text },
        {
          onMeta: (id) => setConversationId(id),
          onTool: (summary) => {
            // Insert a logging note just before the streaming assistant bubble.
            setMessages((prev) => {
              const next = [...prev];
              next.splice(Math.max(0, next.length - 1), 0, { role: "system", content: summary });
              return next;
            });
          },
          onToken: (delta) => {
            setMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = {
                role: "assistant",
                content: next[next.length - 1].content + delta,
              };
              return next;
            });
            scrollRef.current?.scrollToEnd({ animated: true });

            if (voiceOnRef.current) {
              speechBufRef.current += delta;
              const { sentences, rest } = drainSentences(speechBufRef.current);
              speechBufRef.current = rest;
              for (const s of sentences) speak(s, voiceRef.current);
            }
          },
        },
      );
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
  }, [input, busy, conversationId, intensity]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>FitCoach</Text>
          {supabaseConfigured ? (
            <TouchableOpacity onPress={signOut} accessibilityLabel="Sign out">
              <Text style={styles.signOut}>Sign out</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.signOut}>Demo mode</Text>
          )}
        </View>
        <View style={styles.headerBtns}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setProfileOpen(true)}>
            <Text style={styles.iconBtnText}>👤 Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, !voiceOn && styles.iconBtnOff]}
            onPress={toggleVoice}
          >
            <Text style={styles.iconBtnText}>{voiceOn ? "🔊 Voice" : "🔇 Muted"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={startNewConversation}>
            <Text style={styles.iconBtnText}>＋ New</Text>
          </TouchableOpacity>
        </View>
        <IntensityDial intensity={intensity} label={label} onChange={setIntensity} />
      </View>

      {loadingHistory ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.chat}
          contentContainerStyle={styles.chatContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((m, i) =>
            m.role === "system" ? (
              <View key={i} style={styles.systemNote}>
                <Text style={styles.systemNoteText}>✓ {m.content}</Text>
              </View>
            ) : (
              <View
                key={i}
                style={[styles.bubble, m.role === "user" ? styles.userBubble : styles.coachBubble]}
              >
                <Text style={styles.bubbleText}>
                  {m.content || (busy && i === messages.length - 1 ? "…" : "")}
                </Text>
              </View>
            ),
          )}
        </ScrollView>
      )}

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
  signOut: { color: theme.colors.textDim, fontSize: 14, fontWeight: "600" },
  headerBtns: { flexDirection: "row", gap: theme.spacing(1) },
  iconBtn: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius,
    paddingHorizontal: theme.spacing(1.5),
    paddingVertical: theme.spacing(0.75),
  },
  iconBtnOff: { opacity: 0.6 },
  iconBtnText: { color: theme.colors.text, fontWeight: "700", fontSize: 13 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  chat: { flex: 1, marginTop: theme.spacing(1) },
  chatContent: { padding: theme.spacing(2), gap: theme.spacing(1.5) },
  bubble: { maxWidth: "85%", borderRadius: theme.radius, padding: theme.spacing(1.5) },
  userBubble: { alignSelf: "flex-end", backgroundColor: theme.colors.user },
  coachBubble: { alignSelf: "flex-start", backgroundColor: theme.colors.coach },
  bubbleText: { color: theme.colors.text, fontSize: 16, lineHeight: 22 },
  systemNote: {
    alignSelf: "center",
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius,
    paddingHorizontal: theme.spacing(1.5),
    paddingVertical: theme.spacing(0.75),
  },
  systemNoteText: { color: theme.colors.accent, fontSize: 13, fontWeight: "600" },
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
