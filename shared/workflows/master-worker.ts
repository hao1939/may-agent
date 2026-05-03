/// <reference path="../../types/workflow-defs.d.ts" />

/**
 * master-worker — Two persistent sessions (orchestrator + worker) running
 * a review-first → work → review → work loop.
 *
 * Project.md fields:
 *   **Workflow**: master-worker          (selects this workflow)
 *   **Max Iterations**: 5               (optional, default 5)
 *   **Status**: active/paused/cancelled/blocked/waiting/done
 *   **Owner**: bob
 *
 * Usage via CLI:
 *   bun src/app/may.ts --run-workflow master-worker "project: agents/shared/projects/my-project"
 */

import { readFileSync, existsSync, writeFileSync, appendFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import {
  extractField, extractSection, updateProjectStatus,
} from "./project-helpers.ts";
import { validateDispatch } from "./dispatch-validator.ts";
import {
  saveIncrementalCheckpoint,
  detectIncompleteCheckpoint,
  markCheckpointComplete,
  cleanupCheckpoints,
  type CheckpointData,
} from "./incremental-checkpoint.ts";
import { validateOutput, type ValidationResult } from "./output-validator.ts";
import { withRetry, isRetryableError } from "./provider-retry.ts";
import { withWorkerRetry, isWorkerRetryable } from "./worker-retry.ts";
import { estimateComplexity } from "./complexity-estimator.ts";
import { IterationTimer } from "./iteration-timer.ts";
import { recordIteration } from "../lib/iteration-monitor.ts";
import { recordUsage } from "../lib/cost-tracker.ts";
import { createBudget, type Budget as IterationBudget } from "./iteration-budget.ts";

// Global iteration timer for observability
const iterationTimer = new IterationTimer();

export const name: string = "master-worker";

export const description: string =
  "Two-session workflow: orchestrator directs strategy, worker executes. " +
  "Review-first pattern ensures focused work from iteration 1.";

// ── Config ──────────────────────────────────────────────────────────────

const DEFAULT_MAX_ITERATIONS = 50; // safety cap — workflow runs until done/blocked/waiting

// ── Decision extraction ─────────────────────────────────────────────────

interface Decision {
  status: "continue" | "pivot" | "waiting" | "blocked" | "done" | "unknown";
  detail: string;
}

export function extractDecision(text: string): Decision {
  const trimmed = text.trim();
  const firstLine = trimmed.split("\n")[0] || "";
  const upper = firstLine.toUpperCase();

  // Check first line starts with a decision keyword
  for (const s of ["CONTINUE", "PIVOT", "WAITING", "BLOCKED"] as const) {
    if (upper.startsWith(s)) {
      return { status: s.toLowerCase() as Decision["status"], detail: trimmed.slice(0, 500) };
    }
  }

  // Check for DONE/COMPLETE — project is finished, stop dispatching
  if (upper.startsWith("DONE") || upper.startsWith("COMPLETE")) {
    return { status: "done", detail: trimmed.slice(0, 500) };
  }

  // Check for "Decision: KEYWORD", "**KEYWORD**", or "**Proceed**" patterns
  const decisionPattern = /(?:\*{0,2}Decision\*{0,2}[:\s]+\*{0,2}|^|\n)\*{0,2}(CONTINUE|PIVOT|BLOCKED|WAITING)\*{0,2}/im;
  const patternMatch = trimmed.match(decisionPattern);
  if (patternMatch) {
    return { status: patternMatch[1].toLowerCase() as Decision["status"], detail: trimmed.slice(0, 500) };
  }

  // "Proceed" / "move forward" / "start working" → CONTINUE
  if (/\b(proceed|move forward|start working|begin work|let'?s begin|let'?s start)\b/i.test(trimmed)) {
    return { status: "continue", detail: trimmed.slice(0, 500) };
  }

  // Fallback: scan for uppercase keywords (including DONE/COMPLETE for project completion)
  for (const keyword of ["CONTINUE", "PIVOT", "BLOCKED", "WAITING"] as const) {
    if (new RegExp(`\\b${keyword}\\b`).test(trimmed)) {
      return { status: keyword.toLowerCase() as Decision["status"], detail: trimmed.slice(0, 500) };
    }
  }

  // Fallback DONE/COMPLETE detection (after other keywords to avoid false positives)
  if (/\b(DONE|COMPLETE|COMPLETED)\b/.test(trimmed) && /\b(project|all\s+metrics|all\s+milestones|stop\s+dispatching)\b/i.test(trimmed)) {
    return { status: "done", detail: trimmed.slice(0, 500) };
  }

  return { status: "unknown", detail: trimmed.slice(0, 500) };
}

// ── System prompts ──────────────────────────────────────────────────────

export function orchestratorSystemPrompt(projectDir: string): string {
  return `You are the orchestrator and project maintainer.
Your role: assess state, direct the worker, verify deliverables, update project.md.

The project directory is: ${projectDir}
You are the ONLY authority on project status. The worker cannot see or edit project.md.

You MUST update project.md directly:
- Check off plan items when you verify the deliverable exists and works
- Update Current State with findings and decisions
- When you reach "Re-plan", review metrics and write new plan items + another Re-plan
- Keep Status as: active (working), waiting (need input), or blocked (something broken)
- Your job is to keep the project moving. When plan items are done, write new ones.

You can read any file to verify claims. You can edit project.md. Do NOT edit other files.

Your job is to PUSH THE PROJECT FORWARD:
1. Understand the goal. Metrics are signals, not the goal itself.
2. Design good metrics that measure real progress toward the goal. Refine them as you learn.
3. Do the work that moves metrics toward targets — the actual improvement, not just measurement.
4. When plan items are done, write new ones based on what you learned.

Metrics tell you where you are. The work is what gets you there.
Good metrics are measurable, connected to the goal, and have clear targets.
Bad metrics get gamed or ignored. If a metric doesn't drive real progress, redefine it.

Respond with one of these decisions as the VERY FIRST WORD:
CONTINUE — guide the next iteration. If metrics are at target, raise them or find new problems.
PIVOT — current approach isn't working, try something different.
DONE — all plan items complete AND all metrics at target. Project is finished.
BLOCKED — something external is broken that you cannot fix.
WAITING — you need something specific from a human (approval, credentials, access). Say exactly what.

Push forward on real goals. But recognize when a project is DONE:
- If ALL plan items are checked off AND ALL metrics are at/above target → say DONE.
- Do NOT invent new work (extra tests, tooling, docs) after goals are met. That's busywork.
- Expanding scope requires explicit new goals from the project owner, not the orchestrator.

Example response format:
CONTINUE

(a) Next iteration should produce...
(b) What's different...
(c) First step...

VERIFICATION RULE: After each worker iteration, verify deliverables exist with read() or bash(ls).
If the worker claims success but files don't exist, the worker is wrong.
If 3+ consecutive iterations produce no files, WRITE THE FILE YOURSELF or provide exact content in guidance.`;
}

export function workerSystemPrompt(projectDir: string): string {
  const outputsDir = projectDir + "/outputs";
  return `You are a worker. You receive focused tasks and produce concrete deliverables.

Your outputs directory: ${outputsDir}
Put ALL deliverables (reports, code, analysis) in this directory.

Rules:
- All deliverables go in ${outputsDir}
- Do NOT edit project.md, journal.md, or discussion.md
- Focus on the specific task in the guidance
- When done, summarize what you created and where

WRITE-FIRST CONSTRAINT:
- When your task says to write or produce a file, your FIRST tool call MUST be write().
- Do NOT use read() or bash() to "check if files exist" before writing. Just write.
- Do NOT claim files "already exist" without verifying via read(). False completion claims are a critical failure mode.
- If your task provides the content to write, write it immediately. Do not scan, explore, or verify first.

SESSION CONTRACT:
- You are starting a FRESH session. Your job is to produce FILES, not verify state.
- If the task seems "already done": produce a verification report or improvement.
- If truly nothing remains: write a completion-evidence file documenting WHY with specific tool output.
- An empty session (0 files produced) is always a failure, regardless of project state.`;
}

// ── Output verification ─────────────────────────────────────────────────

/** Snapshot file mtimes in a directory (recursive, 2 levels deep) */
export function snapshotOutputs(dir: string): Map<string, number> {
  const snap = new Map<string, number>();
  if (!existsSync(dir)) return snap;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isFile()) {
        snap.set(full, statSync(full).mtimeMs);
      } else if (entry.isDirectory()) {
        for (const sub of readdirSync(full, { withFileTypes: true })) {
          if (sub.isFile()) {
            const subFull = join(full, sub.name);
            snap.set(subFull, statSync(subFull).mtimeMs);
          }
        }
      }
    }
  } catch {}
  return snap;
}

/** Compare before/after snapshots, return list of new or modified files */
export function diffSnapshots(before: Map<string, number>, after: Map<string, number>): string[] {
  const changed: string[] = [];
  for (const [path, mtime] of after) {
    const prev = before.get(path);
    if (prev === undefined || mtime > prev) {
      changed.push(path);
    }
  }
  return changed;
}

// ── Main ────────────────────────────────────────────────────────────────

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // ── Parse project dir from task ──
  const projectMatch = ctx.task?.match(/project:\s*(\S+)/);
  if (!projectMatch) {
    return ctx.escalate("Usage: --input \"project: <path-to-project-dir>\"");
  }

  const projectDir = resolve(ctx.projectRoot, projectMatch[1]);
  const projectFile = join(projectDir, "project.md");
  const journalFile = join(projectDir, "journal.md");

  // Pre-flight validation via dispatch-validator
  const validation = validateDispatch(ctx.task, ctx.projectRoot);
  if (!validation.valid) {
    return ctx.escalate(`Dispatch validation failed:\n${validation.errors.join("\n")}`);
  }

  if (!existsSync(projectFile)) {
    ctx.log?.(`Skipping: no project.md at ${projectFile}`);
    return { status: "skipped", reason: "project-not-found", path: projectFile };
  }

  // Ensure journal exists
  if (!existsSync(journalFile)) {
    writeFileSync(journalFile, "# Journal\n", "utf-8");
  }

  // ── Read project files ──
  let projectContent = readFileSync(projectFile, "utf-8");
  const journalContent = readFileSync(journalFile, "utf-8");

  const goal = extractSection(projectContent, "Goal") || extractField(projectContent, "Goal") || "See project.md";
  const status = extractField(projectContent, "Status").toLowerCase();
  const maxIterations = parseInt(extractField(projectContent, "Max Iterations")) || DEFAULT_MAX_ITERATIONS;

  if (status === "paused" || status === "cancelled" || status === "done" || status === "complete" || status === "completed") {
    return ctx.done(`Project status: ${status}. Skipping.`);
  }

  // Check if already done with no pending comments
  if (status === "closed") {
    // Check discussion.md for unread comments
    const discFile = join(projectDir, "discussion.md");
    let hasUnread = false;
    try {
      if (existsSync(discFile)) {
        const disc = readFileSync(discFile, "utf-8");
        const lastMarker = disc.lastIndexOf("---read @");
        const unread = lastMarker >= 0 ? disc.slice(disc.indexOf("\n", lastMarker) + 1).trim() : disc.replace(/^# Discussion\s*/, "").trim();
        hasUnread = !!unread;
      }
    } catch {}
    if (!hasUnread) return ctx.done("Project is closed. No unread comments.");
  }

  ctx.log(`[master-worker] ${projectMatch[1]} | status: ${status} | max-iter: ${maxIterations}`);

  // ── Create sessions ──
  const orchestrator = await ctx.createSession({
    systemPrompt: orchestratorSystemPrompt(projectDir),
    tools: "full",
    label: "orchestrator",
  });

  const worker = await ctx.createSession({
    systemPrompt: workerSystemPrompt(dirname(projectDir)),
    tools: "full",
    label: "worker",
  });

  try {
    // ── Phase 1: Planning — orchestrator assesses current state ──
    ctx.log("[plan] Orchestrator assessing project state...");

    // Aggregate cross-project metrics for orchestrator awareness
    const projectsBaseDir = dirname(projectDir);

    let planningPrompt = `Assess this project and decide what to do next.

## project.md
${projectContent}

## journal.md (last 3000 chars)
${journalContent.slice(-3000)}
`;

    // Handle pending comments from discussion.md
    const discussionFile = join(projectDir, "discussion.md");
    let unreadComments = "";
    try {
      if (existsSync(discussionFile)) {
        const disc = readFileSync(discussionFile, "utf-8");
        const lastMarker = disc.lastIndexOf("---read @");
        const unread = lastMarker >= 0 ? disc.slice(disc.indexOf("\n", lastMarker) + 1).trim() : disc.replace(/^# Discussion\s*/, "").trim();
        if (unread) unreadComments = unread;
      }
    } catch {}
    if (unreadComments) {
      planningPrompt += `\n## Unread Comments (address these)\n${unreadComments}\n`;
    }

    planningPrompt += `\nBased on your assessment, provide your decision and guidance for the worker.`;

    await withRetry(() => orchestrator.prompt(planningPrompt), {
      maxRetries: 3,
      baseDelayMs: 1000,
      onRetry: (err, attempt, delay) => ctx.log(`[plan] ⚠️ Provider error, retry ${attempt} after ${delay}ms: ${String(err).slice(0, 80)}`),
    });


    // Mark comments as read (append-only, never delete)
    if (unreadComments) {
      try {
        appendFileSync(discussionFile, `\n---read @plan---\n`, "utf-8");
      } catch {}
    }

    let decision = extractDecision(orchestrator.lastText());
    ctx.log(`[plan] Decision: ${decision.status.toUpperCase()}`);

    // Treat "unknown" as CONTINUE for the planning phase — orchestrator gave guidance but didn't use the keyword
    if (decision.status === "unknown") {
      ctx.log("[plan] Decision unclear — treating as CONTINUE");
      decision.status = "continue";
    }

    if (decision.status !== "continue" && decision.status !== "pivot") {
      const stopReason = decision.detail.slice(0, 200);
      // Workflow can set waiting, blocked, or done
      const safeStatus = decision.status;
      updateProjectStatus(projectFile, safeStatus === "done" ? "closed" : safeStatus, stopReason);
      return safeStatus === "blocked"
        ? ctx.escalate(stopReason)
        : ctx.done(`${safeStatus}: ${stopReason}`);
    }

    // ── Phase 2+: Work-review loop ──
    let iteration = 0;

    // Clean up old checkpoints at workflow start
    cleanupCheckpoints(projectDir, 5);

    while (iteration < maxIterations && (decision.status === "continue" || decision.status === "pivot")) {
      iteration++;

      // ── Work phase ──
      ctx.log(`[work] Iteration ${iteration}/${maxIterations} starting...`);
      const iterationId = `iter-${iteration}`;
      iterationTimer.startIteration(iterationId);
      const guidance = orchestrator.lastText();

      // Estimate task complexity and set appropriate timeout
      const complexity = estimateComplexity(guidance);
      ctx.log(`[work] 📊 Complexity: ${complexity.score}/5 (${complexity.description}), timeout: ${complexity.timeoutMs}ms`);

      // Create iteration budget based on complexity score
      const iterBudget = createBudget(complexity.score);
      const budgetConfig = iterBudget.getConfig();
      ctx.log(`[work] 💰 Budget: ${budgetConfig.maxTimeMs / 1000}s time, ${budgetConfig.maxTokens} tokens`);

      const outputsDir = join(dirname(projectDir), "outputs");

      // Generate a session-scoped checkpoint ID for this iteration
      const checkpointSessionId = `iter-${iteration}-${Date.now()}`;

      // Detect incomplete checkpoint from a previous crashed iteration
      const incompleteCheckpoint = detectIncompleteCheckpoint(projectDir);
      if (incompleteCheckpoint) {
        ctx.log(`[work] 🔄 Found incomplete checkpoint from session ${incompleteCheckpoint.sessionId} (iteration ${incompleteCheckpoint.iteration}, step ${incompleteCheckpoint.step}). Resuming context.`);
        // Mark the old one complete so we don't re-detect it
        markCheckpointComplete(projectDir, incompleteCheckpoint.sessionId);
      }

      // Track consecutive zero-output iterations for escalation
      if (typeof (ctx as any)._consecutiveZeroOutput === 'undefined') {
        (ctx as any)._consecutiveZeroOutput = 0;
      }
      const MAX_ZERO_OUTPUT = 3;

      // Snapshot outputs before worker runs
      const beforeSnap = snapshotOutputs(outputsDir);

      // V3 GUARDRAIL: Pre-create stub file for write-first tasks
      let stubFilePath: string | null = null;
      const writeFirstFileMatch = guidance.match(/(?:write|produce|create|generate)\s*\(?[`']([^`']+)[`']/i)
        || guidance.match(/outputs\/([^\s`'*]+)/i);
      if (writeFirstFileMatch) {
        const targetFile = writeFirstFileMatch[1].startsWith('outputs/')
          ? writeFirstFileMatch[1]
          : writeFirstFileMatch[0].startsWith('outputs/')
            ? writeFirstFileMatch[0].match(/outputs\/[^\s`'*)]+/)?.[0] || null
            : null;
        if (targetFile) {
          stubFilePath = join(outputsDir, '..', targetFile);
          const stubContent = `<!-- STUB: This file was pre-created by the workflow. Replace this content with your deliverable. -->\n`;
          writeFileSync(stubFilePath, stubContent, 'utf-8');
          ctx.log(`[work] 📝 V3: Pre-created stub file: ${targetFile}`);
        }
      }

      // Worker gets ONLY the orchestrator's guidance — no project.md access
      let workerPrompt = `## Task (Iteration ${iteration})\n${guidance}`;
      if (stubFilePath) {
        const relPath = stubFilePath.replace(/.*?(outputs\/)/, 'outputs/');
        workerPrompt = `## Task (Iteration ${iteration})\nWRITE-FIRST CONSTRAINT:\n- A stub file has been pre-created at \`${relPath}\`. Your FIRST tool call MUST be edit() to replace the stub content.\n- Use this structure for your first edit:\n\n# [Task Summary]\n## Status: IN_PROGRESS\n## What I know so far\n[1-2 sentences: what the task needs]\n## My plan\n[numbered steps]\n## Work output below\n[your actual deliverable content starts here]\n\n- After this first edit, continue working normally. Update the file as you make progress.\n\n${guidance}`;
      }

      // EXP-500: Pre-read injection for edit tasks targeting existing files
      if (!stubFilePath) {
        const editTargetMatch = guidance.match(/(?:edit|update|modify|change|fix|replace|add to|append)\s+(?:in\s+)?[`']([^`']+)[`']/i)
          || guidance.match(/(?:edit|update|modify)\s+(\S+\.\w{1,5})/i);
        if (editTargetMatch) {
          const targetFile = editTargetMatch[1];
          const candidates = [
            join(outputsDir, targetFile),
            join(outputsDir, '..', targetFile),
            targetFile.startsWith('/') ? targetFile : join(projectDir, targetFile),
          ];
          for (const candidate of candidates) {
            try {
              if (existsSync(candidate) && statSync(candidate).isFile() && statSync(candidate).size < 50000) {
                const content = readFileSync(candidate, 'utf-8');
                const lines = content.split('\n');
                const preview = lines.slice(0, 200).join('\n');
                const truncated = lines.length > 200 ? `\n[... ${lines.length - 200} more lines truncated]` : '';
                workerPrompt += `\n\n---\nCURRENT FILE STATE (auto-injected for accurate edit):\nPath: ${candidate}\n\`\`\`\n${preview}${truncated}\n\`\`\`\nUse exact text from above as oldText in edit() calls.`;
                ctx.log(`[work] EXP-500: Pre-read injected ${candidate} (${lines.length} lines)`);
                break;
              }
            } catch { /* skip unreadable files */ }
          }
        }
      }

      // EXP-510: Completion quality injection for worker sessions
      workerPrompt += `\n\n---\nCOMPLETION REQUIREMENTS (structural — do not skip):\n1. Produce at least one file write/edit as deliverable evidence\n2. VERIFICATION GATE (mandatory): For every file you write() or edit(), you MUST read() it back BEFORE calling finish(). Your finish() call will be rejected if deliverables include files you haven't read after modifying. List each verified file in your summary.\n3. Call finish() with: status ('success'|'partial'|'failure'), summary (1-2 sentences of what you did), and deliverables (list of files modified)\n4. If task cannot be completed, finish(status:'blocked') with explanation\n\nDo NOT call finish({}) with empty input. Your finish() call IS your deliverable receipt.\n5. PATH RULE: ALL file paths must be relative to the project root (e.g. agents/bob/workspace/file.md). NEVER use absolute paths (/Users/*, /home/*, /root/*, ~/*).`;
      ctx.log(`[work] EXP-510: Completion quality block injected`);

      // EXP-565: Threat-framed verify-after-edit gate (proven +100pp in gym)
      workerPrompt += `\n\n⚠️ VERIFY-AFTER-EDIT RULE (session REJECTED if violated):\nAfter EVERY write() or edit() call, you MUST immediately read() the same file to confirm the change landed correctly. If you call finish() without verifying each modified file, your session will be REJECTED and marked as a failure. This is non-negotiable.`;
      ctx.log(`[work] EXP-565: Threat-framed verify-after-edit gate injected`);

      // EXP-720: Few-shot dry-run logging (measure match rate before full injection)
      try {
        const { selectExamples } = await import("./fewshot-inject-helpers.js");
        const matches = selectExamples(guidance);
        if (matches.length > 0) {
          const logLine = JSON.stringify({
            ts: new Date().toISOString(),
            iteration,
            matchedFiles: matches,
            guidancePreview: guidance.slice(0, 200),
          });
          appendFileSync("agents/shared/exp720-fewshot-dryrun.log", logLine + "\n");
          ctx.log(`[work] EXP-720 dry-run: ${matches.length} few-shot match(es) — NOT injected yet`);
        }
      } catch { /* EXP-720: non-critical — don't break worker flow */ }

      await withRetry(() => worker.prompt(workerPrompt), {
        maxRetries: 3,
        baseDelayMs: 1000,
        onRetry: (err, attempt, delay) => ctx.log(`[work] ⚠️ Provider error on worker, retry ${attempt} after ${delay}ms: ${String(err).slice(0, 80)}`),
      });
      ctx.log(`[work] Iteration ${iteration} done`);

      // Track budget consumption (approximate tokens from response length)
      const approxTokens = Math.ceil(worker.lastText().length / 4);
      iterBudget.consume(approxTokens);
      const budgetStatus = iterBudget.check();
      if (budgetStatus.exceeded) {
        ctx.log(`[work] ⚠️ Budget exceeded! time=${budgetStatus.timeExceeded}, tokens=${budgetStatus.tokensExceeded} (consumed ~${approxTokens} tokens)`);
      } else {
        ctx.log(`[work] 💰 Budget OK: ${budgetStatus.tokensRemaining} tokens remaining, ${Math.round(budgetStatus.timeRemaining / 1000)}s time remaining`);
      }

      // End iteration timer and log duration
      const timing = iterationTimer.endIteration(iterationId);
      ctx.log(`[work] ⏱️ Iteration ${iteration} took ${timing.durationFormatted}`);
      const stats = iterationTimer.getStats();
      if (stats.count > 1) {
        ctx.log(`[work] 📈 Stats: avg=${Math.round(stats.avg)}ms, median=${Math.round(stats.median)}ms, p95=${Math.round(stats.p95)}ms (n=${stats.count})`);
      }

      // Save incremental checkpoint after worker completes
      saveIncrementalCheckpoint(projectDir, {
        sessionId: checkpointSessionId,
        iteration,
        step: 1,
        timestamp: Date.now(),
        task: guidance.slice(0, 500),
        toolsCalled: ["worker.prompt"],
        partialResults: { workerResponseLength: worker.lastText().length },
        completed: false,
      });

      // Verify worker produced output
      const afterSnap = snapshotOutputs(outputsDir);
      let changedFiles = diffSnapshots(beforeSnap, afterSnap);

      // V3 GUARDRAIL: Check if stub file was left unchanged (< 100 bytes = still a stub)
      if (stubFilePath && changedFiles.length > 0) {
        const stubIdx = changedFiles.indexOf(stubFilePath);
        if (stubIdx !== -1) {
          try {
            const fileSize = statSync(stubFilePath).size;
            if (fileSize < 100) {
              ctx.log(`[work] ⚠️ V3: Stub file ${stubFilePath.split('/').pop()} still < 100 bytes (${fileSize}B) — treating as zero output`);
              changedFiles.splice(stubIdx, 1);
            }
          } catch {}
        }
      }
      if (changedFiles.length === 0) {
        (ctx as any)._consecutiveZeroOutput++;
        const consecutive = (ctx as any)._consecutiveZeroOutput;
        ctx.log(`[work] ⚠️ WARNING: Iteration ${iteration} produced NO output files (${consecutive}/${MAX_ZERO_OUTPUT} consecutive)`);
        appendFileSync(journalFile, `\n### Iteration ${iteration} — ${new Date().toISOString()}\n**⚠️ No output files produced (${consecutive} consecutive failures)**\n`, "utf-8");
        // V2+V3 GUARDRAIL: Auto-retry with worker-retry module (exponential backoff)
        if (consecutive <= MAX_ZERO_OUTPUT && !(ctx as any)[`_retried_${iteration}`]) {
          (ctx as any)[`_retried_${iteration}`] = true;
          ctx.log(`[work] 🔄 RETRY: Re-prompting worker via withWorkerRetry (exponential backoff)`);
          const retryFirstToolInstruction = stubFilePath
            ? `A stub file has already been pre-created at \`${stubFilePath.replace(/.*?(outputs\/)/, 'outputs/')}\`. Your FIRST tool call MUST be edit() to replace the stub content. Do NOT use write(), read(), or bash() first. Use this exact oldText for the first edit: \`<!-- STUB: This file was pre-created by the workflow. Replace this content with your deliverable. -->\\n\`.`
            : `Your FIRST tool call MUST be write(). Do NOT use read() or bash() first. Do NOT claim files already exist.`;
          const retryPrompt = `🚨 YOUR PREVIOUS ATTEMPT PRODUCED 0 FILES. This is iteration ${iteration} retry.\n\n${retryFirstToolInstruction}\n\nOriginal task:\n${guidance}`;
          const retryResult = await withWorkerRetry(
            async () => {
              await withRetry(() => worker.prompt(retryPrompt), {
                maxRetries: 3,
                baseDelayMs: 1000,
                onRetry: (err, attempt, delay) => ctx.log(`[work] ⚠️ Provider error on retry prompt, retry ${attempt} after ${delay}ms: ${String(err).slice(0, 80)}`),
              });
              const retrySnap = snapshotOutputs(outputsDir);
              const retryChanged = diffSnapshots(afterSnap, retrySnap);
              if (retryChanged.length === 0) {
                throw new Error("no output: worker produced 0 files on retry");
              }
              return retryChanged;
            },
            {
              maxRetries: 1,
              baseDelayMs: 2000,
              onRetry: (err, attempt, delay) => ctx.log(`[work] 🔄 Worker retry attempt ${attempt} after ${delay}ms: ${String(err).slice(0, 80)}`),
            },
          );
          if (retryResult.success && retryResult.result) {
            (ctx as any)._consecutiveZeroOutput = 0;
            ctx.log(`[work] ✅ Retry succeeded (${retryResult.attempts} attempt(s)): ${retryResult.result.length} file(s): ${retryResult.result.map(f => f.split('/').pop()).join(', ')}`);
            changedFiles.push(...retryResult.result);
          } else {
            ctx.log(`[work] ❌ Retry failed after ${retryResult.attempts} attempt(s): ${retryResult.errors.join('; ')}`);
          }
        }
        if (consecutive >= MAX_ZERO_OUTPUT) {
          ctx.log(`[work] 🚨 ESCALATION: ${MAX_ZERO_OUTPUT} consecutive zero-output iterations. Injecting write-first constraint into review.`);
        }
        // Auto-terminate after 2x MAX_ZERO_OUTPUT consecutive failures
        if (consecutive >= MAX_ZERO_OUTPUT * 2) {
          ctx.log(`[work] 🛑 AUTO-TERMINATE: ${consecutive} consecutive zero-output iterations. Worker cannot produce files. Stopping workflow.`);
          appendFileSync(journalFile, `\n**🛑 AUTO-TERMINATED**: ${consecutive} consecutive zero-output iterations. Worker is non-functional.\n`, "utf-8");
          decision = { status: "blocked", detail: `Auto-terminated: ${consecutive} consecutive zero-output iterations. Worker cannot produce deliverables.` };
          break;
        }
      } else {
        // Validate outputs before accepting them
        const validFiles: string[] = [];
        const rejectedFiles: string[] = [];
        for (const filePath of changedFiles) {
          try {
            const content = readFileSync(filePath, 'utf-8');
            const filename = filePath.split('/').pop() || '';
            const result = validateOutput(filename, content, { outputDir: outputsDir, checkDuplicates: true });
            if (result.valid) {
              validFiles.push(filePath);
              if (result.warnings.length > 0) {
                ctx.log(`[validate] ⚠️ ${filename}: ${result.warnings.join(', ')}`);
              }
            } else {
              rejectedFiles.push(filePath);
              ctx.log(`[validate] ❌ Rejected ${filename}: ${result.errors.join(', ')}`);
            }
          } catch {
            validFiles.push(filePath); // Can't read = skip validation
          }
        }
        if (rejectedFiles.length > 0) {
          ctx.log(`[validate] Rejected ${rejectedFiles.length} file(s), accepted ${validFiles.length}`);
        }
        changedFiles = validFiles;
        (ctx as any)._consecutiveZeroOutput = 0;
        ctx.log(`[work] ✅ Iteration ${iteration} produced ${changedFiles.length} file(s): ${changedFiles.map(f => f.split('/').pop()).join(', ')}`);
      }

      // ── Record iteration metrics ──
      try {
        recordIteration({
          id: iterationId,
          deliverableProduced: changedFiles.length > 0,
          firstAttempt: !(ctx as any)[`_retried_${iteration}`],
          durationMs: timing.durationMs,
          targetPath: changedFiles[0]?.split('/').pop(),
        });
      } catch { /* non-critical */ }

      // ── Record cost/usage metrics ──
      try {
        const outputLen = worker.lastText()?.length ?? 0;
        recordUsage({
          agent: (ctx as any).agentName ?? 'worker',
          workflow: 'master-worker',
          promptTokens: Math.round(outputLen / 4),  // rough estimate
          completionTokens: Math.round(outputLen / 4),
          model: 'unknown',
        });
      } catch { /* non-critical */ }

      // ── Journal ──
      const workerText = worker.lastText();
      const workerSummary = workerText.length > 1500 ? workerText.slice(0, 1500) + "..." : workerText;
      appendFileSync(journalFile, `\n### Iteration ${iteration} — ${new Date().toISOString()}\n**Worker**: ${workerSummary.slice(0, 500)}\n`, "utf-8");

      // ── Review phase ──
      ctx.log(`[review] Orchestrator evaluating iteration ${iteration}...`);

      // Check for new comments since last read
      let newComments = "";
      try {
        if (existsSync(discussionFile)) {
          const disc = readFileSync(discussionFile, "utf-8");
          const lastMarker = disc.lastIndexOf("---read @");
          const unread = lastMarker >= 0 ? disc.slice(disc.indexOf("\n", lastMarker) + 1).trim() : "";
          if (unread) newComments = unread;
        }
      } catch {}

      let reviewPrompt = `## Worker Output (Iteration ${iteration})
${workerSummary}

**Output verification**: ${changedFiles.length === 0 ? '⚠️ NO files were created or modified this iteration. Consider requiring write() as the first tool call in next guidance.' : `✅ ${changedFiles.length} file(s) modified: ${changedFiles.map(f => f.split('/').pop()).join(', ')}`}

${(ctx as any)._consecutiveZeroOutput >= MAX_ZERO_OUTPUT ? `**🚨 ESCALATION**: Worker has produced 0 output files for ${(ctx as any)._consecutiveZeroOutput} consecutive iterations. This is likely a "false completion claim" failure mode. Options:\n1. Provide EXACT file content in your guidance so worker just needs to write()\n2. Write the file yourself using your tools\n3. PIVOT to a completely different approach` : ''}

Read project.md for current state, metrics, and plan. Update it as needed.
Then provide your decision and guidance for the next iteration.`;
      if (newComments) {
        reviewPrompt += `\n\n## New Comments (address these)\n${newComments}`;
      }

      let reviewAttempt = 0;
      while (reviewAttempt < 3) {
        try {
          await orchestrator.prompt(reviewPrompt);
          break;
        } catch (e: any) {
          reviewAttempt++;
          ctx.log(`[review] Error (attempt ${reviewAttempt}/3): ${e.message?.slice(0, 100)}`);
          if (reviewAttempt >= 3) throw e;
          await new Promise(r => setTimeout(r, 2000 * reviewAttempt));
        }
      }

      const orchestratorText = orchestrator.lastText();


      // Mark new comments as read
      if (newComments) {
        try { appendFileSync(discussionFile, `\n---read @iter${iteration}---\n`, "utf-8"); } catch {}
      }
      decision = extractDecision(orchestratorText);
      if (decision.status === "unknown") {
        // Track consecutive unclear decisions — if the orchestrator can't decide,
        // the project likely has no more actionable work (zombie loop prevention)
        if (typeof (ctx as any)._consecutiveUnknownDecisions === 'undefined') {
          (ctx as any)._consecutiveUnknownDecisions = 0;
        }
        (ctx as any)._consecutiveUnknownDecisions++;
        const unknownCount = (ctx as any)._consecutiveUnknownDecisions;
        if (unknownCount >= 3) {
          ctx.log(`[review] 🛑 ${unknownCount} consecutive unclear decisions — treating as WAITING (zombie loop prevention)`);
          decision.status = "waiting";
          decision.detail = `Auto-waiting: ${unknownCount} consecutive iterations with no clear orchestrator decision. Project may be complete.`;
        } else {
          ctx.log(`[review] Decision unclear (${unknownCount}/3) — treating as CONTINUE`);
          decision.status = "continue";
        }
      } else {
        // Reset counter on any clear decision
        (ctx as any)._consecutiveUnknownDecisions = 0;
      }
      ctx.log(`[review] Decision: ${decision.status.toUpperCase()}`);

      // Append orchestrator decision to journal
      appendFileSync(journalFile, `**Orchestrator**: ${decision.detail.slice(0, 300)}\n`, "utf-8");

      // Update iteration count in project.md (but don't override externally-set closed/done status)
      const currentContent = readFileSync(projectFile, "utf-8");
      const currentStatus = (currentContent.match(/\*\*Status\*\*:\s*(\w+)/) || [])[1]?.toLowerCase();
      if (currentStatus !== "closed" && currentStatus !== "done" && currentStatus !== "completed") {
        updateProjectStatus(projectFile, "active", undefined, iteration);
      } else {
        ctx.log(`[work] Project status externally set to '${currentStatus}' — stopping loop`);
        break;
      }

      // Mark this iteration's checkpoint as complete
      markCheckpointComplete(projectDir, checkpointSessionId);

      // Emit iteration event for metrics tracking
      try { ctx.emit({ type: "project.iteration", project: projectDir, iteration } as any); } catch {}
    }

    // ── Wrap up ──
    const finalContent = readFileSync(projectFile, "utf-8");
    const projectType = extractField(finalContent, "Type").toLowerCase();
    let finalStatus: string;
    let stopReason: string;

    if (decision.status === "blocked") {
      finalStatus = "blocked";
      stopReason = decision.detail.slice(0, 200);
    } else if (decision.status === "waiting") {
      finalStatus = "waiting";
      stopReason = decision.detail.slice(0, 200);
    } else if (iteration >= maxIterations) {
      finalStatus = "blocked";
      stopReason = `Safety cap: ${maxIterations} iterations reached.`;
    } else {
      finalStatus = decision.status;
      stopReason = decision.detail.slice(0, 200);
    }

    // Workflow can set waiting, blocked, or done/closed
    // finalStatus is one of: continue/pivot/waiting/blocked/done/unknown
    const projectStatus = finalStatus === "done" ? "closed" : finalStatus;
    updateProjectStatus(projectFile, projectStatus, stopReason, iteration);
    ctx.log(`[done] ${finalStatus} after ${iteration} iteration(s). ${stopReason}`);

    if (finalStatus === "blocked") return ctx.escalate(stopReason);
    return ctx.done(`${finalStatus} after ${iteration} iteration(s). ${stopReason}`);

  } finally {
    orchestrator.close();
    worker.close();
  }
}
