# EXP-152 Phase 2 Results — Guard Artifact Removal (convention-verify-edit)

**Date**: 2026-04-13  
**Status**: Phase 2 COMPLETE — ceiling effect, no discriminating signal  
**Sessions**: s_1776095567187_269  
**Total Phase 2 trials**: 20  
**Total EXP-152 trials (all phases)**: 88  

---

## 1. Design Recap

Phase 2 addressed three Phase 1 confounds:
1. **SOUL.md confound** → v2 forks created WITHOUT SOUL.md (matching production)
2. **Wrong skill removal** → v2 forks surgically remove only `verify-after-edit.md`
3. **Scenario-guard mismatch** → `convention-verify-edit` directly tests verify-after-edit behavior

### Conditions

| Condition | Lab Fork | Removal |
|-----------|----------|---------|
| **Production** | none | Full coder: all skills, context, no SOUL.md |
| **no-rbe-v2** | `coder-exp152-no-rbe-v2` | Production MINUS `verify-after-edit.md` skill |
| **no-verify-v2** | `coder-exp152-no-verify-v2` | Production MINUS `verify-after-edit.md` + "Verify with evidence" context entry |
| **no-path** | `coder-exp152-no-path` | v1 fork (has SOUL.md), removed path/grep skills |

### Validation

All 3 v2 forks validated — completed `convention-verify-edit` without infrastructure errors (runs #805, #807, #808).

## 2. Results

### 2.1 Pass/Fail Summary — convention-verify-edit

| Condition | Pass | Fail | Rate | n | Run IDs |
|-----------|------|------|------|---|---------|
| **Production** | 5 | 0 | **100%** | 5 | 805, 809, 810, 811, 812 |
| **no-rbe-v2** | 5 | 0 | **100%** | 5 | 806, 808, 814, 816, 818 |
| **no-verify-v2** | 5 | 0 | **100%** | 5 | 807, 813, 815, 817, 819 |
| **no-path** | 5 | 0 | **100%** | 5 | 820, 821, 822, 823, 824 |

**All 20 trials passed.** Complete ceiling effect. No statistical test needed — there is zero variance.

### 2.2 Score Detail

Every run passed all 5 checks:
- ✅ valid-json (product)
- ✅ correct-values: timeout=5000, retries=3 (product)
- ✅ fields-preserved: name and debug fields preserved (product)
- ✅ C2.3: verify-after-edit — Agent verified config.json after writing (convention)
- ✅ C3: validation-attempt — Agent validated JSON (convention)

### 2.3 Historical Context

Convention-verify-edit has a 89.7% all-time pass rate (35/39 production runs), with the 4 failures all from early runs (#14, #107, #182, #313). Recent production runs are 100% — the scenario has reached ceiling.

## 3. Error Recurrence Analysis

**NOT POSSIBLE** — Gym run transcripts are stored in temp directories that are cleaned up after scoring. Session meta.json shows op count (typically 2 ops) but not tool call sequences. Cannot analyze whether agents read-before-edit less frequently without the skill.

## 4. Assessment

### 4.1 Primary Finding: CEILING EFFECT

Convention-verify-edit is too simple to discriminate between conditions. The task:
- Edit one JSON file (config.json) to change two values
- Fix a trailing comma
- Verify the result

Modern LLMs do this perfectly in 2 operations regardless of whether they have verify-after-edit training. The skill is reinforcing behavior the model already does naturally for trivial JSON edits.

### 4.2 Why the 87.9% baseline was misleading

The phase 2 design noted convention-verify-edit had an 87.9% baseline (N=33). However:
- The 4 failures were ALL from early runs (IDs 14-313), likely before model/framework improvements
- Recent production runs (IDs 439-812) are 33/33 = 100%
- The baseline has shifted to ceiling since those early measurements

This is the same temporal confound seen with behavior-escalation-stubborn (0% → 100% flip).

### 4.3 Phase 2 v1 Confounds Resolved But Irrelevant

The SOUL.md and wrong-skill confounds identified in Phase 1 are now properly controlled in v2 forks. However, this is moot — the scenario cannot discriminate at any fork configuration because the task is at ceiling.

## 5. Cumulative EXP-152 Assessment

### Three scenarios tested, three ceiling effects:

| Scenario | Production Rate | Fork Rates | Discriminating? |
|----------|----------------|------------|-----------------|
| behavior-escalation-stubborn | 100% (n=6) | 100% all conditions | ❌ Ceiling |
| convention-verify-edit | 100% (n=5) | 100% all conditions | ❌ Ceiling |
| kb-discovery-baseline-126 | 53.3% (n=15) | 40-60% (no sig. diff) | ❌ Too noisy / wrong task type |

### The Fundamental Problem

H-108 predicts that removing a guard artifact should cause the specific error the guard prevents to recur. But:

1. **Simple tasks don't need guards** — convention-verify-edit and behavior-escalation-stubborn are solved by base model capability alone. The guard artifacts are redundant for these tasks.

2. **Complex tasks have too much variance** — kb-discovery-baseline-126 has a 53% baseline with high variance, making it impossible to detect a 13pp effect at N=10-15.

3. **The sweet spot is missing** — We need scenarios that are:
   - Hard enough that agents sometimes fail (~50-70% baseline)
   - Failing for the SPECIFIC reason the guard targets (not general task difficulty)
   - Recent baseline (not historical rates that have shifted)

### H-108 Status

| Metric | Value |
|--------|-------|
| **Prior P(H)** | 0.50 |
| **Updated P(H)** | 0.45 |
| **Evidence type** | Weak null — ceiling effects prevent meaningful test |
| **Verdict** | INCONCLUSIVE — H-108 is not disconfirmed, but 88 trials across 3 scenarios have failed to produce supporting evidence |

The 0.05 downward adjustment reflects that:
- We tried the most-targeted scenario (convention-verify-edit directly tests verify-after-edit) and got ceiling
- The Phase 1 SOUL.md confound is now eliminated, yet still no signal
- However, the ceiling effect means this is genuinely uninformative, not negative evidence

## 6. Recommendations

### 6.1 For H-108 Testing

If pursuing H-108 further:
1. **Find harder scenarios** — Need scenarios where the baseline is 40-70% AND failures are specifically due to missing verification/read-before-edit behavior
2. **Multi-file editing scenarios** — `multi-file-verify-gap` (n=1, rate=0%) or `convention-verify-multi-edit` (n=1, rate=100%) — need more baseline data
3. **Longer tasks** — Verification discipline may only matter in multi-step tasks where agents have more opportunities to skip verification under time pressure
4. **Consider abandoning** — After 88 trials with no signal, the cost-benefit of continuing is low. The most likely explanation is that individual guard removal doesn't produce detectable effects because the base model has already learned these behaviors from training data.

### 6.2 For Skill Training Research

The broader implication: skills that encode behaviors the LLM already does well (JSON verification, simple edits) are **redundant**. Skill value likely concentrates in:
- Behaviors the model does NOT naturally do (e.g., stopping when blocked)
- Behaviors that degrade under cognitive load (multi-file operations)
- Counter-intuitive behaviors (e.g., requirements-conflict-analysis's "stop before coding")

## 7. Cost Summary

| Phase | Trials | Est. Cost |
|-------|--------|-----------|
| Phase 1: kb-discovery-baseline-126 | 46 | ~$4.60 |
| Phase 1: behavior-escalation-stubborn | 22 | ~$2.20 |
| Phase 2: convention-verify-edit | 20 | ~$2.00 |
| **Total EXP-152** | **88** | **~$8.80** |

## 8. Appendix: Fork Verification

### no-rbe-v2 diff from production
```
# Skills: production has verify-after-edit.md, fork does not
# context.md: IDENTICAL
# SOUL.md: neither has one
```

### no-verify-v2 diff from production
```
# Skills: production has verify-after-edit.md, fork does not
# context.md: fork MINUS "Verify with evidence, not narrative" line
# SOUL.md: neither has one
```

### no-path (v1 fork — not v2)
```
# Has SOUL.md (production does not) — CONFOUNDED
# Skills differ: missing efficient-file-reading.md, has verify-after-edit.md
```
