import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { theme } from "../theme";
import { supabase, supabaseConfigured } from "../supabase";

type Mode = "signin" | "signup";

/**
 * Email/password auth via Supabase. Kept intentionally minimal for Phase 1;
 * OAuth / magic-link can be added later.
 */
export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setNotice("Check your email to confirm your account, then sign in.");
        setMode("signin");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.brand}>FitCoach</Text>
        <Text style={styles.subtitle}>
          {mode === "signin" ? "Welcome back." : "Create your account."}
        </Text>

        {!supabaseConfigured && (
          <Text style={styles.warn}>
            Supabase isn't configured. Set supabaseUrl / supabaseAnonKey in app.json
            (see docs/SUPABASE.md).
          </Text>
        )}

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={theme.colors.textDim}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={theme.colors.textDim}
          secureTextEntry
          autoCapitalize="none"
        />

        {error && <Text style={styles.error}>{error}</Text>}
        {notice && <Text style={styles.notice}>{notice}</Text>}

        <TouchableOpacity
          style={[styles.primary, busy && styles.primaryDisabled]}
          onPress={submit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={theme.colors.text} />
          ) : (
            <Text style={styles.primaryText}>
              {mode === "signin" ? "Sign in" : "Sign up"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setMode(mode === "signin" ? "signup" : "signin")}>
          <Text style={styles.switch}>
            {mode === "signin"
              ? "No account? Create one"
              : "Already have an account? Sign in"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg, justifyContent: "center", padding: theme.spacing(2.5) },
  card: { gap: theme.spacing(1.5) },
  brand: { color: theme.colors.text, fontSize: 36, fontWeight: "800", textAlign: "center" },
  subtitle: { color: theme.colors.textDim, fontSize: 16, textAlign: "center", marginBottom: theme.spacing(1) },
  warn: { color: theme.colors.accent, fontSize: 13, textAlign: "center" },
  input: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius,
    padding: theme.spacing(1.75),
    color: theme.colors.text,
    fontSize: 16,
  },
  error: { color: theme.colors.danger, fontSize: 14 },
  notice: { color: theme.colors.textDim, fontSize: 14 },
  primary: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius,
    paddingVertical: theme.spacing(1.75),
    alignItems: "center",
    marginTop: theme.spacing(0.5),
  },
  primaryDisabled: { backgroundColor: theme.colors.accentDim },
  primaryText: { color: theme.colors.text, fontWeight: "800", fontSize: 16 },
  switch: { color: theme.colors.accent, textAlign: "center", marginTop: theme.spacing(1), fontWeight: "600" },
});
