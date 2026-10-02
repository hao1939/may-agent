import type { AppDefinition } from "@may-agent/sdk";
import { AppTaskAdmissionError } from "../state/task-admission-error.js";

/** App declarations select the handler; an exact Task target bypasses mapping. */
export function appInputRoute(
  app: Readonly<AppDefinition>,
  kind: string,
  targetTaskId?: string,
  appRequest = false,
): "conversation" | "task" | null {
  if (
    !appRequest &&
    !targetTaskId &&
    app.conversation &&
    (!app.conversation.inputKinds || app.conversation.inputKinds.includes(kind))
  )
    return "conversation";
  return app.tasks && app.task ? "task" : null;
}

/** A delegated outcome needs the App's durable work contract. */
export function assertAppTaskInputRoute(app: Readonly<AppDefinition>, kind: string, targetTaskId?: string): void {
  if (appInputRoute(app, kind, targetTaskId, true) === "task") return;
  throw new AppTaskAdmissionError(`App ${app.id} has no Task handler for input kind ${kind}`);
}
