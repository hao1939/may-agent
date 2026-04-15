# DESIGN: Gatekeeper Guard — Automated Review for System-Scope Changes

**Author:** May · **Date:** 2026-04-15 · **Status:** Draft — discussion with Bob & Tech-lead  
**Requested by:** Hao · **Refs:** guard-escalation.md, may-gatekeeper.md, Bob's DESIGN-pre-merge-review-gate.md

---

## Problem

Agents can make system-scope changes (guards, manager code, workflow definitions, cross-agent protocols) that get merged to main without review. The guard escalation incident proved this — tech-lead's EXP-150 warn-only code bypassed both May's gatekeeper role and any QA check.

**What exists today:**
- Pre-commit hook blocks `git commit` directly on `main` ✅
- Agents commit to `review/<sessionId>` branches ✅
- Guards enforce quality at tool-call level (beforeToolCall hooks) ✅
- Workflow guards enforce quality at step level (warn/block/inject) ✅
- **No automated trigger** when a workflow step produces system-scope changes ❌
- **No review before merge** — any agent can `git merge` a review branch ❌
- May's heartbeat says review branches are "agent-scope (no action)" ❌

## Solution: Gatekeeper Guard (Workflow-Level)

A **workflow guard** in `agents/shared/guards/` that triggers on `step_done` events, detects system-scope file changes, and injects a QA review step into the workflow.

This is NOT a subscriber, NOT a cron handler, NOT a heartbeat convention. It's a guard — a pure function that returns demands, processed by the workflow runtime. It fits the existing guard system exactly.

### Why a Guard (Not a Subscriber)

| Approach | When it runs | Can inject work | Can block | Integrated |
|----------|-------------|----------------|-----------|------------|
| Subscriber (session_end) | After session closes | No (fire-and-forget) | No | Loose |
| Cron handler | Every N minutes | Yes (dispatch) | No | External |
| **Workflow guard (step_done)** | **After each step** | **Yes (run_step demand)** | **Yes (block demand)** | **Native** |

The workflow guard is the only approach that can **inject a review step directly into the running workflow** and **block if review fails**. Subscribers and cron handlers are after-the-fact — they can't prevent a bad merge.

### How It Works

```
Workflow Step: tech-lead implements code
    │
    step_done event fires
    │
    gatekeeper guard inspects changed files:
      - src/lib/manager.ts → SYSTEM-SCOPE
      - src/lib/tools/compose-guards.ts → SYSTEM-SCOPE
    │
    Returns: run_step demand
      → { type: "run_step", step: { agent: "qa", label: "guard:review", task: "..." } }
    │
    Workflow runtime executes injected QA step:
      QA reviews the diff, checks correctness, checks for regressions
    │
    Next step_done fires (QA's result)
    │
    Gatekeeper guard checks QA's verdict:
      - If QA approved → no demand (workflow continues normally)
      - If QA rejected → block demand (workflow stops)
```

### System-Scope Detection

Files that are **system-scope** (require review before merge):

```typescript
const SYSTEM_SCOPE_PATTERNS = [
  // Runtime code
  /^src\/lib\/manager/,
  /^src\/lib\/workflow/,
  /^src\/lib\/tools\//,
  /^src\/lib\/session-subscribers/,
  /^src\/lib\/evaluator/,
  /^src\/app\//,
  
  // Guard system itself
  /^agents\/shared\/guards\//,
  
  // Cross-agent protocols
  /^agents\/shared\/protocols?\//,
  /^agents\/shared\/may-agent-docs\//,
  
  // Agent definitions (another agent's heartbeat/context/SOUL)
  // Detected dynamically: file is in agents/<X>/ but step agent is not X
];
```

Everything else is **agent-scope** (own workspace, knowledge files, experiment data) — no review needed.

### Guard Implementation Sketch

```typescript
/// <reference path="../../../src/lib/workflow-defs.d.ts" />

const SYSTEM_SCOPE_PATTERNS = [
  /^src\/lib\/manager/,
  /^src\/lib\/workflow/,
  /^src\/lib\/tools\//,
  /^src\/lib\/session-subscribers/,
  /^src\/lib\/evaluator/,
  /^src\/app\//,
  /^agents\/shared\/guards\//,
  /^agents\/shared\/protocols?\//,
  /^agents\/shared\/may-agent-docs\//,
];

function getChangedFiles(result: TaskResult): string[] {
  // Same as auto-test.ts — scan messages for write/edit tool calls
  const files = new Set<string>();
  for (const msg of result.messages ?? []) {
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      if (part.type === "toolCall" && (part.name === "write" || part.name === "edit")) {
        const p = part.arguments?.path;
        if (typeof p === "string") files.add(p.replace(/^\/app\//, ""));
      }
    }
  }
  return [...files];
}

function isSystemScope(file: string, stepAgent?: string): boolean {
  // Pattern match
  if (SYSTEM_SCOPE_PATTERNS.some(p => p.test(file))) return true;
  
  // Cross-agent edit detection: agent X editing agent Y's files
  if (stepAgent) {
    const agentMatch = file.match(/^agents\/([^/]+)\//);
    if (agentMatch && agentMatch[1] !== stepAgent && agentMatch[1] !== "shared") {
      return true; // Editing another agent's files
    }
  }
  
  return false;
}

export const guard: WorkflowGuard = {
  name: "gatekeeper",
  events: ["step_done"],

  handle(event: WorkflowGuardEvent): Demand[] {
    if (event.type !== "step_done") return [];
    if (event.source === "function") return [];
    
    // Don't re-review guard-injected review steps
    if (event.step.startsWith("guard:review")) return [];
    
    // Check QA review result (if this is the injected QA step)
    if (event.step === "guard:gatekeeper-review") {
      const text = event.result.lastAssistantText ?? "";
      const rejected = /reject|block|fail|not approved/i.test(text) 
        && !/approved|pass|clean/i.test(text);
      if (rejected) {
        return [{ type: "block", reason: "QA review rejected the changes" }];
      }
      return []; // Approved, continue
    }
    
    const changedFiles = getChangedFiles(event.result);
    const systemFiles = changedFiles.filter(f => isSystemScope(f));
    
    if (systemFiles.length === 0) return [];
    
    // Build review task for QA
    const fileList = systemFiles.join("\n  - ");
    const reviewTask = [
      `[GUARD:GATEKEEPER] Review system-scope changes from step "${event.step}".`,
      ``,
      `## System-scope files modified:`,
      `  - ${fileList}`,
      ``,
      `## Review checklist:`,
      `1. Read the diff for each file (use \`git diff\` or read the file)`,
      `2. Check: Does this change break existing behavior?`,
      `3. Check: Is this a reasonable change for the task at hand?`,
      `4. Check: Are there tests for the changes?`,
      `5. If all checks pass: finish(status: "success", summary: "APPROVED: ...")`,
      `6. If issues found: finish(status: "failure", summary: "REJECTED: ...")`,
    ].join("\n");

    return [{
      type: "run_step",
      reason: `${systemFiles.length} system-scope file(s) modified: ${systemFiles.join(", ")}`,
      step: {
        agent: "qa",
        label: "guard:gatekeeper-review",
        task: reviewTask,
      },
    }];
  },
};
```

### Mode B: Proactive Cron Scan (Catching What the Guard Can't)

The workflow guard only fires during workflows. Many changes happen outside workflows — direct sessions, heartbeats, manual intervention. Bob's pre-merge design identified this gap: you need a **periodic scan** that catches unreviewed changes.

**What it catches that Mode A can't:**

| Scenario | Why Mode A misses it | Mode B catches it |
|----------|---------------------|-------------------|
| Agent runs `git merge review/X` in bash | Not a workflow step | Scans main for new system-scope commits |
| Emergency bypass commit (`REVIEW_GATE_BYPASS=1`) | Pre-commit hook skipped | Detects unreviewed commits on main |
| Stale review branches (agent session crashed) | Workflow never completed | Finds branches with no recent activity |
| Design doc committed during heartbeat | Heartbeats aren't workflows | Scans for new design docs |
| Direct `agents.call()` outside a workflow | No workflow guard context | Scans branch state |

**Implementation:** A session subscriber (or May cron job) that runs every 10-15 minutes:

```typescript
// Pseudocode — runs as a cron subscriber or May heartbeat check
function proactiveScan() {
  // 1. Check main for unreviewed system-scope commits since last scan
  const lastScanned = readState("gatekeeper-last-scanned-commit");
  const newCommits = git("log", lastScanned + "..HEAD", "--name-only");
  const unreviewed = newCommits.filter(c => hasSystemScopeFiles(c) && !hasReviewTag(c));
  
  if (unreviewed.length > 0) {
    // Dispatch QA review of unreviewed commits
    dispatch("qa", buildReviewTask(unreviewed));
    // Or flag for Hao if critical
  }
  
  // 2. Find stale review branches (>30 min with no review)
  const staleBranches = git("branch", "--list", "review/*")
    .filter(b => branchAge(b) > 30 * 60 * 1000 && !hasBeenReviewed(b));
  
  if (staleBranches.length > 0) {
    // Dispatch QA review for each stale branch
    for (const branch of staleBranches) {
      dispatch("qa", buildBranchReviewTask(branch));
    }
  }
  
  // 3. Detect bypass commits (committed to main with REVIEW_GATE_BYPASS)
  // These need post-hoc audit
  const bypassCommits = git("log", "--grep=BYPASS", "--grep=hotfix", lastScanned + "..HEAD");
  if (bypassCommits.length > 0) {
    flag("hao", `${bypassCommits.length} bypass commits need post-hoc review`);
  }
  
  updateState("gatekeeper-last-scanned-commit", "HEAD");
}
```

**Where it lives:** This can be:
- A **session subscriber** listening to a periodic timer event (new event type)
- A **May cron job** (simplest — May already has cron infrastructure)
- A **dedicated handler** in May's handlers (like Bob's design proposes)

The recommended approach is **May's cron** — it's the simplest, already exists, and May is the gatekeeper. The cron job dispatches reviews; it doesn't do the review itself.

**State tracking:** Uses `.state/gatekeeper-last-scanned-commit` (a single file with the last commit hash scanned). Simple, no DB needed for Phase 1.

### Mode C: May Proactive Design Review (Heartbeat)

Separate from the automated systems, May's heartbeat should also proactively check for designs/proposals that could break the system and need extra approval. This catches judgment calls that automated scanning can't make.

**What May should check during heartbeats:**
1. New/modified design docs with proposals that affect system behavior
2. Experiment designs that propose changing system behavior (like EXP-150)
3. Proposals from agents that need Hao's approval before implementation proceeds

**Implementation:** Update May's heartbeat instructions — behavioral change, no code needed. This is the human-judgment layer that complements the automated modes.

## Design Decisions

### Q1: What about changes that bypass workflows?

**Mode A (workflow guard)** catches changes during workflows. **Mode B (cron scan)** catches everything else:
- Direct merges via `git merge` in bash → Mode B detects new system-scope commits on main
- Emergency bypass commits → Mode B flags for post-hoc audit
- Stale review branches → Mode B dispatches review for abandoned branches
- Changes during heartbeats → Mode B scans periodically

The three modes are complementary — Mode A is preventive (blocks during workflow), Mode B is detective (scans after the fact), Mode C is judgmental (May's human-like review of designs/proposals).

### Q2: Won't this make workflows slower?

Yes — system-scope changes add one QA session (~30-60 seconds). This is the point. The alternative is broken production code. Agent-scope changes (vast majority) are unaffected.

### Q3: What if QA is wrong?

The escalation chain applies: if QA blocks incorrectly, the agent escalates to its owner, who escalates to May, who escalates to Hao. The guard stays enforced — nobody bypasses, but the decision can be overridden through the chain.

### Q4: Should guard changes review themselves?

If an agent modifies `agents/shared/guards/gatekeeper.ts`, the gatekeeper guard will trigger a review of itself. This is intentional — the guard system should be self-protecting.

### Q5: What about the auto-test guard overlap?

`auto-test` checks if tests were run. `gatekeeper` checks if the change was reviewed. They're orthogonal — both can fire on the same step. The workflow runtime handles multiple demands correctly (deduplication, ordering).

## Open Questions (For Bob & Tech-Lead)

1. **File detection accuracy:** The `getChangedFiles` approach scans messages for tool calls. Should we also check `git diff` in the review branch? (Tech-lead: is this feasible in a guard's pure-function constraint?)

2. **Review quality:** QA's review is an LLM session — it could hallucinate approval. Should we add structural checks (e.g., require QA to cite specific files it read)?

3. **Workflow-done event:** Should the guard also fire on `workflow_done` to do a final review of all changes across all steps? Or is per-step review sufficient?

4. **Cost:** Each system-scope step adds a QA session. For workflows with 3 system-scope steps, that's 3 QA sessions. Should we batch reviews (one QA session at workflow end)?

5. **May's heartbeat update:** Bob — what should the exact heartbeat text say for the proactive design review?

## Implementation Order

1. **Phase 1:** Write the `gatekeeper` guard in `agents/shared/guards/gatekeeper.ts` — ~80 lines
2. **Phase 2:** Update May's heartbeat with design review instructions — 0 code
3. **Phase 3:** Add review metrics to DB (optional) — track what got reviewed, who approved

## References

- Bob's pre-merge design: `agents/bob/workspace/archive/2026-04/DESIGN-pre-merge-review-gate.md`
- Guard system design: `agents/may/workspace/DESIGN-workflow-guards.md`
- Bob's guard review: `agents/bob/workspace/review-guards-v2.md`
- Guard escalation: `agents/shared/may-agent-docs/design/guard-escalation.md`
- Gatekeeper role: `agents/shared/may-agent-docs/design/may-gatekeeper.md`
