/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * Gated Exploration Workflow (H-041 P3 Test)
 *
 * A "soft workflow" that provides validation gates but NOT step sequences.
 * Designed for exploratory tasks where essential decisions dominate.
 *
 * ## Design Rationale (from H-041: Decision Topology)
 *
 * The skill-lifecycle workflow achieves only 27% good rate because it constrains
 * essential decisions (discovery, testing) with rigid step sequences. Unconstrained
 * optimizer achieves 60%. This workflow tries to capture the best of both:
 *
 * - **Eliminable decisions** → hard-coded (always write artifacts, always verify)
 * - **Essential decisions** → left to agent (what to explore, which approach to take)
 * - **Navigation decisions** → gated (agent declares progress, gate validates)
 *
 * ## How It Works
 *
 * 1. **Explore Phase** — Agent gets the full task with ONE constraint: write a
 *    `workspace/exploration-log.md` artifact documenting findings as you go.
 *    No step-by-step prescription. The agent decides how to approach the work.
 *
 * 2. **Gate Check** — A cheap evaluation verifies the exploration produced
 *    something concrete (not just meta-commentary). Checks:
 *    - Did the agent write an artifact?
 *    - Does the artifact contain concrete findings (not just plans)?
 *    - Is there evidence of actual investigation (file reads, data checks)?
 *
 * 3. **Produce Phase** — Agent takes findings from exploration and produces
 *    the deliverable. Again, no step prescription — just "produce output X
 *    based on your exploration."
 *
 * 4. **Delivery Gate** — Validates the deliverable exists and meets basic criteria.
 *
 * ## Key Difference from skill-lifecycle
 *
 * skill-lifecycle: "Step 1: scan 10 transcripts. Step 2: look for patterns appearing 3+ times..."
 * gated-exploration: "Explore the problem space. Document what you find. [GATE] Now produce the output."
 *
 * The gates are decision-eliminators (you MUST write an artifact, you MUST produce output).
 * The space between gates is decision-preserving (you decide HOW to explore).
 *
 * ## Task Format
 *
 * ```
 * agent: optimizer
 *
 * ## Exploration Goal
 * <what to investigate / discover>
 *
 * ## Deliverable
 * <what concrete output is expected>
 *
 * ## Success Criteria
 * <how to judge if the deliverable is good>
 * ```
 */

export const name: string = "gated-exploration";

export const description: string =
  "Soft workflow for exploratory tasks: explore with artifact logging → " +
  "gate check → produce deliverable → delivery gate. " +
  "Preserves essential decisions, eliminates only infrastructure ones. " +
  "Task: exploration goal + expected deliverable.";

// ── Task Parser ────────────────────────────────────────────────────────

interface ParsedTask {
  agent: string;
  explorationGoal: string;
  deliverable: string;
  successCriteria: string;
  rawTask: string;
}

function parseTask(raw: string): ParsedTask {
  let agent = "optimizer";
  const agentMatch = raw.match(/^agent:\s*(\S+)\s*$/im);
  if (agentMatch) {
    agent = agentMatch[1];
    raw = raw.replace(/^agent:\s*\S+\s*$/im, "").trim();
  }

  // Extract sections (flexible — doesn't require exact headers)
  const goalMatch = raw.match(/##\s*Exploration\s*Goal\s*\n([\s\S]*?)(?=\n##\s|\n---\s|$)/i);
  const deliverableMatch = raw.match(/##\s*Deliverable\s*\n([\s\S]*?)(?=\n##\s|\n---\s|$)/i);
  const criteriaMatch = raw.match(/##\s*Success\s*Criteria\s*\n([\s\S]*?)(?=\n##\s|\n---\s|$)/i);

  const explorationGoal = goalMatch?.[1]?.trim() || raw.trim();
  const deliverable = deliverableMatch?.[1]?.trim() || "Write findings and recommendations to workspace/deliverable.md";
  const successCriteria = criteriaMatch?.[1]?.trim() || "Concrete findings with evidence. Not just plans or summaries of plans.";

  return { agent, explorationGoal, deliverable, successCriteria, rawTask: raw };
}

// ── Gate Logic ─────────────────────────────────────────────────────────

interface GateResult {
  passed: boolean;
  reason: string;
}

/**
 * Evaluate whether the exploration phase produced concrete findings.
 * This is a heuristic check — not a full LLM evaluation.
 * We check the agent's output for evidence of real work.
 */
function checkExplorationGate(agentOutput: string): GateResult {
  const text = agentOutput.toLowerCase();

  // Check for concrete evidence of investigation
  const hasFileReads = /(?:read|reading|opened|checked|scanned|examined)\s+\S+/.test(text);
  const hasData = /\d+\s*(?:%|percent|sessions?|files?|lines?|errors?|results?)/.test(text);
  const hasConcreteFindings = /(?:found|discovered|identified|noticed|observed)\s+(?:that|a|the|\d)/.test(text);

  // Check for anti-patterns (pure meta-work)
  const isMetaOnly = /(?:i would|i should|we could|the plan is|next steps)/i.test(text) &&
    !hasConcreteFindings;

  // Check artifact was written
  const wroteArtifact = /(?:wrote|written|created|saved|updated)\s+(?:to\s+)?(?:workspace\/|\.\/)?[\w-]+\.md/.test(text);

  if (!wroteArtifact && !hasConcreteFindings) {
    return {
      passed: false,
      reason: "No exploration artifact was written and no concrete findings were reported. " +
        "The exploration phase must produce documented findings.",
    };
  }

  if (isMetaOnly && !hasData && !hasFileReads) {
    return {
      passed: false,
      reason: "Output appears to be planning/meta-commentary without evidence of actual investigation. " +
        "The exploration phase must include real data or file examination.",
    };
  }

  // Pass — the agent did real work
  return {
    passed: true,
    reason: wroteArtifact
      ? "Exploration artifact written with findings."
      : "Concrete findings reported from investigation.",
  };
}

/**
 * Check whether the production phase created the expected deliverable.
 */
function checkDeliveryGate(agentOutput: string, expectedDeliverable: string): GateResult {
  const text = agentOutput.toLowerCase();
  const deliverableLower = expectedDeliverable.toLowerCase();

  // Check if agent wrote something
  const wroteFile = /(?:wrote|written|created|saved|deployed|added)\s+(?:to\s+)?(?:\S+\/)?[\w.-]+/.test(text);
  const hasContent = text.length > 200; // Non-trivial output

  // Check for explicit failure or blocking
  const blocked = /(?:blocked|cannot|unable|failed to|no .* found|nothing to)/i.test(text);

  if (blocked && !wroteFile) {
    return {
      passed: false,
      reason: "Agent reported being blocked or unable to produce deliverable.",
    };
  }

  if (!wroteFile && !hasContent) {
    return {
      passed: false,
      reason: "No deliverable artifact was produced.",
    };
  }

  return {
    passed: true,
    reason: "Deliverable produced.",
  };
}

// ── Workflow Execute ───────────────────────────────────────────────────

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  let parsed: ParsedTask;
  try {
    parsed = parseTask(ctx.task);
  } catch (err) {
    return ctx.escalate(
      err instanceof Error ? err.message : "Failed to parse gated-exploration task",
      { rawTask: ctx.task.slice(0, 500) },
    );
  }

  const { agent, explorationGoal, deliverable, successCriteria } = parsed;

  // ── Phase 1: EXPLORE ─────────────────────────────────────────────
  //
  // Give the agent maximum freedom. Only constraints:
  // 1. Write findings to workspace/exploration-log.md
  // 2. Do real investigation (read files, check data)
  //
  // The agent decides: what to look at, in what order, how deep to go.

  ctx.emit({ type: "step_start", step: "explore" });

  const exploreTask =
    `## Goal\n${explorationGoal}\n\n` +
    `## Your Approach\n` +
    `You decide how to investigate this. There are no prescribed steps.\n` +
    `Look at whatever sources seem most promising. Follow leads. Be thorough.\n\n` +
    `## One Requirement\n` +
    `Document your findings as you go in \`workspace/exploration-log.md\`.\n` +
    `Include: what you looked at, what you found, and what it means.\n` +
    `This artifact will be used in the next phase to produce the deliverable.\n\n` +
    `## What NOT to Do\n` +
    `- Don't just plan. Actually investigate.\n` +
    `- Don't summarize what you already know. Find new information.\n` +
    `- Don't skip writing the exploration log.`;

  const exploreResult = await ctx.runAgent(agent, exploreTask);

  if (exploreResult.status === "error") {
    return ctx.escalate("Exploration phase failed", {
      agent,
      error: exploreResult.error,
    });
  }

  // ── Gate 1: Exploration produced findings ────────────────────────

  const exploreText = exploreResult.lastAssistantText ?? "";
  const gate1 = checkExplorationGate(exploreText);

  if (!gate1.passed) {
    // Exploration didn't produce concrete findings.
    // Instead of failing the whole workflow, give the agent one more chance
    // with specific feedback about what's missing.
    ctx.emit({ type: "step_start", step: "explore-retry" });

    const retryTask =
      `## Retry: Your exploration needs more substance\n\n` +
      `**Issue**: ${gate1.reason}\n\n` +
      `## Original Goal\n${explorationGoal}\n\n` +
      `## What to Do\n` +
      `Read your workspace/exploration-log.md (if it exists) and continue investigating.\n` +
      `You need concrete findings — specific data, specific files examined, specific patterns found.\n` +
      `Update workspace/exploration-log.md with your findings.`;

    const retryResult = await ctx.runAgent(agent, retryTask);
    if (retryResult.status === "error") {
      return ctx.escalate("Exploration retry failed", {
        agent,
        error: retryResult.error,
        gate1Reason: gate1.reason,
      });
    }

    const retryText = retryResult.lastAssistantText ?? "";
    const gate1Retry = checkExplorationGate(retryText);

    if (!gate1Retry.passed) {
      return ctx.done(
        `## Gated Exploration: Exploration Gate Failed\n\n` +
        `The agent could not produce concrete findings after 2 attempts.\n\n` +
        `**Gate feedback**: ${gate1Retry.reason}\n\n` +
        `### Exploration Output\n${exploreText.slice(0, 2000)}\n\n` +
        `### Retry Output\n${retryText.slice(0, 2000)}`
      );
    }
  }

  // ── Phase 2: PRODUCE ─────────────────────────────────────────────
  //
  // Agent takes exploration findings and produces the deliverable.
  // Again, no step prescription — just the expected output.

  ctx.emit({ type: "step_start", step: "produce" });

  const produceTask =
    `## Produce the Deliverable\n\n` +
    `You have explored the problem space. Your findings are in \`workspace/exploration-log.md\`.\n\n` +
    `### What to Produce\n${deliverable}\n\n` +
    `### Success Criteria\n${successCriteria}\n\n` +
    `### Instructions\n` +
    `1. Read \`workspace/exploration-log.md\` first — base your work on these findings.\n` +
    `2. Produce the deliverable. You decide the approach.\n` +
    `3. Verify the deliverable meets the success criteria before finishing.`;

  const produceResult = await ctx.runAgent(agent, produceTask);

  if (produceResult.status === "error") {
    return ctx.escalate("Production phase failed", {
      agent,
      error: produceResult.error,
    });
  }

  // ── Gate 2: Deliverable exists ───────────────────────────────────

  const produceText = produceResult.lastAssistantText ?? "";
  const gate2 = checkDeliveryGate(produceText, deliverable);

  if (!gate2.passed) {
    return ctx.done(
      `## Gated Exploration: Delivery Gate Failed\n\n` +
      `Exploration succeeded but the deliverable was not produced.\n\n` +
      `**Gate feedback**: ${gate2.reason}\n\n` +
      `### Exploration Findings\n${exploreText.slice(0, 2000)}\n\n` +
      `### Production Output\n${produceText.slice(0, 2000)}`
    );
  }

  // ── Success ──────────────────────────────────────────────────────

  return ctx.done(
    `## Gated Exploration: Complete ✅\n\n` +
    `**Agent**: ${agent}\n` +
    `**Exploration gate**: ${gate1.passed ? "✅ passed" : "⚠️ passed on retry"}\n` +
    `**Delivery gate**: ✅ passed\n\n` +
    `### Exploration Summary\n` +
    `${exploreText.slice(0, 2000)}\n\n` +
    `### Deliverable\n` +
    `${produceText.slice(0, 2000)}`
  );
}
