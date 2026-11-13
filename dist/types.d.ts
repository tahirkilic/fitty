export interface Values {
  weight: number;
  reps: number;
}
export interface Machine {
  id: string;
  name: string;
  number: string;
  settings: string;
  archived: boolean;
}
export interface PlanItem {
  id: string;
  exerciseId: string;
  name: string;
  number: string;
  settings: string;
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
  version: number;
  name: string;
  rest: number;
  archived: boolean;
  items: PlanItem[];
}
export interface Session {
  id: string;
  name: string;
  planId: string;
  planVersion: number;
  rest: number;
  base: PlanItem[];
  items: SessionItem[];
  status: "active" | "finished";
  startedAt: string;
  finishedAt?: string;
  restUntil: number | null;
  warmup: number;
  warmupStarted: number | null;
}
export interface Data {
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
