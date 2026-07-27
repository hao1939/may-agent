import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { Type } from "@earendil-works/pi-ai";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import {
  scanCodexLearningSource,
  type CodexLearningTurn,
  type CodexSourceScan,
  type CodexSourceReference,
} from "./lib/codex-learning-source";
import { reconciliationPacket, safeKey, triggerDetails } from "./lib/trigger";

export const name = "codex-learning-intake";
export const description =
  "Extract only strong, reusable Hao intent signals from Codex sessions and preserve them as reviewable learning candidates.";
export const workspace = "shared";

const MIN_CONFIDENCE = 0.92;
const DEFAULT_BATCH_SIZE = 200;
const DEFAULT_MAX_BATCHES = 1;
const MAX_BATCHES = 5;
const MAX_CATALOG_ITEMS = 80;

const signalSchema = Type.Object(
  {
    signals: Type.Array(
      Type.Object(
        {
          sourceIds: Type.Array(Type.String({ minLength: 1 }), {
            minItems: 1,
            maxItems: 8,
          }),
          kind: Type.Union([
            Type.Literal("preference"),
            Type.Literal("requirement"),
            Type.Literal("correction"),
            Type.Literal("approval"),
            Type.Literal("rejection"),
            Type.Literal("positive-example"),
          ]),
          scope: Type.Union([
            Type.Literal("global"),
            Type.Literal("system"),
            Type.Literal("project"),
            Type.Literal("task-class"),
          ]),
          statement: Type.String({ minLength: 1, maxLength: 600 }),
          rationale: Type.String({ minLength: 1, maxLength: 1_200 }),
          strength: Type.Union([
            Type.Literal("explicit"),
            Type.Literal("repeated"),
            Type.Literal("validated"),
          ]),
          reusable: Type.Boolean(),
          confidence: Type.Number({ minimum: 0, maximum: 1 }),
          competencies: Type.Array(Type.String({ minLength: 1 }), {
            maxItems: 8,
          }),
        },
        { additionalProperties: false },
      ),
      { maxItems: 80 },
    ),
  },
  { additionalProperties: false },
);

const catalogSchema = Type.Object(
  {
    preferences: Type.Array(
      Type.Object(
        {
          statement: Type.String({ minLength: 1, maxLength: 600 }),
          scope: Type.Union([
            Type.Literal("global"),
            Type.Literal("system"),
            Type.Literal("project"),
            Type.Literal("task-class"),
          ]),
          rationale: Type.String({ minLength: 1, maxLength: 1_200 }),
          evidenceIds: Type.Array(Type.String({ minLength: 1 }), {
            minItems: 1,
            maxItems: 32,
          }),
          conflictEvidenceIds: Type.Array(Type.String({ minLength: 1 }), {
            maxItems: 16,
          }),
          confidence: Type.Number({ minimum: 0, maximum: 1 }),
          competencies: Type.Array(Type.String({ minLength: 1 }), {
            maxItems: 12,
          }),
        },
        { additionalProperties: false },
      ),
      { maxItems: MAX_CATALOG_ITEMS },
    ),
  },
  { additionalProperties: false },
);

type SignalKind =
  | "preference"
  | "requirement"
  | "correction"
  | "approval"
  | "rejection"
  | "positive-example";
type SignalScope = "global" | "system" | "project" | "task-class";
type SignalStrength = "explicit" | "repeated" | "validated";

interface ExtractedSignal {
  sourceIds: string[];
  kind: SignalKind;
  scope: SignalScope;
  statement: string;
  rationale: string;
  strength: SignalStrength;
  reusable: boolean;
  confidence: number;
  competencies: string[];
}

interface EvidenceRow {
  schema_version: 1;
  evidence_id: string;
  source: "codex-session";
  kind: SignalKind;
  scope: SignalScope;
  statement: string;
  rationale: string;
  strength: SignalStrength;
  confidence: number;
  competencies: string[];
  source_refs: CodexSourceReference[];
  status: "candidate";
  captured_at: string;
}

interface CatalogPreference {
  id: string;
  statement: string;
  scope: SignalScope;
  rationale: string;
  evidenceIds: string[];
  conflictEvidenceIds: string[];
  confidence: number;
  competencies: string[];
  status: "candidate";
}

interface Catalog {
  schema_version: 1;
  owner: "hao";
  updated_at: string;
  preferences: CatalogPreference[];
}

interface Checkpoint {
  schema_version: 1;
  source: "codex-history";
  updated_at: string;
  processed_source_ids: string[];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function integer(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max
    ? parsed
    : fallback;
}

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temporary, path);
}

function boundedText(value: string | null, limit: number): string | null {
  if (!value) return null;
  if (value.length <= limit) return value;
  const head = Math.floor(limit * 0.7);
  const tail = limit - head;
  return `${value.slice(0, head)}\n…[source shortened]…\n${value.slice(-tail)}`;
}

function batch<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function extractionPrompt(batchPath: string): string {
  return [
    "Review one batch of Hao-authored Codex turns for reusable learning evidence.",
    `Batch: ${batchPath}`,
    "Read the batch completely. Each row has a sourceId, Hao's message, and bounded preceding assistant context when available.",
    "Quality is more important than quantity. Returning zero signals is a successful result.",
    "Keep only strong signals: an explicit reusable preference or requirement, a clear correction, a meaningful approve/reject decision whose context establishes the reusable rule, or an explicitly accepted solution that demonstrates a reusable method.",
    "Discard ordinary task requests, questions, status checks, retry/continue messages, politeness, one-off decisions, weak inference, and assistant claims that Hao did not validate.",
    "Exclude credentials, secrets, personal material, third-party content, and project facts that are not Hao policy.",
    "Express the signal in simple plain language. Preserve scope and exceptions. Use only exact sourceIds from the batch.",
    `Return confidence below ${MIN_CONFIDENCE} when the meaning or reusability is uncertain; those rows will be rejected.`,
    "Map to existing competency IDs when clear: authority.act-vs-approve, judgment.infer-bounded-intent, evidence.propose-after-proof, system.owner-and-route, project.app-control, execution.skill-vs-workflow, reliability.delivery-vs-completion, diagnosis.responsible-layer.",
  ].join("\n");
}

function consolidationPrompt(path: string): string {
  return [
    "Consolidate strong Hao preference evidence by meaning.",
    `Input: ${path}`,
    "Read the complete input, which contains the existing catalog and newly extracted evidence.",
    "Quality is more important than quantity. Merge duplicates, preserve useful scope, and keep at most the smallest set of durable rules that explains the evidence.",
    "Prefer recent explicit corrections over older inference. Record genuine contradictory evidence instead of hiding it.",
    "Keep a single explicit preference when it is clear and reusable. Keep inferred or example-based signals only when repeated or independently validated.",
    "Discard one-off project choices, vague approval, and rules that merely restate an assistant proposal without clear Hao endorsement.",
    "Use only evidenceIds present in the input. Return plain language suitable for a human review packet. These remain candidates; do not claim they are already May policy.",
  ].join("\n");
}

function validSignals(value: unknown, allowed: Set<string>): ExtractedSignal[] {
  const signals = Array.isArray(record(value).signals)
    ? (record(value).signals as unknown[])
    : [];
  return signals.flatMap((candidate) => {
    const signal = record(candidate);
    const sourceIds = Array.isArray(signal.sourceIds)
      ? [...new Set(signal.sourceIds.map(String))]
      : [];
    const confidence = Number(signal.confidence);
    if (
      !sourceIds.length ||
      sourceIds.some((id) => !allowed.has(id)) ||
      signal.reusable !== true ||
      !Number.isFinite(confidence) ||
      confidence < MIN_CONFIDENCE
    ) {
      return [];
    }
    return [
      {
        sourceIds,
        kind: String(signal.kind) as SignalKind,
        scope: String(signal.scope) as SignalScope,
        statement: String(signal.statement).trim(),
        rationale: String(signal.rationale).trim(),
        strength: String(signal.strength) as SignalStrength,
        reusable: true,
        confidence,
        competencies: Array.isArray(signal.competencies)
          ? [...new Set(signal.competencies.map(String))]
          : [],
      },
    ];
  });
}

function evidenceRow(
  signal: ExtractedSignal,
  turns: Map<string, CodexLearningTurn>,
  capturedAt: string,
): EvidenceRow {
  const evidenceId = `codex-evidence-${sha256(
    [...signal.sourceIds].sort().join("\0") + `\0${signal.kind}`,
  ).slice(0, 20)}`;
  return {
    schema_version: 1,
    evidence_id: evidenceId,
    source: "codex-session",
    kind: signal.kind,
    scope: signal.scope,
    statement: signal.statement,
    rationale: signal.rationale,
    strength: signal.strength,
    confidence: signal.confidence,
    competencies: signal.competencies,
    source_refs: signal.sourceIds.flatMap((id) => {
      const turn = turns.get(id);
      return turn ? [turn.source] : [];
    }),
    status: "candidate",
    captured_at: capturedAt,
  };
}

function catalogPreferences(
  value: unknown,
  knownEvidence: Set<string>,
): CatalogPreference[] {
  const preferences = Array.isArray(record(value).preferences)
    ? (record(value).preferences as unknown[])
    : [];
  return preferences.slice(0, MAX_CATALOG_ITEMS).flatMap((candidate) => {
    const preference = record(candidate);
    const evidenceIds = Array.isArray(preference.evidenceIds)
      ? [...new Set(preference.evidenceIds.map(String))].filter((id) =>
          knownEvidence.has(id),
        )
      : [];
    const confidence = Number(preference.confidence);
    const statement = String(preference.statement ?? "").trim();
    if (!statement || !evidenceIds.length || confidence < MIN_CONFIDENCE)
      return [];
    const scope = String(preference.scope) as SignalScope;
    return [
      {
        id: `hao-preference-${sha256(`${scope}\0${statement}`).slice(0, 20)}`,
        statement,
        scope,
        rationale: String(preference.rationale ?? "").trim(),
        evidenceIds,
        conflictEvidenceIds: Array.isArray(preference.conflictEvidenceIds)
          ? [...new Set(preference.conflictEvidenceIds.map(String))].filter(
              (id) => knownEvidence.has(id),
            )
          : [],
        confidence,
        competencies: Array.isArray(preference.competencies)
          ? [...new Set(preference.competencies.map(String))]
          : [],
        status: "candidate",
      },
    ];
  });
}

function workflowInput(ctx: WorkflowContext): Record<string, unknown> {
  const packet = reconciliationPacket(ctx.task);
  return record(packet?.input ?? triggerDetails(ctx.task));
}

export async function runCodexLearningIntake(
  ctx: WorkflowContext,
  options: { codexHome?: string; scan?: () => Promise<CodexSourceScan> } = {},
): Promise<WorkflowResult> {
  const input = workflowInput(ctx);
  const batchSize = integer(
    input.batchSize,
    DEFAULT_BATCH_SIZE,
    1,
    DEFAULT_BATCH_SIZE,
  );
  const maxBatches = integer(
    input.maxBatches,
    DEFAULT_MAX_BATCHES,
    1,
    MAX_BATCHES,
  );
  const codexHome = options.codexHome;
  const codexHomes = codexHome ? [codexHome] : defaultCodexHomes();
  const stateDir = join(
    ctx.projectsRoot,
    "gym.app",
    ".state",
    "learning",
    "codex",
  );
  const evidenceDir = join(stateDir, "evidence");
  const runsDir = join(stateDir, "runs");
  const checkpointPath = join(stateDir, "checkpoint.json");
  const catalogPath = join(stateDir, "catalog.json");
  const journalPath = join(stateDir, "evidence.jsonl");
  const checkpoint = readJson<Checkpoint>(checkpointPath);
  const processed = new Set(checkpoint?.processed_source_ids ?? []);
  const runId = `codex-learning-${new Date().toISOString().replace(/[-:.]/g, "").replace("Z", "Z")}`;
  const runPath = join(runsDir, `${safeKey(runId, "codex-learning")}.json`);
  const scratchDir = join(stateDir, "scratch", safeKey(runId, "run"));
  rmSync(scratchDir, { recursive: true, force: true });
  mkdirSync(scratchDir, { recursive: true });
  try {
    const scan = options.scan
      ? await options.scan()
      : options.codexHome
        ? await scanCodexLearningSource({
            codexHome: options.codexHome,
            processedSourceIds: processed,
          })
        : await scanSourceSubprocess(
            ctx,
            codexHomes,
            checkpointPath,
            join(scratchDir, "source-scan.json"),
          );
    const selected = scan.turns.slice(0, batchSize * maxBatches);
    if (!selected.length) {
      const now = new Date().toISOString();
      writeJson(checkpointPath, {
        schema_version: 1,
        source: "codex-history",
        updated_at: now,
        processed_source_ids: [...processed].sort(),
      } satisfies Checkpoint);
      const summary = "Codex learning intake found no new Hao-authored turns.";
      writeJson(runPath, {
        schema_version: 1,
        run_id: runId,
        summary,
        scanned_history_rows: scan.totalHistoryRows,
        new_turns: 0,
        selected_signals: 0,
        backlog: 0,
        malformed_lines: scan.malformedLines,
        completed_at: now,
      });
      return ctx.done(summary, {
        state: "converged",
        summary,
        evidence: [runPath, checkpointPath],
        actions: [],
      });
    }

    const extracted: ExtractedSignal[] = [];
    let index = 0;
    for (const turns of batch(selected, batchSize)) {
      index += 1;
      const batchPath = join(scratchDir, `batch-${index}.json`);
      writeJson(
        batchPath,
        turns.map((turn) => ({
          sourceId: turn.source.sourceId,
          sessionId: turn.source.sessionId,
          timestamp: turn.source.timestamp,
          haoMessage: boundedText(turn.userText, 4_500),
          previousAssistant: boundedText(turn.previousAssistant, 1_600),
        })),
      );
      const result = await ctx.runAgent("gym", extractionPrompt(batchPath), {
        schema: signalSchema,
        timeoutMs: 900_000,
      });
      if (
        result.status === "error" ||
        result.status === "interrupted" ||
        !result.structuredResult
      ) {
        return ctx.done(
          "Codex learning extraction failed; no checkpoint advanced.",
          {
            state: "needs-owner",
            summary:
              "Codex learning extraction failed; no checkpoint advanced.",
            evidence: [result.sessionId, batchPath],
          },
        );
      }
      extracted.push(
        ...validSignals(
          result.structuredResult,
          new Set(turns.map((turn) => turn.source.sourceId)),
        ),
      );
    }

    const now = new Date().toISOString();
    const turnById = new Map(
      selected.map((turn) => [turn.source.sourceId, turn]),
    );
    const rows = extracted.map((signal) => evidenceRow(signal, turnById, now));
    const existingCatalog = readJson<Catalog>(catalogPath) ?? {
      schema_version: 1,
      owner: "hao",
      updated_at: new Date(0).toISOString(),
      preferences: [],
    };
    let preferences = existingCatalog.preferences;
    if (rows.length) {
      const consolidationPath = join(scratchDir, "consolidation.json");
      writeJson(consolidationPath, {
        existingCatalog,
        newEvidence: rows,
      });
      const result = await ctx.runAgent(
        "gym",
        consolidationPrompt(consolidationPath),
        {
          schema: catalogSchema,
          timeoutMs: 900_000,
        },
      );
      if (
        result.status === "error" ||
        result.status === "interrupted" ||
        !result.structuredResult
      ) {
        return ctx.done(
          "Codex learning consolidation failed; no checkpoint advanced.",
          {
            state: "needs-owner",
            summary:
              "Codex learning consolidation failed; no checkpoint advanced.",
            evidence: [result.sessionId, consolidationPath],
          },
        );
      }
      const knownEvidence = new Set([
        ...existingCatalog.preferences.flatMap((item) => [
          ...item.evidenceIds,
          ...item.conflictEvidenceIds,
        ]),
        ...rows.map((row) => row.evidence_id),
      ]);
      preferences = catalogPreferences(result.structuredResult, knownEvidence);
    }

    mkdirSync(evidenceDir, { recursive: true });
    for (const row of rows) {
      const path = join(evidenceDir, `${row.evidence_id}.json`);
      if (existsSync(path)) continue;
      writeJson(path, row);
      appendFileSync(journalPath, `${JSON.stringify(row)}\n`);
    }
    writeJson(catalogPath, {
      schema_version: 1,
      owner: "hao",
      updated_at: now,
      preferences,
    } satisfies Catalog);
    for (const turn of selected) processed.add(turn.source.sourceId);
    writeJson(checkpointPath, {
      schema_version: 1,
      source: "codex-history",
      updated_at: now,
      processed_source_ids: [...processed].sort(),
    } satisfies Checkpoint);
    const backlog = Math.max(0, scan.newHistoryRows - selected.length);
    const summary = rows.length
      ? `Codex intake kept ${rows.length} strong signals from ${selected.length} new turns and consolidated ${preferences.length} preference candidates.`
      : `Codex intake reviewed ${selected.length} new turns and kept no learning signals.`;
    writeJson(runPath, {
      schema_version: 1,
      run_id: runId,
      summary,
      scanned_history_rows: scan.totalHistoryRows,
      reviewed_turns: selected.length,
      selected_signals: rows.length,
      catalog_candidates: preferences.length,
      backlog,
      rollout_files_read: scan.rolloutFilesRead,
      malformed_lines: scan.malformedLines,
      evidence_ids: rows.map((row) => row.evidence_id),
      completed_at: now,
    });
    return ctx.done(summary, {
      state: "converged",
      summary,
      evidence: [runPath, checkpointPath, catalogPath],
      actions: [],
    });
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }
}

async function scanSourceSubprocess(
  ctx: WorkflowContext,
  codexHomes: string[],
  checkpointPath: string,
  outputPath: string,
): Promise<CodexSourceScan> {
  const cliPath = join(
    ctx.projectsRoot,
    "gym.app",
    "agents",
    "gym",
    "workflows",
    "lib",
    "codex-learning-source-cli.ts",
  );
  const process = Bun.spawn(
    ["bun", cliPath, checkpointPath, outputPath, ...codexHomes],
    {
      cwd: join(ctx.projectsRoot, "gym.app"),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const exitCode = await process.exited;
  if (exitCode !== 0 || !existsSync(outputPath)) {
    const error = await new Response(process.stderr).text();
    throw new Error(
      `Codex source indexing failed (${exitCode}): ${error.trim() || "no output"}`,
    );
  }
  return JSON.parse(readFileSync(outputPath, "utf8")) as CodexSourceScan;
}

function defaultCodexHomes(): string[] {
  return [
    process.env.CODEX_HOME,
    join(homedir(), ".codex"),
    "/home/hao/.codex",
  ].flatMap((path, index, values) =>
    path && existsSync(path) && values.indexOf(path) === index ? [path] : [],
  );
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  return runCodexLearningIntake(ctx);
}
