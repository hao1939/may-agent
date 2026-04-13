# EXP-155: Ch2 Forced Externalization Gate vs Ch1 Skill on Selective Compliance

**Date**: 2026-04-13
**Status**: DESIGNED
**Hypothesis**: H-155

## Background

EXP-154 discovered **selective compliance** (KE-176): when given a multi-step process skill, agents cherry-pick additive steps (verify-after-fix: 100% compliance) while ignoring interruptive steps (write-FINDINGS.md-before-fix: 10% compliance). The interruptive step — which is the skill's core value — has the same compliance profile as a judgment skill.

KE-129 (from EXP-127) established that Channel 2 (forced externalization gates) is the **only** reliable delivery channel for judgment-class behaviors. EXP-127 showed 100% Ch2 vs 0% Ch1/Ch3 on contradictory-requirements (p=0.0000074).

**The question**: Can a Ch2 structural gate overcome the selective compliance failure that Ch1 skill delivery could not? This directly tests P-176b ("The same interruptive step delivered via workflow gate should show ≥80% compliance").

## Hypothesis

**H-155**: A Ch2 forced externalization gate that requires FINDINGS.md with bug analysis before implementation improves the process check pass rate on `exp144-hidden-dep-decoupled` by ≥30pp over baseline (15%), reaching ≥45% overall.

### Rationale

- EXP-154's Ch1 skill delivery: 10% (−5pp from baseline, not significant)
- The existing scenario already has a 3-phase workflow (think→implement→check), but Phase 1's instructions are soft: "Write your thinking in whatever format is clearest to you"
- The soft gate doesn't force specific bug documentation — agents write vague plans that don't mention the typo or checksum
- A **hard gate** that explicitly requires FINDINGS.md with enumerated bugs AND checks for its existence in Phase 2 should force the interruptive behavior that the Ch1 skill couldn't

### Why This Should Work

The mechanism is behavioral forcing, not content delivery (KE-129):
1. Phase 1 explicitly says "Write FINDINGS.md listing EVERY bug found — Bug 1, Bug 2, etc."
2. Phase 2 opens with "Read your FINDINGS.md from Phase 1. If it doesn't exist or doesn't list at least 2 bugs, STOP"
3. The agent MUST create the artifact to proceed — there's no way to skip it
4. Writing the artifact forces the agent to articulate bugs, which surfaces the hidden dependency (checksum) that agents normally miss

### Why It Might Fail

1. **The existing 3-phase structure already provides SOME gating** — the baseline is 15%, not 0%. The marginal benefit of hardening the gate may be smaller than on the contradictory-requirements scenario (0% baseline).
2. **KE-134**: Gate stacking has a hump curve. This scenario already has 3 phases; tightening Phase 1 adds cognitive load that might degrade Phase 2/3 performance.
3. **Product vs Process**: Unlike contradictory-requirements where the product outcome changes (analyze vs implement blindly), here the product outcome is the same (fix the bugs). The gate only changes whether bugs are documented. The agent might write a superficial FINDINGS.md that satisfies the gate but doesn't actually surface Bug 2.

## Design

### Scenario

| Scenario | Baseline | N | Failure Mode | Why Selected |
|----------|----------|---|--------------|--------------|
| `exp144-hidden-dep-decoupled` | 15% (3/20) | 20 | Product passes (5/5) but process fails (1/4): agents don't document bugs or verify | Same scenario as EXP-154 — enables direct Ch1 vs Ch2 comparison |

### Treatment: Hard Externalization Gate (Ch2)

**New scenario name**: `exp155-hidden-dep-hard-gate`

Create a variant of `exp144-hidden-dep-decoupled` with hardened Phase 1 instructions:

**Phase 1 changes** (original is soft "write your thinking"):
```
## Phase 1: Investigate ALL Bugs — BUDGET: 15 TOOL CALLS MAX

Read the code, run `node process.js`, and trace the FULL dependency chain.

REQUIRED DELIVERABLE: Create `FINDINGS.md` in the project root listing EVERY bug you find.

For EACH bug, document:
- Bug name/description
- File and approximate location
- What error or incorrect behavior it causes
- What fixing it would affect downstream

IMPORTANT: There are MULTIPLE bugs in this codebase. The first error you see is NOT the only 
problem. After finding Bug 1, ask: "If I fix this, what else might break?" Trace the full 
dependency chain through validation, checksums, and data integrity checks.

Do NOT fix anything yet. Write FINDINGS.md and call finish().
```

**Phase 2 changes** (add existence check):
```
## Phase 2: Fix All Bugs — BUDGET: 25 TOOL CALLS MAX

Read your FINDINGS.md from Phase 1. If FINDINGS.md does not exist, STOP — go back to Phase 1.

Your FINDINGS.md should list at least 2 distinct bugs. If it only lists 1, re-investigate 
before proceeding — you likely missed a hidden dependency.

Fix ALL bugs listed in FINDINGS.md. Then continue to Phase 3.
```

**Phase 3**: Keep largely the same (verify by running).

### Control: Existing Baseline

Use the 20 existing baseline runs from EXP-154 (15% pass rate, 3/20).

### Comparison: EXP-154 Treatment (Ch1 Skill)

Use the 10 existing Ch1 skill runs from EXP-154 (10% pass rate, 1/10).

This gives us a clean 3-way comparison:
| Condition | Channel | N | Source |
|-----------|---------|---|--------|
| Baseline (soft 3-phase) | None | 20 | EXP-154 baseline |
| Ch1 Skill (investigation-before-fix) | Ch1 | 10 | EXP-154 treatment |
| Ch2 Hard Gate (FINDINGS.md required) | Ch2 | 10 | **EXP-155 (new)** |

### Sample Size

- 10 new treatment runs (hard gate scenario)
- 0 new control needed (reuse EXP-154's 20 baseline + 10 Ch1 treatment)
- Total new runs: 10

### Measurements

**Primary**: Overall pass rate (% passing ALL checks — product + process)

**Secondary**:
- P1 (planning-artifact-exists): Does FINDINGS.md exist? — This is the KEY metric. Ch1 skill got 1/10 (10%). Ch2 gate should get ≥8/10 (80%).
- P2 (planning-identifies-typo): Does the artifact mention the RULES_PAH typo?
- P3 (planning-identifies-checksum): Does the artifact mention the checksum mismatch?
- P4 (verify-after-fix): Did the agent run the pipeline after fixing?

### Predictions

| Prediction | Threshold | Rationale |
|-----------|-----------|-----------|
| P1: Overall pass rate ≥45% | ≥30pp improvement over 15% baseline | Conservative — Ch2 typically yields 80-100% but this scenario has product complexity |
| P2: P1 (artifact exists) ≥80% | vs 10% in Ch1 treatment | The gate forces artifact creation — should be near-certain |
| P3: P2+P3 (bug identification) ≥50% | vs ~0% in both baseline and Ch1 | Writing forces articulation, but agents might write vague content |
| P4: P4 (verify after) ≥80% | vs ~15% baseline, 100% in Ch1 treatment | Phase 3 already instructs verification; hardened gate shouldn't hurt this |

### Falsification Criteria

H-155 is **rejected** if:
- Overall pass rate < 30% (i.e., < 15pp improvement over baseline)
- P1 (artifact exists) < 50% (i.e., the gate doesn't force artifact creation)

H-155 is **confirmed** if:
- Overall pass rate ≥ 45% AND P1 ≥ 80%

### Implementation Steps

1. Copy `exp144-hidden-dep-decoupled` → `exp155-hidden-dep-hard-gate`
2. Modify `task.md` with hardened Phase 1 and Phase 2 instructions (above)
3. Keep `scenario.json` the same (workflow: true, timeout: 5, agent_type: coder)
4. Keep `success_criteria.js` identical (same checks P1-P4 + product checks)
5. Keep `environment/` identical (same bugs)
6. Run 10 trials: `scripts/gym-batch.sh exp155-hidden-dep-hard-gate --trials 10`
7. Score and compare to EXP-154 baseline (20 runs) and Ch1 treatment (10 runs)

## Theoretical Framework

This experiment sits at the intersection of three knowledge entries:

```
KE-021: Process > Knowledge > Judgment (skill type hierarchy)
    ↓ refined by
KE-176: Additive Process > Interruptive Process ≈ Judgment (sub-level)
    ↓ tested by EXP-155
KE-129: Ch2 forced externalization overcomes judgment-class failures
```

If H-155 is confirmed, it validates the full chain:
1. Interruptive process steps fail as Ch1 text (EXP-154 confirmed)
2. Interruptive process steps succeed as Ch2 gates (EXP-155 would confirm)
3. The Ch2 > Ch1 hierarchy (KE-129) extends beyond judgment tasks to interruptive process tasks

If H-155 is rejected, the failure modes are informative:
- If P1 < 50% (gate doesn't force artifact): The scenario's 3-phase structure may already saturate the "gate" channel — adding more gate pressure doesn't help
- If P1 ≥ 80% but overall < 30%: The artifact is created but content is too vague to surface Bug 2. This would mean Ch2 gates need content-quality enforcement (a new finding)

## Files

- Treatment scenario: `agents/gym/scenarios/exp155-hidden-dep-hard-gate/` (to be created)
- Base scenario: `agents/gym/scenarios/exp144-hidden-dep-decoupled/`
- EXP-154 results (Ch1 comparison): `agents/shared/knowledge/experiments/EXP-154/results.md`
- KE-176 (selective compliance): `agents/shared/knowledge/entries/KE-176-selective-skill-compliance.md`
- KE-129 (Ch2 only channel): `agents/shared/knowledge/entries/KE-129-forced-externalization-only-reliable-channel-judgment.md`
