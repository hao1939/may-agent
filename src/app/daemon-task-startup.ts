import type { EventBus } from "./core/events/bus.js";
import type { SubagentManager } from "../lib/index.js";

/** Start an optional bounded startup task. Human interfaces admit their own App requests. */
export async function startInitialTask(opts: {
  bus: EventBus;
  manager: SubagentManager;
  interfaceAgent: string;
  initialTask: string | null;
  interactiveMode: boolean;
  envSessionId?: string;
  envParentSessionId?: string;
  envParentAgent?: string;
}): Promise<string | undefined> {
  if (!opts.initialTask || opts.interactiveMode) return undefined;

  const sessionId = opts.manager.run(opts.interfaceAgent, opts.initialTask, {
    kind: "job",
    ...(opts.envSessionId ? { sessionId: opts.envSessionId } : {}),
    ...(opts.envParentSessionId ? { parentSessionId: opts.envParentSessionId } : {}),
    ...(opts.envParentAgent ? { parentAgentName: opts.envParentAgent } : {}),
  });
  opts.bus.emit({
    type: "info",
    message: `[task] Started ${opts.interfaceAgent} task session: ${sessionId}`,
  });
  await opts.manager.waitForIdle(sessionId);
  return sessionId;
}
