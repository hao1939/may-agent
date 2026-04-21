# Implementation vs Design Audit — 2026-04-20

## Gaps Found

### GAP 1: "Already in context" lie (FIXED 2026-04-21)
**File**: `src/lib/manager.ts` line 474
**Status**: ✅ FIXED — now correctly says "Already in context (do NOT re-read): SOUL.md, common-sense.md"

### GAP 2: Session context is dead code (FIXED 2026-04-21)
**Status**: ✅ FIXED — `buildSessionContext()` removed. Only comment references remain. Session continuity tracked by context-learning project.

### GAP 3: Metric alerts — functional but coupled (NEEDS REFACTORING)
**File**: `agents/may/handlers/metrics-snapshot.ts`
**Status**: `autoForkForAlert()` works — agents get forked on breach. But measurement and response are coupled in one handler. Per P1 (everything is an event), metrics-snapshot should emit `metric.breach` events and a separate `metric-alert` handler should subscribe and route the response. See [closing-the-loop.md](closing-the-loop.md) G9.

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
