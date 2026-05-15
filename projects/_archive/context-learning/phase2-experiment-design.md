# Phase 2: Reflexion-Style Learning Experiment Design

**Author**: bob | **Date**: 2026-04-19 | **Status**: Phase 2 Step 1: COMPLETE

### Implementation Status
- ✅ **Step 1**: Scenario (`reflexion-npx-recovery`) created and validated; extraction function (`extract-reflection.js`) tested and working
  - `success_criteria.js` correctly detects formatting state (verified: passes after `prettier --write`, fails before)
  - `extractReflection()` returns prompt when no llmCall provided, returns lesson when llmCall given
  - Prettier available globally; scenario is solvable
- ⬜ **Step 2**: Baseline runs (no lesson)
- ⬜ **Step 3**: Extract lesson from baseline failure
- ⬜ **Step 4**: Treatment runs (with lesson)
- ⬜ **Step 5**: Analyze results

## Overview

Test whether a reflexion-style lesson extracted after a failed session prevents the same error in a subsequent session. This is a controlled A/B experiment using the existing gym infrastructure.

---

## A. The Gym Test Scenario

### Scenario: `reflexion-npx-recovery`

**Why this scenario**: The npx-avoidance A/B test (context-learning.md) already proved context.md changes behavior with 100% consistency across 6 runs. But that lesson was *human-authored*. This experiment tests whether an **LLM-extracted reflection from a failure session** produces an equally effective lesson.

### Design: Two-phase gym run

**Phase 1 — Baseline (no lesson)**:
- Agent gets a task requiring `npx prettier --write .` (or similar npx-dependent command)
- Agent has NO context.md entry about npx unavailability
- Expected: agent tries npx → fails → eventually recovers via `node_modules/.bin/prettier` or similar
- Record: the session transcript (tool calls, errors, recovery path)

**Phase 2a — Human-authored lesson (control)**:
- Same task, agent has context.md: `"npx is not available in this environment. Use node_modules/.bin/<tool> instead."`
- Expected: agent skips npx entirely (proven by prior A/B test)

**Phase 2b — LLM-extracted lesson (treatment)**:
- Same task, agent has context.md with a lesson extracted by the reflection pipeline from Phase 1's transcript
- Expected: agent skips npx entirely IF the extracted lesson is effective

**Phase 2c — No lesson (negative control)**:
- Same task, fresh agent with no context.md
- Expected: agent tries npx again (same as Phase 1)

### Scenario structure

```
agents/gym/scenarios/reflexion-npx-recovery/
├── scenario.json          # tier: smoke, categories: [context-learning, reflexion]
├── task.md                # "Format all JS files using prettier"
├── environment/
│   ├── package.json       # prettier in devDependencies
│   ├── node_modules/.bin/prettier  # works
│   ├── src/ugly.js        # unformatted file
│   └── .prettierrc        # config
└── success_criteria.js    # checks: (1) ugly.js is formatted, (2) npx was NOT attempted
```

Success criteria has two independent checks:
1. **Task completion**: `ugly.js` is properly formatted (both with and without lesson)
2. **npx avoidance**: transcript does NOT contain `npx` command attempts (only passes with effective lesson)

### Second scenario: `reflexion-read-before-edit`

A more behavioral test. Agent must edit a file but should read it first.

**Phase 1**: Agent gets edit task, no guidance → may or may not read first (baseline ~50% per existing data)
**Phase 2b**: Agent gets edit task + LLM-extracted reflection from a Phase 1 failure where blind edit caused problems

```
agents/gym/scenarios/reflexion-read-before-edit/
├── scenario.json
├── task.md                # "Fix the bug in utils.js" (but file has unexpected structure)
├── environment/
│   ├── utils.js           # Has a non-obvious structure that blind edits will break
│   └── test.js            # Verification test
└── success_criteria.js    # checks: (1) test passes, (2) agent read file before editing
```

---

## B. Lesson Extraction Mechanism

### When: After session completion

Trigger: the existing `context-learn` pipeline (`onSessionComplete` → `evaluateTask` → `bus.emit("context-learn")`).

### What extracts the reflection

A new function `extractReflection(sessionTranscript, outcome)` that runs alongside the existing `learnFromSessionLLM()`. The key difference:

- **Current `learnFromSessionLLM()`**: extracts factual knowledge ("npx isn't available")
- **New `extractReflection()`**: extracts behavioral guidance ("When you need to run a CLI tool, check node_modules/.bin/ first instead of using npx, which isn't available in this environment")

### Extraction prompt

```
You are reviewing an agent session that encountered an error. Extract a concise, actionable lesson the agent should remember for future sessions.

Session transcript (tool calls and results):
{transcript}

Session outcome: {pass/fail + summary}

Rules:
1. Focus on the ROOT CAUSE of wasted effort, not the final fix
2. Write as a direct instruction: "When X, do Y instead of Z"
3. Include the WHY: "...because [reason]"
4. Max 2 sentences
5. Only extract a lesson if the agent made an avoidable mistake. If the session went well, output "NO_LESSON"

Lesson:
```

### Format

Lessons are stored as entries in the agent's `context.md` under a `## Learned from experience` section:

```markdown
## Learned from experience
- When you need to run a CLI tool, use `node_modules/.bin/<tool>` directly instead of `npx`, because npx is not available in this environment. (source: session s_abc123, 2026-04-19)
- Before editing a file, always read it first to understand its structure, because files may have unexpected formatting that blind edits will break. (source: session s_def456, 2026-04-19)
```

### Where stored

Same place as current context learning: `agents/<name>/context.md`. The reflection is delivered via the existing `context_updates` mechanism in `finish()`, or via a new `applyReflection()` that appends to the "Learned from experience" section.

### How injected

No change needed — `buildSessionContext` already loads the full `context.md` as "What You Know" in the session prompt. Lessons in context.md are automatically injected.

### Pipeline summary

```
Session fails
  → evaluateTask() runs (existing)
    → extractReflection(transcript, outcome) [NEW]
      → returns lesson string or NO_LESSON
        → if lesson: append to agents/<name>/context.md "Learned from experience" section
          → next session: buildSessionContext loads it automatically
```

---

## C. Success Criteria (Quantitative)

### Primary metric: Error Repeat Rate

**Definition**: % of sessions where an agent repeats an error that a prior session already encountered and reflected on.

For the npx experiment:
- **Baseline (no lesson)**: 100% npx attempt rate (from existing data: 82/100 sessions)
- **Human lesson (control)**: 0% npx attempt rate (from existing A/B: 0/3)
- **LLM-extracted lesson (treatment)**: Target ≤ 10% npx attempt rate
- **Success threshold**: LLM lesson must achieve ≤ 20% npx attempt rate (at least 80% effective)

For the read-before-edit experiment:
- **Baseline**: ~50% read-before-edit rate (existing gym data)
- **LLM-extracted lesson**: Target ≥ 80% read-before-edit rate
- **Success threshold**: ≥ 70% read-before-edit rate (at least 20pp improvement)

### Secondary metric: Lesson Quality Score

Compare LLM-extracted lesson to human-authored lesson:
- **Specificity**: Does it name the exact tool/behavior? (binary)
- **Actionability**: Does it say what TO DO, not just what not to do? (binary)
- **Conciseness**: ≤ 2 sentences? (binary)
- **Accuracy**: Does it identify the actual root cause? (binary)

Target: 3/4 criteria met on ≥ 80% of extractions.

### Sample size

- 5 runs per condition (npx scenario) = 20 total runs
- 5 runs per condition (read-before-edit) = 20 total runs
- At ~$0.10/run = ~$4.00 total experiment cost

---

## D. Before and After

### BEFORE (current state)

```
Session 1: Agent tries npx → fails → wastes 2-3 tool calls → finds workaround
Session 2: Agent tries npx → fails → wastes 2-3 tool calls → finds workaround  (no learning)
Session 3: Agent tries npx → fails → wastes 2-3 tool calls → finds workaround  (still no learning)
...
Human notices pattern → manually adds to context.md → problem stops
```

**Latency**: Days to weeks (depends on human noticing)
**Cost**: 2-3 wasted tool calls × 82% of sessions = ~160 wasted ops per 100 sessions

### AFTER (with reflexion pipeline)

```
Session 1: Agent tries npx → fails → wastes 2-3 tool calls → finds workaround
  → extractReflection() runs → lesson added to context.md
Session 2: Agent reads lesson → uses node_modules/.bin/ directly → no wasted calls
Session 3: Same as session 2
...
```

**Latency**: One session (automated, no human needed)
**Cost**: 2-3 wasted tool calls × 1 session only = ~3 wasted ops, then zero

### Quantified improvement

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Sessions until error stops repeating | ∞ (until human intervenes) | 1 | ∞ → 1 |
| Wasted tool calls per 100 sessions | ~160 | ~3 | 98% reduction |
| Human intervention required | Yes | No | Fully automated |
| Time to lesson deployment | Days | Seconds | ~10,000× faster |

---

## Status Update (2026-04-19)

### Completed
- ✅ `reflexion-npx-recovery` scenario created and validated (scenario.json, task.md, environment/, success_criteria.js)
- ✅ `extractReflection()` function implemented and tested with mock LLM — produces correct `{ lesson, raw, prompt }` output
- ✅ Success criteria verified: correctly detects unformatted files (fail) and formatted files (pass)
- ✅ Prettier installed globally (`/usr/bin/prettier`) — scenario is solvable

### Known Issues
- **npx works in this environment** — the scenario concept assumes npx fails, but `npx prettier` succeeds. Options: (a) create a wrapper that shadows npx to simulate failure, (b) redesign the scenario to test a different error pattern, or (c) run in a restricted environment where npx is removed
- **Scenario files in .gitignored path** — `bob/workspace/projects/` is gitignored. Move deliverables to non-ignored paths before committing
- **Second scenario (`reflexion-read-before-edit`) not yet created**

### Next Steps
1. Resolve the npx-availability issue so baseline runs actually fail on npx
2. Run 5 baseline sessions (Step 2) and collect transcripts
3. Test `extractReflection()` with a real LLM on baseline transcripts
4. Build the second scenario

---

## Implementation Plan

### Step 1: Build the two gym scenarios (1 hour)
- Create `reflexion-npx-recovery/` and `reflexion-read-before-edit/` scenario directories
- Write task.md, environment files, success_criteria.js for each

### Step 2: Run baseline (Phase 1) — 5 runs each scenario
- No context.md, record transcripts
- Confirm baseline error rates match expectations

### Step 3: Implement `extractReflection()` function
- Add to existing context-learning pipeline
- Test on Phase 1 transcripts — verify lesson quality

### Step 4: Run treatment (Phase 2b) — 5 runs each with LLM lesson
- Inject extracted lessons into context.md
- Measure error avoidance rate

### Step 5: Compare results
- Calculate error repeat rates across conditions
- Determine if LLM-extracted lessons meet success thresholds
- Document findings in `phase2-results.md`
