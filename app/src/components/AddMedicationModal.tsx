import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { theme } from "../theme";
import { createMedication, type MedicationKind } from "../api/medications";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
};

/** Add a medication or supplement to track. */
export function AddMedicationModal({ visible, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<MedicationKind>("supplement");
  const [dosage, setDosage] = useState("");
  const [schedule, setSchedule] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName("");
      setKind("supplement");
      setDosage("");
      setSchedule("");
      setError(null);
      setBusy(false);
    }
  }, [visible]);

  const save = async () => {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give it a name (e.g. \"Vitamin D\").");
      return;
    }
    setBusy(true);
    try {
      await createMedication({
        name: trimmed,
        kind,
        dosage: dosage.trim() || undefined,
        schedule: schedule.trim() || undefined,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Add to your stack</Text>

          <Text style={styles.label}>Type</Text>
          <View style={styles.kindRow}>
            {(["supplement", "medication"] as MedicationKind[]).map((k) => (
              <TouchableOpacity
                key={k}
                style={[styles.kindChip, kind === k && styles.kindChipOn]}
                onPress={() => setKind(k)}
              >
                <Text style={[styles.kindText, kind === k && styles.kindTextOn]}>{k}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={kind === "supplement" ? "Creatine" : "Metformin"}
            placeholderTextColor={theme.colors.textDim}
          />

          <Text style={styles.label}>Dosage (optional)</Text>
          <TextInput
            style={styles.input}
            value={dosage}
            onChangeText={setDosage}
            placeholder="5 g / 500 mg / 2 capsules"
            placeholderTextColor={theme.colors.textDim}
          />

          <Text style={styles.label}>Schedule (optional)</Text>
          <TextInput
            style={styles.input}
            value={schedule}
            onChangeText={setSchedule}
            placeholder="Daily, morning"
            placeholderTextColor={theme.colors.textDim}
          />

          {error && <Text style={styles.error}>{error}</Text>}

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
    padding: theme.spacing(2.5),
    paddingBottom: theme.spacing(4),
    gap: theme.spacing(0.5),
  },
  title: { color: theme.colors.text, fontSize: 22, fontWeight: "800", marginBottom: theme.spacing(1) },
  label: { color: theme.colors.text, fontSize: 15, fontWeight: "700", marginTop: theme.spacing(1.5) },
  input: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius,
    padding: theme.spacing(1.5),
    color: theme.colors.text,
    fontSize: 16,
  },
  kindRow: { flexDirection: "row", gap: theme.spacing(1), marginTop: theme.spacing(0.5) },
  kindChip: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius,
    paddingVertical: theme.spacing(1.25),
    alignItems: "center",
  },
  kindChipOn: { backgroundColor: theme.colors.accent },
  kindText: { color: theme.colors.textDim, fontWeight: "700", textTransform: "capitalize" },
  kindTextOn: { color: theme.colors.text },
  error: { color: theme.colors.danger, fontSize: 14, marginTop: theme.spacing(1) },
  actions: { flexDirection: "row", gap: theme.spacing(1.5), marginTop: theme.spacing(2) },
  btn: { flex: 1, borderRadius: theme.radius, paddingVertical: theme.spacing(1.75), alignItems: "center" },
  btnDisabled: { opacity: 0.6 },
  btnGhost: { backgroundColor: theme.colors.surfaceAlt },
  btnGhostText: { color: theme.colors.text, fontWeight: "700", fontSize: 16 },
  btnPrimary: { backgroundColor: theme.colors.accent },
  btnPrimaryText: { color: theme.colors.text, fontWeight: "800", fontSize: 16 },
});
