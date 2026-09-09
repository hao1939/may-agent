import type { TaskExecutor } from "@may-agent/sdk";
import { inspectWorkflowDefinition } from "../../../lib/workflow-tool.js";

/** Backend lookup for one recovery pass, not another execution or retry path. */
export function createTaskHandlerAvailability(input: {
  executors?: Readonly<Record<string, TaskExecutor>>;
  workflowDir: (agent: string) => string;
}): (binding: { agent: string; handler: string }) => Promise<boolean> {
  const workflows = new Map<string, boolean>();
  return async ({ agent, handler }) => {
    if (handler.startsWith("executor:") || handler.startsWith("cli:")) {
      return typeof input.executors?.[handler.slice(handler.indexOf(":") + 1)] === "function";
    }
    if (!handler.startsWith("workflow:")) return false;
    const name = handler.slice("workflow:".length);
    const directory = input.workflowDir(agent);
    const key = `${directory}\0${name}`;
    let available = workflows.get(key);
    if (available === undefined) {
      available = (await inspectWorkflowDefinition(directory, name)).available;
      workflows.set(key, available);
    }
    return available;
  };
}
