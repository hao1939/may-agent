import { AppInboxHost, type AppInboxHostOptions } from "../core/inbox/app-inbox-host.js";
import { prepareConversationInput } from "../conversations/context.js";

/** Admission and context only. Conversation execution belongs to the Task runtime. */
export function createConversationInbox(options: AppInboxHostOptions): AppInboxHost {
  return new AppInboxHost({
    ...options,
    prepareInput: (item, input) => prepareConversationInput(options.db, item, input, options.readDependency),
  });
}
