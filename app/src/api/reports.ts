import { authHeader } from "../supabase";
import { API_BASE_URL } from "./base";

export type WeeklyReport = {
  rangeStart: string;
  rangeEnd: string;
  days: number;
  training: {
    workouts: number;
    daysTrained: number;
    sets: number;
    volume: number;
    topExercises: { exercise: string; sets: number }[];
  };
  nutrition: {
    meals: number;
    daysLogged: number;
    avgCalories: number | null;
    avgProtein: number | null;
  };
  adherence: { name: string; daysTaken: number; doses: number; rate: number }[];
  markdown: string;
};

export async function getWeeklyReport(days = 7): Promise<WeeklyReport> {
  const res = await fetch(`${API_BASE_URL}/reports/weekly?days=${days}`, {
    headers: await authHeader(),
  });
  if (!res.ok) throw new Error(`report failed (${res.status})`);
  return (await res.json()) as WeeklyReport;
}
