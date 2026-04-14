# KE-182: Hard Gate Design Rules — Consolidated Synthesis

**Status**: Active
**Source**: EXP-127, EXP-129, EXP-131, EXP-155, EXP-156, EXP-157, EXP-163, EXP-RECOGNITION
**Date**: 2026-04-14
**Confidence**: ★★★★☆ (High — synthesizes 8 experiments, 200+ runs, consistent patterns)
**Supersedes**: Individual findings in KE-129, KE-134, KE-178, KE-179, KE-180, KE-181 (those remain valid; this unifies them)

---

## Executive Summary

Hard externalization gates (Ch2) are the most powerful behavioral intervention discovered: +100pp on 3 scenarios, 0% → 100%. But they are NOT universally beneficial. EXP-157 showed -80pp when misapplied. This entry consolidates 8 experiments into actionable design rules.

---

## The Evidence Base

| Experiment | Scenario | Baseline | Treatment | Δ | Verdict |
|-----------|----------|----------|-----------|---|---------|
| EXP-127 | contradictory-requirements | 0% (0/25) | 100% (10/10) | **+100pp** | ✅ Landmark |
| EXP-156 | misleading-test-fix | 0% (0/11) | 100% (11/11) | **+100pp** | ✅ Generalized |
| EXP-RECOGNITION | stale-config + wrong-error | 10% (1/10) | 100% (10/10) | **+90pp** | ✅ 2-phase validated |
| EXP-155 | hidden-dep | 15% → 100% overall | +85pp overall | +85pp | ⚠️ Process compliance only (product was 100% in all arms — EXP-163) |
| EXP-156 | ambiguous-context-drift | 90% (9/10) | 70% (7/10) | **-20pp** | ⚠️ Regression (NS, p=0.587) |
| EXP-157 | mock-leak-trap | 80% (4/5) | 0% (0/10) | **-80pp** | ❌ Completion illusion (p=0.004) |
| EXP-129 | contradictory-req (1-4 gates) | 86% (1-gate) | 100% (3-gate) → 67% (4-gate) | Hump curve | ✅ Stacking curve mapped |
| EXP-131 | contradictory-req (related vs unrelated) | 89% (1-related) | 50% (3-unrelated) vs 86% (3-related) | Relevance > count | ✅ Synergy confirmed |

---

## Rule 1: The Gate Artifact Must Be Part of the Solution

**The single most important design rule.** This separates the +100pp successes from the -80pp failure.

### What works: Artifact changes the agent's next action
| Gate | Artifact | Why It Works |
|------|----------|-------------|
| EXP-127: ANALYSIS.md | Documents contradiction + alternatives | Agent can't propose alternatives without first recognizing the contradiction |
| EXP-156: DIAGNOSIS.md | Hand-calculates expected values | Agent discovers the test is wrong before deciding what to fix |
| EXP-RECOGNITION: REVIEW.md | Lists all inconsistencies across files | Phase 2 explicitly reads REVIEW.md and fixes everything listed |

### What fails: Artifact is a standalone analysis document
| Gate | Artifact | Why It Fails |
|------|----------|-------------|
| EXP-157: TEST_ANALYSIS.md | Describes mock masking problem | Writing about the problem satisfies "I addressed it" — agent never fixes the mock |

### The Design Test

> **Ask: "Does writing this artifact PRODUCE the fix, or merely DESCRIBE the problem?"**
> - If PRODUCE → good gate (DIAGNOSIS.md with correct calculations IS the diagnostic step)
> - If DESCRIBE → bad gate (TEST_ANALYSIS.md describing mock masking is NOT the fix)

Corollary: The best gates force the agent into a cognitive mode where the correct action becomes obvious. Writing the artifact IS the thinking step. The fix follows naturally.

---

## Rule 2: Check the Baseline Before Designing the Gate

Hard gates are high-impact only on **low baselines** (≤ 50%). On high baselines, they add overhead without benefit — and may cause regression.

| Baseline Range | Expected Gate Effect | Action |
|---------------|---------------------|--------|
| 0-20% | +80 to +100pp | Strong candidate for hard gate |
| 20-50% | +30 to +60pp (estimated) | Possible candidate; test first |
| 50-80% | Small or none | Probably not worth the overhead |
| 80-100% | Likely regression (-20pp) | Do NOT apply — agent already succeeds |

**Evidence**: Three scenarios at 0-15% baseline → +85 to +100pp. One scenario at 90% baseline → -20pp regression. One scenario at 80% → -80pp (completion illusion compounded the baseline effect).

---

## Rule 3: Match the Gate to a Step-Skipping Failure Mode

Hard gates work when the agent's failure mode is: **"rushes to action without performing an analytical step that would have revealed the correct answer."**

### Failure modes where gates work:
| Mode | Example | Why Gate Helps |
|------|---------|---------------|
| Judgment skip | Doesn't analyze contradictory requirements | Forces analysis before implementation |
| Verification skip | Doesn't hand-check math in tests | Forces calculation before acting on test results |
| Investigation skip | Fixes obvious bug, misses secondary issues | Forces comprehensive file review before fixing |

### Failure modes where gates DON'T work:
| Mode | Example | Why Gate Fails |
|------|---------|---------------|
| Belief error | Trusts injected false context | Agent writes verification but still believes the false context |
| Completion illusion | Identifies problem, writes about it, doesn't fix it | Analysis substitutes for action |
| Already competent | Agent naturally discovers the answer | Gate adds overhead to a solved process |

---

## Rule 4: Use 2-Phase Investigate→Fix, Not 1-Phase Analyze→Report

The most robust gate pattern is:

```
Phase 1: INVESTIGATE — Write ARTIFACT.md documenting findings
Phase 2: FIX — Read ARTIFACT.md, fix everything listed
```

This works because:
1. Phase 1 forces comprehensive investigation (can't write findings without reading)
2. The artifact creates a **memory bridge** — Phase 2 has a concrete list to work from
3. Phase 2 treats the artifact as a TODO list, not as "already handled"

### Why standalone analysis fails (EXP-157)
When there's no Phase 2 that references the artifact, the agent treats writing the analysis as task completion. The "announcement effect" — stating what you found substitutes for acting on it.

### EXP-RECOGNITION: The gold standard
- Phase 1: "Investigate ALL files, write REVIEW.md listing every inconsistency"
- Phase 2: "Read REVIEW.md. Fix every issue listed."
- Result: 100% (10/10) vs 10% baseline

---

## Rule 5: Gate Relevance Matters More Than Gate Count

From EXP-129 and EXP-131:

| Configuration | Pass Rate | Duration |
|--------------|-----------|----------|
| 1 related gate | 88% (14/16 combined) | 253s |
| 3 related gates | 92% (12/13 combined) | 556s |
| 3 unrelated gates | 50% (4/8) | 584s |
| 4 related gates | 67% (4/6) | 755s |

**Key insights**:
- Related analytical gates **synergize** — they scaffold thinking without competing for attention
- Unrelated gates **dilute** judgment — the agent spends cognitive budget on irrelevant analysis
- Duration is identical for related vs unrelated at same count → it's attention dilution, not time pressure
- The hump curve peaks at 2-3 related gates; unrelated gates degrade from 1+
- Each gate costs ~167s of execution time regardless of relevance

**Design implication**: Every gate in a multi-gate workflow should contribute analytical scaffolding to the SAME judgment task. Don't mix style reviews, performance audits, and dependency checks into a judgment workflow.

---

## Rule 6: Distinguish Process Compliance from Product Quality

From EXP-163's retroactive reinterpretation of EXP-155:

**A gate that requires ARTIFACT.md and a scorer that checks for ARTIFACT.md is measuring compliance, not quality.** The "forced externalization effect" on hidden-dep was tautological: tasks that require artifacts produce artifacts.

| Metric | What It Shows | Reliability |
|--------|--------------|-------------|
| Product checks (code correctness, test pass) | Whether the agent solved the problem | High — hard to game |
| Process checks (artifact exists, identifies X) | Whether the agent followed the process | Confounded when gate creates what scorer checks |

**Design rule**: Always measure product quality independently of process compliance. Report them separately. The primary outcome should be: "Did the agent's output solve the problem correctly?"

---

## Summary Decision Tree

```
Should I use a hard gate?

1. Is the baseline ≤ 50%?
   NO → Don't apply (overhead risk, possible regression)
   YES ↓

2. Is the failure mode "agent skips an analytical step"?
   NO → Don't apply (beliefs, perception, competence aren't fixable by gates)
   YES ↓

3. Can the gate artifact BE the analytical step (not just describe the problem)?
   NO → Redesign: make the artifact produce the fix, not describe it
   YES ↓

4. Can I structure as 2-phase (investigate → fix)?
   NO → Use 1-phase but ensure artifact changes subsequent action
   YES ↓

5. Are all gates in the workflow analytically relevant to the task?
   NO → Remove irrelevant gates (they dilute, not help)
   YES ↓

6. Is the total gate count ≤ 3?
   NO → Consider reducing; 4+ gates show mild degradation
   YES → APPLY THE HARD GATE — expect +50 to +100pp improvement
```

---

## What Experiments Should We Run Next?

Given these consolidated rules, three gaps remain:

### Gap 1: The 20-50% Baseline Zone
All successful gates were on 0-15% baselines. The 90% case regressed. We have **no data** in the 20-50% range where moderate-difficulty tasks live. 
- **Proposed**: Find or design a scenario with 30-50% baseline, apply a hard gate, measure product quality.

### Gap 2: Solution-Producing Gates vs Analysis-Describing Gates (Controlled)
EXP-157 showed analysis gates harm. But was it the analysis format or the lack of Phase 2 reference? 
- **Proposed**: Same scenario, two gate designs: (A) "Write TEST_ANALYSIS.md" (analysis-only), (B) "Write FIXED_TESTS.md with corrected test code" (solution-producing). Isolates the artifact-type variable.

### Gap 3: Gate Effectiveness on Non-Judgment Tasks
All confirmed gains are on judgment/verification tasks. Do gates help on implementation quality, creative design, or debugging tasks?
- **Proposed**: Apply investigate→fix gate to a debugging scenario with 20-40% baseline. Test whether the mechanism generalizes beyond "notice the non-obvious thing" to "figure out the complex thing."

---

## Related Entries

| Entry | Relationship |
|-------|-------------|
| KE-129 | Ch2 is the only reliable channel — this entry explains WHEN Ch2 works |
| KE-134 | Hump curve for gate stacking — subsumed into Rule 5 |
| KE-178 | Boundary condition (low baseline + step-skipping) — subsumed into Rules 2+3 |
| KE-179 | Generalization evidence — subsumed into Evidence Base |
| KE-180 | Completion illusion — subsumed into Rule 1 |
| KE-181 | Process vs product metrics — subsumed into Rule 6 |
| KE-176 | Selective compliance — explains WHY Ch1 skills fail (motivating Ch2 gates) |

## Tags
`synthesis` `hard-gate` `ch2` `externalization` `design-rules` `intervention-design` `completion-illusion` `gate-stacking` `process-vs-product`
