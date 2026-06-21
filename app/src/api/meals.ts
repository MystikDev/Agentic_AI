import { authHeader } from "../supabase";
import { API_BASE_URL } from "./base";

export type Meal = {
  id: string;
  eatenAt: string;
  description: string;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

export type NewMeal = {
  eatenAt?: string;
  description: string;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
};

export async function listMeals(): Promise<Meal[]> {
  const res = await fetch(`${API_BASE_URL}/meals`, { headers: await authHeader() });
  if (!res.ok) throw new Error(`meals load failed (${res.status})`);
  return ((await res.json()) as { meals: Meal[] }).meals;
}

export async function createMeal(meal: NewMeal): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/meals`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(meal),
  });
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      detail = ((await res.json()) as { error?: string }).error ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(`could not save meal: ${detail}`);
  }
  return ((await res.json()) as { id: string }).id;
}
