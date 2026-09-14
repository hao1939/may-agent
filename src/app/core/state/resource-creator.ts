import type { ResourceCreator } from "@may-agent/sdk";

/** Compare trusted contexts, never agent names, input source text, or parent links. */
export function assertResourceCreator(creator: ResourceCreator | undefined, actor: ResourceCreator): void {
  if (!creator || creator.appId !== actor.appId || creator.taskId !== actor.taskId) {
    throw new Error("Only the recorded creator may change this resource's spec");
  }
}
