/**
 * Daily Self-Improving Agent Loop (`alex/learn-from-daily-work`)
 *
 * Harvests user intent, corrections (failures), efficiency bottlenecks, and
 * repeated success patterns across Gemini, Pi, Codex, and May sessions—working
 * seamlessly across both container (`<projectRoot>/.state`) and localhost
 * (`$HOME` / custom root) environments—then synthesizes `cases.json` draft
 * benchmarks and orchestrates `gym` + `tech-lead` to verify improvements.
 */

import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { dirname, join, resolve } from "node:path";
import { Type, type Static, type AgentContext } from "@may-agent/sdk";

export const name = "learn-from-daily-work";
export const description =
  "Harvest daily user signals (Gemini, Pi, Codex, May DB) across container and localhost roots, extract failure/efficiency/success lessons, draft single-file benchmark cases, and run Gym diagnosis.";

export const learnFromDailyWorkInputSchema = Type.Object(
  {
    /**
     * Optional explicit root directories to scan for `.gemini`, `.pi`, `.codex`, and `may.db`.
     * Defaults to scanning `<projectRoot>/.state`, `process.env.HOME`, `os.homedir()`, and `DAILY_LEARNING_ROOTS`.
     */
    roots: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    /** Maximum number of recent user signals to harvest across sources (default: 40). */
    maxSignals: Type.Optional(Type.Number({ minimum: 1, maximum: 200 })),
    /** Target agent role to focus on (`may`, `alex`, `bob`, `tech-lead`, `scout`). */
    targetRole: Type.Optional(Type.String({ minLength: 1 })),
    /** Whether to only harvest & classify signals without calling the LLM specialist (`dryRun: true`). */
    dryRun: Type.Optional(Type.Boolean()),
    /** Optional path to persist the incremental cursor JSON. */
    cursorPath: Type.Optional(Type.String({ minLength: 1 })),
    /** Optional path to write the synthesized daily learning report JSON. */
    outputFile: Type.Optional(Type.String({ minLength: 1 })),
    /** Whether to automatically stage accepted draft benchmark cases into projects/gym/benchmarks/<role>-judgment/cases.json. */
    stageDraftCases: Type.Optional(Type.Boolean()),
    /** Optional override for the Gym benchmarks root directory (defaults to <workspaceRoot>/projects/gym/benchmarks). */
    gymBenchmarksRoot: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: true },
);

export type LearnFromDailyWorkInput = Static<typeof learnFromDailyWorkInputSchema>;

export type SignalKind = "failure_correction" | "efficiency_gap" | "success_pattern";

export interface HarvestedUserSignal {
  id: string;
  source: "gemini" | "pi" | "codex" | "may-db";
  originRoot: string;
  timestampMs: number;
  kind: SignalKind;
  userText: string;
  inferredRole: "may" | "alex" | "bob" | "tech-lead" | "scout";
}

export interface DiscoveredSessionSources {
  scannedRoots: string[];
  geminiLogFiles: string[];
  piSessionDirs: string[];
  codexSqliteFiles: string[];
  codexHistoryFiles: string[];
  mayDbFiles: string[];
}

export const dailyLearningSynthesisSchema = Type.Object(
  {
    summary: Type.String({ minLength: 1 }),
    lessons: Type.Array(
      Type.Object(
        {
          role: Type.Union([
            Type.Literal("may"),
            Type.Literal("alex"),
            Type.Literal("bob"),
            Type.Literal("tech-lead"),
            Type.Literal("scout"),
          ]),
          signalKind: Type.Union([
            Type.Literal("failure_correction"),
            Type.Literal("efficiency_gap"),
            Type.Literal("success_pattern"),
          ]),
          sourceQuote: Type.String({ minLength: 1 }),
          extractedJudgeRule: Type.String({ minLength: 1 }),
          recommendedStage: Type.Union([
            Type.Literal("stage1_prompt"),
            Type.Literal("stage2_skill"),
            Type.Literal("stage3_workflow"),
          ]),
          draftBenchmarkCase: Type.Object(
            {
              id: Type.String({ minLength: 1 }),
              description: Type.String({ minLength: 1 }),
              task: Type.String({ minLength: 1 }),
              expectedHumanAnswer: Type.String({ minLength: 1 }),
              requiredConcepts: Type.Array(Type.Array(Type.String({ minLength: 1 }))),
            },
            { additionalProperties: false },
          ),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

export type DailyLearningSynthesis = Static<typeof dailyLearningSynthesisSchema>;

/**
 * Resolves all candidate home/state roots across container (`/app/.state`,
 * `/workspace/.../.state`) and localhost (`$HOME`, `/home/hao`, `DAILY_LEARNING_ROOTS`)
 * without assuming container and localhost paths are identical.
 */
export function discoverSessionSources(
  projectRoot: string,
  explicitRoots?: string[],
): DiscoveredSessionSources {
  const envRoots = (process.env.DAILY_LEARNING_ROOTS ?? "")
    .split(":")
    .map((p) => p.trim())
    .filter(Boolean);

  let passwdHome = "";
  try {
    passwdHome = userInfo().homedir;
  } catch {
    // Ignore if passwd entry is unavailable
  }
  const parentRoot = dirname(dirname(resolve(projectRoot)));

  const homeSubdirs: string[] = [];
  if (existsSync("/home")) {
    try {
      for (const entry of readdirSync("/home")) {
        const full = join("/home", entry);
        if (existsSync(full) && statSync(full).isDirectory()) {
          homeSubdirs.push(full);
        }
      }
    } catch {
      // Ignore if /home is not readable
    }
  }

  const rawRoots =
    explicitRoots && explicitRoots.length > 0
      ? explicitRoots
      : [
          join(projectRoot, ".state"),
          projectRoot,
          join(parentRoot, ".state"),
          parentRoot,
          process.env.HOME ?? "",
          homedir(),
          passwdHome,
          process.env.USER ? `/home/${process.env.USER}` : "",
          ...homeSubdirs,
          ...envRoots,
        ];

  const scannedRoots: string[] = [];
  const seenRoots = new Set<string>();
  for (const candidate of rawRoots) {
    if (!candidate) continue;
    const resolved = resolve(candidate);
    if (seenRoots.has(resolved) || !existsSync(resolved)) continue;
    seenRoots.add(resolved);
    scannedRoots.push(resolved);
  }

  const geminiLogFiles = new Set<string>();
  const piSessionDirs = new Set<string>();
  const codexSqliteFiles = new Set<string>();
  const codexHistoryFiles = new Set<string>();
  const mayDbFiles = new Set<string>();

  for (const root of scannedRoots) {
    // 1. Gemini logs: <root>/.gemini/tmp/*/logs.json or <root>/tmp/*/logs.json
    for (const geminiBase of [join(root, ".gemini", "tmp"), join(root, "tmp")]) {
      if (!existsSync(geminiBase)) continue;
      try {
        for (const sub of readdirSync(geminiBase)) {
          const logFile = join(geminiBase, sub, "logs.json");
          if (existsSync(logFile)) geminiLogFiles.add(logFile);
        }
      } catch {
        // Ignore unreadable directories
      }
    }

    // 2. Pi session dirs: <root>/.pi/agent/sessions/*
    for (const piBase of [
      join(root, ".pi", "agent", "sessions"),
      join(root, "agent", "sessions"),
    ]) {
      if (!existsSync(piBase)) continue;
      try {
        for (const sub of readdirSync(piBase)) {
          const full = join(piBase, sub);
          if (existsSync(full) && statSync(full).isDirectory()) {
            piSessionDirs.add(full);
          }
        }
      } catch {
        // Ignore unreadable directories
      }
    }

    // 3. Codex SQLite & history: <root>/.codex/thread_history_1.sqlite & history.jsonl
    for (const codexBase of [join(root, ".codex"), root]) {
      const sqlitePath = join(codexBase, "thread_history_1.sqlite");
      if (existsSync(sqlitePath)) codexSqliteFiles.add(sqlitePath);
      const histPath = join(codexBase, "history.jsonl");
      if (existsSync(histPath)) codexHistoryFiles.add(histPath);
    }

    // 4. May SQLite DB: <root>/may.db or <root>/.state/may.db
    for (const mayDbPath of [join(root, "may.db"), join(root, ".state", "may.db")]) {
      if (existsSync(mayDbPath)) mayDbFiles.add(mayDbPath);
    }
  }

  return {
    scannedRoots,
    geminiLogFiles: [...geminiLogFiles],
    piSessionDirs: [...piSessionDirs],
    codexSqliteFiles: [...codexSqliteFiles],
    codexHistoryFiles: [...codexHistoryFiles],
    mayDbFiles: [...mayDbFiles],
  };
}

export function classifyUserSignal(
  rawText: string,
): { kind: SignalKind; inferredRole: HarvestedUserSignal["inferredRole"] } | null {
  const clean = rawText.replace(/\s+/g, " ").trim();
  if (clean.length < 15 || clean.length > 600) return null;
  if (clean.startsWith("<session_context>") || clean.startsWith("[System")) return null;

  const inferredRole: HarvestedUserSignal["inferredRole"] = /\bscout\b|\bknowledge\b|\barchive\b/i.test(
    clean,
  )
    ? "scout"
    : /\btech-lead\b|\btest file\b|\bcheck:ci\b|\bcommit\b/i.test(clean)
      ? "tech-lead"
      : /\bbob\b|\bdesign doc\b|\bproposal\b|\bunified api\b/i.test(clean)
        ? "bob"
        : /\balex\b|\bworkflow\b|\bgym\b|\bstage\b/i.test(clean)
          ? "alex"
          : "may";

  if (
    /\b(?:why|confusing|don't|do not|wrong|instead|remove it|broken|leak|issue|waste|weakness|burden)\b/i.test(
      clean,
    )
  ) {
    return { kind: "failure_correction", inferredRole };
  }
  if (/\b(?:faster|30s|timeout|slow|simplify|consolidate|single file|tidy)\b/i.test(clean)) {
    return { kind: "efficiency_gap", inferredRole };
  }
  if (/\b(?:take all|good|great|merged|solid|right decision)\b/i.test(clean)) {
    return { kind: "success_pattern", inferredRole };
  }
  return null;
}

function makeSignalId(source: string, text: string): string {
  return `${source}-${createHash("sha256").update(text).digest("hex").slice(0, 12)}`;
}

export function harvestSignalsFromSources(
  sources: DiscoveredSessionSources,
  options: { maxSignals?: number; targetRole?: string; seenIds?: Set<string> } = {},
): HarvestedUserSignal[] {
  const maxSignals = options.maxSignals ?? 40;
  const seen = new Set<string>(options.seenIds ?? []);
  const signals: HarvestedUserSignal[] = [];

  const pushCandidate = (
    source: HarvestedUserSignal["source"],
    originRoot: string,
    text: string,
    timestampMs: number,
  ) => {
    const classified = classifyUserSignal(text);
    if (!classified) return;
    if (options.targetRole && classified.inferredRole !== options.targetRole) return;
    const clean = text.replace(/\s+/g, " ").trim();
    const id = makeSignalId(source, clean);
    if (seen.has(id)) return;
    seen.add(id);
    signals.push({
      id,
      source,
      originRoot,
      timestampMs,
      kind: classified.kind,
      userText: clean,
      inferredRole: classified.inferredRole,
    });
  };

  // 1. Gemini logs.json
  for (const logPath of sources.geminiLogFiles) {
    try {
      const entries = JSON.parse(readFileSync(logPath, "utf8")) as Array<{
        type?: string;
        message?: string;
        timestamp?: string;
      }>;
      for (const entry of entries.slice(-80)) {
        if (entry.type === "user" && typeof entry.message === "string") {
          const ts = entry.timestamp ? Date.parse(entry.timestamp) || Date.now() : Date.now();
          pushCandidate("gemini", logPath, entry.message, ts);
        }
      }
    } catch {
      // Ignore malformed log file
    }
  }

  // 2. Codex history.jsonl & thread_history_1.sqlite
  for (const histPath of sources.codexHistoryFiles) {
    try {
      const lines = readFileSync(histPath, "utf8").split("\n").filter(Boolean).slice(-80);
      for (const line of lines) {
        const parsed = JSON.parse(line) as { text?: string; prompt?: string; ts?: number };
        const text = parsed.text ?? parsed.prompt ?? "";
        if (text) pushCandidate("codex", histPath, text, parsed.ts ?? Date.now());
      }
    } catch {
      // Ignore malformed history file
    }
  }

  for (const sqlitePath of sources.codexSqliteFiles) {
    try {
      const db = new Database(sqlitePath, { readonly: true });
      const rows = db
        .query(
          "SELECT item_json, created_at_ms FROM thread_items WHERE item_type = 'userMessage' ORDER BY created_at_ms DESC LIMIT 80",
        )
        .all() as Array<{ item_json: string; created_at_ms: number }>;
      for (const row of rows) {
        const obj = JSON.parse(row.item_json) as { content?: Array<{ text?: string }> };
        const text = (obj.content ?? []).map((c) => c.text ?? "").join(" ");
        if (text) pushCandidate("codex", sqlitePath, text, row.created_at_ms || Date.now());
      }
      db.close();
    } catch {
      // Ignore locked or incompatible sqlite file
    }
  }

  // 3. Pi session JSONLs
  for (const piDir of sources.piSessionDirs) {
    try {
      const files = readdirSync(piDir)
        .filter((f) => f.endsWith(".jsonl"))
        .slice(-15);
      for (const file of files) {
        const fullPath = join(piDir, file);
        const lines = readFileSync(fullPath, "utf8").split("\n").filter(Boolean);
        for (const line of lines) {
          const obj = JSON.parse(line) as {
            type?: string;
            timestamp?: number;
            message?: { role?: string; content?: unknown };
          };
          if (obj.type === "message" && obj.message?.role === "user") {
            const text = Array.isArray(obj.message.content)
              ? (obj.message.content as Array<{ text?: string }>).map((c) => c.text ?? "").join(" ")
              : String(obj.message.content ?? "");
            pushCandidate("pi", fullPath, text, obj.timestamp ?? Date.now());
          }
        }
      }
    } catch {
      // Ignore unreadable session files
    }
  }

  // 4. May SQLite DB (`workflow_runs` error/blocked anomalies)
  for (const mayDbPath of sources.mayDbFiles) {
    let db: Database | undefined;
    try {
      db = new Database(mayDbPath, { readonly: true });
      const hasWorkflowRuns = db
        .query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'workflow_runs'")
        .get();
      if (hasWorkflowRuns) {
        const rows = db
          .query(
            `SELECT COALESCE(app_id, projectId, 'alex') AS appId,
                    workflow,
                    status,
                    COALESCE(result_reason, result_summary, '') AS detail,
                    COALESCE(endedAt, startedAt) AS ts
             FROM workflow_runs
             WHERE status IN ('error', 'blocked')
             ORDER BY COALESCE(endedAt, startedAt) DESC
             LIMIT 40`,
          )
          .all() as Array<{
          appId: string;
          workflow: string;
          status: string;
          detail: string;
          ts: number;
        }>;
        for (const row of rows) {
          const cleanDetail = row.detail.replace(/\s+/g, " ").trim().slice(0, 360);
          const syntheticText = `workflow ${row.appId}/${row.workflow} broken (${row.status}): ${cleanDetail || "unexpected failure"}`;
          pushCandidate("may-db", mayDbPath, syntheticText, row.ts || Date.now());
        }
      }
    } catch {
      // Ignore locked or incompatible may.db file
    } finally {
      db?.close();
    }
  }

  return signals.slice(-maxSignals);
}

/**
 * Validates that a drafted benchmark case contains zero answer leaks and zero
 * references to synthetic `system-state.md` fixtures.
 */
export function validateDraftBenchmarkCase(draft: {
  id: string;
  task: string;
  expectedHumanAnswer: string;
}): { ok: boolean; reason?: string } {
  if (/system-state\.md/i.test(draft.task)) {
    return { ok: false, reason: "Draft task references synthetic system-state.md" };
  }
  if (/\b(?:May|Alex|Bob|Tech-lead|Scout) (?:should|must|may answer)\b/i.test(draft.task)) {
    return {
      ok: false,
      reason: "Draft task leaks prescriptive answer (<Agent> should/must)",
    };
  }
  if (!draft.expectedHumanAnswer.trim()) {
    return { ok: false, reason: "Draft case is missing expectedHumanAnswer" };
  }
  return { ok: true };
}

/**
 * Stages accepted draft benchmark cases into `<gymBenchmarksRoot>/<role>-judgment/cases.json`
 * with `"status": "draft"` (deduplicating by case `id`) so `gym test` can immediately evaluate them.
 */
export function stageDraftCasesToGym(
  lessons: DailyLearningSynthesis["lessons"],
  gymBenchmarksRoot: string,
): string[] {
  const stagedIds: string[] = [];
  for (const lesson of lessons) {
    const check = validateDraftBenchmarkCase(lesson.draftBenchmarkCase);
    if (!check.ok) continue;
    const casesPath = join(gymBenchmarksRoot, `${lesson.role}-judgment`, "cases.json");
    if (!existsSync(casesPath)) continue;
    try {
      const existing = JSON.parse(readFileSync(casesPath, "utf8")) as Array<Record<string, unknown>>;
      const rawId = lesson.draftBenchmarkCase.id
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const caseId = rawId.startsWith(`${lesson.role}-`) ? rawId : `${lesson.role}-${rawId}`;
      if (existing.some((entry) => entry.id === caseId)) continue;
      existing.push({
        id: caseId,
        status: "draft",
        description: lesson.draftBenchmarkCase.description,
        task: lesson.draftBenchmarkCase.task,
        expected: {
          human_answer: lesson.draftBenchmarkCase.expectedHumanAnswer,
          exact: {
            needs_clarification: false,
          },
          contains_groups: {
            response_to_hao: lesson.draftBenchmarkCase.requiredConcepts,
          },
          response_max_words: 100,
        },
      });
      writeFileSync(casesPath, `${JSON.stringify(existing, null, 2)}\n`, "utf8");
      stagedIds.push(caseId);
    } catch {
      // Ignore unparseable or read-only cases.json
    }
  }
  return stagedIds;
}

export async function execute(ctx: AgentContext<LearnFromDailyWorkInput>) {
  const projectRoot = ctx.workspace?.projectRoot ?? ctx.workspace?.root ?? process.cwd();
  const input: LearnFromDailyWorkInput =
    ctx.input && typeof ctx.input === "object" ? (ctx.input as LearnFromDailyWorkInput) : {};

  const cursorPath =
    input.cursorPath?.trim() || join(projectRoot, ".state", "daily-learning-cursor.json");
  let seenIds = new Set<string>();
  if (existsSync(cursorPath)) {
    try {
      const saved = JSON.parse(readFileSync(cursorPath, "utf8")) as { seenIds?: string[] };
      seenIds = new Set(saved.seenIds ?? []);
    } catch {
      // Start fresh if cursor is unreadable
    }
  }

  const sources = discoverSessionSources(projectRoot, input.roots);
  const signals = harvestSignalsFromSources(sources, {
    maxSignals: input.maxSignals ?? 30,
    targetRole: input.targetRole,
    seenIds,
  });

  if (input.dryRun || signals.length === 0) {
    const drySummary =
      signals.length === 0
        ? `No new daily learning signals found across ${sources.scannedRoots.length} root(s).`
        : `Harvested ${signals.length} daily learning signal(s) across ${sources.scannedRoots.length} root(s) (dryRun).`;
    const dryPayload = {
      scannedRoots: sources.scannedRoots,
      signalCount: signals.length,
      acceptedLessonCount: 0,
      signals,
      lessons: [],
    };
    if (input.outputFile?.trim()) {
      writeFileSync(
        resolve(projectRoot, input.outputFile.trim()),
        `${JSON.stringify(dryPayload, null, 2)}\n`,
        "utf8",
      );
    }
    return ctx.done(drySummary, {
      state: "converged",
      summary: drySummary,
      facts: [
        `scannedRoots:${sources.scannedRoots.length}`,
        `signalCount:${signals.length}`,
      ],
      result: dryPayload,
    });
  }

  const prompt = [
    "# Daily Work Signal Synthesis (Multi-Root Container + Localhost)",
    "",
    "Review the harvested user signals below from Gemini, Pi, and Codex sessions.",
    "Extract 1 to 3 high-leverage judgment lessons across agent roles (`may`, `alex`, `bob`, `tech-lead`, `scout`).",
    "",
    "## Hard Benchmark Invariants",
    "- Never mention `system-state.md` in `draftBenchmarkCase.task`.",
    "- Never leak the rule or answer (`May should`, `Bob must`, etc.) inside `draftBenchmarkCase.task`; put only situational facts and the user request in `task`.",
    "",
    "## Harvested Signals",
    JSON.stringify(signals, null, 2),
  ].join("\n");

  const synthesisStep = await ctx.call("bob", prompt, {
    schema: dailyLearningSynthesisSchema,
  });

  if (synthesisStep.status !== "done" || !synthesisStep.output) {
    return ctx.blocked(
      synthesisStep.summary || "bob did not return a valid daily learning synthesis",
    );
  }

  const synthesis = synthesisStep.output as DailyLearningSynthesis;
  const acceptedLessons = synthesis.lessons.filter(
    (lesson) => validateDraftBenchmarkCase(lesson.draftBenchmarkCase).ok,
  );

  // Update cursor so processed signals are not re-processed tomorrow
  mkdirSync(resolve(cursorPath, ".."), { recursive: true });
  const updatedSeen = [...new Set([...seenIds, ...signals.map((s) => s.id)])].slice(-2000);
  writeFileSync(
    cursorPath,
    `${JSON.stringify({ updatedAt: new Date().toISOString(), seenIds: updatedSeen }, null, 2)}\n`,
    "utf8",
  );

  const outputPayload = {
    scannedRoots: sources.scannedRoots,
    signalCount: signals.length,
    acceptedLessonCount: acceptedLessons.length,
    stagedCaseIds: [] as string[],
    lessons: acceptedLessons,
  };
  if (input.stageDraftCases) {
    const defaultBenchmarksRoot = existsSync(join(projectRoot, "projects", "gym", "benchmarks"))
      ? join(projectRoot, "projects", "gym", "benchmarks")
      : join(dirname(dirname(resolve(projectRoot))), "projects", "gym", "benchmarks");
    const benchmarksRoot = input.gymBenchmarksRoot?.trim() || defaultBenchmarksRoot;
    outputPayload.stagedCaseIds = stageDraftCasesToGym(acceptedLessons, benchmarksRoot);
  }
  if (input.outputFile?.trim()) {
    writeFileSync(
      resolve(projectRoot, input.outputFile.trim()),
      `${JSON.stringify(outputPayload, null, 2)}\n`,
      "utf8",
    );
  }

  return ctx.done(synthesis.summary, {
    state: "converged",
    summary: synthesis.summary,
    facts: [
      `scannedRoots:${sources.scannedRoots.length}`,
      `signalCount:${signals.length}`,
      `acceptedLessonCount:${acceptedLessons.length}`,
      ...(outputPayload.stagedCaseIds.length > 0
        ? [`stagedCases:${outputPayload.stagedCaseIds.length}`]
        : []),
    ],
    result: outputPayload,
  });
}
