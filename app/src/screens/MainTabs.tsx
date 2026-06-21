import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { theme } from "../theme";
import { CoachScreen } from "./CoachScreen";
import { WorkoutsScreen } from "./WorkoutsScreen";

type Tab = "coach" | "workouts";

/**
 * Minimal two-tab shell (no navigation library yet). The signed-in app is the
 * Coach and the Workouts history; more tabs (diet, meds, reports) arrive in later
 * Phase 2 slices.
 */
export function MainTabs() {
  const [tab, setTab] = useState<Tab>("coach");

  return (
    <View style={styles.root}>
      <View style={styles.screen}>
        {tab === "coach" ? <CoachScreen /> : <WorkoutsScreen />}
      </View>
      <View style={styles.tabBar}>
        <TabButton label="Coach" icon="🗣️" active={tab === "coach"} onPress={() => setTab("coach")} />
        <TabButton
          label="Workouts"
          icon="🏋️"
          active={tab === "workouts"}
          onPress={() => setTab("workouts")}
        />
      </View>
    </View>
  );
}

function TabButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.tab} onPress={onPress} accessibilityLabel={label}>
      <Text style={styles.tabIcon}>{icon}</Text>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  screen: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.surfaceAlt,
    paddingBottom: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
  tab: { flex: 1, alignItems: "center", gap: 2 },
  tabIcon: { fontSize: 20 },
  tabLabel: { color: theme.colors.textDim, fontSize: 12, fontWeight: "700" },
  tabLabelActive: { color: theme.colors.accent },
});
