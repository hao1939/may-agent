# Audit: HandlerContext Surface Area

**Date**: 2026-04-11
**Lens**: A (System Architecture)
**Scope**: `src/lib/handler-context.ts`, 27 handlers in `agents/may/handlers/`, construction site in `src/app/agent-loader.ts`

## Summary

HandlerContext has 16 properties. Only 8 are used by more than 2 handlers. **4 properties (25%) are completely unused by any handler** — they exist on the interface but zero handlers call them. The interface is over-broad but stable; it's not causing bugs, just carrying dead weight.

**Verdict**: Not a pressing simplification target. The dead properties should be pruned, but the interface pattern itself (dependency injection bag) is appropriate for this use case.

## Property Usage Heat Map

| Property | Handlers using | % | Tier |
|----------|---------------|---|------|
| `log` | 26/27 | 96% | Core |
| `getDb` | 14/27 | 52% | Core |
| `agentsRoot` | 13/27 | 48% | Core |
| `projectRoot` | 12/27 | 44% | Core |
| `emit` | 10/27 | 37% | Common |
| `persistDir` | 10/27 | 37% | Common |
| `manager` | 4/27 | 15% | Specialized |
| `notify` | 4/27 | 15% | Specialized |
| `agentName` | 4/27 | 15% | Specialized |
| `triggerNow` | 3/27 | 11% | Specialized |
| `loadAllSessionMetas` | 1/27 | 4% | Rare |
| `writeHeuristicEvaluations` | 1/27 | 4% | Rare |
| **`getSessionId`** | **0/27** | **0%** | **Dead** |
| **`trackRequest`** | **0/27** | **0%** | **Dead** |
| **`evaluateTask`** | **0/27** | **0%** | **Dead** |
| **`writeSkippedEvaluations`** | **0/27** | **0%** | **Dead** |

## Key Findings

### 1. Four dead properties (0 handler usage)

- **`getSessionId`**: Exposed for "followUp" use but no handler calls it. cron.ts uses getSessionId() internally (line 865, 75), but it never flows through HandlerContext.
- **`trackRequest`**: Already marked `@deprecated` in the interface. Zero handlers use it. cron.ts calls `trackRequest()` directly via its own import. Should be removed.
- **`evaluateTask`**: Zero handlers use it. The evaluation pipeline runs from cron.ts inline code, not through handlers.
- **`writeSkippedEvaluations`**: Zero handlers use it. Same situation — evaluation logic lives in cron.ts, not delegated to handlers.

These four properties were likely added speculatively ("handlers might need this") but the use cases stayed in cron.ts.

### 2. The interface is a flat dependency injection bag — and that's OK

The HandlerModule pattern is:
```ts
export function create(ctx: HandlerContext, entry: CronEntry) {
  return async () => { /* use ctx.log, ctx.getDb, etc */ };
}
```

This is a standard factory-injection pattern. The alternative (splitting into smaller interfaces) would add complexity without real benefit since:
- All handlers share one `ctx` object per agent (built once in agent-loader.ts, line 699)
- TypeScript already enforces the contract at compile time
- Handlers can destructure what they need: `const { log, getDb } = ctx;`

### 3. Most handlers use 2-5 properties

| Properties used | Handler count | Examples |
|----------------|---------------|---------|
| 1 | 2 | watchdog (log), heartbeat-context (log) |
| 2 | 5 | agents-auto-commit, tracker-compact, zombie-cleanup, etc. |
| 3 | 6 | analyze-failures, audit-requests, coaching-feedback, etc. |
| 4-5 | 9 | run-agent-task, run-workflow, daily-brief, etc. |
| 6+ | 5 | convention-check (6), system-status (9), daily-digest (5), task-watchdog (6), tool-quality-scan (5) |

The median handler uses **3 properties**. system-status is the heaviest user at 9/16.

### 4. Blast radius of changing HandlerContext

Only **3 files in src/** touch it:
- `src/lib/handler-context.ts` — definition
- `src/lib/index.ts` — re-export
- `src/app/agent-loader.ts` — construction (one site, line 699)

Plus **27 handler files** in `agents/may/handlers/` that import the type.

**Adding a new property**: Low blast radius. Add to interface + add to construction site in agent-loader.ts. Handlers opt in.

**Removing a property**: Need to check all 27 handlers. But since we now know usage counts, removing dead properties (0 usage) is safe.

**Renaming/restructuring**: Would touch all 27 handlers — not worth it unless there's a compelling reason.

### 5. `log` is universal but `notify` is rare

`log` (26/27) vs `notify` (4/27) suggests the distinction is well-understood: `log` is diagnostic (EventBus info channel), `notify` reaches the human (Telegram). The 4 handlers that notify are the right ones: daily-brief, daily-digest, health-trend, task-watchdog.

## Recommendations

### Do Now (low effort, clear win)
1. **Remove 4 dead properties** from HandlerContext: `getSessionId`, `trackRequest`, `evaluateTask`, `writeSkippedEvaluations`. They're unused and add cognitive load when reading the interface. Remove from both the interface definition and the construction site in agent-loader.ts.

### Don't Do
1. **Don't split HandlerContext into smaller interfaces** (e.g., "HandlerContextLite" for simple handlers). The single flat bag is simpler than a type hierarchy, and TypeScript's structural typing means handlers already ignore what they don't use.
2. **Don't add lazy-loading or proxy patterns**. The construction is trivial (closures over existing values). No performance concern.

### Watch
1. **`loadAllSessionMetas` and `writeHeuristicEvaluations`** are used by only 1 handler each. If those handlers get refactored or removed, these become dead too.
2. If handler count grows beyond ~30, consider grouping by domain (evaluation handlers, monitoring handlers) rather than one flat HandlerContext.

## Appendix: Per-Handler Detail

```
active-nudge (265L):        agentsRoot, log, manager, projectRoot
agents-auto-commit (709L):  log, projectRoot
analyze-failures (509L):    agentsRoot, getDb, log
audit-requests (260L):      getDb, log, persistDir
coaching-feedback (161L):   emit, getDb, log
coaching-report (233L):     agentsRoot, getDb, log, persistDir
convention-check (1078L):   agentsRoot, emit, getDb, log, persistDir, triggerNow
daily-brief (282L):         agentsRoot, getDb, notify, persistDir, projectRoot
daily-digest (247L):        agentsRoot, getDb, log, notify, projectRoot
error-log-scanner (384L):   agentsRoot, emit, log
evaluation-sync (362L):     getDb, log, projectRoot, writeHeuristicEvaluations
health-trend (235L):        emit, getDb, log, notify
heartbeat-context (402L):   log
lessons-graduation (258L):  agentName, agentsRoot, log, triggerNow
memory-trimmer (303L):      agentName, agentsRoot, log, persistDir
repo-gate-check (273L):     emit, log, projectRoot
research-sync (62L):        emit, getDb, log, projectRoot
run-agent-task (304L):      log, manager, persistDir, projectRoot
run-workflow (240L):        agentsRoot, log, manager, persistDir
session-sync (162L):        emit, getDb, log, projectRoot
system-status (223L):       agentName, agentsRoot, emit, getDb, loadAllSessionMetas, log, persistDir, projectRoot, triggerNow
task-watchdog (375L):       emit, getDb, log, notify, persistDir, projectRoot
tool-quality-scan (426L):   agentsRoot, emit, getDb, log, persistDir
tracker-compact (146L):     log, projectRoot
watchdog (129L):            log
workspace-compaction (344L): agentName, agentsRoot, log
zombie-cleanup (23L):       log, manager
```
