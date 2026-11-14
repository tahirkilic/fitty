export interface Values {
  weight: number | null;
  reps: number | null;
  durationSeconds?: number | null;
}
export type ExerciseKind = "strength" | "cardio" | "isometric";
export interface Machine {
  id: string;
  kind?: ExerciseKind;
  importSourceKey?: string;
  name: string;
  number: string;
  archived: boolean;
}
export interface PlanItem {
  id: string;
  kind?: ExerciseKind;
  exerciseId: string;
  name: string;
  number: string;
  sets: Values[];
}
export interface LoggedSet extends Values {
  target: Values;
  done: boolean;
  previous: string | null;
}
export interface SessionItem extends Omit<PlanItem, "sets"> {
  skipped: boolean;
  sets: LoggedSet[];
}
export interface Plan {
  id: string;
  importSourceKey?: string;
  version: number;
  name: string;
  rest: number;
  archived: boolean;
  items: PlanItem[];
}
export interface Session {
  id: string;
  historicalDate?: string;
  importSource?: "clever_fit_json";
  importSourceKey?: string;
  name: string;
  planId: string;
  planVersion: number;
  rest: number;
  base: PlanItem[];
  items: SessionItem[];
  status: "active" | "finished";
  startedAt?: string;
  finishedAt?: string;
  restUntil: number | null;
}
export interface Data {
  cleverFitMappings?: Record<string, string>;
  exercises: Machine[];
  plans: Plan[];
  rotation: string[];
  next: number;
  sessions: Session[];
  active: Session | null;
}
export interface Repository {
  load(): Data;
  save(data: Data): void;
}
export interface Clock {
  now(): number;
  iso(): string;
}

export interface AppUpdateState {
  available: boolean;
  offlineReady: boolean;
  error: string;
}
export interface AppUpdateService {
  start(notify: (state: AppUpdateState) => void): Promise<void>;
  check(): Promise<void>;
  activate(): Promise<void>;
}
