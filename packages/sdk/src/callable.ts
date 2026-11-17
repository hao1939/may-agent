import { Type, type Static, type TSchema } from "typebox";
import { Check, Errors } from "typebox/value";

const INVOCATION_SETTLEMENT_GRACE_MS = 2_000;
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

function schemaDiagnostic(schema: TSchema, value: unknown): string {
  const details: string[] = [];
  for (const error of Errors(schema, value)) {
    details.push(`${error.instancePath || "/"} ${error.message}`.trim());
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

function isJsonCompatible(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || seen.has(value as object)) return false;
  seen.add(value as object);
  if (Array.isArray(value)) return value.every((item) => isJsonCompatible(item, seen));
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Object.values(value as Record<string, unknown>).every((item) => isJsonCompatible(item, seen));
}

export function validateCallableInput(schema: TSchema, input: unknown): asserts input is ExecutionInput {
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
  if (!isJsonCompatible(input)) {
    throw new CallableValidationError("input", "Callable input must be JSON-compatible", input);
  }
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
    throw new CallableValidationError("result", `Invalid callable result status: ${String(value.status)}`, raw);
  }
  if (typeof value.summary !== "string" || !value.summary.trim()) {
    throw new CallableValidationError("result", "Callable result summary must contain non-whitespace text", raw);
  }
  if (value.output !== undefined && !isJsonCompatible(value.output)) {
    throw new CallableValidationError("output", "Callable result output must be JSON-compatible", value.output);
  }
  if (value.facts !== undefined && !isJsonCompatible(value.facts)) {
    throw new CallableValidationError("result", "Callable result facts must be JSON-compatible", value.facts);
  }
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
  return deepFreeze({
    ...(childId ? { id: childId } : {}),
    status: value.status as CallableStatus,
    summary: value.summary,
    ...(value.output !== undefined ? { output: value.output } : {}),
    ...(value.facts !== undefined ? { facts: value.facts } : {}),
  });
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
          (value) => ({ settled: true as const, value }),
          (error) => ({ settled: true as const, error }),
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
      if (Object.hasOwn(outcome, "error")) throw outcome.error;
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
      return deepFreeze({
        ...(childId ? { id: childId } : {}),
        status: "error",
        summary: error.message,
        facts: {
          phase: error.phase,
          invalidEvidence: isJsonCompatible(error.rawValue) ? error.rawValue : String(error.rawValue),
        },
      });
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
