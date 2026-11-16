import type {
  AgentContext,
  AgentExecutableModule,
  ExecutionResult,
  WorkflowContext,
} from "../src/index.js";

type Input = { value: string };
declare const call: AgentContext<Input>["call"];

// Canonical authoring requires only the proposal-shaped, Task-transparent context.
const minimalContext: AgentContext<Input> = {
  input: { value: "measure me" },
  signal: new AbortController().signal,
  call,
  log: {
    debug() {},
    info() {},
    warn() {},
    error() {},
  },
  done: (summary, output) => ({ id: "test", kind: "agent", status: "done", summary, output }),
  blocked: (reason, facts) => ({ id: "test", kind: "agent", status: "blocked", summary: reason, facts }),
};

const module: AgentExecutableModule<Input, { length: number }> = {
  name: "length",
  description: "Measure input",
  async execute(ctx: AgentContext<Input>): Promise<ExecutionResult<{ length: number }>> {
    return ctx.done("Measured", { length: ctx.input.value.length });
  },
};

// The deprecated root name remains an alias of the Task-transparent context.
const legacyContext: WorkflowContext<Input> = minimalContext;
void [module, legacyContext];

declare const canonical: AgentContext<Input>;
// @ts-expect-error Task reconciliation belongs to @may-agent/sdk/app compatibility APIs.
void canonical.reconciliation;
// @ts-expect-error Task mutation belongs to @may-agent/sdk/app compatibility APIs.
void canonical.reviseTask;
// @ts-expect-error Task mutation belongs to @may-agent/sdk/app compatibility APIs.
void canonical.closeTask;
// @ts-expect-error Task mutation belongs to @may-agent/sdk/app compatibility APIs.
void canonical.applyTaskChanges;
// @ts-expect-error AppRead belongs to @may-agent/sdk/app.
void canonical.read;
// @ts-expect-error Task-scoped event operations belong to @may-agent/sdk/app.
void canonical.events;

// @ts-expect-error Host Task settlement belongs to @may-agent/sdk/app.
import type { TaskReconcileResult } from "../src/index.js";
// @ts-expect-error AppRead belongs to @may-agent/sdk/app.
import type { AppRead } from "../src/index.js";
void [null as unknown as TaskReconcileResult, null as unknown as AppRead];
