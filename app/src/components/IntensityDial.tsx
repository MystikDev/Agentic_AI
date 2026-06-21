import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Slider from "@react-native-community/slider";
import { theme } from "../theme";

type Props = {
  intensity: number;
  label: string;
  onChange: (value: number) => void;
};

/**
 * The signature control: a 1–10 slider that sets the coach's personality, from
 * "Zen Guide" to "Drill Sergeant". Label is supplied by the parent (fetched from
 * the server so the band definitions live in one place).
 */
export function IntensityDial({ intensity, label, onChange }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{intensity}/10</Text>
      </View>
      <Slider
        minimumValue={1}
        maximumValue={10}
        step={1}
        value={intensity}
        onValueChange={onChange}
        minimumTrackTintColor={theme.colors.accent}
        maximumTrackTintColor={theme.colors.surfaceAlt}
        thumbTintColor={theme.colors.accent}
      />
      <View style={styles.scaleRow}>
        <Text style={styles.scaleEnd}>Gentle</Text>
        <Text style={styles.scaleEnd}>Drill Sergeant</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    padding: theme.spacing(2),
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { color: theme.colors.accent, fontSize: 16, fontWeight: "700" },
  value: { color: theme.colors.textDim, fontSize: 14, fontWeight: "600" },
  scaleRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  scaleEnd: { color: theme.colors.textDim, fontSize: 11 },
});
