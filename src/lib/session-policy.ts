/** Runtime capability profile persisted with a session so recovery cannot broaden its tools. */
export type ToolPolicy =
  | "full"
  | "full-no-tasks"
  | "readonly"
  /** @deprecated Retained-session restriction; do not select for new Conversation work. */
  | "deputy"
  | "app-agent-full"
  /** @deprecated Retained-session restriction; do not select for new Conversation work. */
  | "app-agent-deputy"
  /** @deprecated Compatibility with retained session metadata. */
  | "app-owner-full"
  /** @deprecated Compatibility with retained session metadata. */
  | "app-owner-deputy";
