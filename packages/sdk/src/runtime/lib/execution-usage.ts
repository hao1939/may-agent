import type { AgentRuntimeListener } from "./agent-runner.js";

export type PreparationMeasurement = {
  preparer: string;
  entryHash: string | null;
  durationMs: number;
  taskBytes: number;
  promptBytes: number | null;
  systemBytes: number | null;
  failed: boolean;
};

export type ModelUsage = {
  provider: string;
  model: string;
  replies: number;
  measuredReplies: number;
  estimatedCostReplies: number;
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
  estimatedCost: number;
};

export type ExecutionUsage = {
  preparation: PreparationMeasurement;
  models: ModelUsage[];
  totals: Omit<ModelUsage, "provider" | "model">;
  toolCalls: number;
};

const nonnegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

/** New replies only. Never reads a transcript or attributes a child's usage to its parent. */
export function createExecutionUsage(preparation: PreparationMeasurement) {
  const models = new Map<string, ModelUsage>();
  const seen = new WeakSet<object>();
  let toolCalls = 0;
  const observe: AgentRuntimeListener = (event) => {
    if (event.type === "tool_execution_start") toolCalls++;
    if (event.type !== "message_end" || event.message.role !== "assistant") return;
    const message = event.message;
    if (seen.has(message)) return;
    seen.add(message);
    const provider = message.provider || "unknown";
    const model = message.model || "unknown";
    const key = JSON.stringify([provider, model]);
    let row = models.get(key);
    if (!row) {
      row = {
        provider,
        model,
        replies: 0,
        measuredReplies: 0,
        estimatedCostReplies: 0,
        input: 0,
        cacheRead: 0,
        cacheWrite: 0,
        output: 0,
        estimatedCost: 0,
      };
      models.set(key, row);
    }
    row.replies++;
    const usage = message.usage;
    // Pi normalizes input to exclude cache reads AND writes. Synthetic failure
    // messages use all-zero usage; that is not evidence of a free request.
    if (
      !usage ||
      ![usage.input, usage.cacheRead, usage.cacheWrite, usage.output].every(nonnegative) ||
      usage.input + usage.cacheRead + usage.cacheWrite + usage.output === 0
    )
      return;
    row.measuredReplies++;
    row.input += usage.input;
    row.cacheRead += usage.cacheRead;
    row.cacheWrite += usage.cacheWrite;
    row.output += usage.output;
    if (nonnegative(usage.cost?.total)) {
      row.estimatedCostReplies++;
      row.estimatedCost += usage.cost.total;
    }
  };
  return {
    observe,
    snapshot: (): ExecutionUsage => ({
      preparation: { ...preparation },
      models: [...models.values()]
        .sort((a, b) => JSON.stringify([a.provider, a.model]).localeCompare(JSON.stringify([b.provider, b.model])))
        .map((row) => ({ ...row })),
      totals: [...models.values()].reduce(
        (sum, row) => ({
          replies: sum.replies + row.replies,
          measuredReplies: sum.measuredReplies + row.measuredReplies,
          estimatedCostReplies: sum.estimatedCostReplies + row.estimatedCostReplies,
          input: sum.input + row.input,
          cacheRead: sum.cacheRead + row.cacheRead,
          cacheWrite: sum.cacheWrite + row.cacheWrite,
          output: sum.output + row.output,
          estimatedCost: sum.estimatedCost + row.estimatedCost,
        }),
        {
          replies: 0,
          measuredReplies: 0,
          estimatedCostReplies: 0,
          input: 0,
          cacheRead: 0,
          cacheWrite: 0,
          output: 0,
          estimatedCost: 0,
        },
      ),
      toolCalls,
    }),
  };
}
