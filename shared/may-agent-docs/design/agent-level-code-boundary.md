# Design: Move Agent-Level Logic from src/lib to agents/

**Status:** ✅ Implemented  
**Date:** 2026-04-22  
**References:** [unified-event-system.md](unified-event-system.md), [runtime-ctx.md](runtime-ctx.md)

## Problem

Several files in `src/lib/` contain agent-level logic — code that makes decisions about how agents work, hardcodes agent names, and contains prompt templates. This violates the boundary between **infrastructure** (src/) and **agent behavior** (agents/).

The clearest example: `src/lib/evaluator.ts` (986 lines) calls `manager.run("evaluator", prompt)` five times. It knows what agent to call, what prompt to send, how to parse the response, when to retry, and how to score. That's not infrastructure — that's how the evaluation system works. It belongs with the agents that use it.

### Files that don't belong in src/lib

| File | Lines | Problem |
|------|-------|---------|
| `evaluator.ts` | 986 | Hardcodes `manager.run("evaluator", ...)` 5×, contains eval prompt templates, scoring logic, EXP-039 isolation re-evaluation |
| `evaluator-error-log.ts` | ~100 | Evaluator helper — formats error logs from eval results |
| `evaluator-failure-chain.ts` | ~350 | Evaluator helper — extracts failure patterns from transcripts |
| `context-learn.ts` | ~400 | Calls `manager.run("evaluator", ...)` 2× for fact extraction, contains learning prompt templates |
| `project-scanner.ts` | ~80 | Generates agent-facing text ("Use persistent-task workflow"), project system logic |

### Files that correctly stay in src/lib

| File | Why |
|------|-----|
| `session-digest.ts` | Used by manager, session-subscribers, retry logic — infrastructure plumbing |
| `persistence.ts` | Session storage — pure infra |
| `manager.ts` | Session lifecycle — pure infra |
| `handoff.ts` | Used by manager.ts and workflow-tool.ts for step-to-step result formatting — infra utility |
| `requests.ts` | DB operations — pure infra |

## Principle

**src/ = infrastructure. agents/ = behavior.** If code makes decisions about what agents do, contains prompts agents will see, or hardcodes agent names — it belongs in agents/. Infrastructure provides capabilities (run an agent, store data, emit events). Agent code decides what to do with them.

## Design

### Target layout

```
agents/shared/
├── evaluation/              # Session evaluation system
│   ├── evaluator.ts         # evaluateTask(), evaluateStandaloneSession()
│   ├── error-log.ts         # appendErrorLogs()
│   ├── failure-chain.ts     # extractFailureChains(), formatFailureChains()
│   ├── context-learn.ts     # learnFromSession(), learnFromSessionLLM()
│   └── types.ts             # TaskEvaluationResult, AgentScores, UsageSummary, etc.
├── project-scanner.ts       # buildProjectInjection(), scanActiveProjects()
└── ...existing (workflows/, guards/, knowledge/)
```

### Types stay in src/lib (interface boundary)

`TaskEvaluationResult`, `AgentScores`, `UsageSummary`, `FailureChain` — these are the **interface types** that `HandlerContext.evaluateTask` returns. They belong in `src/lib/handler-context.ts` (or a dedicated `src/lib/evaluator-types.ts`) because they're part of the RuntimeCtx contract that infrastructure exposes to handlers.

The implementation that produces these types moves to agents/. The types themselves stay.

### How the wiring works

Currently:
```
handler-context.ts  defines  evaluateTask(opts) → TaskEvaluationResult
agent-loader.ts     imports  evaluateTask from src/lib/evaluator.ts
agent-loader.ts     wires    ctx.evaluateTask = (opts) => evaluateTask(opts)
handler             calls    ctx.evaluateTask(...)
```

After:
```
handler-context.ts  defines  evaluateTask(opts) → TaskEvaluationResult      (unchanged)
agent-loader.ts     imports  evaluateTask from agents/shared/evaluation/evaluator.ts
agent-loader.ts     wires    ctx.evaluateTask = (opts) => evaluateTask(opts) (unchanged)
handler             calls    ctx.evaluateTask(...)                           (unchanged)
```

The only change in src/ is **one import path** in agent-loader.ts. Handlers don't change at all. The contract stays the same — only the implementation moves.

Same pattern for context-learn:

Currently:
```
may.ts              imports  learnFromSession, learnFromSessionLLM from src/lib/index.ts
context-learn subscriber    calls them directly
```

After:
```
may.ts (or handler) imports  from agents/shared/evaluation/context-learn.ts
```

### What changes per file

#### 1. evaluator.ts → agents/shared/evaluation/evaluator.ts

Move the file. Update imports to use relative paths to src/lib/ for infrastructure deps:
- `SubagentManager` → `../../../src/lib/manager.js`
- `readSessionMessages`, `PersistedSession` → `../../../src/lib/persistence.js`
- `upsertEvaluation`, `hasEvaluation` → `../../../src/lib/requests.js`
- `appendErrorLogs` → `./error-log.js` (moved alongside)
- `extractFailureChains` → `./failure-chain.js` (moved alongside)

Extract types (`TaskEvaluationResult`, `AgentScores`, `UsageSummary`, `ChildSessionInfo`, etc.) to `agents/shared/evaluation/types.ts`. Re-export from `src/lib/handler-context.ts` so existing consumers don't break.

#### 2. evaluator-error-log.ts → agents/shared/evaluation/error-log.ts

Move. Update imports.

#### 3. evaluator-failure-chain.ts → agents/shared/evaluation/failure-chain.ts

Move. No src/lib deps — pure logic.

#### 4. context-learn.ts → agents/shared/evaluation/context-learn.ts

Move. Update imports. The context-learn bus subscriber in may.ts updates its import path.

#### 5. project-scanner.ts → agents/shared/project-scanner.ts

Move. Used by `src/app/cron.ts` for project injection. Update import in cron.ts.

Also fix the stale "persistent-task" workflow reference (line 75-80) to "project" while moving.

#### 6. src/lib/index.ts — remove re-exports

Remove `evaluateTask`, `learnFromSession`, `learnFromSessionLLM`, `classifyError` (already on RuntimeCtx), and all evaluator type re-exports from `src/lib/index.ts`.

#### 7. src/app/agent-loader.ts — update import

Change:
```typescript
import { evaluateTask } from "../lib/evaluator.js";
```
To:
```typescript
import { evaluateTask } from "../../agents/shared/evaluation/evaluator.js";
```

#### 8. src/app/may.ts — update context-learn imports

The context-learn subscriber imports `learnFromSession`/`learnFromSessionLLM` from `src/lib/index.ts`. Update to import from `agents/shared/evaluation/context-learn.js`.

### Import direction

After this change, the import graph is:

```
agents/shared/evaluation/evaluator.ts
  → imports types from src/lib/ (manager, persistence, requests)
  → imports helpers from agents/shared/evaluation/ (error-log, failure-chain)

src/app/agent-loader.ts
  → imports evaluateTask from agents/shared/evaluation/
  → wires it into HandlerContext

agents/may/handlers/session-eval.ts
  → calls ctx.evaluateTask() (no direct import)
```

This is the same pattern as handlers: agent code imports infrastructure types, infrastructure wires agent code into the runtime context.

## Migration plan

### Phase 1: Move evaluator (biggest impact)

1. Create `agents/shared/evaluation/` directory
2. Extract types to `agents/shared/evaluation/types.ts`
3. Move `evaluator.ts` → `agents/shared/evaluation/evaluator.ts`
4. Move `evaluator-error-log.ts` → `agents/shared/evaluation/error-log.ts`
5. Move `evaluator-failure-chain.ts` → `agents/shared/evaluation/failure-chain.ts`
6. Update imports in `agent-loader.ts`, `handler-context.ts`, `src/lib/index.ts`
7. Verify: `npx tsc --noEmit`, `npm test`

### Phase 2: Move context-learn

1. Move `context-learn.ts` → `agents/shared/evaluation/context-learn.ts`
2. Update imports in `may.ts`, `src/lib/index.ts`
3. Verify

### Phase 3: Move project-scanner

1. Move `project-scanner.ts` → `agents/shared/project-scanner.ts`
2. Fix "persistent-task" → "project" workflow name
3. Update import in `cron.ts`
4. Verify

### Phase 4: Clean up src/lib/index.ts

Remove all re-exports for moved modules. `src/lib/index.ts` should only export infrastructure.

## Success criteria

1. Zero files in `src/lib/` that call `manager.run("evaluator", ...)`
2. Zero prompt templates in `src/lib/`
3. `src/lib/index.ts` only exports infrastructure (manager, persistence, types)
4. All evaluation logic lives in `agents/shared/evaluation/`
5. `npx tsc --noEmit` passes
6. `npm test` passes — pure refactor, no behavior change
