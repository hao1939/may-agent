/**
 * Ambient type declarations for @mariozechner/pi-agent-core.
 *
 * The real package is linked via a workspace symlink to ../../../pi-mono/packages/agent
 * which doesn't exist in the container. These stubs provide enough type information
 * for TSC to validate our code without the real package.
 *
 * WARNING: Keep in sync with the real package when updating pi-mono.
 * Updated for pi-agent-core 0.65.0.
 */
declare module "@mariozechner/pi-agent-core" {
  import type { TSchema, Model } from "@mariozechner/pi-ai";

  // ── Agent messages ───────────────────────────────────────────────────

  /** Messages flowing through an agent session (superset of pi-ai Message). */
  export type AgentMessage = {
    role: string;
    content: any;
    [key: string]: any;
  };

  // ── Agent events ─────────────────────────────────────────────────────

  export type AgentEvent =
    | { type: "agent_start" }
    | { type: "agent_end"; messages: AgentMessage[] }
    | { type: "turn_start" }
    | { type: "turn_end"; message: AgentMessage; toolResults: AgentMessage[] }
    | { type: "message_start"; message: AgentMessage }
    | { type: "message_update"; message: AgentMessage; assistantMessageEvent: any }
    | { type: "message_end"; message: AgentMessage }
    | { type: "tool_execution_start"; toolCallId: string; toolName: string; args: any }
    | { type: "tool_execution_update"; toolCallId: string; toolName: string; args: any; partialResult: any }
    | { type: "tool_execution_end"; toolCallId: string; toolName: string; result: any; isError: boolean };

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
  export interface AgentTool<_T = any> {
    name: string;
    label?: string;
    description: string;
    parameters: TSchema;
    prepareArguments?: (args: unknown) => any;
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
    /** Conversation transcript. Assigning replaces messages (copies the array). */
    messages: AgentMessage[];
    /** Error message from the most recent failed or aborted turn, if any. Readonly. */
    readonly errorMessage?: string;
    /** Whether the agent is currently streaming a response. */
    readonly isStreaming: boolean;
    /** The message currently being streamed, if any. */
    readonly streamingMessage?: AgentMessage;
    /** Set of tool call IDs currently being executed. */
    readonly pendingToolCalls: ReadonlySet<string>;
    [key: string]: any;
  }

  export interface AgentOptions {
    initialState?: {
      systemPrompt: string;
      model: Model<any>;
      tools: AgentTool[];
      [key: string]: any;
    };
    transformContext?: (messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]>;
    getApiKey?: (provider: string) => Promise<string | undefined> | string | undefined;
    beforeToolCall?: any;
    afterToolCall?: any;
    [key: string]: any;
  }

  export class Agent {
    constructor(options?: AgentOptions);
    state: AgentState;
    prompt(message: AgentMessage | AgentMessage[]): Promise<void>;
    prompt(input: string, images?: any[]): Promise<void>;
    continue(): Promise<void>;
    abort(): void;
    /** Subscribe to lifecycle events. Listener receives event and the run's abort signal. */
    subscribe(listener: (event: AgentEvent, signal: AbortSignal) => Promise<void> | void): () => void;
    steer(message: AgentMessage): void;
    followUp(message: AgentMessage): void;
    waitForIdle(): Promise<void>;
    reset(): void;
    clearSteeringQueue(): void;
    clearFollowUpQueue(): void;
    clearAllQueues(): void;
    hasQueuedMessages(): boolean;
    get signal(): AbortSignal | undefined;
  }
}
