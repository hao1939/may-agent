import type { AppDefinition } from "@may-agent/sdk";
import type { AppTaskResource } from "./app-task-state.js";

export type TaskCoordinationPolicy = NonNullable<NonNullable<AppDefinition["tasks"]>["coordination"]>;

/** Shared exact eligibility for coordination reserve dispatch. */
export function matchesTaskCoordination(
  appId: string,
  owner: string,
  policy: TaskCoordinationPolicy | undefined,
  resource: AppTaskResource,
  agent: string,
): boolean {
  return Boolean(
    policy &&
    resource.metadata.id === policy.taskId &&
    resource.spec.workflow === policy.workflow &&
    !resource.spec.executor &&
    agent === owner &&
    resource.metadata.creator?.appId === appId &&
    resource.metadata.creator.taskId === undefined,
  );
}

export function assertTaskCoordinationPolicy(appId: string, owner: string, policy?: TaskCoordinationPolicy): void {
  if (!policy) return;
  if (!owner.trim()) throw new Error(`App ${appId} coordination requires a non-empty owner agent`);
  if (!policy.taskId?.trim() || !policy.workflow?.trim())
    throw new Error(`App ${appId} coordination requires non-empty taskId and workflow`);
  if (policy.maxAttemptMs !== undefined && (!Number.isSafeInteger(policy.maxAttemptMs) || policy.maxAttemptMs <= 0))
    throw new Error(`App ${appId} coordination maxAttemptMs must be a positive integer`);
}
