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
import { LogMealModal } from "../components/LogMealModal";
import { listMeals, type Meal } from "../api/meals";

type DayGroup = {
  key: string;
  label: string;
  meals: Meal[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function groupByDay(meals: Meal[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const m of meals) {
    const key = dayKey(m.eatenAt);
    const g =
      groups.get(key) ??
      { key, label: dayLabel(m.eatenAt), meals: [], calories: 0, protein: 0, carbs: 0, fat: 0 };
    g.meals.push(m);
    g.calories += m.calories ?? 0;
    g.protein += m.proteinG ?? 0;
    g.carbs += m.carbsG ?? 0;
    g.fat += m.fatG ?? 0;
    groups.set(key, g);
  }
  return Array.from(groups.values());
}

function macroLine(m: Meal): string | null {
  const parts: string[] = [];
  if (m.calories != null) parts.push(`${m.calories} kcal`);
  const macros: string[] = [];
  if (m.proteinG != null) macros.push(`P ${m.proteinG}`);
  if (m.carbsG != null) macros.push(`C ${m.carbsG}`);
  if (m.fatG != null) macros.push(`F ${m.fatG}`);
  if (macros.length) parts.push(macros.join(" / "));
  return parts.length ? parts.join(" · ") : null;
}

export function DietScreen() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  const load = useCallback(async (mode: "initial" | "refresh") => {
    if (mode === "refresh") setRefreshing(true);
    setError(null);
    try {
      setMeals(await listMeals());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load meals.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load("initial");
  }, [load]);

  const days = groupByDay(meals);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Diet</Text>
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

          {!error && days.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No meals logged yet</Text>
              <Text style={styles.emptyText}>
                Tap ＋ Log to track what you eat. Macros are optional.
              </Text>
            </View>
          )}

          {days.map((d) => (
            <View key={d.key} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.date}>{d.label}</Text>
                {d.calories > 0 && <Text style={styles.dayTotal}>{d.calories} kcal</Text>}
              </View>
              {d.meals.map((m) => {
                const line = macroLine(m);
                return (
                  <View key={m.id} style={styles.meal}>
                    <Text style={styles.mealDesc}>{m.description}</Text>
                    {line && <Text style={styles.mealMacros}>{line}</Text>}
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}

      <LogMealModal
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
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius, padding: theme.spacing(2), gap: theme.spacing(1) },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  date: { color: theme.colors.accent, fontWeight: "700", fontSize: 15 },
  dayTotal: { color: theme.colors.text, fontWeight: "700", fontSize: 14 },
  meal: { gap: 2 },
  mealDesc: { color: theme.colors.text, fontSize: 15 },
  mealMacros: { color: theme.colors.textDim, fontSize: 13 },
});
