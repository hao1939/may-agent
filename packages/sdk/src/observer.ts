import { MIN_CONDITION_REVIEW_AFTER_MS, type Condition } from "./task.js";

/** App-owned source semantics; the Host supplies demand, identity and delivery. */
export type ResourceObserver = {
  id: string;
  type: string;
  description: string;
  intervalMs: number;
  timeoutMs: number;
  /** Return provider fields unchanged in meaning; `resource` is reserved for Host correlation. */
  inspect(resource: string, context: { signal: AbortSignal }): Promise<Record<string, unknown>>;
};

export type ObservationContract = Omit<ResourceObserver, "inspect"> & { appId: string };
export type ObservationInterest = {
  observerId: string;
  id: string;
  resource: string;
  expected: Record<string, unknown>;
  /** @deprecated Retained for compatibility; use Task reviewAt for agent reconsideration. */
  reviewAfterMs?: number;
};

/** Current runtime evidence, not proof that a Task consumed the observation. */
export type ObserverHealth = {
  id: string;
  intervalMs: number;
  available: boolean;
  running: boolean;
  lastStartedAt?: number;
  lastCompletedAt?: number;
  lastError?: string;
  /** Bounded recent resource reads; absence means unknown, not healthy. */
  resources?: Array<{ resource: string; checkedAt: number; lastSuccessAt?: number; error?: string }>;
};

export function defineObserver(definition: ResourceObserver): ResourceObserver {
  return definition;
}

/** Pure Condition construction. Save it through the ordinary Task result. */
export function observationCondition(capability: ObservationContract, interest: ObservationInterest): Condition {
  if (interest.observerId !== capability.id) throw new Error("Observation capability does not match observerId");
  if (!interest.id?.trim() || !interest.resource?.trim()) throw new Error("Observation requires id and resource");
  if (!interest.expected || typeof interest.expected !== "object" || Array.isArray(interest.expected))
    throw new Error("Observation requires an expectation object");
  const reviewAfterMs = interest.reviewAfterMs;
  if (
    reviewAfterMs !== undefined &&
    (!Number.isSafeInteger(reviewAfterMs) || reviewAfterMs < MIN_CONDITION_REVIEW_AFTER_MS)
  )
    throw new Error(`reviewAfterMs must be an integer of at least ${MIN_CONDITION_REVIEW_AFTER_MS}`);
  return {
    id: interest.id,
    type: capability.type,
    subject: `resource:${interest.resource}`,
    expected: { ...interest.expected, source: `app:${capability.appId}:observer:${capability.id}` },
    owner: `app:${capability.appId}`,
    ...(reviewAfterMs === undefined ? {} : { reviewAfterMs }),
  };
}
