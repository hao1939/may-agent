import { AppInboxHost, type AppInboxHostOptions } from "../core/inbox/app-inbox-host.js";
import { prepareConversationInput } from "../conversations/context.js";
import { createConversationTurnHandler, type ConversationHandlerOptions } from "../conversations/turn-handler.js";

/** Default conversational capability; Apps and core state remain independently usable. */
export function createConversationInbox(
  options: Omit<AppInboxHostOptions, "prepareInput" | "handleInput"> & ConversationHandlerOptions,
): AppInboxHost {
  return new AppInboxHost({
    ...options,
    prepareInput: (item, input) => prepareConversationInput(options.db, item, input, options.readDependency),
    handleInput: createConversationTurnHandler(options),
  });
}
