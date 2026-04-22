# Context Learning System

## Status: Proven Effective (Narrow Scope)

A/B testing on 2026-03-27 showed context.md **does change agent behavior** — but only for environmental knowledge the agent can't derive from project files.

## The Problem

Each session starts fresh. Agents rediscover the same environmental constraints, repeat the same mistakes, don't know what worked or failed in prior sessions.

## The Evidence

### What works: Environmental knowledge (not in any file)

A/B test — `context-npx-avoidance` scenario, 3 runs each, 100% consistent:

| Run | context.md | npx attempted | Result |
|-----|-----------|---------------|--------|
| WITHOUT (×3) | absent | yes (always) | Agent tries npx → fails → recovers |
| WITH (×3) | "npx not available, use node_modules/.bin/" | no (never) | Agent uses correct path directly |

Real data backing this: 82 out of 100 coder sessions used `npx` despite it not being available in the container. This wastes 1-3 ops per session.

### What doesn't work: Derivable knowledge (already in project files)

A/B test — `context-proof-runtime` and `context-proof-config` scenarios:

| Scenario | WITH context | WITHOUT context | Delta |
|----------|-------------|----------------|-------|
| Runtime discovery (bun vs node) | PASS 8/8 | PASS 8/8 | **None** |
| Config location | PASS 7/7 | PASS 7/7 | **None** |

Claude reads package.json, sees `bun:test`, and knows to use bun — with or without context.md.

### Why the difference

Context.md helps when the knowledge **doesn't exist in any file the agent can read**:
- ✅ Environment constraints: "npx not available", "port 6443 blocked"
- ✅ Historical failures: "approach X failed because Y, use Z"
- ✅ Team preferences: "user wants concise answers"
- ✅ Cross-session patterns: "coder hits this error 5× — workaround is..."
- ❌ Project facts: runtime, config locations, dependencies → agent reads these from files

### Weaker model hypothesis

Claude Sonnet 4 derives project facts from files. A weaker model (GPT-4o-mini, Gemini Flash) might not. Context.md's value scales inversely with model capability. Not tested yet — becomes relevant when optimizer downgrades models for cost.

## Architecture

### Three layers

```
1. Extraction     →  extractFacts() (LLM) or extractFactsMechanical() (pattern matching)
2. Context file   →  applyContextUpdates() or mergeContext() (LLM produces complete file)
3. Convenience    →  learnFromSession(), learnFromText(), context-learn workflow
```

### Triggering

```
session ends
  → handleCompletion fires onSessionComplete
    → evaluateTask runs (3s delay)
      → bus.emit("context-learn", { agentName, sessionId, persistDir })
        → listener in may.ts (filtered by CONTEXT_LEARN_AGENTS env var)
          → learnFromSessionLLM() [primary] or learnFromSession() [fallback]
            → writes agents/<name>/context.md
              → next session: buildSessionContext loads it as "What You Know"
```

### Enable/disable

```bash
# Enable for specific agents
CONTEXT_LEARN_AGENTS=coder,tech-lead

# Enable for all
CONTEXT_LEARN_AGENTS=all

# Disable (default)
# unset or empty
```

Meta-agents (evaluator, coach, judge) are always excluded.

### Two extraction modes

**LLM merge (primary)**: Evaluator agent reads transcript + existing context.md, produces the complete updated context.md. Handles conflicts, dedup, staleness, reorganization. Cost: ~$0.01/session.

**Mechanical (fallback)**: Pattern matches on tool calls. Catches: npm→bun corrections, node→deno, path corrections, runtime file discovery. Misses: build dependencies, architectural patterns, implicit constraints.

### Workflow

`agents/shared/workflows/context-learn.ts` — invokable by any agent:

```
workflow context-learn
agent: coder
contextPath: agents/coder/context.md

<transcript or text to learn from>
```

Steps: parse → LLM extract+merge → write → verify. Produces diff summary.

### Reuse

The extraction functions are decoupled. Call from anywhere:

```typescript
// Post-session (automatic)
learnFromSessionLLM({ agentDir, messages, agentName, task, manager });

// Ad-hoc from any text
learnFromText(contextPath, prReviewText, manager, "Code review on PR #42");

// Merge with full conflict resolution
mergeContext(contextPath, transcript, manager, "Agent: coder");

// Mechanical only (no LLM, for gym/tests)
learnFromSession({ agentDir, messages });

// Low-level
const updates = extractFactsMechanical(messages);
applyContextUpdates(contextPath, updates);
```

## What belongs in context.md

**YES — environmental knowledge:**
- `npx is not available — use ./node_modules/.bin/<tool> or bun x <tool>`
- `Docker container has no sudo — use bun install --no-save for temp deps`
- `Port 6443 requires NSG rule — check Azure portal before debugging connectivity`

**YES — historical patterns:**
- `manager.ts uses lazy DB init — call getDb() not import db directly`
- `SOUL.md text changes don't fix judgment failures (coach proved 0/18) — use workflows`
- `gym scenarios cost $0.05-0.15 each — don't run full baseline casually`

**YES — team/user preferences:**
- `User prefers concise answers over explanations`
- `Don't modify common-sense.md — human-controlled`
- `One task per agent, end-to-end — avoid long coordination chains`

**NO — derivable from project files:**
- ~~"Project uses Bun runtime"~~ → agent reads package.json
- ~~"Config at config/database.json"~~ → agent runs find/grep
- ~~"Tests use vitest"~~ → agent reads test files

## Files

| File | Purpose |
|------|---------|
| `agents/shared/evaluation/context-learn.ts` | Core extraction + context file management (moved from src/lib/) |
| `src/app/event-bus.ts` | `context-learn` event type |
| `src/app/may.ts` | Event listener, CONTEXT_LEARN_AGENTS filter |
| `src/lib/manager.ts` | `buildSessionContext()` loads context.md; `applyContextUpdates()` writes it |
| `agents/shared/workflows/context-learn.ts` | Workflow for agent/human-triggered learning |
| `scripts/context-learn-ab.sh` | A/B comparison script |

## Gym scenarios

| Scenario | What it tests | Result |
|----------|--------------|--------|
| `context-npx-avoidance` | Environmental knowledge (npx unavailable) | **✅ Proven: 3/3 WITH avoided npx, 3/3 WITHOUT used npx** |
| `context-learning` | Basic fact extraction via finish() | Pass but doesn't prove improvement |
| `context-learning-correction` | Remove+add wrong facts | Pass but doesn't prove improvement |
| `context-learning-restraint` | No spam on trivial tasks | Pass |
| `context-proof-runtime` | Runtime discovery (bun) | **No difference with/without context** |
| `context-proof-config` | Config location | **No difference with/without context** |
| `context-proof-build` | Build dependency (codegen) | Broken — mechanical extractor can't detect |

## Tests

- `test/context-learn.test.ts` — 7 tests for mechanical extraction patterns
- `test/context-learning.test.ts` — 6 tests for context file persistence (applyContextUpdates in manager.ts)

## Cost

- LLM merge: ~$0.01/session (evaluator agent, single turn)
- Mechanical: $0 (pattern matching only)
- Storage: context.md capped at 2KB per agent

## Recommendations

1. **Deploy now**: Set `CONTEXT_LEARN_AGENTS=coder` on k3s. Seed with known facts (npx unavailability).
2. **Measure weekly**: Track coder's avg quality score (currently 0.7) against gym baseline.
3. **Seed manually**: Don't wait for the extractor to discover known facts. Write them.
4. **Don't over-invest**: Mechanical extraction is limited. LLM merge is the real path.
5. **Revisit on model downgrade**: When optimizer switches to cheaper models, context.md becomes more valuable.
