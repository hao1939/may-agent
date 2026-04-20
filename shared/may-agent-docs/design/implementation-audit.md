# Implementation vs Design Audit — 2026-04-20

## Gaps Found

### GAP 1: "Already in context" lie (CRITICAL)
**File**: `src/lib/manager.ts` line 479
**Issue**: Runtime environment tells agents: "Already in context (do NOT re-read): SOUL.md, common-sense.md, standing-orders.md, knowledge-essentials.md, skills/*.md"
**Reality**: Only SOUL.md and common-sense.md are actually injected. Standing-orders, knowledge-essentials, and skills are NOT in the prompt.
**Impact**: Agents think they have context they don't. They won't re-read these files because they're told not to. This means standing orders, knowledge essentials, and skills are effectively invisible.
**Fix**: Change to: "Already in context (do NOT re-read): SOUL.md, common-sense.md" — Remove the false claims. Or: actually inject them (but that contradicts our on-demand design).
**Recommendation**: Fix the code to be honest. On-demand is correct per our philosophy. The line should say only what's truly injected.

### GAP 2: Session digests still injected (DESIGN CONFLICT)
**File**: `src/lib/manager.ts` buildSessionContext()
**Issue**: The code still injects recent task history (digests), cross-agent digests, and unresolved items into the first user message.
**Design says**: "User message = task only" (context-injection-design.md)
**Reality**: User message = task + session context + recent history + cross-agent activity
**Impact**: Not necessarily bad — agents get useful continuity. But it contradicts our stated design.
**Recommendation**: Update the design doc to acknowledge this. Session digest injection solves the "session continuity" open problem (#1). We archived the design docs for it but the implementation is still active and useful. Either: (a) align the design to match reality (digests are useful, keep them), or (b) remove the code to match the design. Given that session continuity is an open problem, option (a) seems right.

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
