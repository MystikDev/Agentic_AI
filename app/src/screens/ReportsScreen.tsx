import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Share,
  Platform,
} from "react-native";
import { theme } from "../theme";
import { getWeeklyReport, type WeeklyReport } from "../api/reports";

/** Share or copy text, working on native (Share sheet) and web (Web Share / clipboard). */
async function shareText(text: string): Promise<"shared" | "copied" | "none"> {
  if (Platform.OS === "web") {
    const nav = globalThis.navigator as
      | { share?: (d: { text: string }) => Promise<void>; clipboard?: { writeText: (t: string) => Promise<void> } }
      | undefined;
    if (nav?.share) {
      try {
        await nav.share({ text });
        return "shared";
      } catch {
        /* user cancelled or unsupported — fall through to clipboard */
      }
    }
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return "copied";
    }
    return "none";
  }
  await Share.share({ message: text });
  return "shared";
}

export function ReportsScreen() {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);

  const load = useCallback(async (mode: "initial" | "refresh") => {
    if (mode === "refresh") setRefreshing(true);
    setError(null);
    try {
      setReport(await getWeeklyReport(7));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load report.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load("initial");
  }, [load]);

  const onShare = useCallback(async () => {
    if (!report) return;
    setShareNote(null);
    try {
      const result = await shareText(report.markdown);
      if (result === "copied") setShareNote("Copied to clipboard");
      else if (result === "none") setShareNote("Sharing isn't available here");
    } catch {
      setShareNote("Couldn't share");
    }
  }, [report]);

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Weekly Report</Text>
        {report && (
          <TouchableOpacity style={styles.shareBtn} onPress={onShare}>
            <Text style={styles.shareBtnText}>Share</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} tintColor={theme.colors.accent} />
        }
      >
        {error && <Text style={styles.error}>{error}</Text>}
        {shareNote && <Text style={styles.note}>{shareNote}</Text>}

        {report && (
          <>
            <Text style={styles.range}>Last {report.days} days</Text>

            <Section title="Training">
              {report.training.workouts === 0 ? (
                <Text style={styles.muted}>No workouts logged.</Text>
              ) : (
                <>
                  <Stat label="Workouts" value={`${report.training.workouts}`} />
                  <Stat label="Days trained" value={`${report.training.daysTrained}`} />
                  <Stat label="Sets" value={`${report.training.sets}`} />
                  {report.training.volume > 0 && (
                    <Stat label="Total volume" value={report.training.volume.toLocaleString()} />
                  )}
                  {report.training.topExercises.length > 0 && (
                    <Text style={styles.line}>
                      Top: {report.training.topExercises.map((e) => `${e.exercise} (${e.sets})`).join(", ")}
                    </Text>
                  )}
                </>
              )}
            </Section>

            <Section title="Nutrition">
              {report.nutrition.meals === 0 ? (
                <Text style={styles.muted}>No meals logged.</Text>
              ) : (
                <>
                  <Stat label="Meals" value={`${report.nutrition.meals}`} />
                  <Stat label="Days logged" value={`${report.nutrition.daysLogged}`} />
                  {report.nutrition.avgCalories != null && (
                    <Stat label="Avg calories/day" value={`${report.nutrition.avgCalories} kcal`} />
                  )}
                  {report.nutrition.avgProtein != null && (
                    <Stat label="Avg protein/day" value={`${report.nutrition.avgProtein} g`} />
                  )}
                </>
              )}
            </Section>

            <Section title="Meds & Supplements">
              {report.adherence.length === 0 ? (
                <Text style={styles.muted}>Nothing tracked.</Text>
              ) : (
                report.adherence.map((a) => (
                  <View key={a.name} style={styles.adhRow}>
                    <Text style={styles.line}>{a.name}</Text>
                    <Text style={styles.adhRate}>
                      {a.daysTaken}/{report.days} ({Math.round(a.rate * 100)}%)
                    </Text>
                  </View>
                ))
              )}
            </Section>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  center: { justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: theme.spacing(7),
    paddingHorizontal: theme.spacing(2),
    paddingBottom: theme.spacing(1),
  },
  title: { color: theme.colors.text, fontSize: 26, fontWeight: "800" },
  shareBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius,
    paddingHorizontal: theme.spacing(2),
    paddingVertical: theme.spacing(1),
  },
  shareBtnText: { color: theme.colors.text, fontWeight: "800", fontSize: 15 },
  list: { padding: theme.spacing(2), gap: theme.spacing(1.5) },
  range: { color: theme.colors.textDim, fontSize: 13 },
  error: { color: theme.colors.danger, fontSize: 14 },
  note: { color: theme.colors.accent, fontSize: 13 },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius, padding: theme.spacing(2), gap: theme.spacing(0.75) },
  sectionTitle: { color: theme.colors.accent, fontSize: 16, fontWeight: "800", marginBottom: theme.spacing(0.5) },
  statRow: { flexDirection: "row", justifyContent: "space-between" },
  statLabel: { color: theme.colors.textDim, fontSize: 14 },
  statValue: { color: theme.colors.text, fontSize: 14, fontWeight: "700" },
  line: { color: theme.colors.text, fontSize: 14 },
  muted: { color: theme.colors.textDim, fontSize: 14 },
  adhRow: { flexDirection: "row", justifyContent: "space-between" },
  adhRate: { color: theme.colors.text, fontSize: 14, fontWeight: "700" },
});
