import { existsSync, readFileSync } from "node:fs";
import { Type } from "@earendil-works/pi-ai";
import type {
  GuidedPracticeCase,
  GuidedPracticeRequirement,
  LearningUnitContext,
} from "@may-agent/gym/loop";
import type { WorkflowContext } from "@may-agent/sdk";
import { callGymAgent, type GymAgentResult } from "./context";

const reflectionSchema = Type.Object(
  {
    summary: Type.String({ minLength: 1, maxLength: 1_000 }),
    calls: Type.Array(
      Type.Object(
        {
          taskId: Type.String({ minLength: 1 }),
          tool: Type.Union([Type.Literal("codex"), Type.Literal("claude")]),
          outcome: Type.Union([
            Type.Literal("completed"),
            Type.Literal("failed"),
            Type.Literal("orphaned"),
          ]),
          failureCategory: Type.Optional(Type.String({ minLength: 1 })),
          evidence: Type.Array(Type.String({ minLength: 1 }), {
            minItems: 1,
            maxItems: 8,
          }),
        },
        { additionalProperties: false },
      ),
      { maxItems: 8 },
    ),
    lessons: Type.Array(Type.String({ minLength: 1 }), {
      minItems: 1,
      maxItems: 8,
    }),
    decision: Type.String({ minLength: 1, maxLength: 1_000 }),
  },
  { additionalProperties: false },
);

export interface CliPracticeEvent {
  id: number;
  eventType: string;
  taskId: string;
  tool: "codex" | "claude" | null;
  failureCategory: string | null;
  resultPath: string | null;
  structuredResultPath: string | null;
  eventsPath: string | null;
}

export interface CliPracticeAssessment {
  passed: boolean;
  /** Evidence/runtime gaps, not demonstrated agent failures. Absent in old records. */
  invalid?: string[];
  missing: string[];
  taskIds: string[];
  evidence: string[];
}

export interface GuidedPracticeAttempt {
  attempt: number;
  sessionId: string;
  agentStatus: string;
  agentSummary: string | null;
  reflection: unknown;
  lifecycle: CliPracticeAssessment;
  events: CliPracticeEvent[];
}

export interface GuidedPracticeCaseResult {
  unit: string;
  case: string;
  type: "live" | "simulation";
  passed: boolean;
  attempts: GuidedPracticeAttempt[];
}

export interface GuidedPracticeResult {
  schema_version: 1;
  agent: string;
  passed: boolean;
  units: Array<{ id: string; version: number }>;
  cases: GuidedPracticeCaseResult[];
  completed_at: string;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseData(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") return record(value);
  try {
    return record(JSON.parse(value));
  } catch {
    return {};
  }
}

export function parseCliPracticeEvents(
  rows: Record<string, unknown>[],
): CliPracticeEvent[] {
  return rows.map((row) => {
    const data = parseData(row.data);
    const tool =
      data.tool === "codex" || data.tool === "claude" ? data.tool : null;
    return {
      id: Number(row.id ?? 0),
      eventType: String(row.event_type ?? ""),
      taskId: String(row.task_id ?? data.taskId ?? ""),
      tool,
      failureCategory:
        typeof data.failureCategory === "string" ? data.failureCategory : null,
      resultPath: typeof data.resultPath === "string" ? data.resultPath : null,
      structuredResultPath:
        typeof data.structuredResultPath === "string"
          ? data.structuredResultPath
          : null,
      eventsPath: typeof data.eventsPath === "string" ? data.eventsPath : null,
    };
  });
}

function terminalName(
  eventType: string,
): GuidedPracticeRequirement["terminal"] | null {
  if (eventType === "cli.task.completed") return "completed";
  if (eventType === "cli.task.failed") return "failed";
  if (eventType === "cli.task.orphaned") return "orphaned";
  return null;
}

export function assessCliPractice(
  events: CliPracticeEvent[],
  requirements: GuidedPracticeRequirement[],
  requireLifecycleEvents = true,
): CliPracticeAssessment {
  const used = new Set<string>();
  const missing: string[] = [];
  const evidence: string[] = [];
  const taskIds = [
    ...new Set(events.map(({ taskId }) => taskId).filter(Boolean)),
  ];

  for (const requirement of requirements) {
    const match = events.find((event) => {
      if (!event.taskId || used.has(event.taskId)) return false;
      if (event.tool !== requirement.tool) return false;
      if (terminalName(event.eventType) !== requirement.terminal) return false;
      return (
        !requirement.failure_category ||
        event.failureCategory === requirement.failure_category
      );
    });
    const label = `${requirement.tool}:${requirement.terminal}${
      requirement.failure_category ? `:${requirement.failure_category}` : ""
    }`;
    if (!match) {
      missing.push(label);
      continue;
    }
    used.add(match.taskId);
    if (requireLifecycleEvents) {
      const lifecycle = new Set(
        events
          .filter(({ taskId }) => taskId === match.taskId)
          .map(({ eventType }) => eventType),
      );
      if (!lifecycle.has("cli.task.requested")) {
        missing.push(`${label}:requested`);
      }
      if (!lifecycle.has("cli.task.started")) {
        missing.push(`${label}:started`);
      }
    }
    evidence.push(
      ...[
        match.resultPath,
        match.structuredResultPath,
        match.eventsPath,
      ].filter((value): value is string => Boolean(value)),
    );
  }

  return {
    passed: missing.length === 0,
    missing,
    taskIds,
    evidence: [...new Set(evidence)],
  };
}

export function observePractice(
  result: GymAgentResult,
  practice: GuidedPracticeCase,
): { events: CliPracticeEvent[]; assessment: CliPracticeAssessment } {
  // The reflection is a claim to compare, never the source of observed outcomes.
  const claims = Array.isArray(record(result.structuredResult).calls)
    ? (record(result.structuredResult).calls as unknown[]).map(record)
    : [];
  const calls = [
    ...new Map(
      (result.cliCalls ?? [])
        .filter((call) => call.sessionId === result.sessionId)
        .map((call) => [call.taskId, call] as const),
    ).values(),
  ];
  const events: CliPracticeEvent[] = calls.map((call, index) => ({
    id: index + 1,
    eventType: `cli.task.${call.status}`,
    taskId: call.taskId,
    tool: call.tool,
    failureCategory: call.failureCategory ?? null,
    resultPath: call.resultPath,
    structuredResultPath: call.structuredResultPath,
    eventsPath: call.eventsPath,
  }));
  const assessment = assessCliPractice(events, practice.requirements, false);
  // A bounded transcript tail can prove presence, not absence. Missing required
  // outcomes cannot distinguish an omitted call from lost/truncated evidence.
  const invalid = assessment.missing.map(
    (item) => `required-cli-evidence-missing:${item}`,
  );
  if (result.status !== "done")
    invalid.push(`agent-execution:${result.status}`);
  if (result.cliCalls === undefined)
    invalid.push("cli-evidence-unavailable:requires-updated-host");
  if (!calls.length && practice.requirements.length)
    invalid.push("cli-evidence-missing");
  if (!result.structuredResult)
    assessment.missing.push("structured-reflection");
  const claimed = new Set<string>();
  for (const claim of claims) {
    const id = String(claim.taskId ?? "");
    const call = calls.find((item) => item.taskId === id);
    if (!call) {
      invalid.push(`cli-evidence-missing:${id}`);
      continue;
    }
    if (claimed.has(id)) assessment.missing.push(`duplicate-claim:${id}`);
    claimed.add(id);
    if (
      claim.tool !== call.tool ||
      claim.outcome !== call.status ||
      (claim.failureCategory ?? null) !== (call.failureCategory ?? null)
    ) {
      assessment.missing.push(`reflection-outcome:${id}`);
    }
    const paths = [call.resultPath, call.structuredResultPath, call.eventsPath];
    if (
      !Array.isArray(claim.evidence) ||
      !claim.evidence.length ||
      claim.evidence.some((path) => !paths.includes(String(path)))
    ) {
      assessment.missing.push(`reflection-evidence:${id}`);
    }
  }
  for (const call of calls) {
    if (!claimed.has(call.taskId))
      assessment.missing.push(`unreported-call:${call.taskId}`);
    if (
      call.status === "failed" &&
      !practice.requirements.some(
        (requirement) =>
          requirement.tool === call.tool &&
          requirement.terminal === "failed" &&
          (!requirement.failure_category ||
            requirement.failure_category === call.failureCategory),
      )
    ) {
      invalid.push(
        `unexpected-cli-failure:${call.taskId}:${call.failureCategory ?? "unknown"}`,
      );
    }
  }
  if (invalid.length) assessment.invalid = [...new Set(invalid)];
  assessment.passed = !assessment.missing.length && !invalid.length;
  return { events, assessment };
}

export function guidedPracticePrompt(
  unit: LearningUnitContext,
  practice: GuidedPracticeCase,
  prior: GuidedPracticeAttempt | null,
): string {
  const requirements = practice.requirements
    .map(
      (item) =>
        `${item.tool} must end ${item.terminal}${
          item.failure_category ? ` with ${item.failure_category}` : ""
        }`,
    )
    .join("; ");
  return [
    "This is guided practice, not a written knowledge test.",
    `Learning unit: ${unit.id} v${unit.version} — ${unit.title}`,
    `Objective: ${practice.objective}`,
    `Lesson: ${unit.lessonPath}`,
    `Practice guide: ${unit.practicePath}`,
    `Accepted sources: ${unit.sourcePaths.join(", ")}`,
    "Use run_cli_agent for every required live worker call. Do not simulate a call or replace it with your own answer.",
    "Use review or investigate mode only. Keep the work read-only and scoped to the named files.",
    "Await the tool's terminal return, then inspect its named result.md, result.json, and events.jsonl paths before deciding. The CLI taskId is an evidence correlation key, not a Task or execution resource; do not poll it or return a CLI-terminal Condition.",
    "Treat each worker answer as advice. Resolve disagreement with cited primary evidence, not a vote.",
    "Use a fresh native context for an independent opinion. Resume only when continuing the same worker's unfinished line of work.",
    requirements
      ? `Required observed outcomes: ${requirements}`
      : "No live worker outcome is required for this simulation.",
    `Practice task:\n${practice.task}`,
    ...(prior
      ? [
          `Previous attempt missed: ${prior.lifecycle.missing.join(", ") || "reflection quality"}`,
          `Previous agent summary: ${prior.agentSummary ?? prior.agentStatus}`,
          "Try again using that evidence. Change the failed waiting, context, retry, or result-handling behavior instead of repeating it.",
        ]
      : []),
    "Finish with the task ids, terminal outcomes, artifact paths you inspected, what changed your judgment, and the next decision you own.",
  ].join("\n");
}

export async function runGuidedPractice(input: {
  ctx: WorkflowContext;
  agent: string;
  units: LearningUnitContext[];
}): Promise<GuidedPracticeResult> {
  const cases: GuidedPracticeCaseResult[] = [];
  for (const unit of input.units) {
    for (const practice of unit.guidedPracticeCases) {
      const attempts: GuidedPracticeAttempt[] = [];
      for (let attempt = 1; attempt <= 2; attempt++) {
        const prior = attempts.at(-1) ?? null;
        const result = await callGymAgent(
          input.ctx,
          input.agent,
          guidedPracticePrompt(unit, practice, prior),
          {
            schema: reflectionSchema,
            timeoutMs: practice.max_wait_ms + 120_000,
          },
        );
        const observed =
          practice.type === "live"
            ? observePractice(result, practice)
            : {
                events: [] as CliPracticeEvent[],
                assessment: {
                  passed:
                    result.status === "done" &&
                    Boolean(result.structuredResult),
                  missing:
                    result.status === "done" && result.structuredResult
                      ? []
                      : ["structured-reflection"],
                  taskIds: [],
                  evidence: [],
                },
              };
        attempts.push({
          attempt,
          sessionId: result.sessionId,
          agentStatus: result.status,
          agentSummary: result.lastAssistantText,
          reflection: result.structuredResult ?? null,
          lifecycle: observed.assessment,
          events: observed.events,
        });
        // Missing runtime evidence is not a lesson about the agent. Do not spend
        // another live attempt trying to repair an unsupported Host/scorer path.
        if (observed.assessment.invalid?.length) break;
        if (observed.assessment.passed && result.structuredResult) break;
      }
      cases.push({
        unit: unit.id,
        case: practice.id,
        type: practice.type,
        passed: Boolean(attempts.at(-1)?.lifecycle.passed),
        attempts,
      });
    }
  }
  return {
    schema_version: 1,
    agent: input.agent,
    passed: cases.every(({ passed }) => passed),
    units: input.units.map(({ id, version }) => ({ id, version })),
    cases,
    completed_at: new Date().toISOString(),
  };
}

export function readGuidedPracticeResult(
  path: string,
): GuidedPracticeResult | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as GuidedPracticeResult;
  } catch {
    return null;
  }
}
