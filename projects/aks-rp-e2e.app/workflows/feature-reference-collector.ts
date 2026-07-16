/**
 * feature-reference-collector — collect official references for one feature packet.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import {
  workflowResult,
  workflowResultVersion,
  type StructuredWorkflowResult,
  type WorkflowContext,
  type WorkflowIoContract,
  type WorkflowResult,
} from "@may-agent/sdk";
import {
  buildTaskTreeConfig,
  completeStartedAttempt,
  emitTaskCompleted,
  markAttemptStartedOnce,
  taskRevisionFromTrigger,
} from "./default-task-worker.ts";
import {
  field,
  maxConcurrent,
  parseTriggerEvent,
  resolveAppDir,
  resultText,
  sourceDir,
  triggerString,
} from "./lib/workflow-input.ts";
import {
  defaultFeatureReferenceDraftDir,
  defaultFeatureReferenceLoopStatePath,
  featureReferenceCollectorContractVersion,
  featureReferenceQuality,
  loadFeatureReferenceLoopState,
  safeFeatureReferenceFileKey,
  saveFeatureReferenceLoopState,
  updateFeatureReferenceItem,
} from "./lib/feature-reference-loop-store.ts";
import { taskRevision, type TaskNode } from "./lib/task-tree-store.ts";

export const name = "feature-reference-collector";
export const description =
  "Collect Microsoft Learn and Azure REST API spec references for one AKS feature.";
export const workflowContract: WorkflowIoContract = {
  workflow: name,
  version: "feature-reference-collector-v1",
  input: {
    required: ["task.context.featureKey", "task.context.packetPath"],
    optional: [
      "task.context.capabilityId",
      "task.context.referenceFixtureDir",
      "task.context.stateRef",
      "task.context.loopTaskId",
    ],
    description:
      "Collect official public documentation and API references for one feature packet.",
  },
  output: {
    version: workflowResultVersion,
    fields: ["subject", "status", "artifacts", "checks", "problem"],
    description:
      "Reports whether official references were collected and where the draft was written.",
  },
};

type ReferenceHit = {
  source: "learn" | "api";
  path: string;
  title: string;
  claim: string;
};

function taskContext(task: TaskNode): Record<string, unknown> {
  return task.context &&
    typeof task.context === "object" &&
    !Array.isArray(task.context)
    ? (task.context as Record<string, unknown>)
    : {};
}

function contextString(task: TaskNode, key: string, fallback = ""): string {
  const value = taskContext(task)[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function contextNumber(task: TaskNode, key: string, fallback = 0): number {
  const value = taskContext(task)[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function contextStringArray(task: TaskNode, key: string): string[] {
  const value = taskContext(task)[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...listFiles(path));
    } else if (stat.isFile()) {
      files.push(path);
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function tokenSet(values: string[]): string[] {
  const ignored = new Set([
    "feature",
    "features",
    "packet",
    "source",
    "azure",
    "microsoft",
    "learn",
  ]);
  const tokens = values
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !ignored.has(token));
  return [...new Set(tokens)];
}

function matchScore(text: string, tokens: string[]): number {
  const lower = text.toLowerCase();
  return tokens.filter((token) => lower.includes(token)).length;
}

function titleFromContent(path: string, raw: string): string {
  const markdownTitle = raw.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (markdownTitle) return markdownTitle;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const info = parsed.info as Record<string, unknown> | undefined;
    if (typeof info?.title === "string" && info.title.trim())
      return info.title.trim();
    if (typeof parsed.title === "string" && parsed.title.trim())
      return parsed.title.trim();
  } catch {
    // Not JSON.
  }
  return path.replace(/^.*\//, "");
}

function firstUsefulLine(raw: string): string {
  return (
    raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(
        (line) =>
          line &&
          !line.startsWith("#") &&
          !line.startsWith("{") &&
          !line.startsWith("}") &&
          !line.startsWith("[") &&
          !line.startsWith("]"),
      ) || "Reference matched the feature search terms."
  );
}

function collectFixtureReferences(input: {
  fixtureDir: string;
  featureKey: string;
  packetPath: string;
  coveredFeatureIds: string[];
}): ReferenceHit[] {
  const tokens = tokenSet([
    input.featureKey,
    input.packetPath,
    ...input.coveredFeatureIds,
  ]);
  const roots: Array<{ source: "learn" | "api"; dir: string }> = [
    { source: "learn", dir: join(input.fixtureDir, "learn") },
    { source: "api", dir: join(input.fixtureDir, "azure-rest-api-specs") },
  ];
  const hits: Array<ReferenceHit & { score: number }> = [];
  for (const root of roots) {
    for (const file of listFiles(root.dir)) {
      const raw = readFileSync(file, "utf-8");
      const rel = relative(input.fixtureDir, file);
      const score = matchScore(`${rel}\n${raw}`, tokens);
      if (score <= 0) continue;
      hits.push({
        source: root.source,
        path: rel,
        title: titleFromContent(rel, raw),
        claim: firstUsefulLine(raw).slice(0, 240),
        score,
      });
    }
  }
  return hits
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, 16)
    .map(({ score: _score, ...hit }) => hit);
}

function renderReferenceList(hits: ReferenceHit[], source: "learn" | "api") {
  const scoped = hits.filter((hit) => hit.source === source);
  if (scoped.length === 0) return "- No matching reference found yet.";
  return scoped
    .map((hit) => `- ${hit.path}: ${hit.title}. Claim: ${hit.claim}`)
    .join("\n");
}

function referenceTitle(path: string, source: ReferenceHit["source"]): string {
  if (/learn\.microsoft\.com|docs\.microsoft\.com/i.test(path)) {
    return "Microsoft Learn documentation";
  }
  if (/azure-rest-api-specs|specification\/containerservice/i.test(path)) {
    return "Azure REST API spec";
  }
  return source === "learn" ? "Microsoft Learn reference" : "API reference";
}

function firstMatch(line: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match?.[0]) return match[0].replace(/[),.;]+$/, "");
  }
  return "";
}

function extractReferenceHitsFromText(raw: string): ReferenceHit[] {
  const hits = new Map<string, ReferenceHit>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const learnPath = firstMatch(trimmed, [
      /https?:\/\/(?:learn|docs)\.microsoft\.com\/[^\s)]+/i,
      /learn\/[A-Za-z0-9._/-]+/i,
    ]);
    const apiPath = firstMatch(trimmed, [
      /https?:\/\/github\.com\/Azure\/azure-rest-api-specs\/[^\s)]+/i,
      /azure-rest-api-specs\/[A-Za-z0-9._/-]+/i,
      /specification\/containerservice\/[A-Za-z0-9._/-]+/i,
      /(?:managedClusters|agentPools|maintenanceConfigurations|trustedAccessRoleBindings|fleets)\.json/i,
    ]);
    const candidates: Array<{ source: ReferenceHit["source"]; path: string }> =
      [];
    if (learnPath) candidates.push({ source: "learn", path: learnPath });
    if (apiPath) candidates.push({ source: "api", path: apiPath });
    for (const candidate of candidates) {
      const key = `${candidate.source}:${candidate.path}`;
      if (hits.has(key)) continue;
      hits.set(key, {
        source: candidate.source,
        path: candidate.path,
        title: referenceTitle(candidate.path, candidate.source),
        claim: trimmed.replace(/^[-*]\s*/, "").slice(0, 240),
      });
    }
  }
  return [...hits.values()].slice(0, 16);
}

function referencedEvidenceTexts(projectDir: string, raw: string): string[] {
  const refs = [
    ...new Set(raw.match(/evidence\/archive\/[A-Za-z0-9._/-]+\.md/g) ?? []),
  ];
  const texts: string[] = [];
  for (const ref of refs) {
    const absolute = join(projectDir, ref);
    if (!existsSync(absolute)) continue;
    try {
      texts.push(readFileSync(absolute, "utf-8"));
    } catch {
      // Ignore unreadable optional evidence references.
    }
  }
  return texts;
}

function renderDraft(input: {
  featureKey: string;
  packetPath: string;
  packetKind: string;
  layout: string;
  capabilityId: string;
  coveredFeatureIds: string[];
  hits: ReferenceHit[];
  agentNotes?: string;
}): string {
  const covered = input.coveredFeatureIds.length
    ? input.coveredFeatureIds.map((id) => `- ${id}`).join("\n")
    : "- No covered feature ids declared in the packet.";
  const agentNotes = input.agentNotes?.trim()
    ? `\n## Collector Agent Notes\n\n${input.agentNotes.trim()}\n`
    : "";
  return `# Feature Reference: ${input.featureKey}

## Feature

- Key: ${input.featureKey}
- Packet kind: ${input.packetKind}
- Feature folder layout: ${input.layout}
- Capability id: ${input.capabilityId || "not declared"}
- Covered feature ids:
${covered}

## Existing Packet

- ${input.packetPath}

## Official API References

${renderReferenceList(input.hits, "api")}

## Official Documentation References

${renderReferenceList(input.hits, "learn")}

## Behavior Expectations

- Review the API and documentation references above and convert stable behavior into feature packet ground truth.

## Supported Inputs And Constraints

- Draft collector output. Confirm exact supported inputs during packet promotion.

## Unsupported Or Deprecated Behavior

- Draft collector output. Confirm unsupported or deprecated behavior during packet promotion.

## Usage Scenarios

- Draft collector output. Confirm documented usage scenarios during packet promotion.

## Gaps And Contradictions

- Compare these official references with existing specs, scenario tests, and feature packets before promotion.

## Recommended Model Or Spec Updates

- Add stable API references under groundTruth.api.
- Add stable Microsoft Learn references under groundTruth.userDocs.
- Promote branch-specific stable references into features/<capability>/packets/ when the source packet is branch-scoped.
- Add judgment rules where official behavior distinguishes implementation issues, test issues, and environment issues.
${agentNotes}`;
}

function completion(
  ctx: WorkflowContext,
  config: ReturnType<typeof buildTaskTreeConfig>,
  input: {
    task: TaskNode;
    attemptId: string;
    claim: "done" | "partial";
    summary: string;
    workflowResult?: StructuredWorkflowResult;
  },
): WorkflowResult {
  const completed = completeStartedAttempt(config, {
    taskId: input.task.id,
    taskRevision: taskRevision(input.task),
    attemptId: input.attemptId,
    claim: input.claim,
    summary: input.summary,
  });
  if (completed.ok) {
    emitTaskCompleted(ctx, completed.task, {
      taskRevision: taskRevision(input.task),
      attemptId: input.attemptId,
      result: input.claim,
      summary: input.summary,
      workflowResult:
        input.workflowResult ?? referenceCollectorResult(input.task, input),
    });
  }
  return ctx.done(input.summary);
}

function referenceCollectorResult(
  task: TaskNode,
  input: {
    claim: "done" | "partial";
    summary: string;
    artifacts?: string[];
    checks?: StructuredWorkflowResult["checks"];
    problem?: { category: string; diagnosis: string; resumeCondition?: string };
  },
): StructuredWorkflowResult {
  const context = taskContext(task);
  const featureKey = contextString(task, "featureKey", task.id);
  const capabilityId = contextString(task, "capabilityId", featureKey);
  return workflowResult({
    workflow: name,
    workflowVersion: workflowContract.version,
    subject: {
      kind: "feature",
      id: featureKey,
      capabilityId,
    },
    status: input.claim === "done" ? "done" : "partial",
    summary: input.summary,
    artifacts: input.artifacts,
    checks: input.checks,
    problem: input.problem ?? null,
    inputFingerprint: {
      featureKey,
      packetPath:
        typeof context.packetPath === "string" ? context.packetPath : "",
      capabilityId,
    },
  });
}

function collectorPrompt(input: {
  featureKey: string;
  packetPath: string;
  coveredFeatureIds: string[];
}): string {
  return `Collect public official AKS references for feature ${input.featureKey}.

Use only these authorities for public behavior:
- Microsoft Learn documentation under learn.microsoft.com
- Azure REST API specs in Azure/azure-rest-api-specs

Use the local packet ${input.packetPath} only as context. Covered feature ids: ${input.coveredFeatureIds.join(", ") || "none"}.

Return concise Markdown with:
- API references and the claim each reference proves
- Microsoft Learn references and the claim each reference proves
- behavior expectations
- supported inputs and constraints
- unsupported or deprecated behavior
- usage scenarios
- gaps or contradictions against current local knowledge
- recommended model or spec updates`;
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectDir = field(ctx.task, "project") ?? "/app/projects/aks-rp-e2e";
  const appDir = resolveAppDir(projectDir, field(ctx.task, "app"));
  sourceDir(ctx.task);
  const trigger = parseTriggerEvent(ctx.task);
  const config = buildTaskTreeConfig(
    ctx,
    appDir,
    projectDir,
    maxConcurrent(ctx.task, trigger),
  );

  if (trigger?.type !== "project.task.assigned") {
    return ctx.done(
      `Feature reference collector ignored trigger ${String(trigger?.type ?? "unknown")}; use project.task.assigned.`,
    );
  }

  const taskId =
    triggerString(trigger, "taskId") ||
    triggerString(trigger, "task_id") ||
    field(ctx.task, "taskId");
  const attemptId =
    triggerString(trigger, "attemptId") || triggerString(trigger, "attempt_id");
  if (!taskId || !attemptId) {
    return ctx.done(
      "Feature reference collector requires taskId and attemptId.",
    );
  }

  const start = markAttemptStartedOnce(config, {
    taskId,
    taskRevision: taskRevisionFromTrigger(trigger),
    attemptId,
  });
  if (start.ok === false) return ctx.done(start.reason);
  const task = start.task;
  const featureKey = contextString(task, "featureKey");
  const packetPath = contextString(task, "packetPath");
  const packetKind = contextString(task, "packetKind", "feature");
  const layout = contextString(task, "layout", "migration-root-feature");
  const capabilityId = contextString(task, "capabilityId");
  const coveredFeatureIds = contextStringArray(task, "coveredFeatureIds");
  const stateRef = contextString(
    task,
    "stateRef",
    defaultFeatureReferenceLoopStatePath(appDir),
  );
  const loopTaskId = contextString(
    task,
    "loopTaskId",
    "aks-feature-reference-loop",
  );
  const draftDir = contextString(
    task,
    "draftDir",
    defaultFeatureReferenceDraftDir(projectDir),
  );
  const referenceFixtureDir = contextString(task, "referenceFixtureDir");
  const attemptNumber = contextNumber(task, "attemptNumber", 0);
  const runDate =
    contextString(task, "runDate") ||
    new Date().toISOString().slice(0, 10).replace(/-/g, "");

  const statePath = stateRef.startsWith("/")
    ? stateRef
    : join(appDir, stateRef);
  const { state } = loadFeatureReferenceLoopState({
    appDir,
    projectDir,
    loopTaskId,
    windowSize: 5,
    statePath,
  });

  if (!featureKey || !packetPath) {
    const summary = `Task ${task.id} is missing featureKey or packetPath.`;
    return completion(ctx, config, {
      task,
      attemptId,
      claim: "partial",
      summary,
      workflowResult: referenceCollectorResult(task, {
        claim: "partial",
        summary,
        problem: {
          category: "feature-reference-task-input",
          diagnosis: summary,
        },
      }),
    });
  }

  updateFeatureReferenceItem(state, featureKey, {
    status: "running",
    attempts: Math.max(
      state.features[featureKey]?.attempts ?? 0,
      attemptNumber || (state.features[featureKey]?.attempts ?? 0) + 1,
    ),
  });
  saveFeatureReferenceLoopState(statePath, state);

  let hits: ReferenceHit[] = [];
  let agentNotes = "";
  if (referenceFixtureDir) {
    hits = collectFixtureReferences({
      fixtureDir: referenceFixtureDir,
      featureKey,
      packetPath,
      coveredFeatureIds,
    });
    if (hits.length === 0) {
      const summary = `No fixture references matched ${featureKey}.`;
      updateFeatureReferenceItem(state, featureKey, {
        status: "error",
        lastSummary: summary,
        collectorContractVersion: featureReferenceCollectorContractVersion,
      });
      saveFeatureReferenceLoopState(statePath, state);
      return completion(ctx, config, {
        task,
        attemptId,
        claim: "partial",
        summary,
        workflowResult: referenceCollectorResult(task, {
          claim: "partial",
          summary,
          problem: {
            category: "feature-reference-fixture-match",
            diagnosis: summary,
          },
        }),
      });
    }
  } else {
    const result = await ctx.runAgent(
      ctx.agent,
      collectorPrompt({ featureKey, packetPath, coveredFeatureIds }),
      { timeoutMs: 1_800_000 },
    );
    agentNotes = resultText(result);
    if (!agentNotes.trim()) {
      const summary = `Official reference collection for ${featureKey} produced no usable notes.`;
      updateFeatureReferenceItem(state, featureKey, {
        status: "error",
        lastSummary: summary,
        collectorContractVersion: featureReferenceCollectorContractVersion,
      });
      saveFeatureReferenceLoopState(statePath, state);
      return completion(ctx, config, {
        task,
        attemptId,
        claim: "partial",
        summary,
        workflowResult: referenceCollectorResult(task, {
          claim: "partial",
          summary,
          problem: {
            category: "feature-reference-agent-output",
            diagnosis: summary,
          },
        }),
      });
    }
    hits = extractReferenceHitsFromText(
      [agentNotes, ...referencedEvidenceTexts(projectDir, agentNotes)].join(
        "\n\n",
      ),
    );
  }

  const absoluteDraftDir = draftDir.startsWith("/")
    ? draftDir
    : join(projectDir, draftDir);
  const outputPath = join(
    absoluteDraftDir,
    `feature-reference-${safeFeatureReferenceFileKey(featureKey)}-${runDate}.md`,
  );
  mkdirSync(dirname(outputPath), { recursive: true });
  const draft = renderDraft({
    featureKey,
    packetPath,
    packetKind,
    layout,
    capabilityId,
    coveredFeatureIds,
    hits,
    agentNotes,
  });
  writeFileSync(outputPath, draft, "utf-8");
  const relativeOutput = relative(projectDir, outputPath);
  const quality = featureReferenceQuality(draft);
  if (quality.missing.length > 0) {
    const summary = `Official reference collection for ${featureKey} is incomplete: missing ${quality.missing.join(" and ")}. Draft: ${relativeOutput}.`;
    updateFeatureReferenceItem(state, featureKey, {
      status: "error",
      lastOutputPath: relativeOutput,
      lastSummary: summary,
      collectorContractVersion: featureReferenceCollectorContractVersion,
    });
    saveFeatureReferenceLoopState(statePath, state);
    return completion(ctx, config, {
      task,
      attemptId,
      claim: "partial",
      summary,
      workflowResult: referenceCollectorResult(task, {
        claim: "partial",
        summary,
        artifacts: [relativeOutput],
        checks: quality.missing.map((missing) => ({
          name: `reference-${missing}`,
          status: "fail",
          detail: `Draft is missing ${missing}.`,
        })),
        problem: {
          category: "feature-reference-quality",
          diagnosis: summary,
        },
      }),
    });
  }
  const summary = `Collected official feature references for ${featureKey}: ${relativeOutput}.`;
  updateFeatureReferenceItem(state, featureKey, {
    status: "done",
    lastOutputPath: relativeOutput,
    lastSummary: summary,
    collectorContractVersion: featureReferenceCollectorContractVersion,
  });
  saveFeatureReferenceLoopState(statePath, state);
  return completion(ctx, config, {
    task,
    attemptId,
    claim: "done",
    summary,
    workflowResult: referenceCollectorResult(task, {
      claim: "done",
      summary,
      artifacts: [relativeOutput],
      checks: [
        { name: "official-learn-reference", status: "pass" },
        { name: "official-api-reference", status: "pass" },
      ],
    }),
  });
}
