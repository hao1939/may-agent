import type { AppDefinition } from "@may-agent/sdk";
import { AppTaskAdmissionError } from "../state/task-admission-error.js";

/** App declarations select the handler; an exact Task target bypasses mapping. */
export function appInputRoute(
  app: Readonly<AppDefinition>,
  kind: string,
  targetTaskId?: string,
): "conversation" | "task" | null {
  if (!targetTaskId && app.conversation && (!app.conversation.inputKinds || app.conversation.inputKinds.includes(kind)))
    return "conversation";
  return app.tasks && app.task ? "task" : null;
}

/** A delegated outcome needs the App's durable work contract. */
export function assertAppTaskInputRoute(app: Readonly<AppDefinition>, kind: string, targetTaskId?: string): void {
  const route = appInputRoute(app, kind, targetTaskId);
  if (route === "task") return;
  throw new AppTaskAdmissionError(
    route === "conversation"
      ? `App ${app.id} input ${kind} is conversational and cannot be used for delegated Task work. Submit an input from the App's durable Task contract.`
      : `App ${app.id} has no Task handler for input kind ${kind}`,
  );
}
