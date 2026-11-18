import type { PersistedSession } from "./persistence.js";

export type SessionControlManager = {
  activeSessions?: Map<string, { parentSessionId?: string; taskBinding?: PersistedSession["taskBinding"] }>;
};

export function ownsBoundedHelper(manager: SessionControlManager, caller: string | undefined, target: string): boolean {
  if (!caller || caller === target || !manager.activeSessions?.has(caller)) return false;
  const callerBinding = manager.activeSessions.get(caller)?.taskBinding;
  const helper = manager.activeSessions.get(target);
  const binding = helper?.taskBinding;
  if (
    !helper ||
    Boolean(binding) !== Boolean(callerBinding) ||
    (binding && callerBinding && (
      binding.appId !== callerBinding.appId ||
      binding.taskId !== callerBinding.taskId ||
      binding.generation !== callerBinding.generation ||
      binding.attemptId !== callerBinding.attemptId
    ))
  )
    return false;
  const seen = new Set<string>();
  let parent = helper.parentSessionId;
  while (parent && !seen.has(parent)) {
    if (parent === caller) return true;
    seen.add(parent);
    parent = manager.activeSessions.get(parent)?.parentSessionId;
  }
  return false;
}
