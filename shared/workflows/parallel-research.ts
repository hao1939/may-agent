/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * parallel-research — Fork N research threads, collect results, synthesize.
 *
 * Pattern: Fork-Join with Synthesis
 *   1. FORK:  Run N research threads in parallel (Promise.allSettled)
 *   2. COLLECT: Gather results, handle partial failures gracefully
 *   3. SYNTHESIZE: Separate agent call finds cross-thread connections
 *
 * Input format (JSON string):
 *   {
 *     "threads": [
 *       { "task": "...", "agent": "bob", "label": "H-091 validation" },
 *       { "task": "...", "label": "Cost model update" }
 *     ],
 *     "synthesisAgent": "bob",       // optional, default: first thread's agent
 *     "synthesisPrompt": "...",       // optional, custom synthesis instructions
 *     "defaultAgent": "bob"           // optional, default agent for threads without one
 *   }
 *
 * Constraints:
 *   - Max 5 threads (rejects inputs with more)
 *   - Uses Promise.allSettled for resilience (one failure doesn't block others)
 *   - Each thread writes to its own output; only synthesis touches shared state
 *
 * Design doc: agents/bob/workspace/meta-harness-design.md
 */

export const name: string = "parallel-research";

export const description: string =
  "Fork N research threads in parallel, collect results, synthesize findings. " +
  "Input: JSON with { threads: [{ task, agent?, label? }], synthesisAgent?, synthesisPrompt?, defaultAgent? }. " +
  "Max 5 threads. Uses Promise.allSettled for resilience.";

// ── Types ──────────────────────────────────────────────────────────────

interface ResearchThread {
  /** The research task/question for this thread. */
  task: string;
  /** Which agent runs this thread. Defaults to defaultAgent or "bob". */
  agent?: string;
  /** Human-readable label for tracking. Defaults to "thread-N". */
  label?: string;
}

interface ResearchInput {
  threads: ResearchThread[];
  /** Who synthesizes results. Default: defaultAgent or first thread's agent. */
  synthesisAgent?: string;
  /** Custom instructions for the synthesis step. */
  synthesisPrompt?: string;
  /** Default agent for threads that don't specify one. Default: "bob". */
  defaultAgent?: string;
}

const MAX_THREADS = 5;

// ── Main workflow ──────────────────────────────────────────────────────

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // ── Parse and validate input ───────────────────────────────────────
  let input: ResearchInput;
  try {
    input = JSON.parse(ctx.task);
  } catch (e) {
    return ctx.escalate("Invalid input: expected JSON string. " +
      'Format: { "threads": [{ "task": "...", "label": "..." }] }');
  }

  if (!input.threads || !Array.isArray(input.threads) || input.threads.length === 0) {
    return ctx.escalate("No research threads specified. Provide at least one thread with a task.");
  }

  if (input.threads.length > MAX_THREADS) {
    return ctx.escalate(
      `Too many threads: ${input.threads.length} (max ${MAX_THREADS}). ` +
      `Split into multiple parallel-research runs or reduce scope.`
    );
  }

  const defaultAgent = input.defaultAgent ?? "bob";
  const synthAgent = input.synthesisAgent ?? input.threads[0].agent ?? defaultAgent;

  ctx.emit({ type: "workflow_start", workflow: "parallel-research", task: ctx.task });

  // ── Phase 1: FORK — run all threads in parallel ────────────────────
  ctx.emit({ type: "step_start", step: "parallel-fork" });

  const threadPromises = input.threads.map((thread, i) => {
    const agent = thread.agent ?? defaultAgent;
    const label = thread.label ?? `thread-${i + 1}`;
    const threadTask =
      `## Research Thread: ${label}\n\n` +
      `${thread.task}\n\n` +
      `**Budget: ≤25 tool calls.** Focus on answering the question, not exhaustive exploration.\n` +
      `If you've used 20 tool calls, STOP and write what you have NOW.\n\n` +
      `⛔ Do NOT trigger deliver-or-report or other workflows — you are inside a research thread.\n` +
      `Do NOT call workflow.run() or callAgent(). Write deliverables directly.\n\n` +
      `Write your findings to a file. Be focused on this specific thread.`;

    return ctx.runAgent(agent, threadTask);
  });

  // Promise.allSettled: completed threads aren't lost if one fails
  const settled = await Promise.allSettled(threadPromises);

  // ── Phase 2: COLLECT — gather all results ──────────────────────────
  ctx.emit({ type: "step_start", step: "collect-results" });

  const threadSummaries: string[] = [];
  let successCount = 0;

  for (let i = 0; i < settled.length; i++) {
    const label = input.threads[i].label ?? `thread-${i + 1}`;
    const outcome = settled[i];

    if (outcome.status === "fulfilled") {
      const result = outcome.value;
      if (result.status === "error") {
        threadSummaries.push(
          `### Thread ${i + 1}: ${label} [FAILED]\nAgent error: ${result.error ?? "(unknown)"}`
        );
      } else {
        successCount++;
        // Truncate long outputs to keep synthesis context manageable
        const text = result.lastAssistantText ?? "(no output)";
        const truncated = text.length > 3000 ? text.slice(0, 3000) + "\n\n...(truncated)" : text;
        threadSummaries.push(`### Thread ${i + 1}: ${label} [completed]\n${truncated}`);
      }
    } else {
      // Promise rejected (infrastructure-level failure)
      threadSummaries.push(
        `### Thread ${i + 1}: ${label} [FAILED]\nInfra error: ${String(outcome.reason)}`
      );
    }
  }

  if (successCount === 0) {
    return ctx.escalate(
      `All ${input.threads.length} research threads failed. No results to synthesize.`,
      { threadSummaries }
    );
  }

  // ── Phase 3: SYNTHESIZE — find cross-thread connections ────────────
  ctx.emit({ type: "step_start", step: "synthesize" });

  const synthesisInstructions = input.synthesisPrompt
    ?? `Synthesize the findings from ${successCount} parallel research threads. ` +
       `Look for cross-thread connections, contradictions, and emergent patterns.`;

  const synthTask =
    `## Task: Research Synthesis\n\n` +
    `**Budget: ≤15 tool calls.** Synthesize the thread results into a coherent answer.\n\n` +
    `${synthesisInstructions}\n\n` +
    `## Thread Results (${successCount}/${input.threads.length} succeeded)\n\n` +
    `${threadSummaries.join("\n\n")}\n\n` +
    `## Instructions\n` +
    `1. Summarize key findings from each successful thread\n` +
    `2. Identify connections between threads (shared patterns, contradictions)\n` +
    `3. Rank findings by impact/novelty\n` +
    `4. Propose next steps based on combined findings\n` +
    `5. Write your synthesis to a markdown file`;

  const synthesis = await ctx.runAgent(synthAgent, synthTask);

  // Synthesis failed — still return thread results
  if (synthesis.status === "error") {
    return ctx.done(
      `## Parallel Research: ${successCount}/${input.threads.length} threads completed\n\n` +
      `⚠️ Synthesis step failed (${synthesis.error ?? "unknown error"}), ` +
      `but individual thread results are available below.\n\n` +
      `${threadSummaries.join("\n\n")}`
    );
  }

  // ── Done ───────────────────────────────────────────────────────────
  const synthText = synthesis.lastAssistantText ?? "(no synthesis output)";

  return ctx.done(
    `## Parallel Research Complete\n\n` +
    `**Threads**: ${successCount}/${input.threads.length} completed\n` +
    `**Synthesis agent**: ${synthAgent}\n\n` +
    `## Synthesis\n${synthText}\n\n` +
    `## Individual Thread Results\n${threadSummaries.join("\n\n")}`
  );
}
