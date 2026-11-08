import type { AppDefinition } from "@may-agent/sdk";
import type { AppTaskResource } from "./app-task-state.js";

export type TaskCoordinationPolicy = NonNullable<NonNullable<AppDefinition["tasks"]>["coordination"]>;

/** Shared exact eligibility for reserve dispatch and protected funding. */
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
