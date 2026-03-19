/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * Skill Lifecycle Workflow
 *
 * Mechanically enforces the full skill lifecycle: discover → draft → test → deploy.
 * Each phase runs in a separate agent session, preventing the common failure mode
 * of skipping testing or doing "meta-work" (updating templates instead of creating
 * actual skills).
 *
 * ## Task Format
 *
 * Plain text describing what kind of skill to look for, or a specific pattern
 * already identified. Examples:
 *
 *   "Scan recent transcripts for repeated multi-step patterns"
 *   "Pattern: agents always read file → check convention → edit → verify. Create a skill for this."
 *
 * ## How It Works
 *
 * Phase 1 (Discover): Scan transcripts/evals, find a proven pattern appearing 3+ times
 * Phase 2 (Draft): Write a SKILL.md with assertions, based on Phase 1 findings
 * Phase 3 (Test): Run gym scenarios to verify the skill improves behavior
 * Phase 4 (Deploy): Add skill to relevant agents' knowledge INDEX.md
 *
 * If Phase 1 finds no pattern → workflow exits cleanly with "no pattern found"
 * If Phase 3 fails → workflow discards the skill and reports why
 *
 * ## Evidence
 *
 * This workflow exists because optimizer spent 17/17 sessions on cost analysis
 * and 0 on skill creation, despite skill work being focus area #1. Mechanical
 * enforcement (separate sessions per phase) is the only proven method for
 * overriding agent tendencies to skip judgment-heavy work.
 */

export const name: string = "skill-lifecycle";

export const description: string =
  "Full skill lifecycle: discover pattern → draft SKILL.md → test in gym → deploy. " +
  "Each phase is a separate session to prevent skipping steps. " +
  "Task: describe what kind of pattern to look for. " +
  "Optional 'agent: <name>' header (default: optimizer).";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // Parse optional agent declaration (default: whoever called this workflow)
  let raw = ctx.task;
  let agent = "optimizer"; // default
  const agentMatch = raw.match(/^agent:\s*(\S+)\s*$/im);
  if (agentMatch) {
    agent = agentMatch[1];
    raw = raw.replace(/^agent:\s*\S+\s*$/im, "").trim();
  }
  const callerHint = raw;

  // ── Phase 1: Discover ──────────────────────────────────────────────
  //
  // Scan recent session transcripts for a repeated multi-step pattern.
  // The agent must produce a concrete finding or explicitly state "no pattern found."

  const discoverTask =
    `## Phase 1: DISCOVER a proven pattern — do NOT create any skill files yet.\n\n` +
    `${callerHint}\n\n` +
    `### Instructions\n` +
    `1. Read 10 recent session transcripts from .state/sessions/history/ (pick diverse agents).\n` +
    `   Use: ls -t .state/sessions/history/ | head -20, then read meta.json to find diverse agents,\n` +
    `   then read the session.jsonl files (tail the last ~100 lines of each).\n` +
    `2. Look for multi-step processes that agents repeat successfully across 3+ sessions.\n` +
    `   Examples: "read file → check X → edit Y → verify", "analyze error → find root cause → fix → test"\n` +
    `3. Also check .state/evaluations/ for patterns in failure modes that a skill could prevent.\n` +
    `4. If you find a pattern (appears 3+ times across different sessions):\n` +
    `   - Write it to workspace/skill-discovery.md with:\n` +
    `     - Pattern name\n` +
    `     - Description (what agents do, step by step)\n` +
    `     - Evidence (3+ session IDs where this pattern appears)\n` +
    `     - Which agents would benefit\n` +
    `5. If no pattern found after scanning 10 transcripts:\n` +
    `   - Write "NO PATTERN FOUND" to workspace/skill-discovery.md with a 3-line explanation.\n\n` +
    `### Output\n` +
    `You MUST write to workspace/skill-discovery.md. Do NOT create any SKILL.md files yet.`;

  const discover = await ctx.runAgent(agent, discoverTask);
  if (discover.status === "error") {
    return ctx.escalate("Phase 1 (discover) failed", { error: discover.error });
  }

  // Check if pattern was found
  const discoverText = discover.lastAssistantText ?? "";
  if (
    discoverText.toUpperCase().includes("NO PATTERN FOUND") ||
    discoverText.toUpperCase().includes("NO PROVEN PATTERN")
  ) {
    return ctx.done(
      `## Skill Lifecycle: No pattern found\n\n` +
        `Scanned transcripts but no repeating multi-step pattern appeared 3+ times.\n\n` +
        `${discoverText}`,
    );
  }

  // ── Phase 2: Draft ─────────────────────────────────────────────────
  //
  // Write a SKILL.md based on the discovered pattern. Separate session
  // forces the agent to read the discovery artifact rather than relying
  // on memory of what it found.

  const draftTask =
    `## Phase 2: DRAFT a SKILL.md — based on the pattern discovered in Phase 1.\n\n` +
    `### Instructions\n` +
    `1. Read workspace/skill-discovery.md (written in Phase 1).\n` +
    `2. Read agents/shared/skills/skill-lifecycle/SKILL.md for the skill format/template.\n` +
    `3. Read 1-2 existing skills in agents/shared/skills/ for examples of good skills.\n` +
    `4. Create the skill file at agents/shared/skills/<pattern-name>/SKILL.md with:\n` +
    `   - Frontmatter: name, version (1.0.0), description, owner\n` +
    `   - ## When to Apply: specific trigger conditions\n` +
    `   - ## Steps: the multi-step process (numbered, concrete)\n` +
    `   - ## Assertions: 3-7 testable assertions (things that must be true if skill is followed)\n` +
    `   - ## Anti-Patterns: 2-3 common failure modes this skill prevents\n` +
    `5. Read back the file to verify it's well-formed.\n\n` +
    `### Constraints\n` +
    `- One skill only. Do NOT create multiple skills.\n` +
    `- Assertions must be mechanically verifiable (a gym scenario can check them).\n` +
    `- Do NOT modify any existing skills or agent files. Only create the new SKILL.md.`;

  const draft = await ctx.runAgent(agent, draftTask);
  if (draft.status === "error") {
    return ctx.escalate("Phase 2 (draft) failed", { error: draft.error });
  }

  // ── Phase 3: Test ──────────────────────────────────────────────────
  //
  // Run gym scenarios to verify the skill makes a difference. The agent
  // must run actual gym tests, not just claim the skill "looks good."

  const testTask =
    `## Phase 3: TEST the skill drafted in Phase 2.\n\n` +
    `### Instructions\n` +
    `1. Read the SKILL.md you created in Phase 2 (check agents/shared/skills/ for new directories).\n` +
    `2. Find or create a gym scenario that exercises this skill.\n` +
    `   - Check agents/gym/scenarios/ for existing scenarios that match.\n` +
    `   - If none exist, create a minimal scenario in agents/gym/scenarios/<name>/\n` +
    `     with: scenario.json, task.md, success_criteria.js, environment/ dir.\n` +
    `3. Run the gym test 3 times: test/gym/run-gym.sh <scenario> --agent coder\n` +
    `   (use bash tool for each run)\n` +
    `4. Record results:\n` +
    `   - If 2/3 or better pass → write "TEST PASSED" to workspace/skill-test-results.md\n` +
    `   - If <2/3 pass → write "TEST FAILED" with analysis to workspace/skill-test-results.md\n` +
    `5. If test failed, explain what went wrong and whether the skill needs revision.\n\n` +
    `### Constraints\n` +
    `- You MUST run actual gym tests. "The skill looks correct" is not a test result.\n` +
    `- If gym infrastructure is broken (bun not installed, etc.), write "TEST BLOCKED: <reason>".\n` +
    `- Do NOT modify the SKILL.md in this phase — only test it.`;

  const test = await ctx.runAgent(agent, testTask);
  if (test.status === "error") {
    return ctx.escalate("Phase 3 (test) failed", { error: test.error });
  }

  const testText = test.lastAssistantText ?? "";
  const testUpper = testText.toUpperCase();

  // If test failed or was blocked, don't deploy
  if (testUpper.includes("TEST FAILED")) {
    return ctx.done(
      `## Skill Lifecycle: Test FAILED — skill not deployed\n\n` +
        `The skill was drafted but gym tests did not pass (need 2/3).\n\n` +
        `### Discovery\n${discoverText}\n\n` +
        `### Draft\n${draft.lastAssistantText ?? "(no output)"}\n\n` +
        `### Test Results\n${testText}`,
    );
  }

  if (testUpper.includes("TEST BLOCKED")) {
    return ctx.done(
      `## Skill Lifecycle: Test BLOCKED — skill not deployed\n\n` +
        `The skill was drafted but gym testing was blocked by infrastructure issues.\n\n` +
        `### Discovery\n${discoverText}\n\n` +
        `### Draft\n${draft.lastAssistantText ?? "(no output)"}\n\n` +
        `### Test Results\n${testText}`,
    );
  }

  // ── Phase 4: Deploy ────────────────────────────────────────────────
  //
  // Add the skill to relevant agents' knowledge so they actually use it.

  const deployTask =
    `## Phase 4: DEPLOY the tested skill to production agents.\n\n` +
    `### Instructions\n` +
    `1. Read workspace/skill-discovery.md to see which agents benefit.\n` +
    `2. Read workspace/skill-test-results.md to confirm tests passed.\n` +
    `3. Read the SKILL.md you created (in agents/shared/skills/<name>/).\n` +
    `4. For each agent that should use this skill:\n` +
    `   - Read agents/<agent>/knowledge/INDEX.md\n` +
    `   - Add an entry pointing to the new skill\n` +
    `   - Verify the INDEX.md is valid after editing\n` +
    `5. Log the deployment to workspace/journal.md with:\n` +
    `   - Skill name and path\n` +
    `   - Agents it was deployed to\n` +
    `   - Gym test results (pass rate)\n` +
    `   - Date\n\n` +
    `### Constraints\n` +
    `- Only deploy if Phase 3 passed (2/3+ gym tests).\n` +
    `- Do NOT modify the SKILL.md — only update INDEX.md files and journal.`;

  const deploy = await ctx.runAgent(agent, deployTask);
  if (deploy.status === "error") {
    return ctx.escalate("Phase 4 (deploy) failed", { error: deploy.error });
  }

  return ctx.done(
    `## Skill Lifecycle: Complete ✅\n\n` +
      `### Phase 1: Discovery\n${discoverText}\n\n` +
      `### Phase 2: Draft\n${draft.lastAssistantText ?? "(no output)"}\n\n` +
      `### Phase 3: Test\n${testText}\n\n` +
      `### Phase 4: Deploy\n${deploy.lastAssistantText ?? "(no output)"}`,
  );
}
