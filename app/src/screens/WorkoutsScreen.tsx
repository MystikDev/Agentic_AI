import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { theme } from "../theme";
import { LogWorkoutModal } from "../components/LogWorkoutModal";
import { listWorkouts, type Workout, type WorkoutSet } from "../api/workouts";

function formatSet(s: WorkoutSet): string {
  const load = s.weight == null ? "BW" : `${s.weight}`;
  return `${s.exercise} — ${load} × ${s.reps}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function WorkoutsScreen() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  const load = useCallback(async (mode: "initial" | "refresh") => {
    if (mode === "refresh") setRefreshing(true);
    setError(null);
    try {
      setWorkouts(await listWorkouts());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load workouts.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load("initial");
  }, [load]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Workouts</Text>
        <TouchableOpacity style={styles.logBtn} onPress={() => setLogOpen(true)}>
          <Text style={styles.logBtnText}>＋ Log</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load("refresh")}
              tintColor={theme.colors.accent}
            />
          }
        >
          {error && <Text style={styles.error}>{error}</Text>}

          {!error && workouts.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No workouts yet</Text>
              <Text style={styles.emptyText}>
                Tap ＋ Log after a session to start building your history.
              </Text>
            </View>
          )}

          {workouts.map((w) => (
            <View key={w.id} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.date}>{formatDate(w.performedAt)}</Text>
                <Text style={styles.count}>
                  {w.sets.length} {w.sets.length === 1 ? "set" : "sets"}
                </Text>
              </View>
              {w.sets.map((s, i) => (
                <Text key={i} style={styles.setLine}>
                  {formatSet(s)}
                </Text>
              ))}
              {w.notes ? <Text style={styles.notes}>{w.notes}</Text> : null}
            </View>
          ))}
        </ScrollView>
      )}

      <LogWorkoutModal
        visible={logOpen}
        onClose={() => setLogOpen(false)}
        onSaved={() => load("refresh")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: theme.spacing(7),
    paddingHorizontal: theme.spacing(2),
    paddingBottom: theme.spacing(1),
  },
  title: { color: theme.colors.text, fontSize: 28, fontWeight: "800" },
  logBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius,
    paddingHorizontal: theme.spacing(2),
    paddingVertical: theme.spacing(1),
  },
  logBtnText: { color: theme.colors.text, fontWeight: "800", fontSize: 15 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: theme.spacing(2), gap: theme.spacing(1.5) },
  error: { color: theme.colors.danger, fontSize: 14 },
  empty: { alignItems: "center", marginTop: theme.spacing(8), gap: theme.spacing(1) },
  emptyTitle: { color: theme.colors.text, fontSize: 18, fontWeight: "700" },
  emptyText: { color: theme.colors.textDim, fontSize: 14, textAlign: "center", paddingHorizontal: theme.spacing(4) },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    padding: theme.spacing(2),
    gap: theme.spacing(0.5),
  },
  cardHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing(0.5),
  },
  date: { color: theme.colors.accent, fontWeight: "700", fontSize: 15 },
  count: { color: theme.colors.textDim, fontSize: 13 },
  setLine: { color: theme.colors.text, fontSize: 15, lineHeight: 22 },
  notes: { color: theme.colors.textDim, fontSize: 13, fontStyle: "italic", marginTop: theme.spacing(0.5) },
});
