import type { PersistedSession } from "../../../lib/persistence.js";
import { readActiveSessionProcessId } from "../../../lib/persistence.js";
import { readExecutionStatus } from "../../core/reads/execution-status.js";

export type SessionControlManager = {
  registryStore: { getSession(id: string): PersistedSession | null; getFilePath(): string };
  status(): Array<{ sessionId: string }>;
  activeSessions?: Map<string, { parentSessionId?: string; taskBinding?: PersistedSession["taskBinding"] }>;
};

function ownsBoundedHelper(manager: SessionControlManager, caller: string | undefined, target: string): boolean {
  if (!caller || caller === target || !manager.activeSessions?.has(caller)) return false;
  const callerBinding = manager.activeSessions.get(caller)?.taskBinding;
  const helper = manager.activeSessions.get(target);
  const binding = helper?.taskBinding;
  if (
    !helper ||
    !binding ||
    !callerBinding ||
    binding.appId !== callerBinding.appId ||
    binding.taskId !== callerBinding.taskId ||
    binding.generation !== callerBinding.generation ||
    binding.attemptId !== callerBinding.attemptId
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

/** The same execution-ownership check guards public admission and redelivery. */
export function validateSessionControl(
  manager: SessionControlManager,
  type: string,
  sessionId?: string,
  options: { callerSessionId?: string; remote?: boolean } = {},
): void {
  const check = (id: string): void => {
    const meta = manager.registryStore.getSession(id);
    if (!meta) throw new Error(`Session ${id} is not known to this runtime`);
    if (meta.taskBinding && !ownsBoundedHelper(manager, options.callerSessionId, id)) {
      const { appId, taskId } = meta.taskBinding;
      throw new Error(
        `Session ${id} belongs to Task ${appId}/${taskId}. Use its App input or Task control; use Conversation Stop to stop a turn.`,
      );
    }
    if (manager.status().some((session) => session.sessionId === id)) return;
    if (options.remote && meta.detached) return;
    if (readActiveSessionProcessId(manager.registryStore.getFilePath(), id) !== null) {
      throw new Error(`Session ${id} is active in another manager; control it through its owning runtime.`);
    }
    if (type !== "session.steer.requested" && (meta?.status === "running" || meta?.status === "idle")) {
      throw new Error(`Session ${id} has no reachable execution; wait for recovery before controlling it.`);
    }
  };
  if (type === "session.cancel_all.requested") {
    // Check all targets before any mutation, including workers outside this manager.
    const shared = readExecutionStatus(manager.registryStore.getFilePath()).sessions;
    for (const session of [...shared, ...manager.status()]) check(session.sessionId);
  } else if (sessionId) check(sessionId);
}
