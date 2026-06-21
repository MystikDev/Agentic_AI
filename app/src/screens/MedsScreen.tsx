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
import { AddMedicationModal } from "../components/AddMedicationModal";
import { listMedications, logIntake, type Medication } from "../api/medications";

export function MedsScreen() {
  const [meds, setMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [takingId, setTakingId] = useState<string | null>(null);

  const load = useCallback(async (mode: "initial" | "refresh") => {
    if (mode === "refresh") setRefreshing(true);
    setError(null);
    try {
      setMeds(await listMedications());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load("initial");
  }, [load]);

  const take = useCallback(
    async (id: string) => {
      setTakingId(id);
      // Optimistic bump so the count feels instant.
      setMeds((prev) =>
        prev.map((m) => (m.id === id ? { ...m, takenToday: m.takenToday + 1 } : m)),
      );
      try {
        await logIntake(id);
        await load("refresh");
      } catch {
        await load("refresh"); // reconcile on failure
      } finally {
        setTakingId(null);
      }
    },
    [load],
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Meds & Supplements</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setAddOpen(true)}>
          <Text style={styles.addBtnText}>＋ Add</Text>
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

          {!error && meds.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Nothing tracked yet</Text>
              <Text style={styles.emptyText}>
                Tap ＋ Add to track a medication or supplement, then log each dose.
              </Text>
            </View>
          )}

          {meds.map((m) => (
            <View key={m.id} style={styles.card}>
              <View style={styles.cardMain}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{m.name}</Text>
                  <View style={[styles.badge, m.kind === "medication" && styles.badgeMed]}>
                    <Text style={styles.badgeText}>{m.kind}</Text>
                  </View>
                </View>
                {(m.dosage || m.schedule) && (
                  <Text style={styles.sub}>
                    {[m.dosage, m.schedule].filter(Boolean).join(" · ")}
                  </Text>
                )}
                <Text style={styles.taken}>
                  {m.takenToday > 0 ? `✓ Taken ${m.takenToday}× today` : "Not taken today"}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.takeBtn, takingId === m.id && styles.takeBtnBusy]}
                onPress={() => take(m.id)}
                disabled={takingId === m.id}
              >
                <Text style={styles.takeBtnText}>Take</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      <AddMedicationModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
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
  title: { color: theme.colors.text, fontSize: 24, fontWeight: "800" },
  addBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius,
    paddingHorizontal: theme.spacing(2),
    paddingVertical: theme.spacing(1),
  },
  addBtnText: { color: theme.colors.text, fontWeight: "800", fontSize: 15 },
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
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(1.5),
  },
  cardMain: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing(1) },
  name: { color: theme.colors.text, fontSize: 16, fontWeight: "700" },
  badge: { backgroundColor: theme.colors.surfaceAlt, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  badgeMed: { backgroundColor: theme.colors.accentDim },
  badgeText: { color: theme.colors.textDim, fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  sub: { color: theme.colors.textDim, fontSize: 13 },
  taken: { color: theme.colors.text, fontSize: 13, marginTop: 2 },
  takeBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius,
    paddingHorizontal: theme.spacing(2),
    paddingVertical: theme.spacing(1.25),
  },
  takeBtnBusy: { opacity: 0.6 },
  takeBtnText: { color: theme.colors.text, fontWeight: "800", fontSize: 14 },
});
