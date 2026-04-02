# Finding: LLM-to-JS Scan #3 — Coach Workflow Mechanical Steps

**Date**: 2026-03-19T00:30:00Z
**Session**: s_1773879543072_186

## Summary

Coach's `growth-cycle.ts` and `training-sprint.ts` workflows contain 3 LLM sessions that do purely mechanical work. These can be replaced with JS code that already exists in the codebase (growth-cycle Step 3 was already converted).

## Current State

In last 24h: **6 mechanical LLM sessions** consumed ~716KB of transcript, ~$7-10/day.

| Session Type | Count/24h | Avg Size | Complexity |
|---|---|---|---|
| Ceiling-effect gate (baseline test) | 2 | 29KB | LOW — runs gym, checks pass/fail |
| Record ceiling-effect skip | 1 | 23KB | TRIVIAL — appends 1 JSONL line |
| Sprint gym tests (Step 3) | 1 | 62KB | LOW — runs gym for multiple forks |
| Record experiment results | 1 | 258KB | MEDIUM — edits catalog, judgment |
| Record sprint results | 1 | 315KB | MEDIUM — edits catalog, judgment |

## Clean JS Replacements (3 changes)

### 1. Ceiling-effect gate → JS in growth-cycle.ts

**Current**: LLM session runs `scripts/gym-run.sh` and reads JSON output.
**Proposed**: Use existing `runGym()` helper already in growth-cycle.ts:

```typescript
// Replace Step 1b LLM session with:
const scenarios = extractScenarios(step1.lastAssistantText ?? "");
const baselineResults: GymResult[] = [];
let anyFails = false;
for (const scenario of scenarios) {
  const result = runGym(scenario, agentName);
  baselineResults.push(result);
  if (!result.passed) anyFails = true;
}

if (!anyFails) {
  // Ceiling effect — skip
  appendSkipRecord(agentName, scenarios, step1);
  return ctx.done("Growth cycle SKIPPED (ceiling-effect gate). All baseline pass.");
}
```

**Saves**: ~2 LLM sessions/day, ~$2-4/day

### 2. Record ceiling-effect skip → JS helper

**Current**: LLM session appends one JSONL line.
**Proposed**: JS function:

```typescript
function appendSkipRecord(agent: string, scenarios: string[], diagnosis: TaskResult) {
  const entry = {
    timestamp: new Date().toISOString(),
    error_pattern: extractFMCode(diagnosis.lastAssistantText ?? ""),
    agent,
    method: extractMethod(diagnosis.lastAssistantText ?? ""),
    scenarios: [],
    decision: "skipped",
    reason: "ceiling-effect gate: all baseline scenarios pass"
  };
  appendFileSync(
    join(PROJECT_ROOT, "agents/coach/workspace/experiments.jsonl"),
    JSON.stringify(entry) + "\n"
  );
}
```

**Saves**: ~1 LLM session/day, ~$0.50/day

### 3. Training-sprint Step 3 → JS (like growth-cycle Step 3)

**Current**: LLM runs bash commands to execute gym tests for all forks.
**Proposed**: Port growth-cycle's JS gym-running pattern:

```typescript
// In training-sprint.ts, replace Step 3 LLM session:
ctx.emit({ type: "step_start", step: "sprint-gym-tests" });

const sprintResults = [];
for (const exp of experiments) {
  const baseline = runGym(exp.scenario, exp.agent);
  const patched = runGym(exp.scenario, exp.agent, exp.forkName);
  sprintResults.push({
    fork: exp.forkName,
    scenario: exp.scenario,
    baseline,
    patched,
    delta: patched.checks.filter(c => c.passed).length - 
           baseline.checks.filter(c => c.passed).length
  });
}

const resultsText = formatSprintResults(sprintResults);
writeFileSync(join(PROJECT_ROOT, "agents/coach/workspace/sprint-results.md"), resultsText);
ctx.emit({ type: "step_done", step: "sprint-gym-tests" });
```

**Saves**: ~1 LLM session/day, ~$2-4/day

## Why NOT convert Step 4 (record results / promote/discard)

Step 4 involves:
- Editing `method-catalog.md` with qualitative observations
- Making nuanced judgment about why a method worked/failed
- Updating todo.md with follow-ups

This requires LLM reasoning. The decision (promote vs discard) is simple math, but the catalog updates need understanding. Could potentially split: JS for decision + promote/discard + JSONL logging, LLM only for catalog update. But that adds complexity for marginal savings.

## Impact

| Metric | Current | After Fix |
|---|---|---|
| Mechanical LLM sessions/day | ~6 | ~2 (only Step 4s) |
| Cost from these sessions | ~$7-10/day | ~$3-5/day |
| Annual savings | — | ~$1,500-1,800/year |

## Implementation

All 3 fixes go into existing workflow files:
- `agents/coach/workflows/growth-cycle.ts` — changes 1 & 2
- `agents/coach/workflows/training-sprint.ts` — change 3

The `runGym()`, `listScenarios()`, `extractScenarios()`, `formatGymResults()` helpers already exist in growth-cycle.ts. They just need to be applied to the remaining mechanical steps.

## Next Steps

Send to tech-lead for implementation. Changes are localized to 2 files with established patterns.
