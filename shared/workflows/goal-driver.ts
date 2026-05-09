/// <reference path="../../types/workflow-defs.d.ts" />

/**
 * goal-driver — experimental project workflow.
 *
 * This workflow treats the project file as useful context, not as authority.
 * The goal is authority; plan items, metrics, artifacts, and session history are
 * signals the owner uses to judge the next useful movement.
 */

import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { WorkflowContext, WorkflowResult } from "../../../src/lib/workflow.js";
import {
  extractField,
  extractMilestones,
  extractSection,
  updateProjectStatus,
} from "./project-helpers.js";

export const name = "goal-driver";

export const description =
  "Experimental goal-driven project workflow: collect live facts, ask owner to judge, run one useful action or escalate.";

interface GoalDriverConfig {
  projectDir: string;
  projectPath: string;
  journalPath: string;
  owner: string;
  worker: string;
  maxCycles: number;
}

interface ProjectFacts {
  id: string;
  status: string;
  stopReason: string;
  iteration: number;
  goal: string;
  currentState: string;
  context: string;
  signals: string;
  plan: ReturnType<typeof extractMilestones>;
  artifacts: string[];
  pendingComments: string;
  recentJournal: string;
}

interface DriverDecision {
  kind: "ACT" | "REPLAN" | "WAITING" | "ESCALATE" | "DONE_THIS_RUN" | "INVALID";
  rationale: string;
  nextAction: string;
  validationSignal: string;
  raw: string;
}

type AgentResult = Awaited<ReturnType<WorkflowContext["runAgent"]>>;

interface AgentTextResult {
  result: AgentResult;
  text: string;
  attempts: number;
}

function field(raw: string, name: string): string | undefined {
  const m = raw.match(new RegExp(`^${name}:\\s*(.+)$`, "m"));
  return m ? m[1].trim() : undefined;
}

function parseInput(raw: string, callingAgent: string): GoalDriverConfig {
  const projectInput = field(raw, "project");
  if (!projectInput) throw new Error("Missing required field: project");
  const projectDir = projectInput.endsWith(".md") ? dirname(projectInput) : projectInput;
  const projectPath = projectInput.endsWith(".md") ? projectInput : join(projectInput, "project.md");
  const journalPath = join(projectDir, "journal.md");
  const owner = field(raw, "owner") ?? field(raw, "agent") ?? callingAgent;
  const worker = field(raw, "worker") ?? field(raw, "agent") ?? owner;
  const maxCycles = Math.max(1, Math.min(5, Number.parseInt(field(raw, "maxCycles") ?? "2", 10) || 2));
  return { projectDir, projectPath, journalPath, owner, worker, maxCycles };
}

function ensureProjectFiles(config: GoalDriverConfig): void {
  if (!existsSync(config.projectPath)) throw new Error(`Project file not found: ${config.projectPath}`);
  if (!existsSync(config.journalPath)) {
    if (!existsSync(config.projectDir)) mkdirSync(config.projectDir, { recursive: true });
    writeFileSync(config.journalPath, "# Journal\n\n", "utf-8");
  }
  const outputsDir = join(config.projectDir, "outputs");
  if (!existsSync(outputsDir)) mkdirSync(outputsDir, { recursive: true });
}

function listArtifacts(projectDir: string): string[] {
  const outputsDir = join(projectDir, "outputs");
  if (!existsSync(outputsDir)) return [];
  return readdirSync(outputsDir)
    .filter((file) => {
      try {
        return statSync(join(outputsDir, file)).isFile();
      } catch {
        return false;
      }
    })
    .sort()
    .map((file) => `outputs/${file}`);
}

function readRecentJournal(journalPath: string, maxChars = 5000): string {
  if (!existsSync(journalPath)) return "";
  const text = readFileSync(journalPath, "utf-8");
  return text.length <= maxChars ? text : text.slice(text.length - maxChars);
}

function readUnreadDiscussion(projectDir: string): string {
  const discussionPath = join(projectDir, "discussion.md");
  if (!existsSync(discussionPath)) return "";
  const content = readFileSync(discussionPath, "utf-8");
  const lastMarker = content.lastIndexOf("---read @");
  if (lastMarker >= 0) {
    const afterMarker = content.indexOf("\n", lastMarker);
    return afterMarker === -1 ? "" : content.slice(afterMarker + 1).trim();
  }
  return content.replace(/^# Discussion\s*/i, "").trim();
}

function markDiscussionRead(projectDir: string, iteration: number): void {
  const discussionPath = join(projectDir, "discussion.md");
  if (!existsSync(discussionPath)) return;
  appendFileSync(discussionPath, `\n---read @goal-driver-iter${iteration}---\n`, "utf-8");
}

function collectFacts(config: GoalDriverConfig): ProjectFacts {
  const content = readFileSync(config.projectPath, "utf-8");
  const id = extractField(content, "Project") || basename(config.projectDir);
  const status = (extractField(content, "Status") || "active").toLowerCase();
  const iteration = Number.parseInt(extractField(content, "Iteration") || "0", 10) || 0;
  return {
    id,
    status,
    stopReason: extractField(content, "Stop Reason"),
    iteration,
    goal: extractSection(content, "Goal"),
    currentState: extractSection(content, "Current State"),
    context: extractSection(content, "Context"),
    signals: extractSection(content, "Signals") || extractSection(content, "Metrics"),
    plan: extractMilestones(content),
    artifacts: listArtifacts(config.projectDir),
    pendingComments: [extractSection(content, "Comments"), readUnreadDiscussion(config.projectDir)].filter(Boolean).join("\n").trim(),
    recentJournal: readRecentJournal(config.journalPath),
  };
}

function updateSection(content: string, heading: string, newContent: string): string {
  const marker = `## ${heading}\n`;
  const idx = content.indexOf(marker);
  if (idx === -1) return `${content.trimEnd()}\n\n${marker}${newContent.trim()}\n`;
  const after = content.slice(idx + marker.length);
  const nextSection = after.search(/\n## /);
  const end = nextSection === -1 ? content.length : idx + marker.length + nextSection;
  return content.slice(0, idx + marker.length) + `${newContent.trim()}\n` + content.slice(end);
}

function updateCurrentState(config: GoalDriverConfig, text: string): void {
  const content = readFileSync(config.projectPath, "utf-8");
  writeFileSync(config.projectPath, updateSection(content, "Current State", text), "utf-8");
}

function appendJournal(config: GoalDriverConfig, entry: string): void {
  appendFileSync(config.journalPath, `${entry.trimEnd()}\n\n`, "utf-8");
}

function compactLine(text: string, maxLength = 180): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLength) return oneLine;
  const prefix = oneLine.slice(0, maxLength);
  const sentenceEnd = prefix.lastIndexOf(".");
  if (sentenceEnd >= 40) return prefix.slice(0, sentenceEnd + 1);
  const wordEnd = prefix.lastIndexOf(" ");
  return `${prefix.slice(0, wordEnd >= 40 ? wordEnd : maxLength).trimEnd()}...`;
}

async function runAgentForText(
  ctx: WorkflowContext,
  agent: string,
  prompt: string,
  attempts = 2,
): Promise<AgentTextResult> {
  let last: AgentResult | null = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    last = await ctx.runAgent(agent, prompt);
    const text = last.lastAssistantText?.trim() ?? "";
    if (text) return { result: last, text, attempts: attempt };
    if (attempt < attempts) {
      ctx.log(`goal-driver: ${agent} produced no assistant text on attempt ${attempt}; retrying`);
    }
  }
  if (!last) throw new Error("runAgentForText called with zero attempts");
  return { result: last, text: "", attempts };
}

function buildDriverPrompt(facts: ProjectFacts, cycle: number): string {
  const pending = facts.plan.pending.length > 0
    ? facts.plan.pending.map((item) => `- [ ] ${item}`).join("\n")
    : "(none)";
  const completed = facts.plan.completed.length > 0
    ? facts.plan.completed.map((item) => `- [x] ${item}`).join("\n")
    : "(none)";
  const artifacts = facts.artifacts.length > 0 ? facts.artifacts.map((a) => `- ${a}`).join("\n") : "(none)";

  return `You are the owner driving a durable goal, not a template.

Mental model:
- Goal is authority.
- Project file, plan items, metrics/signals, artifacts, and journal are evidence.
- Use the project frame when it helps; do not obey stale state blindly.
- Each run should make one useful movement toward the goal or escalate clearly.
- This is the judgment step: answer from the evidence below; the worker step performs changes if needed.
- If the next useful movement is unclear, risky, or requires human judgment, say ESCALATE or WAITING.
- Do not create ceremonial "ready" files or busywork.

## Cycle
${cycle}

## Goal
${facts.goal || "(missing goal)"}

## Current State
Current project metadata is the source of truth for status:
- status=${facts.status}
- stop_reason=${facts.stopReason || "(none)"}
- iteration=${facts.iteration}
${facts.currentState || "(empty)"}

## Signals
${facts.signals || "(no explicit signals)"}

## Plan Signal
Completed (${facts.plan.done}/${facts.plan.total}):
${completed}

Pending:
${pending}

## Artifacts
${artifacts}

## Context
${facts.context || "(empty)"}

## Pending Comments
These are new human/agent comments to judge. Treat comments as evidence and direction, not automatic truth.
${facts.pendingComments || "(none)"}

## Recent Journal
Older journal entries may describe stale status. Treat them as history, not current metadata.
${facts.recentJournal || "(empty)"}

Decide the next movement. Your first line must be exactly one of:
DECISION: ACT
DECISION: REPLAN
DECISION: WAITING
DECISION: ESCALATE
DECISION: DONE_THIS_RUN

Use:
- ACT when a worker should perform a concrete next operation now.
- REPLAN when the current plan/theory is stale and the worker should update direction.
- WAITING when a known precondition is missing.
- ESCALATE when judgment is uncertain or risk is too high.
- DONE_THIS_RUN when no useful action is needed now; durable project may remain active for future checks.

Then include:
RATIONALE: <facts and judgment>
NEXT_ACTION: <what the worker should do, or why no worker should run>
VALIDATION_SIGNAL: <what later signal proves the movement helped>`;
}

export function parseDecision(text: string): DriverDecision {
  const raw = (text ?? "").trim();
  const firstLine = raw.split(/\r?\n/, 1)[0]?.trim() ?? "";
  const match = firstLine.match(/^DECISION:\s*(ACT|REPLAN|WAITING|ESCALATE|DONE_THIS_RUN)\b/i);
  const kind = match ? (match[1].toUpperCase() as DriverDecision["kind"]) : "INVALID";
  const sections: Record<string, string[]> = {};
  let current: string | null = null;
  for (const line of raw.split(/\r?\n/).slice(1)) {
    const heading = line.match(/^(RATIONALE|NEXT_ACTION|VALIDATION_SIGNAL):\s*(.*)$/i);
    if (heading) {
      current = heading[1].toUpperCase();
      sections[current] = [heading[2] ?? ""];
    } else if (current) {
      sections[current].push(line);
    }
  }
  const section = (name: string): string => (sections[name] ?? []).join("\n").trim();
  return {
    kind,
    rationale: section("RATIONALE"),
    nextAction: section("NEXT_ACTION"),
    validationSignal: section("VALIDATION_SIGNAL"),
    raw,
  };
}

function buildWorkerPrompt(facts: ProjectFacts, decision: DriverDecision, config: GoalDriverConfig): string {
  return `You are moving this durable goal forward. Do not do ceremony.

## Goal
${facts.goal}

## Owner Judgment
${decision.rationale || "(no rationale supplied)"}

## Next Useful Movement
${decision.nextAction || "(missing next action; inspect project state and make the smallest useful move)"}

## Validation Signal
${decision.validationSignal || "(record what should validate this movement)"}

## Working Rules
- Make the smallest useful movement toward the goal.
- If the requested move is unsafe or unclear, stop and report exactly why.
- Before editing a file, read the current file contents you will change.
- After every edit/write, read the changed file back and inspect the diff before finishing.
- Prefer updating existing project/context/knowledge files over creating duplicate artifacts.
- Use ${config.projectDir}/outputs only for genuinely useful project artifacts.
- Commit intentional changes in agents/ before finishing.
- End with what changed and what signal should be checked next.`;
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const config = parseInput(ctx.task, ctx.agent);
  ensureProjectFiles(config);

  let facts = collectFacts(config);
  if (facts.status === "cancelled" || facts.status === "paused") {
    return ctx.done(`Project is ${facts.status}.`);
  }

  for (let cycle = 1; cycle <= config.maxCycles; cycle++) {
    facts = collectFacts(config);
    const iteration = facts.iteration + 1;
    const now = new Date().toISOString();

    ctx.emit({ type: "step_start", step: `goal-driver-judge-${cycle}` });
    const judgment = await runAgentForText(ctx, config.owner, buildDriverPrompt(facts, cycle));
    if (!judgment.text) {
      const reason = judgment.result.error || `owner agent ended with status=${judgment.result.status}`;
      appendJournal(config, `### Goal Driver Cycle ${cycle} Runtime Failure — ${now}
**Owner**: ${config.owner}
**Attempts**: ${judgment.attempts}
**Status**: ${judgment.result.status}
**Error**: ${reason}`);
      updateProjectStatus(config.projectPath, "waiting", "Owner agent produced no response", iteration);
      updateCurrentState(config, `Waiting: goal-driver could not collect an owner judgment.
Owner: ${config.owner}
Attempts: ${judgment.attempts}
Status: ${judgment.result.status}
Error: ${reason}`);
      return ctx.escalate("Goal-driver owner agent produced no response.", {
        owner: config.owner,
        status: judgment.result.status,
        error: judgment.result.error,
      });
    }
    const decision = parseDecision(judgment.text);

    appendJournal(config, `### Goal Driver Cycle ${cycle} — ${now}
**Facts**: status=${facts.status}; iteration=${facts.iteration}; plan=${facts.plan.done}/${facts.plan.total}; artifacts=${facts.artifacts.length}; comments=${facts.pendingComments ? "yes" : "no"}
${facts.pendingComments ? `**Pending Comments**: ${facts.pendingComments}\n` : ""}**Decision**: ${decision.kind}
**Rationale**: ${decision.rationale || "(missing)"}
**Next Action**: ${decision.nextAction || "(missing)"}
**Validation Signal**: ${decision.validationSignal || "(missing)"}`);

    if (decision.kind === "INVALID") {
      updateProjectStatus(config.projectPath, "waiting", "Owner judgment did not use goal-driver decision format", iteration);
      updateCurrentState(config, `Waiting: owner judgment did not use the goal-driver decision format. Last raw response:\n${decision.raw.slice(0, 1000)}`);
      return ctx.escalate("Goal-driver owner judgment was not machine-readable.", { raw: decision.raw });
    }

    if (facts.pendingComments) markDiscussionRead(config.projectDir, iteration);

    if (decision.kind === "WAITING") {
      updateProjectStatus(config.projectPath, "waiting", compactLine(decision.rationale || decision.nextAction), iteration);
      updateCurrentState(config, `Waiting: ${decision.rationale || decision.nextAction}\nValidation signal: ${decision.validationSignal || "(missing)"}`);
      return ctx.done(`Waiting: ${decision.rationale || decision.nextAction}`);
    }

    if (decision.kind === "ESCALATE") {
      updateProjectStatus(config.projectPath, "waiting", compactLine(decision.rationale || decision.nextAction), iteration);
      updateCurrentState(config, `Escalated: ${decision.rationale || decision.nextAction}\nValidation signal: ${decision.validationSignal || "(missing)"}`);
      return ctx.escalate(decision.rationale || "Goal-driver owner escalated uncertainty.", { decision: decision.raw });
    }

    if (decision.kind === "DONE_THIS_RUN") {
      updateProjectStatus(config.projectPath, "active", undefined, iteration);
      updateCurrentState(config, `No useful action this run.\nJudgment: ${decision.rationale || "(missing)"}\nNext validation signal: ${decision.validationSignal || "(missing)"}`);
      return ctx.done(decision.rationale || "No useful action this run.");
    }

    ctx.emit({ type: "step_start", step: `goal-driver-worker-${cycle}` });
    const worker = await ctx.runAgent(config.worker, buildWorkerPrompt(facts, decision, config));
    const workerSummary = ctx.summarize(worker, { maxLength: 1500 });
    appendJournal(config, `**Worker Result Cycle ${cycle}**: ${workerSummary}`);

    const afterWorker = collectFacts(config);
    if (afterWorker.status && afterWorker.status !== "active") {
      appendJournal(config, `**Workflow Note Cycle ${cycle}**: Worker left project status as \`${afterWorker.status}\`; preserving it instead of forcing \`active\`.`);
      return ctx.done(`Worker left project ${afterWorker.status}: ${workerSummary.slice(0, 500)}`);
    }

    updateProjectStatus(config.projectPath, "active", undefined, iteration);
    updateCurrentState(config, `Iteration ${iteration} via goal-driver.\nLast decision: ${decision.kind}\nWorker result: ${workerSummary.slice(0, 1000)}\nNext validation signal: ${decision.validationSignal || "(missing)"}`);
  }

  return ctx.done(`Goal-driver completed ${config.maxCycles} cycle(s). Re-run for the next judgment.`);
}
