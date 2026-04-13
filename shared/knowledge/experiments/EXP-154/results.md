# EXP-154 Results: Investigation-Before-Fix Skill

**Date**: 2026-04-13
**Status**: COMPLETE
**Result**: H-154 NOT SUPPORTED

## Summary

The "investigation-before-fix" process skill showed no overall improvement on the `exp144-hidden-dep-decoupled` scenario. Treatment pass rate was 10.0% vs baseline 15.0% (−5.0pp). However, the skill revealed a **selective compliance** pattern: the additive step (verify-after-fix) passed in all 10 treatment runs (100%, vs ~15% baseline), while the interruptive steps (write FINDINGS.md before fixing) were ignored in 9/10 runs. Agents cherry-pick skill instructions based on deviation from their default workflow.

## Data

### Overall Pass Rates

| Condition | N | Passed | Rate | 95% CI |
|-----------|---|--------|------|--------|
| Baseline (no skill) | 20 | 3 | 15.0% | 3–38% |
| Treatment (investigation skill) | 10 | 1 | 10.0% | 0–45% |
| **Difference** | — | — | **−5.0pp** | — |

### Score Patterns

| Pattern | Baseline | Treatment |
|---------|----------|-----------|
| Product 5/5, Process 4/4 (PASS) | 3/20 (15%) | 1/10 (10%) |
| Product 5/5, Process 1/4 (FAIL) | 17/20 (85%) | 9/10 (90%) |

Every single run achieved perfect product scores (5/5). The failure mode is entirely in process checks — agents fix the code correctly but don't document bugs or run verification afterward.

### Process Check Breakdown (Baseline)

Failing baseline runs consistently show **Process: 1/4**, meaning:
- **P1** (planning-artifact-exists): ✅ Always passes
- **P2** (planning-identifies-typo): ❌ Almost never passes  
- **P3** (planning-identifies-checksum): ❌ Almost never passes
- **P4** (verify-after-fix): ❌ Almost never passes

### Process Check Breakdown (Treatment) — Selective Compliance

Treatment runs reveal a **selective compliance** pattern:
- **P1** (planning-artifact-exists): ❌ **9/10 FAIL** — agents ignored the instruction to write FINDINGS.md/analysis.md
- **P2** (planning-identifies-typo): ❌ Almost never passes (artifact doesn't exist)
- **P3** (planning-identifies-checksum): ❌ Almost never passes (artifact doesn't exist)
- **P4** (verify-after-fix): ✅ **PASSES in all treatment runs** — the "run code after fixing" instruction worked

This is the critical insight: the skill wasn't entirely ignored. The agent **selectively adopted** instructions that aligned with its existing workflow (run code = natural action) while **discarding** instructions requiring novel behavior (stop, write documentation, THEN fix). P2 and P3 necessarily fail when P1 fails (no artifact = nothing to check for bug mentions).

## Hypothesis Evaluation

**H-154**: An "investigation-before-fix" process skill improves process check pass rate by ≥20pp.

**Verdict: NOT SUPPORTED**

- Prediction 1 (≥35% overall): FAILED — got 10% (worse than baseline 15%)
- Prediction 2 (P2/P3 ≥50%): FAILED — still ~0% in treatment (artifact not created)
- Prediction 3 (P4 ≥70%): **PASSED** — verify-after-fix passes in all 10 treatment runs (100%), vs ~15% in baseline. The "run code after" instruction worked.

## Analysis

### The Selective Compliance Pattern

The investigation-before-fix skill instructed agents to:
1. Run code first to see errors
2. Write FINDINGS.md documenting every bug
3. Look for hidden dependencies
4. Fix only after documentation
5. Run code again after fixing

**The agent didn't ignore all of these — it cherry-picked.** Step 5 (verify by running) was adopted in all 10 treatment runs (P4 passes). But steps 2-4 (write documentation before fixing) were ignored in 9/10 runs (P1 fails → P2, P3 necessarily fail).

This reveals **selective compliance**: agents adopt skill instructions that align with their existing workflow (running code is a natural developer action) while discarding instructions that require behavioral deviation (stopping to write documentation mid-task). The skill didn't fail completely — it failed *asymmetrically*.

### Refining KE-021: Process Skills Have Internal Gradients

KE-021 established that process skills work better than judgment skills. EXP-154 adds a crucial nuance: **within a single process skill, individual steps have different compliance rates** based on how much they deviate from the agent's default workflow.

| Step | Deviation from Default | Compliance |
|------|----------------------|------------|
| Run code after fixing | Low (agents often do this anyway) | 10/10 (100%) |
| Write FINDINGS.md before fixing | High (requires stopping, creating new artifact) | 1/10 (10%) |
| Document hidden dependencies | High (requires metacognitive pause) | 1/10 (10%) |

This suggests a **compliance gradient** within process skills:
- **Additive steps** (do X in addition to what you normally do): HIGH compliance
- **Interruptive steps** (stop your normal flow and do Y first): LOW compliance

The "investigation-before-fix" skill failed because its core value proposition — document before fixing — is an *interruptive* step. The one step that worked (verify after) is *additive*.

### Implications for Skill Design

1. **Decompose compound skills**: A skill with 5 steps containing both additive and interruptive components will partially work. Test each step type separately.
2. **Additive process steps work as text**: "Run code after fixing" can be delivered as a skill file.
3. **Interruptive process steps need workflow gates**: "Write FINDINGS.md before editing" requires an L5 materialization gate — same as judgment skills.
4. **The KE-021 hierarchy needs a sub-level**: Process skills aren't uniformly effective. Additive process > Interruptive process > Knowledge > Judgment.

### Connection to KE-011 and KE-175

- **KE-011** (knowledge is passive): EXP-154 shows that even *active* process skills are partially passive when they contain interruptive steps. The agent reads the skill, adopts the easy parts, skips the hard parts.
- **KE-175** (skill effectiveness window): The 15% baseline is at the lower edge of the effectiveness window. The selective compliance pattern might be stronger at higher baselines where agents have more cognitive slack to follow instructions.

## Knowledge Entry

**KE-176**: Selective Skill Compliance — agents cherry-pick skill instructions based on deviation from default workflow. Additive steps (verify after fix) show 100% compliance; interruptive steps (write documentation before fixing) show 10% compliance. Process skills are not uniformly effective — they have an internal gradient: Additive Process > Interruptive Process. Interruptive process steps require workflow gates, same as judgment skills.

## Raw Data

### Baseline (20 runs)
```
#327  FAIL  Product: 5/5, Process: 1/4
#331  FAIL  Product: 5/5, Process: 1/4
#337  FAIL  Product: 5/5, Process: 1/4
#341  FAIL  Product: 5/5, Process: 1/4
#345  PASS  Product: 5/5, Process: 4/4
#346  PASS  Product: 5/5, Process: 4/4
#347  PASS  Product: 5/5, Process: 4/4
#349  FAIL  Product: 5/5, Process: 1/4
#353  FAIL  Product: 5/5, Process: 1/4
#355  FAIL  Product: 5/5, Process: 1/4
#359  FAIL  Product: 5/5, Process: 1/4
#362  FAIL  Product: 5/5, Process: 1/4
#364  FAIL  Product: 5/5, Process: 1/4
#368  FAIL  Product: 5/5, Process: 1/4
#371  FAIL  Product: 5/5, Process: 1/4
#374  FAIL  Product: 5/5, Process: 1/4
#378  FAIL  Product: 5/5, Process: 1/4
#382  FAIL  Product: 5/5, Process: 1/4
#386  FAIL  Product: 5/5, Process: 1/4
#388  FAIL  Product: 5/5, Process: 1/4
```

### Treatment (10 runs, fork: coder-exp154-investigate)
```
#960  FAIL  Product: 5/5, Process: 1/4
#961  FAIL  Product: 5/5, Process: 1/4
#962  FAIL  Product: 5/5, Process: 1/4
#963  FAIL  Product: 5/5, Process: 1/4
#964  FAIL  Product: 5/5, Process: 1/4
#965  FAIL  Product: 5/5, Process: 1/4
#966  FAIL  Product: 5/5, Process: 1/4
#967  FAIL  Product: 5/5, Process: 1/4
#968  FAIL  Product: 5/5, Process: 1/4
#969  PASS  Product: 5/5, Process: 4/4
```
