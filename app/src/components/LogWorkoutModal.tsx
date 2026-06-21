import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { theme } from "../theme";
import { createWorkout, type WorkoutSet } from "../api/workouts";

type Row = { exercise: string; weight: string; reps: string };
const emptyRow = (): Row => ({ exercise: "", weight: "", reps: "" });

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
};

/** Log a workout: a session of one or more sets (exercise / weight / reps). */
export function LogWorkoutModal({ visible, onClose, onSaved }: Props) {
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setRows([emptyRow()]);
      setNotes("");
      setError(null);
      setBusy(false);
    }
  }, [visible]);

  const update = (i: number, field: keyof Row, value: string) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (i: number) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  const save = async () => {
    setError(null);
    const sets: WorkoutSet[] = [];
    for (const r of rows) {
      const exercise = r.exercise.trim();
      const reps = parseInt(r.reps, 10);
      if (!exercise) continue; // skip blank rows
      if (!Number.isInteger(reps) || reps < 1) {
        setError("Every set needs a name and reps ≥ 1.");
        return;
      }
      const weightNum = r.weight.trim() ? Number(r.weight) : undefined;
      if (weightNum !== undefined && (Number.isNaN(weightNum) || weightNum < 0)) {
        setError(`"${exercise}" has an invalid weight.`);
        return;
      }
      sets.push({ exercise, reps, ...(weightNum !== undefined ? { weight: weightNum } : {}) });
    }
    if (!sets.length) {
      setError("Add at least one set.");
      return;
    }

    setBusy(true);
    try {
      await createWorkout({ sets, notes: notes.trim() || undefined });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save workout.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Log a workout</Text>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.headRow}>
              <Text style={[styles.head, styles.exCol]}>Exercise</Text>
              <Text style={[styles.head, styles.numCol]}>Weight</Text>
              <Text style={[styles.head, styles.numCol]}>Reps</Text>
              <View style={styles.delCol} />
            </View>

            {rows.map((r, i) => (
              <View key={i} style={styles.row}>
                <TextInput
                  style={[styles.input, styles.exCol]}
                  value={r.exercise}
                  onChangeText={(v) => update(i, "exercise", v)}
                  placeholder="Squat"
                  placeholderTextColor={theme.colors.textDim}
                />
                <TextInput
                  style={[styles.input, styles.numCol]}
                  value={r.weight}
                  onChangeText={(v) => update(i, "weight", v)}
                  placeholder="BW"
                  placeholderTextColor={theme.colors.textDim}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.input, styles.numCol]}
                  value={r.reps}
                  onChangeText={(v) => update(i, "reps", v)}
                  placeholder="5"
                  placeholderTextColor={theme.colors.textDim}
                  keyboardType="number-pad"
                />
                <TouchableOpacity style={styles.delCol} onPress={() => removeRow(i)}>
                  <Text style={styles.del}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.addRow} onPress={addRow}>
              <Text style={styles.addRowText}>＋ Add set</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.notes]}
              value={notes}
              onChangeText={setNotes}
              placeholder="How did it feel?"
              placeholderTextColor={theme.colors.textDim}
              multiline
            />

            {error && <Text style={styles.error}>{error}</Text>}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onClose}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, busy && styles.btnDisabled]}
              onPress={save}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={theme.colors.text} />
              ) : (
                <Text style={styles.btnPrimaryText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: theme.colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: theme.spacing(2),
    maxHeight: "90%",
  },
  title: { color: theme.colors.text, fontSize: 22, fontWeight: "800", paddingHorizontal: theme.spacing(2.5) },
  body: { padding: theme.spacing(2.5), gap: theme.spacing(1) },
  headRow: { flexDirection: "row", gap: theme.spacing(1), paddingHorizontal: theme.spacing(0.5) },
  head: { color: theme.colors.textDim, fontSize: 12, fontWeight: "700" },
  row: { flexDirection: "row", gap: theme.spacing(1), alignItems: "center" },
  exCol: { flex: 3 },
  numCol: { flex: 1.4, textAlign: "center" },
  delCol: { width: 28, alignItems: "center", justifyContent: "center" },
  del: { color: theme.colors.danger, fontSize: 16, fontWeight: "700" },
  input: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius,
    paddingHorizontal: theme.spacing(1.25),
    paddingVertical: theme.spacing(1.25),
    color: theme.colors.text,
    fontSize: 15,
  },
  addRow: { paddingVertical: theme.spacing(1), alignItems: "center" },
  addRowText: { color: theme.colors.accent, fontWeight: "700", fontSize: 15 },
  label: { color: theme.colors.text, fontSize: 15, fontWeight: "700", marginTop: theme.spacing(1) },
  notes: { minHeight: 60, textAlignVertical: "top" },
  error: { color: theme.colors.danger, fontSize: 14, marginTop: theme.spacing(0.5) },
  actions: { flexDirection: "row", gap: theme.spacing(1.5), padding: theme.spacing(2), paddingBottom: theme.spacing(4) },
  btn: { flex: 1, borderRadius: theme.radius, paddingVertical: theme.spacing(1.75), alignItems: "center" },
  btnDisabled: { opacity: 0.6 },
  btnGhost: { backgroundColor: theme.colors.surfaceAlt },
  btnGhostText: { color: theme.colors.text, fontWeight: "700", fontSize: 16 },
  btnPrimary: { backgroundColor: theme.colors.accent },
  btnPrimaryText: { color: theme.colors.text, fontWeight: "800", fontSize: 16 },
});
