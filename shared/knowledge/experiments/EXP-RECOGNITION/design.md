# EXP-RECOGNITION: Can Recognition Skills or Hard Gates Break the 0% Recognition Baseline?

**Date**: 2026-04-14  
**Status**: COMPLETE — See results.md  
**Author**: Bob  
**Scenarios**: stale-config-override, wrong-error-message  
**Baseline**: 0% recognition (4/4 runs show BLIND FIX pattern — 3/4 checks, never 4/4)

## Background

Two recognition-layer scenarios produce a perfectly reproducible 0% baseline:

| Scenario | Obvious Bug | Recognition Bug | Baseline |
|----------|------------|----------------|----------|
| stale-config-override | Hardcoded 60s TTL (tests fail) | config.json uses `cacheTtlSeconds` but config.js DEFAULTS use `cache_ttl_seconds` — spread merge doesn't reconcile keys | 0/4 (0%) |
| wrong-error-message | Email regex missing `+` (tests fail) | `username.length > 50` but error says "at most 100 characters" — in the same file agent edits | 0/4 (0%) |

The BLIND FIX pattern: agent sees failing tests → fixes the obvious bug → tests pass → stops. It never reads code beyond what's needed for the immediate fix. Even when the recognition bug is **in the same file** being edited (wrong-error-message), the agent doesn't notice.

## Research Questions

1. **Is recognition fundamentally interruptive (H-160) or could a well-designed skill make it additive?**
2. **What's the minimum structural intervention that could force recognition?**
3. **Does this shed light on H-161 (dual IT functions)?**

## Analysis: Why Recognition Is Hard

Recognition differs from previous hard-gate successes in a critical way:

| Property | EXP-155 (hidden-dep) | EXP-RECOGNITION (recognition) |
|----------|---------------------|-------------------------------|
| What the gate forces | Investigation BEFORE fixing | Review AFTER fixing |
| Is there a clear step to skip? | Yes: write FINDINGS.md | Unclear: "also look for other issues" |
| Does forced step make answer obvious? | Yes: enumeration surfaces hidden bug | Maybe: inconsistency may not be obvious even with review |
| Gate predicate | FINDINGS.md exists with >100 chars | ??? (hard to verify recognition mechanically) |
| Failure mode | Step-skipping (process) | Attention narrowing (perceptual) |

**Key insight**: This is NOT a step-skipping failure. The agent doesn't skip a step it should take. It takes all the steps (read → fix → verify) but has a **narrow attention window** that excludes context beyond the failing test. This may be a different failure mode than what KE-178 covers.

### Is KE-178 Boundary Condition Met?

KE-178 says hard gates work when: (1) baseline ≤ 50% ✅, (2) step-skipping failure mode ❓

The failure mode is ambiguous:
- **Argument for step-skipping**: The agent skips a "whole-file review" step that would catch the inconsistency
- **Argument against**: The agent isn't really skipping a step — it reads the file, it just doesn't attend to irrelevant-to-tests sections

This makes EXP-RECOGNITION a **boundary test** for KE-178. If hard gates work here, the "step-skipping" condition is broader than previously thought (includes attention-narrowing). If they fail, KE-178's boundary is confirmed as specific to process-skipping.

## Experiment Design

### Arms (3 arms × 2 scenarios = 6 conditions)

#### Arm A: Baseline (already collected)
- **Delivery**: Standard task.md, no skill, single session
- **N**: 4 (1 stale-config, 3 wrong-error-message) — will extend to 5 per scenario
- **Expected**: 0% recognition (established)

#### Arm B: Recognition Skill (Ch1 behavioral)
- **Delivery**: Lab fork that adds a `recognition-review.md` skill to coder's skills/ directory
- **Mechanism**: Text instruction telling the agent to review all code it touches for inconsistencies beyond the immediate bug
- **Hypothesis prediction**: ≤20% (KE-176: interruptive process steps get ~10% compliance via Ch1)
- **Why this might be additive (not interruptive)**: The skill asks the agent to do something DURING its normal read-fix flow, not before or after. It's asking for broader attention, not a workflow interruption. If this works, it means recognition skills are additive (riding the "read file" momentum) rather than interruptive (fighting it).

#### Arm C: Hard Gate (Ch2 structural — 2-phase workflow)
- **Delivery**: New scenario variant with 2-phase workflow:
  - Phase 1: "Fix the bug and make tests pass. Before calling finish, write REVIEW.md listing every inconsistency, code smell, or potential issue you noticed in the files you read — even things the tests don't check."
  - Phase 2: "Read your REVIEW.md. Fix any issues listed there. Then verify all tests still pass."
- **Mechanism**: Forces the agent to produce an artifact documenting ALL observations before moving on. Phase 2 then acts on those observations.
- **Gate predicate**: REVIEW.md exists with >50 chars
- **Hypothesis prediction**: ≥50% recognition

### Why Not a Third Arm?

Considered:
- **Task-message injection** (Ch1 high-privilege): "There are TWO issues in this code" — too hint-like, doesn't test recognition, tests instruction-following
- **Injected context** (Ch3): Similar to skill but positional variant — KE-129 shows Ch3 ≈ Ch1, unlikely to differ

A 2-arm treatment (skill vs gate) is the crispest comparison. Adding a third arm dilutes sample size without adding theoretical value.

## Predictions

### Based on Prior Knowledge

**H-160** (P=0.92) predicts structural > behavioral with >60pp gap.
**KE-178** predicts hard gates work on step-skipping failures. Recognition MAY or MAY NOT qualify.
**KE-176** predicts behavioral skill ≤20% on interruptive steps. But recognition might be additive.

### Specific Predictions

| ID | Prediction | Confidence | Rationale |
|----|-----------|------------|-----------|
| P-R1 | Arm B (skill) recognition rate: 5-25% | 70% | If recognition is interruptive: ~10% (KE-176). If additive: could reach 25%. Split the difference. |
| P-R2 | Arm C (gate) recognition rate: 40-80% | 65% | Lower confidence than EXP-155 because failure mode is attention-narrowing, not step-skipping. The gate forces a review artifact, but the agent may still not NOTICE inconsistencies during review. |
| P-R3 | Arm C > Arm B by ≥20pp | 80% | H-160 strongly predicts structural > behavioral. Even with uncertainty about absolute rates, the relative ordering should hold. |
| P-R4 | If Arm C ≥60%, recognition is step-skippable | 75% | High gate success would mean the failure was always "skipping the review step," confirming KE-178 applies. |
| P-R5 | If Arm C <30%, recognition is a perception failure, not a process failure | 70% | Low gate success despite forced review would mean the issue is perceptual — agents can't spot inconsistencies even when looking. This would be a novel failure category. |

### Meta-Prediction: What We Learn Either Way

| Arm C Result | Interpretation | Next Steps |
|-------------|----------------|------------|
| ≥60% | Recognition is step-skippable; KE-178 boundary is broader. Hard gates work for attention-narrowing too. | Roll out recognition gates in production. |
| 30-60% | Mixed — gate helps but doesn't fully solve. Probably need gate + hints (structured review template). | Design follow-up with scaffolded review format. |
| <30% | Recognition is fundamentally perceptual. Structural gates can't fix it. Need model-level intervention or better prompting. | Explore few-shot examples showing inconsistency detection. |

## Sample Size

### Power Analysis

- Baseline: 0% (0/4). Very tight — any single success is detectable.
- With N=5 per arm per scenario (10 total per arm):
  - Detecting ≥40% treatment effect: Fisher's exact p < 0.05 at 4+/10 successes vs 0/10 baseline
  - Detecting ≥20% effect: Need N≈15 per arm — too expensive for initial test
- **Decision**: N=5 per arm per scenario (10 per arm total). Sufficient to detect meaningful effects (≥30pp). If results are ambiguous, extend to N=10 per scenario.

### Cost Estimate
- 10 baseline runs (5 per scenario, extending existing 4) → ~$1.00
- 10 skill runs (5 per scenario) → ~$1.00
- 10 gate runs (5 per scenario) → ~$1.50 (2 phases each)
- **Total**: ~$3.50 (30 runs × ~$0.10-0.15 each)

## Concrete Implementations

### Arm B: Recognition Skill

**File**: `agents/.lab/recognition-skill/coder/skills/recognition-review.md`

The skill should be:
- **Short** — long skills get lower compliance (KE-011: agents skip passive knowledge)
- **Additive framing** — "while you're reading code to fix bugs, ALSO note..." rather than "BEFORE fixing, review..."
- **Specific to the recognition pattern** — not generic "be careful"

See full draft: `agents/bob/workspace/recognition-skill-draft.md`

### Arm C: Hard Gate Scenarios

**Stale-config-override variant**: `agents/gym/scenarios/exp-rec-stale-config-gate/`
- Copy environment from stale-config-override
- New task.md with 2-phase workflow
- Same success_criteria.js
- scenario.json: `workflow: true`

**Wrong-error-message variant**: `agents/gym/scenarios/exp-rec-wrong-error-gate/`
- Copy environment from wrong-error-message
- New task.md with 2-phase workflow
- Same success_criteria.js
- scenario.json: `workflow: true`

### Phase Design for Gate Arms

The gate design is critical. Unlike EXP-155 where the gate forces investigation BEFORE fixing, here we need to force review DURING/AFTER fixing. Two options:

**Option 1: Review-After-Fix (post-fix artifact)**
```
Phase 1: Fix the obvious bug (tests pass). Then write REVIEW.md documenting
         ALL inconsistencies, code smells, or issues you noticed — even ones
         tests don't catch. Look at EVERY file you touched.
Phase 2: Read REVIEW.md. Fix or document each issue. Verify tests still pass.
```

**Option 2: Read-Before-Fix (pre-fix investigation)**
```
Phase 1: Read ALL relevant files thoroughly. Write REVIEW.md listing every
         issue you find — bugs, inconsistencies, mismatches, code smells.
         Tests may reveal the obvious bug, but look deeper.
Phase 2: Fix ALL issues from REVIEW.md. Make tests pass AND fix inconsistencies.
```

**Decision: Option 2 (Read-Before-Fix)** — This is closest to EXP-155's proven pattern. Option 1 risks the agent writing REVIEW.md after fixing, at which point its attention has already narrowed. Option 2 forces broad reading before the attention-narrowing "fix mode" kicks in.

But note: Option 2 is the strongest possible gate. If even this fails, recognition is truly perceptual, not procedural. Option 1 would be a useful follow-up if Option 2 succeeds (testing whether post-fix review also works).

### Phase 1 Task Template (for both scenarios)

```markdown
## Phase 1: Investigate the Codebase — Do NOT Fix Yet

Read ALL source files listed below and run the tests. Understand what's broken.

[scenario-specific file list]

REQUIRED DELIVERABLE: Create `REVIEW.md` listing EVERY issue you find:
- The obvious test failure (describe it)
- Any inconsistencies between files (mismatched names, values, conventions)
- Any code where the logic doesn't match comments/messages/docs
- Any hardcoded values that should be configurable (or vice versa)

Be thorough. Read each file completely, not just the parts related to the test failure.

Do NOT fix anything. Write REVIEW.md and call finish().
```

### Phase 2 Task Template

```markdown
## Phase 2: Fix All Issues

Read your REVIEW.md from Phase 1.

Fix ALL issues listed — both the test failure AND any inconsistencies you documented.

Run tests to confirm they pass. Then verify your other fixes are correct.

Call finish() with a summary.
```

## Answering the Research Questions

### Q1: Is recognition interruptive or additive?

**Test**: Compare Arm B (skill) to KE-176's interruptive baseline (10%):
- If Arm B ≈ 10%: Recognition skill is interruptive (same compliance as "write FINDINGS.md before fixing")
- If Arm B ≈ 25-40%: Recognition is partially additive — the "also notice" framing rides momentum better than "stop and document"
- If Arm B ≈ 0% (worse than baseline): The skill is actively harmful (KE-175 floor effect)

### Q2: Minimum structural intervention for recognition?

**Test**: Arm C (full 2-phase gate). If this works (≥50%), it establishes the proof of concept.

**Follow-up** (not in this experiment): Can we get the same effect with a lighter gate? E.g.:
- Single-phase with "before calling finish, write REVIEW.md"
- Injecting "there may be other issues beyond the test failure" into task.md
- Adding a check in success_criteria that simply counts how many files were read

### Q3: H-161 implications?

If Arm C succeeds:
- **F2 (behavioral forcing)**: The act of writing REVIEW.md forces the agent to enumerate observations → surfaces the inconsistency. This is F2 working as predicted.
- **F1 (memory compression)**: Phase 2 reads REVIEW.md → the inconsistency is now in the agent's immediate context. F1 provides the artifact for consumption.
- If we could test "Phase 1 writes REVIEW.md, Phase 2 starts fresh without reading it" → that isolates F2 from F1. This would be EXP-162a/P-161a applied to recognition. Could be a follow-up arm.

If Arm C fails:
- Neither F1 nor F2 help with perception failures. This limits H-161's scope to process failures.

## Success Criteria for the Experiment

| Outcome | Interpretation | H-160 Update | KE-178 Update |
|---------|---------------|-------------|---------------|
| B≤15%, C≥50% | Standard H-160 pattern: structural beats behavioral | Confirms (another scenario) | Expands: attention-narrowing IS step-skippable |
| B≤15%, C≤30% | Recognition is perceptual, not procedural | Confirms but adds boundary | Confirms: attention-narrowing is NOT step-skipping |
| B≥30%, C≥50% | Both help, structural still better | Partial — gap is smaller | Ambiguous |
| B≥30%, C≤30% | Skill beats gate (?!) | Refutes on this task type | Confirms boundary, reveals additive > forced |

## Implementation Checklist

1. [ ] Write recognition skill draft → `agents/bob/workspace/recognition-skill-draft.md`
2. [ ] Create lab fork → `agents/.lab/recognition-skill/coder/skills/recognition-review.md`
3. [ ] Create gate scenario (stale-config) → `agents/gym/scenarios/exp-rec-stale-config-gate/`
4. [ ] Create gate scenario (wrong-error-msg) → `agents/gym/scenarios/exp-rec-wrong-error-gate/`
5. [ ] Run 6 additional baseline runs (3 stale-config + 3 wrong-error-message) to reach N=5 per scenario
6. [ ] Run 10 skill arm runs (5 per scenario) with `--lab recognition-skill`
7. [ ] Run 10 gate arm runs (5 per scenario)
8. [ ] Score and analyze
9. [ ] Write results.md
10. [ ] Update H-160, KE-178, and potentially H-161

## Cross-References

| Entry | Relationship |
|-------|-------------|
| H-160 | Core prediction: structural > behavioral. P=0.92. EXP-RECOGNITION tests on a novel failure mode (attention-narrowing). |
| KE-178 | Boundary condition: low baseline + step-skipping. This experiment tests whether attention-narrowing qualifies as step-skipping. |
| KE-176 | Selective compliance: interruptive ≈ 10%. If recognition skill also ≈ 10%, confirms the gradient model. |
| H-161 | Dual IT functions. If gate works, isolating F1 vs F2 would be informative follow-up. |
| KE-129 | Ch2 is only reliable channel. This experiment tests Ch2 on a novel behavioral domain (recognition). |
| EXP-155 | Closest precedent: Ch2 hard gate on investigation-before-fix. 100% vs 10% vs 15%. |
| EXP-156 | Hard gate generalization. Boundary discovery on context-drift (high-baseline, belief-based). |
| RECOGNITION-BASELINE-RESULTS.md | Baseline data: 0% recognition on 4 runs. |

## Files

- Design: `agents/shared/knowledge/experiments/EXP-RECOGNITION/design.md` (this file)
- Skill draft: `agents/bob/workspace/recognition-skill-draft.md`
- Baseline data: `agents/gym/scenarios/RECOGNITION-BASELINE-RESULTS.md`
- Gate scenario (stale-config): `agents/gym/scenarios/exp-rec-stale-config-gate/` (to be created)
- Gate scenario (wrong-error-msg): `agents/gym/scenarios/exp-rec-wrong-error-gate/` (to be created)
- Lab fork: `agents/.lab/recognition-skill/` (to be created)
