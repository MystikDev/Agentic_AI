import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { theme } from "../theme";
import type { AthleteProfile } from "../api/coach";
import { listToLines, linesToList } from "../profile";

type Experience = NonNullable<AthleteProfile["experienceLevel"]>;
const LEVELS: Experience[] = ["beginner", "intermediate", "advanced"];

type Props = {
  visible: boolean;
  initial: AthleteProfile;
  onSave: (profile: AthleteProfile) => void;
  onClose: () => void;
};

/**
 * Profile editor. Captures the context the persona engine personalizes around —
 * name, experience, goals, and (most importantly) injuries/limitations the coach
 * must respect at every intensity.
 */
export function ProfileModal({ visible, initial, onSave, onClose }: Props) {
  const [name, setName] = useState(initial.name ?? "");
  const [level, setLevel] = useState<Experience | undefined>(initial.experienceLevel);
  const [goals, setGoals] = useState(listToLines(initial.goals));
  const [constraints, setConstraints] = useState(listToLines(initial.constraints));

  // Re-seed fields whenever the modal is (re)opened with fresh data.
  useEffect(() => {
    if (visible) {
      setName(initial.name ?? "");
      setLevel(initial.experienceLevel);
      setGoals(listToLines(initial.goals));
      setConstraints(listToLines(initial.constraints));
    }
  }, [visible, initial]);

  const save = () => {
    onSave({
      name: name.trim() || undefined,
      experienceLevel: level,
      goals: linesToList(goals),
      constraints: linesToList(constraints),
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Your Profile</Text>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="What should the coach call you?"
              placeholderTextColor={theme.colors.textDim}
            />

            <Text style={styles.label}>Experience</Text>
            <View style={styles.levelRow}>
              {LEVELS.map((l) => (
                <TouchableOpacity
                  key={l}
                  style={[styles.levelChip, level === l && styles.levelChipOn]}
                  onPress={() => setLevel(level === l ? undefined : l)}
                >
                  <Text style={[styles.levelText, level === l && styles.levelTextOn]}>
                    {l}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Goals</Text>
            <Text style={styles.hint}>One per line (e.g. "lose 10 lbs", "first pull-up")</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={goals}
              onChangeText={setGoals}
              placeholder={"Build strength\nRun a 5K"}
              placeholderTextColor={theme.colors.textDim}
              multiline
            />

            <Text style={styles.label}>Injuries / limitations</Text>
            <Text style={styles.hint}>
              The coach will respect these at every intensity — one per line.
            </Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={constraints}
              onChangeText={setConstraints}
              placeholder={"Bad left knee\nLower-back sensitivity"}
              placeholderTextColor={theme.colors.textDim}
              multiline
            />
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onClose}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={save}>
              <Text style={styles.btnPrimaryText}>Save</Text>
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
  title: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: "800",
    paddingHorizontal: theme.spacing(2.5),
  },
  body: { padding: theme.spacing(2.5), gap: theme.spacing(0.5) },
  label: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "700",
    marginTop: theme.spacing(1.5),
  },
  hint: { color: theme.colors.textDim, fontSize: 12, marginBottom: theme.spacing(0.5) },
  input: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius,
    padding: theme.spacing(1.5),
    color: theme.colors.text,
    fontSize: 16,
  },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  levelRow: { flexDirection: "row", gap: theme.spacing(1), marginTop: theme.spacing(0.5) },
  levelChip: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius,
    paddingVertical: theme.spacing(1.25),
    alignItems: "center",
  },
  levelChipOn: { backgroundColor: theme.colors.accent },
  levelText: { color: theme.colors.textDim, fontWeight: "700", textTransform: "capitalize" },
  levelTextOn: { color: theme.colors.text },
  actions: {
    flexDirection: "row",
    gap: theme.spacing(1.5),
    padding: theme.spacing(2),
    paddingBottom: theme.spacing(4),
  },
  btn: { flex: 1, borderRadius: theme.radius, paddingVertical: theme.spacing(1.75), alignItems: "center" },
  btnGhost: { backgroundColor: theme.colors.surfaceAlt },
  btnGhostText: { color: theme.colors.text, fontWeight: "700", fontSize: 16 },
  btnPrimary: { backgroundColor: theme.colors.accent },
  btnPrimaryText: { color: theme.colors.text, fontWeight: "800", fontSize: 16 },
});
