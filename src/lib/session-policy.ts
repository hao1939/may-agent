/** Runtime capability profile persisted with a session so recovery cannot broaden its tools. */
export type ToolPolicy =
  | "full"
  | "readonly"
  | "deputy"
  | "app-agent-full"
  | "app-agent-deputy"
  /** @deprecated Compatibility with retained session metadata. */
  | "app-owner-full"
  /** @deprecated Compatibility with retained session metadata. */
  | "app-owner-deputy";
