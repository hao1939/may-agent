import type { AppTaskContext } from "./app-task-store.js";
import {
  listHandlerUnavailableAppTasks,
  releaseHandlerUnavailableAppTask,
  type AppTaskHandlerRepairCandidate,
} from "./app-task-reconciler.js";

/** One bounded recovery pass. Backend inspection cannot mutate Task state. */
export async function recoverUnavailableTaskHandlers(input: {
  config: AppTaskContext;
  isAvailable: (candidate: AppTaskHandlerRepairCandidate) => Promise<boolean>;
  /** The installed definition must still be the one whose bindings we checked. */
  isCurrent: () => boolean;
  onRecovered: (candidate: AppTaskHandlerRepairCandidate) => void;
}): Promise<void> {
  if (!input.isCurrent()) return;
  const ids = input.config.resourceStore.takeHandlerRecoveryTaskIds(512);
  for (const candidate of listHandlerUnavailableAppTasks(input.config, input.config.agent, ids)) {
    if (!input.isCurrent()) return;
    const available = await input.isAvailable(candidate);
    if (!input.isCurrent()) return;
    if (available && releaseHandlerUnavailableAppTask(input.config, candidate)) input.onRecovered(candidate);
  }
}
