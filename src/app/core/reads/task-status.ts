import type { TaskStatus } from "@may-agent/sdk";

/** One read projection over existing phase and terminal decision authority. */
export function taskStatusFromPhase(phase: string | undefined, closure?: "closed" | "cancelled"): TaskStatus {
  if (closure) return closure;
  if (phase === "converged") return "idle";
  if (phase === "pending" || phase === "running" || phase === "waiting" || phase === "attention") return phase;
  throw new Error(`Invalid Task phase: ${String(phase)}`);
}
