import { Type, validateToolArguments, type Static, type TSchema, type ToolCall } from "@earendil-works/pi-ai";
import { createFinishTool } from "../../src/lib/tools/lifecycle.js";
import { createWorkflowFinishTool } from "../../src/lib/tools/workflow-finish.js";

export const ReviewSchema = Type.Object({
  verdict: Type.Union([Type.Literal("pass"), Type.Literal("fail")]),
  findings: Type.Array(
    Type.Object({
      summary: Type.String(),
      evidence: Type.Array(Type.String()),
    }),
  ),
});

export type Review = Static<typeof ReviewSchema>;

export type StructuredAttempt = { kind: "finish"; arguments: Record<string, unknown> } | { kind: "text"; text: string };

export interface ComparisonCase {
  name: string;
  shouldBeUsable: boolean;
  freeText: string;
  structuredAttempts: StructuredAttempt[];
}

export interface ArmOutcome<T> {
  status: "done" | "error";
  accepted: boolean;
  deterministicUsable: boolean;
  attemptsUsed: number;
  result?: T;
  error?: string;
}

export interface ComparisonMetrics {
  cases: number;
  validAccepted: number;
  invalidRejected: number;
  falseAccepted: number;
  deterministicUsable: number;
  recoveredOnRetry: number;
}

export interface ComparisonRow {
  name: string;
  shouldBeUsable: boolean;
  freeText: ArmOutcome<string>;
  structuredFinish: ArmOutcome<Review>;
}

export interface ComparisonReport {
  rows: ComparisonRow[];
  freeText: ComparisonMetrics;
  structuredFinish: ComparisonMetrics;
}

export function createPocWorkflowFinishTool<S extends TSchema>(schema: S) {
  const baseFinish = createFinishTool({
    agentName: "poc-agent",
    projectRoot: process.cwd(),
    persistDir: process.cwd(),
  });
  return createWorkflowFinishTool(baseFinish, schema);
}

function parseExactJson<S extends TSchema>(schema: S, text: string): Static<S> | undefined {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const tool = createPocWorkflowFinishTool(schema);
    const call: ToolCall = {
      type: "toolCall",
      id: "free-text-validation",
      name: tool.name,
      arguments: {
        status: "success",
        summary: "POC validation",
        verification_evidence: ["POC fixture"],
        result: parsed,
      },
    };
    const validated = validateToolArguments(tool, call) as { result: Static<S> };
    return validated.result;
  } catch {
    return undefined;
  }
}

/** Arm A: session success accepts non-empty text; typed use requires exact JSON. */
export function evaluateFreeText<S extends TSchema>(schema: S, text: string): ArmOutcome<string> {
  const accepted = text.trim().length > 0;
  const parsed = accepted ? parseExactJson(schema, text) : undefined;
  return {
    status: accepted ? "done" : "error",
    accepted,
    deterministicUsable: parsed !== undefined,
    attemptsUsed: 1,
    ...(accepted ? { result: text } : { error: "No assistant text returned" }),
  };
}

/** Arm B: one initial finish attempt and at most one corrective prompt. */
export async function evaluateStructuredFinish<S extends TSchema>(
  schema: S,
  attempts: StructuredAttempt[],
): Promise<ArmOutcome<Static<S>>> {
  const tool = createPocWorkflowFinishTool(schema);
  const boundedAttempts = attempts.slice(0, 2);
  let lastError = "finish() was not called";

  for (let index = 0; index < boundedAttempts.length; index++) {
    const attempt = boundedAttempts[index];
    if (attempt.kind === "text") {
      lastError = "finish() was not called";
      continue;
    }

    const call: ToolCall = {
      type: "toolCall",
      id: `finish-attempt-${index + 1}`,
      name: tool.name,
      arguments: attempt.arguments,
    };

    try {
      const params = validateToolArguments(tool, call) as { result: Static<S> };
      const execution = await tool.execute(call.id, params);
      const finishError = execution.content.find(
        (content) => content.type === "text" && content.text.startsWith("finish() error:"),
      );
      if (finishError?.type === "text") {
        lastError = finishError.text;
        continue;
      }
      return {
        status: "done",
        accepted: true,
        deterministicUsable: true,
        attemptsUsed: index + 1,
        result: params.result,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    status: "error",
    accepted: false,
    deterministicUsable: false,
    attemptsUsed: boundedAttempts.length,
    error: lastError,
  };
}

const validReview: Review = {
  verdict: "pass",
  findings: [{ summary: "The change is covered", evidence: ["bun test: 12 passed"] }],
};

function finishWith(result?: unknown): Record<string, unknown> {
  return {
    status: "success",
    summary: "Review completed",
    verification_evidence: ["POC fixture supplied deterministic evidence"],
    ...(result === undefined ? {} : { result }),
  };
}

const missingFindings = { verdict: "pass" };
const wrongFindingsType = { verdict: "fail", findings: "No evidence" };

export const comparisonCases: ComparisonCase[] = [
  {
    name: "plain JSON",
    shouldBeUsable: true,
    freeText: JSON.stringify(validReview),
    structuredAttempts: [{ kind: "finish", arguments: finishWith(validReview) }],
  },
  {
    name: "fenced JSON",
    shouldBeUsable: true,
    freeText: `\`\`\`json\n${JSON.stringify(validReview, null, 2)}\n\`\`\``,
    structuredAttempts: [{ kind: "finish", arguments: finishWith(validReview) }],
  },
  {
    name: "prose around JSON",
    shouldBeUsable: true,
    freeText: `Review complete.\n${JSON.stringify(validReview)}\nLet me know if you need more detail.`,
    structuredAttempts: [{ kind: "finish", arguments: finishWith(validReview) }],
  },
  {
    name: "missing required result field",
    shouldBeUsable: false,
    freeText: JSON.stringify(missingFindings),
    structuredAttempts: [
      { kind: "finish", arguments: finishWith() },
      { kind: "finish", arguments: finishWith() },
    ],
  },
  {
    name: "wrong result field type",
    shouldBeUsable: false,
    freeText: JSON.stringify(wrongFindingsType),
    structuredAttempts: [
      { kind: "finish", arguments: finishWith(wrongFindingsType) },
      { kind: "finish", arguments: finishWith(wrongFindingsType) },
    ],
  },
  {
    name: "malformed JSON / no finish",
    shouldBeUsable: false,
    freeText: '{"verdict":"pass","findings":',
    structuredAttempts: [
      { kind: "text", text: "I am done." },
      { kind: "text", text: "Still no finish call." },
    ],
  },
  {
    name: "invalid then corrected",
    shouldBeUsable: true,
    freeText: JSON.stringify(missingFindings),
    structuredAttempts: [
      { kind: "finish", arguments: finishWith(missingFindings) },
      { kind: "finish", arguments: finishWith(validReview) },
    ],
  },
  {
    name: "no finish then corrected",
    shouldBeUsable: true,
    freeText: "Review complete; everything passes.",
    structuredAttempts: [
      { kind: "text", text: "Review complete; everything passes." },
      { kind: "finish", arguments: finishWith(validReview) },
    ],
  },
  {
    name: "no finish after retry",
    shouldBeUsable: false,
    freeText: "Review complete; everything passes.",
    structuredAttempts: [
      { kind: "text", text: "Review complete; everything passes." },
      { kind: "text", text: "I already answered." },
    ],
  },
];

function summarize(rows: ComparisonRow[], select: (row: ComparisonRow) => ArmOutcome<unknown>): ComparisonMetrics {
  return rows.reduce<ComparisonMetrics>(
    (metrics, row) => {
      const outcome = select(row);
      metrics.cases++;
      if (row.shouldBeUsable && outcome.accepted) metrics.validAccepted++;
      if (!row.shouldBeUsable && !outcome.accepted) metrics.invalidRejected++;
      if (!row.shouldBeUsable && outcome.accepted) metrics.falseAccepted++;
      if (outcome.deterministicUsable) metrics.deterministicUsable++;
      if (row.shouldBeUsable && outcome.accepted && outcome.attemptsUsed === 2) metrics.recoveredOnRetry++;
      return metrics;
    },
    {
      cases: 0,
      validAccepted: 0,
      invalidRejected: 0,
      falseAccepted: 0,
      deterministicUsable: 0,
      recoveredOnRetry: 0,
    },
  );
}

export async function runComparison(cases: ComparisonCase[] = comparisonCases): Promise<ComparisonReport> {
  const rows: ComparisonRow[] = [];
  for (const fixture of cases) {
    rows.push({
      name: fixture.name,
      shouldBeUsable: fixture.shouldBeUsable,
      freeText: evaluateFreeText(ReviewSchema, fixture.freeText),
      structuredFinish: await evaluateStructuredFinish(ReviewSchema, fixture.structuredAttempts),
    });
  }

  return {
    rows,
    freeText: summarize(rows, (row) => row.freeText),
    structuredFinish: summarize(rows, (row) => row.structuredFinish),
  };
}

if (import.meta.main) {
  const report = await runComparison();
  console.table(
    report.rows.map((row) => ({
      case: row.name,
      expected: row.shouldBeUsable ? "usable" : "reject",
      A: row.freeText.accepted ? (row.freeText.deterministicUsable ? "typed" : "accepted text") : "error",
      B: row.structuredFinish.accepted
        ? row.structuredFinish.attemptsUsed === 2
          ? "typed after retry"
          : "typed"
        : "error",
    })),
  );
  console.table([
    { arm: "A: free text", ...report.freeText },
    { arm: "B: structured finish", ...report.structuredFinish },
  ]);
  console.log("This POC measures workflow-result contract reliability, not factual answer quality.");
}
