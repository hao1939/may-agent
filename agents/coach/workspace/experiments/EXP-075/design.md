# EXP-075: Deploy Classify-Then-Act to Bob's Heartbeat Dispatch

**Date**: 2026-04-08
**Status**: CLOSED — BASELINE AT CEILING (3/3 pass, 6/6 checks). Treatment skipped — no improvement possible on classification accuracy. See Baseline Results below.
**Sprint**: 31
**Tags**: knowledge-deployment, KE-029, structural, production
**Gym budget**: 6 runs (3 baseline + 3 treatment) — gym validation before production deploy
**Hypothesis**: H-085 (forced externalization) predicts that adding classify-then-act structure to Bob's heartbeat dispatch will reduce FM-3.1 (non-delivery) and FM-2.6 (reasoning-action mismatch) errors

## Problem Statement

KE-029 shows classify-then-act achieves 90% vs 30% pass rates in gym scenarios — a verified 60-point improvement. But this mechanism is **not deployed** to the agent that needs it most: Bob.

Bob's ERROR_LOG shows:
- **FM-3.1 (non-delivery)**: 6+ entries — Bob starts analyzing but never produces deliverables
- **FM-2.6 (reasoning-action mismatch)**: 5+ entries — Bob's reasoning doesn't match actions
- **FM-1.3 (looping)**: 3+ entries — Bob repeats failing approaches

Bob's heartbeat is the single highest-traffic judgment point in the system (12+ sessions in recent history). His only workflow (`deliver-or-report`) already uses two-phase structure for deliverable production, but **the heartbeat dispatch itself has no classify-then-act structure**.

### The Core Gap

Bob's heartbeat currently says: "TRIAGE and DISPATCH" — but there's no structural enforcement. Bob reads context and immediately starts dispatching or doing work, without forced classification of what he should do. This is exactly the pattern KE-029 addresses: the agent has the judgment capability but doesn't activate it without explicit prompting.

## Experimental Design

### What We're Testing

**Treatment**: Add classify-then-act structure to Bob's heartbeat.md

The classification phase would require Bob to:
1. Read pending requests, error logs, and recent activity
2. Write a TRIAGE.md file with explicit classifications:
   - Each item classified as: DISPATCH (delegate), DO (self-execute), DEFER (skip), ESCALATE (to May)
   - For each DISPATCH item: which agent, what specific task
   - For each DO item: what deliverable will be produced
3. Hard gate: "Do NOT take any action until TRIAGE.md is written"
4. Phase 2: Execute based on TRIAGE.md classifications

### Gym Validation (Pre-Deploy)

Before modifying production, we validate in gym:

**Scenario**: `heartbeat-triage-gap` (new scenario to build)
- Environment: Simulated heartbeat context with 4 pending items (2 dispatches, 1 self-task, 1 defer)
- Injected context: Stale checkpoint data, prior session that started but didn't finish
- Task: "You're waking up. Read your context and decide what to do this heartbeat."
- Success criteria: Correct classification of all 4 items (especially identifying the defer case)

**Baseline** (3 runs): Bob's current heartbeat prompt, no classify-then-act
**Treatment** (3 runs): Heartbeat prompt with forced TRIAGE.md phase

### Measurement

| Metric | How Measured | Target |
|--------|-------------|--------|
| Classification accuracy | Manual review of TRIAGE.md vs ground truth | ≥75% items correctly classified |
| Non-delivery prevention | Does Bob produce all promised deliverables? | Treatment > Baseline |
| Dispatch quality | Are delegated tasks well-scoped? | Qualitative improvement |
| Overhead cost | Tool call count Phase 1 vs total | Phase 1 < 30% of total calls |

### Production Deploy (If Gym Validates)

If treatment shows ≥50% improvement on classification accuracy:

1. **Edit `agents/bob/heartbeat.md`** to add classify-then-act structure:
   - Phase 1: Read context → Write `agents/bob/workspace/TRIAGE.md`
   - Hard gate: "Do NOT dispatch or execute until TRIAGE.md exists"
   - Phase 2: Execute triage plan
2. **Monitor** for 5 heartbeats post-deploy
3. **Measure**: Count FM-3.1, FM-2.6, FM-1.3 errors per heartbeat before/after

### Risks

- **Overhead**: Classification phase may consume too many tool calls, leaving insufficient budget for execution. Mitigation: Cap Phase 1 at 5 tool calls.
- **Compliance**: Bob may write TRIAGE.md perfunctorily (EXP-073 showed binding analysis varies). Mitigation: Require specific format with explicit classifications.
- **Regression**: Adding structure to heartbeat may slow down simple dispatches. Mitigation: Include "FAST-PATH: if only 1 pending item, skip triage and execute directly" escape hatch.

## Theoretical Grounding

This experiment directly deploys KE-029 and KE-007:
- **KE-029**: Classify-then-act eliminates sycophantic compliance → here we're applying the same mechanism to prevent non-deliberate dispatch (Bob dispatching reflexively without classifying)
- **KE-007**: Structural interventions are the only reliable behavioral interventions → text-based dispatch rules have 0/20+ failure rate; only structural enforcement works
- **KE-043**: Forced externalization → writing TRIAGE.md externalizes judgment, making it auditable and binding

## Dependencies

- Requires building one new gym scenario (`heartbeat-triage-gap`) ✅ BUILT
- No code changes to workflow infrastructure needed
- Only heartbeat.md changes for production deploy

## Baseline Results (3 runs, 2026-04-08)

All 3 baseline runs **PASSED** (6/6 checks each):

| Run | item1 (FM-2.2 dispatch) | item2 (gym sweep dispatch) | item3 (H-055 self-task) | item4 (deep-dive defer) | Coverage | Lean |
|-----|------------------------|---------------------------|------------------------|------------------------|----------|------|
| 1   | ✅ dispatch via transcript | ✅ dispatch via transcript | ✅ H-055 modified directly | ✅ implicitly skipped | 4/4 | 0 new files |
| 2   | ✅ dispatch via transcript | ✅ dispatch via transcript | ✅ H-055 modified directly | ✅ implicitly skipped | 4/4 | 0 new files |
| 3   | ✅ dispatch via transcript | ✅ dispatch via new content | ✅ H-055 modified directly | ✅ correctly deferred | 4/4 | 1 new file |

### Key Observations

1. **Bob already triages well** — without classify-then-act, Bob correctly classifies all 4 items in 3/3 runs
2. **No written TRIAGE.md** — Bob does triage entirely in reasoning (transcript), doesn't produce a triage artifact
3. **Lean heartbeats** — 0-1 new files written. Bob modifies existing files (H-055, todo.md) but doesn't create dispatch artifacts
4. **Dispatch is verbal** — Bob says "should go to someone" and "can't dispatch in this environment" instead of writing dispatch plans

### Implications for Treatment

The baseline is already at ceiling (4/4 classification). This means:
- The scenario may need **harder items** to differentiate baseline vs treatment (consider adding ambiguous cases or misleading context)
- OR: The treatment metric should focus on **dispatch quality** (artifact production, scoped task descriptions) rather than classification accuracy
- OR: Measure **time/tool-call efficiency** — does classify-then-act produce the same result with fewer wasted steps?

**Next Step**: Design and run treatment (3 runs with classify-then-act heartbeat prompt)

## Exit Criteria

- **SUCCESS**: Treatment shows ≥50% improvement in classification accuracy AND overhead < 30% tool calls
- **PARTIAL**: Treatment shows improvement but overhead too high → redesign Phase 1 to be lighter
- **FAIL**: No improvement → classify-then-act doesn't generalize from judgment scenarios to dispatch scenarios (update KE-029 boundary conditions)
