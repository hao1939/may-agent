/** Replaceable observations stay live on the bus without growing the Event journal.
 * This classification affects storage only, never subscriber or listener delivery.
 */
const LIVE_ONLY_EVENT_TYPES = new Set<string>([
  "conversation.updated",
  "skill.loaded",
  "workflow.step_started",
  "workflow.step_completed",
  "handler.workflow_dispatched",
  "project.task.reconcile.started",
  "project.task.reconcile.profiled",
  "project.task.executor.progress",
]);

export function isLiveOnlyEventType(type: string): boolean {
  return LIVE_ONLY_EVENT_TYPES.has(type);
}
