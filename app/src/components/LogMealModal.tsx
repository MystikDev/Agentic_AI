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
import { createMeal, type NewMeal } from "../api/meals";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
};

/** Log a meal: a description plus optional calories and macros. */
export function LogMealModal({ visible, onClose, onSaved }: Props) {
  const [description, setDescription] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setDescription("");
      setCalories("");
      setProtein("");
      setCarbs("");
      setFat("");
      setError(null);
      setBusy(false);
    }
  }, [visible]);

  const optionalNum = (s: string, label: string): number | undefined | "err" => {
    if (!s.trim()) return undefined;
    const n = Number(s);
    if (Number.isNaN(n) || n < 0) {
      setError(`"${label}" must be a number ≥ 0.`);
      return "err";
    }
    return n;
  };

  const save = async () => {
    setError(null);
    const desc = description.trim();
    if (!desc) {
      setError("Add a description (e.g. \"Chicken & rice\").");
      return;
    }
    const cal = optionalNum(calories, "Calories");
    const p = optionalNum(protein, "Protein");
    const c = optionalNum(carbs, "Carbs");
    const f = optionalNum(fat, "Fat");
    if (cal === "err" || p === "err" || c === "err" || f === "err") return;

    const meal: NewMeal = { description: desc };
    if (cal !== undefined) meal.calories = Math.round(cal);
    if (p !== undefined) meal.proteinG = p;
    if (c !== undefined) meal.carbsG = c;
    if (f !== undefined) meal.fatG = f;

    setBusy(true);
    try {
      await createMeal(meal);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save meal.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Log a meal</Text>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>What did you eat?</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Chicken, rice & broccoli"
              placeholderTextColor={theme.colors.textDim}
            />

            <Text style={styles.label}>Calories (optional)</Text>
            <TextInput
              style={styles.input}
              value={calories}
              onChangeText={setCalories}
              placeholder="520"
              placeholderTextColor={theme.colors.textDim}
              keyboardType="number-pad"
            />

            <Text style={styles.label}>Macros (grams, optional)</Text>
            <View style={styles.macroRow}>
              <MacroInput label="Protein" value={protein} onChange={setProtein} />
              <MacroInput label="Carbs" value={carbs} onChange={setCarbs} />
              <MacroInput label="Fat" value={fat} onChange={setFat} />
            </View>

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

function MacroInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.macroCol}>
      <Text style={styles.macroLabel}>{label}</Text>
      <TextInput
        style={[styles.input, styles.macroField]}
        value={value}
        onChangeText={onChange}
        placeholder="0"
        placeholderTextColor={theme.colors.textDim}
        keyboardType="numeric"
      />
    </View>
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
  body: { padding: theme.spacing(2.5), gap: theme.spacing(0.5) },
  label: { color: theme.colors.text, fontSize: 15, fontWeight: "700", marginTop: theme.spacing(1.5) },
  input: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius,
    padding: theme.spacing(1.5),
    color: theme.colors.text,
    fontSize: 16,
  },
  macroRow: { flexDirection: "row", gap: theme.spacing(1), marginTop: theme.spacing(0.5) },
  macroCol: { flex: 1, gap: theme.spacing(0.5) },
  macroLabel: { color: theme.colors.textDim, fontSize: 12, fontWeight: "700" },
  macroField: { textAlign: "center" },
  error: { color: theme.colors.danger, fontSize: 14, marginTop: theme.spacing(1) },
  actions: { flexDirection: "row", gap: theme.spacing(1.5), padding: theme.spacing(2), paddingBottom: theme.spacing(4) },
  btn: { flex: 1, borderRadius: theme.radius, paddingVertical: theme.spacing(1.75), alignItems: "center" },
  btnDisabled: { opacity: 0.6 },
  btnGhost: { backgroundColor: theme.colors.surfaceAlt },
  btnGhostText: { color: theme.colors.text, fontWeight: "700", fontSize: 16 },
  btnPrimary: { backgroundColor: theme.colors.accent },
  btnPrimaryText: { color: theme.colors.text, fontWeight: "800", fontSize: 16 },
});
