# Implementation vs Design Audit — 2026-04-20

## Gaps Found

### GAP 1: "Already in context" lie (CRITICAL)
**File**: `src/lib/manager.ts` line 479
**Issue**: Runtime environment tells agents: "Already in context (do NOT re-read): SOUL.md, common-sense.md, standing-orders.md, knowledge-essentials.md, skills/*.md"
**Reality**: Only SOUL.md and common-sense.md are actually injected. Standing-orders, knowledge-essentials, and skills are NOT in the prompt.
**Impact**: Agents think they have context they don't. They won't re-read these files because they're told not to. This means standing orders, knowledge essentials, and skills are effectively invisible.
**Fix**: Change to: "Already in context (do NOT re-read): SOUL.md, common-sense.md" — Remove the false claims. Or: actually inject them (but that contradicts our on-demand design).
**Recommendation**: Fix the code to be honest. On-demand is correct per our philosophy. The line should say only what's truly injected.

### GAP 2: Session context is dead code (NOT A CONFLICT)
**File**: `src/lib/manager.ts` buildSessionContext()
**Issue**: `buildSessionContext()` computes session history, cross-agent digests, checkpoints, session diffs, active recall — then the result is NEVER USED. `promptText = task` ignores it completely. Same for `fewShotBlock`.
**Design says**: "User message = task only" — this is CORRECT and matches the code.
**Reality**: Session context and few-shot injection are dead code. Computed but discarded.
**Impact**: Open problem #1 (session continuity) is completely unsolved. Agents truly start fresh every session with zero memory. No digests, no history, no cross-agent context.
**Recommendation**: Either (a) delete the dead code to reduce confusion, or (b) find a way to make it available on-demand (a tool agents can call to get their recent history). The dead code represents valuable functionality that was disabled when we moved to "task only" — we should decide its fate.

### GAP 3: Metric alerts don't auto-fork (INCOMPLETE)
**File**: `agents/may/handlers/metrics-snapshot.ts`
**Issue**: On metric regression, the handler calls `ctx.notify()` which sends a message. It does NOT fork the agent with a task.
**Design says**: metric-reactivity project proposes auto-fork on breach.
**Reality**: Only notification, no task dispatch.
**Impact**: Agents get FYI notifications but no actionable task. They may ignore notifications.
**Recommendation**: Implement auto-fork in metrics-snapshot handler: on threshold breach, fork the metric owner with a task describing the breach and asking for investigation. This is the metric-reactivity project's next milestone.

### GAP 4: Preferred workflows slot not implemented (MISSING)
**File**: context-injection-design.md describes "Preferred Workflows" as a replaceable slot in system prompt
**Reality**: Not implemented. No mechanism to inject per-agent workflow preferences.
**Impact**: Agents don't know which workflows to prefer. They freestyle instead of using workflows.
**Recommendation**: Add to common-sense-followups.md. Medium priority — the workflow-first project partially addresses this via cron routing.

### GAP 5: Per-step tool override not implemented (MISSING)
**File**: context-injection-design.md describes workflows overriding tools per step
**Reality**: Not implemented. `ctx.runAgent()` doesn't support tool overrides.
**Impact**: All workflow steps have full tool access. Can't constrain workers.
**Recommendation**: Low priority — current guards handle the constraint need.

### GAP 6: Evaluator runs as project owner, not independent (DESIGN QUESTION)
**File**: `agents/shared/workflows/persistent-task.ts`
**Issue**: `buildEvalPrompt` is run via `ctx.runAgent(config.owner, ...)` — the project OWNER evaluates their own work.
**Concern**: Self-evaluation bias. The owner might be lenient with their own project.
**Recommendation**: Consider running evaluator as a different agent (e.g., "evaluator" or "may"). But this adds complexity. Monitor false-done rates first — if self-evaluation works, keep it simple.

## Alignment Issues

### common-sense.md references that don't match reality:
- "Your preferred workflows are listed in a separate section of your context" — this section doesn't exist (GAP 4)
- Conventions table is correct — all paths exist

### context-injection-design.md vs implementation:
- System prompt assembly: MOSTLY aligned (SOUL + common-sense + tools + runtime)
- Missing: preferred workflows slot (GAP 4)
- User message: MISALIGNED — design says "task only" but code injects digests (GAP 2)

### persistent-task-files.md vs implementation:
- ALIGNED — all v3 features are implemented
- One issue: evaluator runs as owner, not independent (GAP 6)
