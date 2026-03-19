/**
 * Ambient type declarations for @mariozechner/pi-agent-core.
 *
 * The real package is linked via a workspace symlink to ../../../pi-mono/packages/agent
 * which doesn't exist in the container. These stubs provide enough type information
 * for TSC to validate our code without the real package.
 *
 * WARNING: Keep in sync with the real package when updating pi-mono.
 */
declare module "@mariozechner/pi-agent-core" {
  import type { TSchema, Message, Model, Api } from "@mariozechner/pi-ai";

  // ── Agent messages ───────────────────────────────────────────────────

  /** Messages flowing through an agent session (superset of pi-ai Message). */
  export type AgentMessage = {
    role: string;
    content: any;
    [key: string]: any;
  };

  // ── Agent events ─────────────────────────────────────────────────────

  export interface AgentEvent {
    type: string;
    message: AgentMessage;
    [key: string]: any;
  }

  // ── Agent tool types ─────────────────────────────────────────────────

  /** Callback for streaming tool updates during execution. */
  export type AgentToolUpdateCallback<T = string> = (update: T) => void;

  /** Result returned by a tool's execute method. */
  export interface AgentToolResult<T = string> {
    content: Array<{ type: "text"; text: string } | Record<string, any>>;
    details?: T;
    [key: string]: any;
  }

  /** A tool that an agent can invoke. */
  export interface AgentTool<T = any> {
    name: string;
    label?: string;
    description: string;
    parameters: TSchema;
    execute(
      toolCallId: string,
      params: unknown,
      signal?: AbortSignal,
      onUpdate?: AgentToolUpdateCallback<any>,
    ): Promise<AgentToolResult<any>>;
    [key: string]: any;
  }

  // ── Agent class ──────────────────────────────────────────────────────

  export interface AgentState {
    systemPrompt: string;
    model: Model<any>;
    tools: AgentTool[];
    messages: AgentMessage[];
    error?: string;
    [key: string]: any;
  }

  export interface AgentOptions {
    initialState: {
      systemPrompt: string;
      model: Model<any>;
      tools: AgentTool[];
      [key: string]: any;
    };
    transformContext?: (messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]>;
    getApiKey?: () => string | undefined;
    beforeToolCall?: any;
    [key: string]: any;
  }

  export class Agent {
    constructor(options: AgentOptions);
    state: AgentState;
    prompt(text: string | AgentMessage): Promise<void>;
    continue(): Promise<void>;
    abort(): void;
    subscribe(fn: (event: AgentEvent) => void): () => void;
    replaceMessages(messages: AgentMessage[]): void;
    appendMessage(message: AgentMessage): void;
    steer(message: string | AgentMessage): boolean;
    followUp(text: string | AgentMessage): Promise<void>;
  }
}
