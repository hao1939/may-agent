import type { AppTaskResource } from "./app-task-state.js";
import { readAppTaskAgent } from "./app-task-reconciler.js";
import { appTaskConfig, type AppTaskRuntimeDescriptor } from "./runtime-definition.js";

/** Installed policy and immutable provenance, never input labels or priority. */
export function isTrustedTaskCoordination(descriptor: AppTaskRuntimeDescriptor, resource: AppTaskResource, agent: string): boolean {
  const policy = descriptor.app.tasks?.coordination;
  return Boolean(policy && resource.metadata.id === policy.taskId &&
    resource.spec.workflow === policy.workflow && !resource.spec.executor &&
    agent === descriptor.agent && resource.metadata.creator?.appId === descriptor.id &&
    resource.metadata.creator.taskId === undefined);
}

export function coordinationTaskIds(descriptor: AppTaskRuntimeDescriptor): ReadonlySet<string> {
  const policy = descriptor.app.tasks?.coordination;
  if (!policy || descriptor.resourceStore.projectLifecycle() !== "active") return new Set();
  const task = descriptor.resourceStore.readTask(policy.taskId);
  const agent = task ? readAppTaskAgent(appTaskConfig(descriptor), policy.taskId) : null;
  return task && agent && isTrustedTaskCoordination(descriptor, task, agent)
    ? new Set([policy.taskId]) : new Set();
}
