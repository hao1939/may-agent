# Finding: may.ts Architecture Review (1243 LOC)

**Lens**: A (System Architecture)  
**File**: `src/app/may.ts`  
**Date**: 2026-04-16  
**Severity**: Medium — file is functional but has grown beyond "wiring" into a mixed-concern monolith

---

## 1. Responsibilities (8 distinct concerns)

| # | Responsibility | Lines (approx) | Notes |
|---|---------------|-----------------|-------|
| 1 | CLI arg parsing & mode selection | 96–135, 908–960 | `--cron`, `--oneshot`, `--chat`, `--status`, `--message`, `--task` |
| 2 | Model configuration | 143–181 | `models` dict with Anthropic direct/proxy logic |
| 3 | Instance identity / PID management | 56–88, 860–877, 1070–1090 | `writeIdentity()`, PID file lifecycle |
| 4 | EventBus wiring + subscriber registration | 183–270 | DbWriter, context updater, stuck detector, auto-resume, digest writer |
| 5 | Session lifecycle bus subscribers (recovery, eval, escalation, context-learn) | 350–610 | 4 large `bus.subscribe()` blocks with significant business logic |
| 6 | SubagentManager + ApiGate construction | 301–345 | Infrastructure wiring |
| 7 | Graceful shutdown / restart / signal handling | 613–700 | `gracefulShutdown()`, `gracefulRestart()`, signal handlers |
| 8 | Startup orchestration (oneshot, task, chat, cron modes) | 908–1243 | Mode-specific boot sequences, cron resume, readline setup |

## 2. Handler registrations vs. handler files

No duplication found. Handler registration is delegated to `loadAgentHandlers()` (agent-loader.ts, line ~1118). The bus subscribers in may.ts are **not** agent handlers — they're infrastructure lifecycle hooks (recovery, evaluation, escalation). These are correctly located in the app entry point rather than in handler files.

## 3. evaluateTask() usage

`evaluateTask()` is called at line 425 inside a `bus.subscribe()` block (lines 412–460). The call itself is clean — it delegates to `src/lib/evaluator.ts`. However, it **only fires for sessions with `parentSessionId`** (line 418: `if (!info.parentSessionId) return`), meaning top-level heartbeat sessions are never LLM-evaluated. This is a known issue (see checkpoint from prior session).

The evaluateTask subscriber is cohesive — it does one thing: trigger evaluation on child session completion.

## 4. Dead / vestigial code

- **`recoveryKey()` (line 271)**: Used only by the recovery subscriber. Not dead, but the function is trivial (2 lines) and exists solely for this one call site. Minor.
- **`formatDurationMs()` (line 85)**: Used in `writeIdentity` on exit and oneshot result. Alive.
- **All imports are consumed** — no unused imports detected.
- **`telegramAlert` late-binding (line 278)**: Initialized as no-op, set later only if `--telegram` is passed. Works but is a code smell — could be replaced by routing through the bus.
- **`require()` inside subscriber (line 568)**: The context-learn subscriber uses `require("../lib/index.js")` at runtime instead of the top-level import. This is likely to avoid circular deps but is fragile and non-obvious.

## 5. Wiring vs. business logic ratio

**~40% wiring, ~60% business logic.** A clean app entry file should be 80%+ wiring. The four large `bus.subscribe()` blocks (lines 350–610, totaling ~260 lines) contain substantial business logic:

- **Recovery subscriber** (lines 355–420): Two-tier digest/classifyError decision tree, recovery attempt tracking, requeue logic
- **Evaluation subscriber** (lines 422–460): evaluateTask + context-learn emission
- **Escalation subscriber** (lines 462–510): Digest classification, trackRequest, escalateToHuman
- **Context-learn subscriber** (lines 540–610): LLM extraction with fallback, agent directory resolution

Each of these could be extracted into its own module under `src/lib/session-subscribers.ts` or `src/app/lifecycle/`. Note that some subscribers are already extracted (`createContextUpdater`, `createRequestTracker`, `createStuckDetector`, `createAutoResume`, `createDigestWriter` from `session-subscribers.js` — lines 188–230). The inline ones are inconsistent with this pattern.

## Summary of findings

| Finding | Severity | Recommendation |
|---------|----------|----------------|
| 8 responsibilities in one file | Medium | Extract bus subscribers into lifecycle modules |
| 4 inline bus.subscribe blocks with business logic (~260 LOC) | Medium | Move to `session-subscribers.ts` (pattern already exists for 5 other subscribers) |
| `require()` inside context-learn subscriber | Low | Convert to top-level import or lazy `await import()` |
| `telegramAlert` late-binding pattern | Low | Consider routing through EventBus instead |
| Top-level sessions skip LLM evaluation | Medium | Known issue — separate fix session needed |
| Mixed `import` (top) and `import` (mid-file, lines 183, 188, 301) | Low | Group all imports at top; mid-file imports are Bun-compatible but hurt readability |

## Recommended action

Extract the 4 inline `bus.subscribe()` blocks (recovery, evaluation, escalation, context-learn) into factory functions in `src/lib/session-subscribers.ts`, matching the existing pattern (`createContextUpdater`, etc.). This would reduce may.ts by ~260 lines and make each lifecycle concern independently testable.

**Do NOT fix in this session** — this is a finding for a separate refactoring session.
