/**
 * Ambient type declarations for @mariozechner/pi-ai.
 *
 * The real package is linked via a workspace symlink to ../../../pi-mono/packages/ai
 * which doesn't exist in the container. These stubs provide enough type information
 * for TSC to validate our code without the real package.
 *
 * These are intentionally permissive (using index signatures) to avoid false
 * negatives — the real package provides stricter types at build time.
 *
 * WARNING: Keep in sync with the real package when updating pi-mono.
 */
declare module "@mariozechner/pi-ai" {
  // ── Schema (re-exported from @sinclair/typebox) ──────────────────────

  /** TypeBox TSchema — base type for all schema definitions. */
  export interface TSchema {
    [key: string]: any;
  }

  /** TypeBox Type builder — used to define tool parameter schemas. */
  export const Type: {
    Object(properties: Record<string, TSchema>, options?: Record<string, any>): TSchema;
    String(options?: Record<string, any>): TSchema;
    Number(options?: Record<string, any>): TSchema;
    Boolean(options?: Record<string, any>): TSchema;
    Array(items: TSchema, options?: Record<string, any>): TSchema;
    Optional(schema: TSchema): TSchema;
    Literal(value: string | number | boolean): TSchema;
    Union(schemas: TSchema[], options?: Record<string, any>): TSchema;
    Record(key: TSchema, value: TSchema, options?: Record<string, any>): TSchema;
    Any(options?: Record<string, any>): TSchema;
    Ref(ref: TSchema, options?: Record<string, any>): TSchema;
    Enum(enumObj: Record<string, string | number>, options?: Record<string, any>): TSchema;
    Null(options?: Record<string, any>): TSchema;
    Integer(options?: Record<string, any>): TSchema;
    Unsafe(options?: Record<string, any>): TSchema;
    Unknown(options?: Record<string, any>): TSchema;
  };

  /** StringEnum helper — creates a union of literal string types. */
  export function StringEnum<T extends readonly string[]>(values: T, options?: Record<string, any>): TSchema;

  /** Static type extractor for TypeBox schemas. */
  export type Static<_T extends TSchema> = any;

  // ── Message types ────────────────────────────────────────────────────

  export interface TextBlock {
    type: "text";
    text: string;
    [key: string]: any;
  }

  export interface ToolCallBlock {
    type: "tool_call";
    id: string;
    name: string;
    input: unknown;
    [key: string]: any;
  }

  export interface ToolResultBlock {
    type: "tool_result";
    tool_use_id: string;
    content: string | Array<{ type: "text"; text: string }>;
    is_error?: boolean;
    text?: string;
    [key: string]: any;
  }

  export type ContentBlock = TextBlock | ToolCallBlock | ToolResultBlock | { type: string; [key: string]: any };

  export interface UserMessage {
    role: "user";
    content: string | ContentBlock[];
    [key: string]: any;
  }

  export interface AssistantMessage {
    role: "assistant";
    content: string | ContentBlock[];
    usage?: {
      input?: number;
      output?: number;
      input_tokens?: number;
      output_tokens?: number;
      cacheRead?: number;
      cacheWrite?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
      totalTokens?: number;
      total_tokens?: number;
      cost?: { total?: number; [key: string]: any } | number;
      [key: string]: any;
    };
    [key: string]: any;
  }

  export interface ToolResultMessage {
    role: "toolResult";
    content: any[];
    toolCallId: string;
    toolName: string;
    isError: boolean;
    [key: string]: any;
  }

  export type Message = UserMessage | AssistantMessage | ToolResultMessage;

  // ── Model / API types ────────────────────────────────────────────────

  export type Api = string | { name: string; [key: string]: any };

  export interface Model<TApi extends Api = Api> {
    id: string;
    api: TApi;
    contextWindow: number;
    maxOutputTokens?: number;
    baseUrl?: string;
    apiKey?: string;
    [key: string]: any;
  }

  /** Look up a pre-configured model by provider + model name. */
  export function getModel(provider: string, modelName: string): Model;
}
