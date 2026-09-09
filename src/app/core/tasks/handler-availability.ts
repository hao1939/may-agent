import type { TaskExecutor } from "@may-agent/sdk";

/** Backend lookup for one recovery pass, not another execution or retry path. */
export function createTaskHandlerAvailability(input: {
  executors?: Readonly<Record<string, TaskExecutor>>;
  agentAvailable?: (agent: string) => boolean;
  inspectWorkflow?: (agent: string, workflow: string) => Promise<boolean>;
}): (binding: { agent: string; handler: string }) => Promise<boolean> {
  const workflows = new Map<string, boolean>();
  return async ({ agent, handler }) => {
    if (handler.startsWith("agent:") || handler.startsWith("owner:")) return input.agentAvailable?.(agent) ?? false;
    if (handler.startsWith("executor:") || handler.startsWith("cli:")) {
      return typeof input.executors?.[handler.slice(handler.indexOf(":") + 1)] === "function";
    }
    if (!handler.startsWith("workflow:")) return false;
    const name = handler.slice("workflow:".length);
    if (!input.inspectWorkflow) return false;
    const key = `${agent}\0${name}`;
    let available = workflows.get(key);
    if (available === undefined) {
      available = await input.inspectWorkflow(agent, name);
      workflows.set(key, available);
    }
    return available;
  };
}
