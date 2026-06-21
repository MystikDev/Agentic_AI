import { authHeader } from "../supabase";
import { API_BASE_URL } from "./base";

export type MedicationKind = "medication" | "supplement";

export type Medication = {
  id: string;
  name: string;
  kind: MedicationKind;
  dosage: string | null;
  schedule: string | null;
  active: boolean;
  takenToday: number;
  lastTakenAt: string | null;
};

export type NewMedication = {
  name: string;
  kind: MedicationKind;
  dosage?: string;
  schedule?: string;
};

export async function listMedications(): Promise<Medication[]> {
  const res = await fetch(`${API_BASE_URL}/medications`, { headers: await authHeader() });
  if (!res.ok) throw new Error(`medications load failed (${res.status})`);
  return ((await res.json()) as { medications: Medication[] }).medications;
}

export async function createMedication(med: NewMedication): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/medications`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(med),
  });
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      detail = ((await res.json()) as { error?: string }).error ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(`could not save: ${detail}`);
  }
  return ((await res.json()) as { id: string }).id;
}

export async function logIntake(medicationId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/medications/${medicationId}/intakes`, {
    method: "POST",
    headers: await authHeader(),
  });
  if (!res.ok) throw new Error(`could not log dose (${res.status})`);
}
