import type {
  AgentContext,
  AgentExecutableModule,
  ExecutionResult,
  WorkflowContext,
} from "../src/index.js";

const module: AgentExecutableModule<{ value: string }, { length: number }> = {
  name: "length",
  description: "Measure input",
  async execute(ctx: AgentContext<{ value: string }>): Promise<ExecutionResult<{ length: number }>> {
    return ctx.done("Measured", { length: ctx.input.value.length });
  },
};

// The compatibility name remains structurally identical during caller migration.
const legacyContext: WorkflowContext<{ value: string }> = null as unknown as AgentContext<{ value: string }>;
void [module, legacyContext];

// @ts-expect-error Host Task settlement belongs to @may-agent/sdk/app.
import type { TaskReconcileResult } from "../src/index.js";
void (null as unknown as TaskReconcileResult);
