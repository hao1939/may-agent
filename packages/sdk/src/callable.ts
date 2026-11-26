import { Type, type Static, type TSchema } from "typebox";
import { Check, Errors } from "typebox/value";

const INVOCATION_SETTLEMENT_GRACE_MS = 2_000;
const MAX_JSON_DEPTH = 100;
const MAX_JSON_TRAVERSAL_VALUES = 100_000;
const MAX_EXPANDED_JSON_BYTES = 1_048_576;
const MAX_SCHEMA_DIAGNOSTIC_PART_LENGTH = 512;
const MAX_ERROR_SUMMARY_LENGTH = 4_096;
const UNCONFIRMED_INVOCATION_SETTLEMENT = Symbol("unconfirmed-invocation-settlement");

export const ExecutionInputSchema = Type.Object(
  {
    prompt: Type.String({ minLength: 1 }),
    data: Type.Optional(Type.Unknown()),
  },
  { additionalProperties: false },
);

export type ExecutionInput<T = unknown> = {
  prompt: string;
  data?: T;
};

export type CallableStatus = "done" | "blocked" | "error" | "interrupted";

export type CallableResult<T = unknown> = {
  id?: string;
  status: CallableStatus;
  summary: string;
  output?: T;
  facts?: unknown;
};

export type CallableDescriptor = Readonly<{
  name: string;
  description: string;
  inputSchema: TSchema;
  outputSchema?: TSchema;
}>;

export type CallableOptions = Readonly<{
  timeoutMs?: number;
  schema?: TSchema;
}>;

export type CallableInvocationContext = Readonly<{
  signal: AbortSignal;
  timeoutMs?: number;
}>;

export type CallableDefinition = Readonly<{
  appId?: string;
  declaredName: string;
  description: string;
  /** Complete target schema for the canonical { prompt, data? } envelope. */
  inputSchema?: TSchema;
  outputSchema?: TSchema;
  invoke(input: ExecutionInput, context: CallableInvocationContext): Promise<unknown>;
}>;

export class CallableValidationError extends Error {
  constructor(
    readonly phase: "catalog" | "input" | "result" | "output" | "options",
    message: string,
    readonly rawValue?: unknown,
  ) {
    super(message);
    this.name = "CallableValidationError";
  }
}

function boundedDiagnosticText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}…[truncated]`;
}

function schemaDiagnostic(schema: TSchema, value: unknown): string {
  const details: string[] = [];
  for (const error of Errors(schema, value)) {
    const path = boundedDiagnosticText(error.instancePath || "/", MAX_SCHEMA_DIAGNOSTIC_PART_LENGTH);
    const message = boundedDiagnosticText(error.message, MAX_SCHEMA_DIAGNOSTIC_PART_LENGTH);
    details.push(`${path} ${message}`.trim());
    if (details.length === 5) break;
  }
  return details.join("; ") || "value failed schema check";
}

function assertNameComponent(value: string, label: string): string {
  if (typeof value !== "string" || !value || /\s/u.test(value) || value.includes("/")) {
    throw new CallableValidationError(
      "catalog",
      `${label} must be a nonempty exact name component without '/' or whitespace`,
      value,
    );
  }
  return value;
}

export function canonicalCallableName(appId: string | undefined, declaredName: string): string {
  const namespace = appId === undefined ? "global" : assertNameComponent(appId, "appId");
  if (namespace === "global" && appId !== undefined) {
    throw new CallableValidationError("catalog", 'App id "global" is reserved for global callables', appId);
  }
  return `${namespace}/${assertNameComponent(declaredName, "declaredName")}`;
}

function callableInputSchema(inputSchema?: TSchema): TSchema {
  return inputSchema ? Type.Intersect([ExecutionInputSchema, inputSchema]) : ExecutionInputSchema;
}

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (!value || typeof value !== "object" || seen.has(value as object)) return value;
  seen.add(value as object);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child, seen);
  return Object.freeze(value);
}

type JsonInspection =
  | Readonly<{ ok: true; expandedBytes: number; maxObjectDepth: number }>
  | Readonly<{ ok: false; reason: "incompatible" | "depth" | "traversal" | "size" }>;

type CompletedJsonInspection = Readonly<{ expandedBytes: number; maxObjectDepth: number }>;

function jsonStringBytes(value: string): number | undefined {
  // Every UTF-16 code unit requires at least one JSON byte. Reject impossible
  // values before indexing them so large ropes are not flattened just to fail.
  if (value.length > MAX_EXPANDED_JSON_BYTES - 2) return undefined;
  let bytes = 2;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (
      code === 0x22 || code === 0x5c || code === 0x08 || code === 0x09 ||
      code === 0x0a || code === 0x0c || code === 0x0d
    ) {
      bytes += 2;
    } else if (code <= 0x1f || (code >= 0xd800 && code <= 0xdfff)) {
      if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
        const next = value.charCodeAt(index + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          bytes += 4;
          index++;
        } else bytes += 6;
      } else bytes += 6;
    } else if (code <= 0x7f) bytes++;
    else if (code <= 0x7ff) bytes += 2;
    else bytes += 3;
    if (bytes > MAX_EXPANDED_JSON_BYTES) return undefined;
  }
  return bytes;
}

function inspectJson(value: unknown): JsonInspection {
  const active = new Set<object>();
  const completed = new Map<object, CompletedJsonInspection>();
  let visitedValues = 0;

  const addBytes = (left: number, right: number): number | undefined => {
    const total = left + right;
    return total <= MAX_EXPANDED_JSON_BYTES ? total : undefined;
  };
  const visit = (current: unknown, depth: number): JsonInspection => {
    visitedValues++;
    if (visitedValues > MAX_JSON_TRAVERSAL_VALUES) return { ok: false, reason: "traversal" };
    if (current === null) return { ok: true, expandedBytes: 4, maxObjectDepth: -1 };
    if (typeof current === "string") {
      const expandedBytes = jsonStringBytes(current);
      return expandedBytes === undefined
        ? { ok: false, reason: "size" }
        : { ok: true, expandedBytes, maxObjectDepth: -1 };
    }
    if (typeof current === "boolean") {
      return { ok: true, expandedBytes: current ? 4 : 5, maxObjectDepth: -1 };
    }
    if (typeof current === "number") {
      if (!Number.isFinite(current)) return { ok: false, reason: "incompatible" };
      return {
        ok: true,
        expandedBytes: String(Object.is(current, -0) ? 0 : current).length,
        maxObjectDepth: -1,
      };
    }
    if (typeof current !== "object") return { ok: false, reason: "incompatible" };
    if (active.has(current)) return { ok: false, reason: "incompatible" };
    const cached = completed.get(current);
    if (cached !== undefined) {
      return depth + cached.maxObjectDepth <= MAX_JSON_DEPTH
        ? { ok: true, ...cached }
        : { ok: false, reason: "depth" };
    }
    if (depth > MAX_JSON_DEPTH) return { ok: false, reason: "depth" };
    if (!Array.isArray(current) && Object.getPrototypeOf(current) !== Object.prototype) {
      return { ok: false, reason: "incompatible" };
    }
    if (typeof (current as { toJSON?: unknown }).toJSON === "function") {
      return { ok: false, reason: "incompatible" };
    }

    active.add(current);
    let expandedBytes = 2;
    let maxObjectDepth = 0;
    try {
      if (Array.isArray(current)) {
        for (let index = 0; index < current.length; index++) {
          if (index > 0) expandedBytes++;
          let child: JsonInspection;
          if (index in current) {
            child = visit(current[index], depth + 1);
          } else {
            visitedValues++;
            if (visitedValues > MAX_JSON_TRAVERSAL_VALUES) return { ok: false, reason: "traversal" };
            child = { ok: true, expandedBytes: 4, maxObjectDepth: -1 };
          }
          if (!child.ok) return child;
          const total = addBytes(expandedBytes, child.expandedBytes);
          if (total === undefined) return { ok: false, reason: "size" };
          expandedBytes = total;
          maxObjectDepth = Math.max(maxObjectDepth, child.maxObjectDepth + 1);
        }
      } else {
        const record = current as Record<string, unknown>;
        const keys = Object.keys(record);
        for (let index = 0; index < keys.length; index++) {
          const key = keys[index]!;
          if (index > 0) expandedBytes++;
          const keyBytes = jsonStringBytes(key);
          if (keyBytes === undefined) return { ok: false, reason: "size" };
          const child = visit(record[key], depth + 1);
          if (!child.ok) return child;
          const total = addBytes(expandedBytes, keyBytes + 1 + child.expandedBytes);
          if (total === undefined) return { ok: false, reason: "size" };
          expandedBytes = total;
          maxObjectDepth = Math.max(maxObjectDepth, child.maxObjectDepth + 1);
        }
      }
    } finally {
      active.delete(current);
    }
    const result = { expandedBytes, maxObjectDepth };
    completed.set(current, result);
    return { ok: true, ...result };
  };

  return visit(value, 0);
}

function assertBoundedJson(
  value: unknown,
  phase: "input" | "result" | "output",
  label: string,
): void {
  const inspection = inspectJson(value);
  if (inspection.ok) return;
  const message = inspection.reason === "incompatible"
    ? `${label} must be JSON-compatible`
    : inspection.reason === "depth"
      ? `${label} exceeds maximum JSON nesting depth of ${MAX_JSON_DEPTH}`
      : inspection.reason === "traversal"
        ? `${label} exceeds maximum JSON traversal of ${MAX_JSON_TRAVERSAL_VALUES} values`
        : `${label} exceeds maximum expanded JSON size of ${MAX_EXPANDED_JSON_BYTES} bytes`;
  throw new CallableValidationError(phase, message, value);
}

export function validateCallableInput(schema: TSchema, input: unknown): asserts input is ExecutionInput {
  assertBoundedJson(input, "input", "Callable input");
  if (!Check(schema, input)) {
    throw new CallableValidationError(
      "input",
      `Invalid callable input: ${schemaDiagnostic(schema, input)}`,
      input,
    );
  }
  if (!(input as ExecutionInput).prompt.trim()) {
    throw new CallableValidationError("input", "Callable input prompt must contain non-whitespace text", input);
  }
}

/** Prepare the canonical assignment for a prompt callable in either runtime. */
export function formatExecutionInput(input: unknown): string {
  validateCallableInput(ExecutionInputSchema, input);
  return input.data === undefined
    ? input.prompt
    : `${input.prompt}\n\nInput data:\n${JSON.stringify(input.data, null, 2)}`;
}

export function validateCallableOptions(options: CallableOptions | undefined): void {
  if (options === undefined) return;
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new CallableValidationError("options", "Callable options must be an object", options);
  }
  const retired = Object.keys(options).filter((key) => key !== "timeoutMs" && key !== "schema");
  if (retired.length > 0) {
    throw new CallableValidationError(
      "options",
      `Unsupported callable option${retired.length === 1 ? "" : "s"}: ${retired.join(", ")}; use only timeoutMs and schema`,
      options,
    );
  }
  if (options.timeoutMs !== undefined && (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)) {
    throw new CallableValidationError("options", "Call timeoutMs must be a positive finite number", options.timeoutMs);
  }
}

function normalizeResult(
  raw: unknown,
  childId: string | undefined,
  targetSchema: TSchema | undefined,
  callerSchema: TSchema | undefined,
): CallableResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new CallableValidationError("result", "Callable returned no result envelope", raw);
  }
  const value = raw as Record<string, unknown>;
  if (Object.hasOwn(value, "kind") || Object.hasOwn(value, "sessionId") || Object.hasOwn(value, "workflowRunId")) {
    throw new CallableValidationError("result", "Callable result exposes a retired executor or session field", raw);
  }
  if (value.id !== undefined) {
    throw new CallableValidationError("result", "Callable producers must not choose the child execution id", raw);
  }
  if (!(["done", "blocked", "error", "interrupted"] as unknown[]).includes(value.status)) {
    throw new CallableValidationError(
      "result",
      "Invalid callable result status; expected done, blocked, error, or interrupted",
      raw,
    );
  }
  if (typeof value.summary !== "string") {
    throw new CallableValidationError("result", "Callable result summary must contain non-whitespace text", raw);
  }
  assertBoundedJson(value.summary, "result", "Callable result summary");
  if (!value.summary.trim()) {
    throw new CallableValidationError("result", "Callable result summary must contain non-whitespace text", raw);
  }
  if (value.output !== undefined) assertBoundedJson(value.output, "output", "Callable result output");
  if (value.facts !== undefined) assertBoundedJson(value.facts, "result", "Callable result facts");
  const schemas = [targetSchema, callerSchema].filter((schema): schema is TSchema => schema !== undefined);
  if (value.status === "done" && schemas.length > 0 && value.output === undefined) {
    throw new CallableValidationError("output", "Successful callable result omitted required output", raw);
  }
  for (const schema of schemas) {
    if (value.output !== undefined && !Check(schema, value.output)) {
      throw new CallableValidationError(
        "output",
        `Callable result output failed schema validation: ${schemaDiagnostic(schema, value.output)}`,
        value.output,
      );
    }
  }
  const normalized = {
    ...(childId ? { id: childId } : {}),
    status: value.status as CallableStatus,
    summary: value.summary,
    ...(value.output !== undefined ? { output: value.output } : {}),
    ...(value.facts !== undefined ? { facts: value.facts } : {}),
  };
  assertBoundedJson(normalized, "result", "Callable result");
  return deepFreeze(normalized);
}

type PreparedCallable = Readonly<{
  descriptor: CallableDescriptor;
  definition: CallableDefinition;
}>;

export class CallableCatalog {
  readonly #entries: ReadonlyMap<string, PreparedCallable>;
  readonly #descriptors: readonly CallableDescriptor[];

  constructor(definitions: Iterable<CallableDefinition>) {
    const entries = new Map<string, PreparedCallable>();
    for (const definition of definitions) {
      if (Object.hasOwn(definition as object, "dataSchema") || Object.hasOwn(definition as object, "effectiveInputSchema")) {
        throw new CallableValidationError(
          "catalog",
          "Callable definitions no longer accept dataSchema or effectiveInputSchema; provide one full-envelope inputSchema",
          definition,
        );
      }
      const name = canonicalCallableName(definition.appId, definition.declaredName);
      if (entries.has(name)) {
        throw new CallableValidationError("catalog", `Duplicate callable canonical name: ${name}`);
      }
      const descriptor = deepFreeze({
        name,
        description: definition.description,
        inputSchema: callableInputSchema(definition.inputSchema),
        ...(definition.outputSchema ? { outputSchema: definition.outputSchema } : {}),
      });
      entries.set(name, deepFreeze({ descriptor, definition: deepFreeze({ ...definition }) }));
    }
    const descriptors = [...entries.values()]
      .map((entry) => entry.descriptor)
      .sort((left, right) => left.name.localeCompare(right.name));
    this.#entries = entries;
    this.#descriptors = deepFreeze(descriptors);
    Object.freeze(this);
  }

  list(): readonly CallableDescriptor[] {
    return this.#descriptors;
  }

  has(name: string): boolean {
    return this.#entries.has(name);
  }

  async call(
    name: string,
    input: unknown,
    options: CallableOptions | undefined,
    context: CallableInvocationContext,
  ): Promise<CallableResult> {
    validateCallableOptions(options);
    const entry = this.#entries.get(name);
    if (!entry) {
      return deepFreeze({ status: "error", summary: `Callable target not found: ${name}` });
    }
    validateCallableInput(entry.descriptor.inputSchema, input);
    context.signal.throwIfAborted();
    const timeoutMs = options?.timeoutMs === undefined
      ? context.timeoutMs
      : context.timeoutMs === undefined
        ? options.timeoutMs
        : Math.min(options.timeoutMs, context.timeoutMs);
    const controller = new AbortController();
    const abortFromParent = () => controller.abort(context.signal.reason);
    context.signal.addEventListener("abort", abortFromParent, { once: true });
    let timedOut = false;
    const timer = timeoutMs === undefined
      ? undefined
      : setTimeout(() => {
          timedOut = true;
          controller.abort(new Error(`Callable "${name}" timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    timer?.unref?.();
    let raw: unknown;
    let settlementTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      // Invocation owns ordinary descendant cleanup. Once cancellation is requested,
      // join cooperative cleanup but do not let an uncooperative provider retain the
      // caller forever.
      const invocation = Promise.resolve()
        .then(() => entry.definition.invoke(input, {
          signal: controller.signal,
          ...(timeoutMs !== undefined ? { timeoutMs } : {}),
        }))
        .then(
          (value) => ({ status: "fulfilled" as const, value }),
          (error: unknown) => ({ status: "rejected" as const, error }),
        );
      const unconfirmed = new Promise<typeof UNCONFIRMED_INVOCATION_SETTLEMENT>((resolve) => {
        const startSettlementBound = () => {
          settlementTimer = setTimeout(() => resolve(UNCONFIRMED_INVOCATION_SETTLEMENT), INVOCATION_SETTLEMENT_GRACE_MS);
          settlementTimer.unref?.();
        };
        if (controller.signal.aborted) startSettlementBound();
        else controller.signal.addEventListener("abort", startSettlementBound, { once: true });
      });
      const outcome = await Promise.race([invocation, unconfirmed]);
      if (outcome === UNCONFIRMED_INVOCATION_SETTLEMENT) {
        const cause = controller.signal.reason instanceof Error
          ? controller.signal.reason.message
          : String(controller.signal.reason ?? `Callable "${name}" interrupted`);
        throw new Error(
          `Callable "${name}" cleanup remained unconfirmed after ${INVOCATION_SETTLEMENT_GRACE_MS}ms; originating failure: ${cause}`,
        );
      }
      if (outcome.status === "rejected") throw outcome.error;
      raw = outcome.value;
      if (controller.signal.aborted) {
        throw controller.signal.reason ?? new Error(`Callable "${name}" interrupted`);
      }
    } finally {
      if (timer) clearTimeout(timer);
      if (settlementTimer) clearTimeout(settlementTimer);
      context.signal.removeEventListener("abort", abortFromParent);
    }
    if (timedOut) throw new Error(`Callable "${name}" timed out after ${timeoutMs}ms`);
    const childId =
      raw && typeof raw === "object" && !Array.isArray(raw) && typeof (raw as { executionId?: unknown }).executionId === "string"
        ? (raw as { executionId: string }).executionId
        : undefined;
    const report =
      raw && typeof raw === "object" && !Array.isArray(raw) && Object.hasOwn(raw, "report")
        ? (raw as { report: unknown }).report
        : raw;
    try {
      return normalizeResult(report, childId, entry.descriptor.outputSchema, options?.schema);
    } catch (error) {
      if (!(error instanceof CallableValidationError)) throw error;
      const rawInspection = inspectJson(error.rawValue);
      const omittedEvidence = `[omitted: ${rawInspection.ok ? "error envelope exceeds JSON resource limits" : rawInspection.reason}]`;
      const summary = boundedDiagnosticText(error.message, MAX_ERROR_SUMMARY_LENGTH);
      let failure: CallableResult = {
        ...(childId ? { id: childId } : {}),
        status: "error",
        summary,
        facts: { phase: error.phase, invalidEvidence: rawInspection.ok ? error.rawValue : omittedEvidence },
      };
      if (!inspectJson(failure).ok) {
        failure = {
          ...(childId ? { id: childId } : {}),
          status: "error",
          summary,
          facts: { phase: error.phase, invalidEvidence: omittedEvidence },
        };
      }
      assertBoundedJson(failure, "result", "Callable error result");
      return deepFreeze(failure);
    }
  }
}

export class CallableCatalogStore {
  #active: CallableCatalog;

  constructor(initial: Iterable<CallableDefinition>) {
    this.#active = new CallableCatalog(initial);
  }

  capture(): CallableCatalog {
    return this.#active;
  }

  reload(next: Iterable<CallableDefinition>): { ok: true; catalog: CallableCatalog } | { ok: false; error: Error; catalog: CallableCatalog } {
    try {
      const catalog = new CallableCatalog(next);
      this.#active = catalog;
      return { ok: true, catalog };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error)),
        catalog: this.#active,
      };
    }
  }
}

export type ExecutionInputValue = Static<typeof ExecutionInputSchema>;
