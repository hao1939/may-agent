# Design: `issue-lifecycle` Workflow

## Overview

Event-driven workflow that carries system issues from discovery through resolution. Each phase is a `ctx.runAgent()` call. Simple issues skip heavyweight phases via a triage gate.

## Task Format

```
title: <one-line issue description>
source: <metrics-snapshot | repo-gate | agent-report | manual>
severity: <critical | regression | minor>
evidence: <what was observed — metric values, error output, session ID>
context: <optional — files involved, recent changes, hypotheses>
agent: <optional — override default assignee, default: coder>
```

## Phases

### Phase 0: Triage (runFunction — no LLM)

Pure JS function. Classifies the issue by severity and decides the path:

- **critical** (production broken, security): Phase 1 → 3 → 4 (skip design/review)
- **regression** (metric dropped, test failing): Phase 1 → 2 → 3 → 4
- **minor** (style, small improvement): Phase 1 → 3 → 4 (skip design/review)

This is the scope control mechanism. A metric blip classified as `minor` never spawns a 5-phase pipeline.

```ts
const triage = await ctx.runFunction("triage", () => {
  // Parse severity from task input
  // If severity not provided, infer from source:
  //   metrics-snapshot with >20% regression → "regression"
  //   metrics-snapshot with <20% → "minor"  
  //   repo-gate failure → "regression"
  //   agent-report → "minor" (default)
  return JSON.stringify({ path, severity, assignee });
});
```

### Phase 1: Investigate (runAgent)

Agent reads the evidence, reproduces the issue, identifies root cause.

**Output**: Write `workspace/issue-investigation.md` with:
- Root cause (or "UNKNOWN" if can't determine)
- Scope: which files/systems affected
- Complexity: `trivial` (one-line fix) | `moderate` (multi-file) | `complex` (architectural)
- Proposed fix approach (1-3 sentences)

**Early exit**: If complexity is `trivial`, skip Phase 2 entirely — go straight to Phase 3.

**Failure handling**: If investigation fails or agent errors, escalate. Don't guess at root causes.

### Phase 2: Design (runAgent) — conditional

Only runs for `moderate` or `complex` issues on the `regression` path.

Agent reads investigation output and writes a fix plan to `workspace/issue-fix-plan.md`.

**Human gate**: If complexity is `complex`, the workflow checks for a `humanApproval: true` field. If not present, escalate with the design doc and block until approval. Implementation:

```ts
if (complexity === "complex") {
  return ctx.escalate("Complex issue requires approval", {
    investigation: investigationSummary,
    fixPlan: designSummary,
    resumeWith: "humanApproval: true",
  });
}
```

The caller (or Hao) can re-invoke the workflow with approval to resume from Phase 3.

### Phase 3: Implement (runAgent)

The coding phase. Agent reads investigation (and design if it exists) and makes the fix.

**Composition decision**: Use `ctx.runAgent()` directly, NOT `ctx.runWorkflow("persistent-task")`. Rationale:
- persistent-task is for open-ended work that needs steering over many iterations
- Issue fixes are bounded (specific root cause, specific fix) — KE-013 says bounded tasks succeed
- persistent-task's worker/owner loop adds overhead that's wasted on a focused fix
- If the fix requires multiple iterations, the retry in Phase 4 handles it

For genuinely complex multi-session fixes, the Design phase (Phase 2) should break the work into sub-tasks, and each sub-task gets its own implement→verify cycle.

### Phase 4: Verify (runFunction)

Shell verification — no LLM. Runs the appropriate verification command:

```ts
const verify = await ctx.runFunction("verify", async () => {
  // 1. Type check: tsc --noEmit
  // 2. Tests: vitest --run
  // 3. If source was metrics-snapshot: re-run the specific metric check
  // Return PASS/FAIL + output
});
```

**Retry logic**: If verify fails, return to Phase 3 with the error output (like implement-and-verify). Max 2 attempts total. After 2 failures → escalate.

## Phase Transition Logic

```
START → Triage (Phase 0)
  ├─ critical/minor → Investigate (1) → Implement (3) → Verify (4) → DONE
  └─ regression → Investigate (1)
                    ├─ trivial → Implement (3) → Verify (4) → DONE
                    ├─ moderate → Design (2) → Implement (3) → Verify (4) → DONE
                    └─ complex → Design (2) → ESCALATE (human gate)
                                               └─ [approved] → Implement (3) → Verify (4) → DONE

On any phase error:
  Phase 0 (triage): impossible (pure function)
  Phase 1 (investigate): escalate immediately
  Phase 2 (design): escalate immediately  
  Phase 3 (implement): retry once with error context, then escalate
  Phase 4 (verify): retry Phase 3→4 once, then escalate
```

## Trigger Integration

Event sources invoke this workflow via `ctx.runWorkflow("issue-lifecycle", task)`.

### metrics-snapshot (primary trigger)

Currently fires `trackRequest` on regression (line ~316). Change to:

```ts
// Instead of:
ctx.trackRequest({ fromEntity: "metrics-snapshot", toAgent: metric.owner, task, ... });

// Do:
ctx.runWorkflow("issue-lifecycle", [
  `title: Metric '${metric.name}' regressed: ${oldValue} → ${newValue}`,
  `source: metrics-snapshot`,
  `severity: ${Math.abs(newValue - oldValue) / oldValue > 0.2 ? "regression" : "minor"}`,
  `evidence: ${metric.name}: ${oldValue} → ${newValue} (${explanation})`,
].join("\n"));
```

### repo-gate-check

On gate failure, invoke with `source: repo-gate`, `severity: regression`.

### session-subscribers / agent reports

When an agent discovers an issue mid-session, it can fire:
```ts
ctx.runWorkflow("issue-lifecycle", `title: ...\nsource: agent-report\nseverity: minor\nevidence: ...`);
```

### Manual invocation

Any agent or human can trigger directly:
```
workflow run issue-lifecycle
title: Tests failing after dependency update
source: manual
severity: regression
evidence: vitest --run shows 3 failures in src/lib/
```

## Error Handling Summary

| Phase | On Error | Rationale |
|-------|----------|-----------|
| Triage | Escalate (shouldn't happen) | Pure function |
| Investigate | Escalate | Can't fix what you don't understand |
| Design | Escalate | Bad design → bad fix |
| Implement | Retry once with error context | Transient failures common |
| Verify | Retry implement+verify once | First attempt often close |
| 2x verify fail | Escalate | Avoid infinite retry loops |

## Scope Control

Three mechanisms prevent overreaction to minor issues:

1. **Triage gate** (Phase 0): Minor issues skip design/review phases entirely
2. **Complexity classification** (Phase 1): Trivial fixes skip design
3. **Human gate** (Phase 2): Complex/architectural changes require approval before implementation

A metric blip flows: Triage(minor) → Investigate → Implement → Verify. Four steps, two LLM calls. Fast and cheap.

## Implementation Skeleton

```ts
export const name = "issue-lifecycle";
export const description = "Event-driven issue lifecycle: triage → investigate → [design] → implement → verify.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // Phase 0: Triage
  const triage = await ctx.runFunction("triage", async () => {
    const severity = parseSeverity(ctx.task);
    const path = severity === "regression" ? "full" : "fast";
    return JSON.stringify({ severity, path });
  });
  const { severity, path } = JSON.parse(triage.lastAssistantText!);
  const agent = parseAgent(ctx.task) ?? "coder";

  // Phase 1: Investigate
  const investigate = await ctx.runAgent(agent, buildInvestigatePrompt(ctx.task));
  if (investigate.status === "error") {
    return ctx.escalate("Investigation failed", { error: investigate.error });
  }
  const complexity = extractComplexity(investigate.lastAssistantText ?? "");

  // Phase 2: Design (conditional)
  if (path === "full" && complexity !== "trivial") {
    const design = await ctx.runAgent(agent, buildDesignPrompt(ctx.task, investigate));
    if (design.status === "error") {
      return ctx.escalate("Design failed", { error: design.error });
    }
    if (complexity === "complex") {
      return ctx.escalate("Complex issue requires human approval", {
        investigation: ctx.summarize(investigate),
        design: ctx.summarize(design),
      });
    }
  }

  // Phase 3+4: Implement and Verify (with retry)
  for (let attempt = 1; attempt <= 2; attempt++) {
    const impl = await ctx.runAgent(agent, buildImplementPrompt(ctx.task, investigate, attempt));
    if (impl.status === "error") {
      if (attempt === 2) return ctx.escalate("Implementation failed twice");
      continue;
    }

    const verify = await ctx.runFunction("verify", async () => {
      // Run tsc + vitest + source-specific checks
      return runVerification();
    });

    if (verify.status === "done" && verify.lastAssistantText?.includes("PASS")) {
      return ctx.done(`Issue resolved in ${attempt} attempt(s): ${ctx.summarize(impl, { maxLength: 500 })}`);
    }
  }

  return ctx.escalate("Verification failed after 2 attempts");
}
```

## Design Decisions

1. **No persistent-task composition**: Issue fixes are bounded tasks. persistent-task's iteration loop adds overhead without value here. If an issue truly needs multi-session work, the human gate catches it and a human can spin up persistent-task separately.

2. **runFunction for triage and verify**: No LLM cost for mechanical decisions. Triage is just severity parsing; verification is just shell commands.

3. **Escalate-heavy error handling**: Better to surface problems than silently retry into nonsense. The skill-lifecycle pattern of checking result text for keywords works well.

4. **Human gate via escalate()**: No polling or approval queue. The workflow simply returns with context. Re-invocation with approval flag resumes from Phase 3. Simple, stateless.
