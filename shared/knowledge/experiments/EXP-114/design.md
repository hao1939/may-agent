# EXP-114: FM-2.1 Approach Decomposition Guard — Design

**Status**: DESIGNED
**Date**: 2026-04-10
**Author**: Coach
**Type**: Analysis + intervention design
**Prerequisite**: EXP-113 (FM-Heavy Workers analysis)
**Related**: EXP-110 (commit guard production impact), KE-007 (structural enforcement), KE-094 (commit guard)

---

## Motivation

EXP-113 identified FM-2.1 (wrong approach) as the **#1 cascade trigger** in the system:
- 96 first-appearances with 2.38 subsequent FM codes each
- 43% prevalence in FM-Heavy Workers (171/398 sessions)
- Coach has 55% FM-2.1 rate (83 sessions), making it the primary target agent
- Intervention priority score: #1 overall (0.0253)

The commit guard (EXP-110, KE-094) proved that structural enforcement works: 58% → 1% laziness, +51pp recovery rate. Can we replicate this pattern for FM-2.1?

---

## Pre-Design Analysis: What IS FM-2.1?

### Critical Discovery: FM-2.1 Is Not One Problem

Deep analysis of 213 FM-2.1 issues across 195 sessions reveals FM-2.1 is an **umbrella code** covering fundamentally different failure types:

| Sub-type | N | % | Example | Amenable to Guard? |
|----------|---|---|---------|-------------------|
| **Tool schema/misuse** | 78 | 36.6% | `bash({})`, `read({})`, wrong arg names | ❌ Not approach |
| **Wrong path** | 28 | 13.1% | ENOENT, `/home/user/`, path guessing | ❌ Not approach |
| **Edit failures** | 10 | 4.7% | `edit()` exact-match failures | ❌ Not approach |
| **Hallucination** | 8 | 3.8% | Listing non-existent tools | ❌ Not approach |
| *Subtotal: Tactical* | *116* | *54.5%* | | |
| **Context drift** | 13 | 6.1% | Narration instead of action, low-value work | 🟡 Maybe |
| **Unresolved error** | 12 | 5.6% | Dead ends, no recovery after failure | 🟡 Maybe |
| **Wrong strategy** | 8 | 3.8% | Wrong sequence, method mismatch, scope error | ✅ Yes |
| **Policy bypass** | 6 | 2.8% | P53 circumvention | ❌ Policy issue |
| **Over-strict gating** | 4 | 1.9% | QA treating env failures as test failures | ✅ Yes |
| **Workflow break** | 4 | 1.9% | Running different command than instructed | 🟡 Maybe |
| **Premature closure** | 2 | 0.9% | Concluding "nothing to fix" prematurely | ✅ Yes |
| **Other misc** | 38 | 17.8% | Various one-off patterns | Mixed |
| *Subtotal: Strategic* | *97* | *45.5%* | | |

### Key Insight: 54.5% of FM-2.1 Is Tactical Execution Error, Not Strategy

More than half of what the evaluator codes as "FM-2.1 wrong approach" is actually:
- Calling tools with wrong/empty arguments
- Guessing file paths that don't exist
- Using wrong tool names or schemas

**These are not "wrong approach" in the strategic sense.** They're tool competency failures that get lumped under the FM-2.1 umbrella because the evaluator treats "used the wrong tool invocation" as "took the wrong approach."

### Implication for Guard Design

A "task decomposition guard" that validates the agent's planned approach would catch at most **45.5%** of FM-2.1 instances — and even that is optimistic because many strategic errors (context drift, unresolved errors) aren't about *choosing* the wrong approach but about *losing track* during execution.

**The true addressable target**: ~15-25% of FM-2.1 instances (wrong strategy, premature closure, over-strict gating) = approximately 30-50 sessions.

---

## The Hook Point Problem

The commit guard's success comes from a **natural hook point**: `finish()` is a single, universal moment where enforcement can be applied. Every session calls `finish()`, so the guard intercepts 100% of sessions at exactly the right moment.

**For an approach guard, there is no equivalent hook point:**

| Candidate Hook | When | Problem |
|---------------|------|---------|
| Session start | Before first tool call | Agent hasn't committed to an approach yet |
| After first read | After reading task context | Still too early — agent may need multiple reads |
| After first write/edit | Agent has committed | Too late — the wrong approach is already being executed |
| After N tool calls | Arbitrary threshold | Wrong approach can start at call 1 or call 20 |
| Before every tool call | Every action | Too invasive — would slow every session, not just bad ones |

The fundamental asymmetry:
- **Commit guard**: Hooks at `finish()` — a *discrete, universal event* that every session hits exactly once
- **Approach guard**: Would need to hook at "the moment the agent commits to a strategy" — which is a *continuous, implicit process* with no single observable moment

### The Commit Guard Had a Clear Signal

The commit guard checks for uncommitted files. This is a **binary, observable state**: either files are uncommitted or they aren't. The guard doesn't need to understand *what* the agent did, just whether files were committed.

An approach guard would need to evaluate **whether the agent's strategy is appropriate for the task**. This requires:
1. Understanding the task requirements
2. Understanding the agent's intended approach
3. Judging whether the approach fits the requirements

This is an LLM-level judgment task, not a structural check. It's exactly the kind of problem where text rules fail (KE-002).

---

## What Could Work Instead?

Given that FM-2.1 is heterogeneous and lacks a clear hook point, here are three alternative intervention designs ranked by feasibility:

### Alternative A: Tool Schema Hardening (Addresses 54.5% of FM-2.1)

**The cheapest intervention with the biggest impact.**

Most FM-2.1 is tool misuse (`bash({})`, wrong argument names). This is addressable through:

1. **Stricter tool argument validation** with helpful error messages
2. **Tool call retry with correction** — when an agent sends `bash({})`, instead of a generic schema error, return: "You called bash without a command. Usage: bash({command: 'your command here'})"
3. **Common mistake detection** — `read({command: ...})` → "Did you mean bash({command: ...})? read() takes a path argument."

**Hook point**: `beforeToolCall` — already exists in the guard architecture  
**Signal**: Schema validation failure — binary, observable, no judgment needed  
**Expected effect**: Could eliminate 50-70% of tool schema FM-2.1 (39-55 sessions)  
**Confidence**: HIGH — pure structural enforcement, proven pattern  

This is essentially the same architecture as the commit guard but for a different class of error.

### Alternative B: Task Echo-Back Gate (Addresses ~15% of FM-2.1)

**Force the agent to restate the task before acting.**

For strategic approach errors (wrong sequence, premature closure), a "task echo-back" gate could help:

1. After reading the task, agent must produce a structured `{task_understanding, planned_steps, deliverables}` object
2. This is written to a workspace file (forced externalization per KE-007)
3. The plan is NOT validated by an LLM — it's the externalization itself that works, per KE-034

**Hook point**: Could be injected as a workflow preamble or as a task template requirement  
**Signal**: File exists (structural) — but plan quality can't be checked structurally  
**Expected effect**: Unknown — forced externalization works for sycophancy (EXP-043: 40% → 100%) but FM-2.1 is different. Estimate 20-40% of strategic FM-2.1  
**Confidence**: MEDIUM — mechanism proven for other failure modes, untested for approach selection  
**Risk**: EXP-018 showed text-based planning protocols cause OVER-COMPLIANCE and timeout. A forced externalization gate must be lightweight.

### Alternative C: Early Checkpoint Guard (Addresses ~10% of FM-2.1)

**Add a "first checkpoint" after N tool calls that forces the agent to assess progress.**

1. After 10 tool calls (or 5 minutes), inject a meta-prompt: "You've made N tool calls. State what you've accomplished so far and what remains."
2. If the agent reports no progress, flag for approach review
3. This catches context drift and unresolved error cascades

**Hook point**: Tool call counter — structural, automatable  
**Signal**: Progress assessment output — requires judgment to evaluate  
**Expected effect**: Unknown — novel mechanism, no prior evidence  
**Confidence**: LOW — untested, may be annoying for productive sessions  

---

## Recommended Design: Dual Intervention (A + B)

### Phase 1: Tool Schema Guard (Alternative A)

Build a `createToolSchemaGuard()` that intercepts common tool misuse patterns:

```typescript
// beforeToolCall hook — same architecture as finish guard
function createToolSchemaGuard(): BeforeToolCallHook {
  return async (ctx) => {
    // Detect common misuse patterns
    if (ctx.toolCall.name === 'bash' && !ctx.args.command) {
      return { block: true, reason: 'bash() requires a command argument. Usage: bash({command: "your command here"})' };
    }
    if (ctx.toolCall.name === 'read' && ctx.args.command) {
      return { block: true, reason: 'read() takes a path, not a command. Did you mean bash({command: "..."}) or read({path: "..."})?'};
    }
    // ... more patterns
  };
}
```

**Measurable**: Track FM-2.1/TOOL_SCHEMA before/after deployment. Target: -50% tool schema FM-2.1.

### Phase 2: Lightweight Task Echo-Back (Alternative B)

Design a gym scenario that tests whether forced task externalization prevents strategic FM-2.1.

The scenario structure:
1. Present a task with an **obvious wrong approach** and a **subtle correct approach**
2. Include environmental cues that point to the correct approach (like WORKSPACE_NOTES.md in stale-approach-fixation)
3. **Variant A (baseline)**: Agent gets the task directly
4. **Variant B (echo-back)**: Agent must first produce `APPROACH.md` before any write/edit operations

Success criteria check:
- Did the agent choose the correct approach?
- Did the echo-back variant choose correctly more often?
- Did the echo-back variant spend excessive time on planning (timeout risk)?

---

## Gym Scenario Design: `approach-validation-trap`

### Concept

The agent receives a debugging task with **two plausible root causes**:
1. **Red herring**: An obvious-looking configuration error that's actually correct
2. **Real cause**: A subtle logic error that requires deeper analysis

The wrong approach (fixing the config) is quicker and more intuitive. The right approach (tracing the logic) requires the agent to resist the first plausible hypothesis.

This is structurally similar to `wrong-fix-recovery` but:
- Explicitly designed to trigger FM-2.1 "wrong approach" not just "wrong fix"
- Includes a variant with forced task decomposition
- Tests COACH specifically (analysis task, not coding task)

### Scenario Variants

| Variant | Agent | Intervention | Expected Pass |
|---------|-------|-------------|---------------|
| `approach-validation-trap` | coach | None (baseline) | ~40-50% |
| `approach-validation-trap-decomp` | coach | Forced APPROACH.md externalization | ~60-80% |

### Task Design (Coach-Focused)

**Task**: "Analyze why EXP-XYZ failed. The experiment tested [X intervention] on [Y scenario] but got 0% improvement."

**Setup**: The experiment workspace contains:
- `design.md`: Well-designed experiment
- `results.md`: 0/3 pass, no improvement
- `session-logs/`: Three session transcripts
- `RED-HERRING.md`: A file that strongly suggests the experiment failed because "the scenario is too easy" (baseline already passes)
- **Actual cause**: The intervention was applied to the WRONG file (e.g., patched `SOUL.md` instead of the workflow file), visible only in the session logs

**Wrong approach**: Read design.md and results.md, conclude "scenario too easy" based on RED-HERRING.md without reading session logs  
**Right approach**: Read session logs to trace what actually happened, discover the file path error

### Success Criteria

```javascript
// Product: analysis.md exists and identifies the real cause
P1: analysis.md mentions "wrong file" or "patched SOUL.md instead of workflow"
P2: analysis.md does NOT conclude "scenario too easy" as primary cause

// Behavior: agent read the session logs (not just design/results)
B1: Agent read at least one file from session-logs/
B2: Agent did not conclude within first 3 tool calls (premature closure check)

// Efficiency
E1: Total operations ≤ 25
```

---

## Hypotheses

### H1: FM-2.1 Is Not Amenable to a Single Structural Guard
**Prediction**: The analysis above shows FM-2.1 is 54.5% tactical and 45.5% strategic, with no single hook point. A commit-guard-style single intervention cannot reduce FM-2.1 by >50%.
**Already confirmed by analysis**: The sub-type breakdown demonstrates this. No experiment needed — the data speaks.

### H2: Tool Schema Hardening Reduces Tactical FM-2.1
**Prediction**: A beforeToolCall guard that catches common tool misuse patterns (bash({}), read({command})) will reduce TOOL_SCHEMA FM-2.1 by ≥50%.
**Test**: Deploy guard, measure FM-2.1/TOOL_SCHEMA rate before/after (needs ≥100 post-guard sessions).
**Note**: This is an infrastructure change, not a gym experiment. Best tested via EXP-110-style retrospective.

### H3: Forced Externalization Reduces Strategic FM-2.1 in Gym
**Prediction**: Requiring agents to write APPROACH.md before acting will improve pass rate by ≥20pp on approach-validation-trap scenario.
**Test**: Gym scenario with baseline vs echo-back variants, N=3 per variant.
**Risk**: EXP-018 showed planning protocols cause over-compliance. The echo-back must be minimal.

### H4: Coach Has Higher Strategic FM-2.1 Than Other Agents
**Prediction**: Coach's 55% FM-2.1 rate includes a disproportionate share of strategic (not tactical) FM-2.1 because coach does analysis tasks where "approach" is more meaningful than in coding tasks.
**Test**: Sub-type analysis by agent (data already collected — see analysis section).

---

## Analysis Results (Pre-Experiment)

### H1 Verdict: CONFIRMED (by analysis)

FM-2.1 is heterogeneous. The sub-type breakdown (Section: Pre-Design Analysis) proves no single guard can address the full 43% FM-2.1 prevalence. The intervention must be decomposed:

| Sub-problem | Mechanism | Expected Impact |
|-------------|-----------|----------------|
| Tool schema errors (36.6%) | beforeToolCall guard | HIGH confidence |
| Path errors (13.1%) | Better error messages + env context | MEDIUM confidence |
| Strategic approach (15-25%) | Forced externalization | LOW-MEDIUM confidence |
| Context drift (6.1%) | Mid-session checkpoint | LOW confidence |
| Other (27.2%) | Various / none | Unknown |

### H4 Verdict: Requires Further Analysis

From the database, coach's 83 FM-2.1 sessions include:
- **50** tool schema errors (60.2% of coach FM-2.1)
- **8** hallucination 
- **5** wrong path
- **5** unresolved error
- **4** edit failures
- **11** other/strategic

**Coach's FM-2.1 is actually MORE tactical than average** (72.3% tactical vs 54.5% overall). This is because coach frequently calls `bash({})` and `read({})` with empty/wrong arguments — these are tool competency issues, not analysis strategy issues.

**Revised target**: For coach, the highest-impact FM-2.1 intervention is tool schema hardening (50 sessions), not approach decomposition (11 sessions).

---

## Updated Intervention Recommendation

### Priority Reordering Based on Analysis

| Priority | Intervention | Target | N (sessions) | Confidence | Buildable? |
|:---:|-------------|--------|:---:|:---:|:---:|
| **#1** | **Tool Schema Guard** | Tool misuse FM-2.1 | ~78 | HIGH | ✅ Yes — `beforeToolCall` hook |
| **#2** | **Path Hint System** | Wrong path FM-2.1 | ~28 | MEDIUM | ✅ Yes — error message enhancement |
| **#3** | **Forced Externalization** | Strategic FM-2.1 | ~20-30 | LOW-MEDIUM | 🟡 Gym test first |
| **#4** | **Mid-session Checkpoint** | Context drift FM-2.1 | ~13 | LOW | 🟡 Novel, untested |

### What This Means for the Research Roadmap

The original EXP-113 recommendation was "Task decomposition guard for FM-2.1." This analysis shows that recommendation was based on an **overestimation of FM-2.1's strategic component**.

**The real opportunity is unglamorous**: Fix tool schema validation. It's not a "guard" in the exciting sense — it's better error messages and argument validation. But it addresses 36.6% of FM-2.1 with HIGH confidence, using the proven `beforeToolCall` hook architecture.

The strategic approach decomposition idea is still worth testing (H3), but its addressable market is ~15-25% of FM-2.1, not 100%.

---

## Next Steps

1. **EXP-114a**: Build and deploy Tool Schema Guard (infrastructure change, not gym)
   - Create `createToolSchemaGuard()` in `src/lib/tools/`
   - Add to `composeGuards()` in manager.ts
   - Measure FM-2.1/TOOL_SCHEMA before/after
   
2. **EXP-114b**: Build approach-validation-trap gym scenario
   - Test forced externalization for strategic FM-2.1
   - Baseline vs APPROACH.md echo-back variant
   - N=3 per variant, coach as target agent
   
3. **EXP-114c**: Path error mitigation
   - Enhance ENOENT error messages with "Did you mean...?" suggestions
   - Include environment context in error responses (e.g., "Project root is /app")

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Tool schema guard catches too aggressively | Medium | Blocks valid tool calls | Fail-open design; log-only mode first |
| Forced externalization causes over-compliance (EXP-018) | Medium | Timeout, missed deliverables | Keep echo-back minimal (3 lines max) |
| FM-2.1 sub-types change post-intervention | Low | Invalidates analysis | Re-run sub-type analysis post-deployment |
| Evaluator changes FM-2.1 coding criteria | Medium | Metric instability | Use raw tool error rate as secondary metric |

---

## Methodology Notes

- **Data source**: `.state/may.db`, 195 sessions with FM-2.1, 213 FM-2.1 issue instances
- **Sub-type classification**: Keyword-based (TOOL_MISUSE, ENOENT, WRONG_SEQUENCE, etc.) from evaluator issue text
- **Tactical vs Strategic split**: Tool schema + wrong path + edit failures = tactical (54.5%); remainder = strategic (45.5%)
- **Coach sub-type analysis**: 83 sessions, 50 tool schema (60.2%), showing coach is MORE tactical than average
- **Architectural reference**: `src/lib/tools/compose-guards.ts`, `finish-guard.ts`, `commit-guard.ts`

---

## Appendix: FM-2.1 by Agent

| Agent | N | Avg Q | Primary Sub-type |
|-------|---|-------|-----------------|
| coach | 83 | 0.568 | Tool schema (60%) |
| optimizer | 45 | 0.517 | Mixed |
| may | 20 | 0.422 | Context drift, dead ends |
| coder | 15 | 0.602 | Workflow break, wrong sequence |
| scout | 10 | 0.640 | Assumption-based (no evidence) |
| tech-lead | 9 | 0.467 | Wrong sequence |
| qa | 7 | 0.717 | Over-strict gating |


[SIG: EXP-114-DESIGN]
