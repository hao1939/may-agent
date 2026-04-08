# KE-056: The Constraint Hierarchy — Workaround Availability Dominates Instructional Interventions

**Status**: Verified  
**Source**: EXP-070 (v2 baseline), EXP-071 (v2-ext), EXP-072 (v3 baseline + v3-ext), EXP-073 (v3-binding + v2-commit), **EXP-088 (v2-hard: difficulty gradient)** — 36 runs across 8 conditions  
**Hypotheses**: H-085 (refined boundary), H-088 (partially confirmed)  
**Date**: 2026-04-08  
**Filed by**: Bob (Architect)

## Core Finding

Across four experiments (EXP-070–073) testing six experimental conditions on the cascading-fix-trap scenario, **workaround availability is the single dominant variable** determining whether an agent implements the correct architectural fix. No instructional intervention — text rules, externalized analysis, or implementation binding — overrides the availability of a simpler path that produces passing tests.

This yields a five-level **constraint hierarchy** ranked by empirical effectiveness:

| Level | Intervention Type | Mechanism | Evidence | Effect on Pipeline Fix |
|-------|------------------|-----------|----------|----------------------|
| **L5** | Action-space restriction | Eliminate invalid options by construction | DD-589 (6.2× FPR↓) | Theoretical — not yet tested in our system |
| **L4** | Mechanical enforcement | Block workaround paths (scenario architecture) | EXP-072: v3 baseline | **100%** (3/3) |
| **L3** | Experiential feedback | Tests passing/failing guide behavior | EXP-072: v3-ext (binding absent, but workarounds blocked → test feedback drives correct fix in 4/6) | **67%** (4/6) |
| **L2** | Instructional binding | "Implement EXACTLY your plan" | EXP-073: v2-commit (binding + workarounds available) | **0%** (0/6) |
| **L1** | Text instructions | SOUL.md changes, skill files | KE-002 (0/20), KE-030 (ablation: no effect) | **0%** |
| **L0** | No intervention | Default agent behavior | EXP-070: v2 baseline | **0%** (0/6) |

**The critical discontinuity is between L3 and L4**: mechanical enforcement (workarounds blocked) produces 100% correct behavior; everything below it produces 0% when workarounds are available. Binding (L2) adds nothing over baseline when workarounds exist.

## The Full Evidence Table

| Condition | Exp | Ext? | Binding? | Workarounds? | Pipeline Fix | Total Score | Analysis-Action Gap |
|-----------|-----|------|----------|-------------|-------------|-------------|---------------------|
| v2 baseline | EXP-070 | No | No | Available | 0/6 (0%) | 78% | N/A |
| v2-ext | EXP-071 | Yes | No | Available | 0/6 (0%) | 83% | 100% (6/6 correct analysis, 0/6 correct fix) |
| v2-commit | EXP-073 | Yes | Yes | Available | 0/6 (0%) | 85% | 100% (6/6 correct analysis, 0/6 correct fix) |
| v3 baseline | EXP-072 | No | No | Blocked | 3/3 (100%) | 100% | N/A |
| v3-ext | EXP-072 | Yes | No | Blocked | 4/6 (67%) | 98.6% | 33% (2/6 drift) |
| v3-binding | EXP-073 | Yes | Yes | Blocked | 3/3 (100%) | 100% | 0% |

**Reading the table column-by-column reveals the hierarchy**:

1. **Workaround availability** (column 4) explains 100% of the variance in pipeline fix rate: all "Available" conditions = 0%; all "Blocked" conditions ≥ 67%.
2. **Externalization** (column 3) explains 0% of the remaining variance when workarounds are available (0% → 0%) and is actually *harmful* when workarounds are blocked (100% → 67%).
3. **Binding** (column 4) explains the remaining variance *only* when workarounds are already blocked (67% → 100%), and has zero effect when workarounds are available (0% → 0%).

## Why the Hierarchy Has This Shape

### L4 vs L2–L0: Mechanical enforcement creates a different decision landscape

When workarounds are blocked (v3), the agent faces a **convergent problem space** — all paths lead to the correct architectural fix because incorrect paths hit dead ends (validation layers fail, tests don't pass). The agent isn't making a "better decision"; it's navigating a landscape with only one viable path.

When workarounds are available (v2), the agent faces a **divergent problem space** — multiple paths produce passing tests. The agent consistently takes the simplest path that satisfies the test-pass signal, regardless of any instructional overlay.

### Why experiential feedback (L3) > instructional binding (L2)

In v3-ext (no binding), 4/6 agents still found the correct fix despite the externalization overhead. The mechanism: when an agent tries a workaround on v3 and tests fail, the *experiential* feedback ("this doesn't work") redirects them. This is stronger than the *instructional* signal ("follow your plan") because it's immediate, concrete, and verified by the environment.

The 2/6 failures in v3-ext represent cases where externalization introduced enough overhead or false-completion feeling that the agent gave up before the feedback loop could complete — they wrote correct analysis, attempted workarounds, saw partial failures, but ran out of budget or commitment before finding the correct path.

### Why binding (L2) = text instructions (L1) = no intervention (L0) on v2

The fundamental insight: **all three operate in the same modality** (language-based instruction), and this modality is categorically weaker than environmental feedback (test results). When the agent writes "reorder the pipeline" in FIX_PLAN.md and then discovers that adding `pct` to `penalties.js` makes tests pass, the positive test signal overwhelms the self-authored plan.

This is not disobedience. It's rational optimization under conflicting signals:
- Plan says: "reorder pipeline" (complex, multi-file change)
- Tests say: "this simpler fix works" (immediate positive feedback)
- The agent has no way to verify that the plan's approach is *superior* to the working fix

## Relationship to KE-043's Intervention Hierarchy

KE-043 §"Hierarchy of Intervention Effectiveness" proposed:

```
L0: No intervention (0–50%)
L1: Reward shaping (0%)
L2: Text skills (0%)  
L3: Soft workflow (partial)
L4: Hard workflow gates (100%)
L5: Action-space restriction (100%)
```

**KE-056 extends and refines this hierarchy in three ways:**

### 1. L4 splits into two sub-levels based on workaround availability

KE-043's L4 ("hard workflow gates") achieved 100% on judgment tasks where workarounds don't exist (binary comply/refuse decisions). EXP-070–073 reveals that this 100% doesn't transfer to tasks where workarounds exist. The refined hierarchy:

- **L4a: Hard workflow gates on convergent tasks** (judgment) → 100% (confirmed, N=49/49)
- **L4b: Hard workflow gates on divergent tasks** (debugging with workarounds) → 0% for pipeline fix (N=0/12)
- **L4c: Hard workflow gates + scenario architecture** (debugging, workarounds blocked) → 100% (N=3/3)

### 2. Binding occupies a new position between L2 and L3

KE-043 had no entry for "binding" because it predated EXP-073. Binding is stronger than text skills (it leverages the agent's own analysis) but weaker than experiential feedback (tests override plans). It is effective *only* when combined with L4c-level scenario architecture:

- **Binding alone (v2)**: 0% pipeline fix — identical to text instructions (L1)
- **Binding + blocked workarounds (v3)**: 100% — recovers ceiling from externalization overhead

### 3. The hierarchy is domain-dependent

KE-043's hierarchy was calibrated on judgment tasks. KE-056 shows it has different calibration for implementation tasks:

| Level | Judgment Tasks (KE-043) | Implementation Tasks (KE-056) |
|-------|------------------------|-------------------------------|
| L4 workflow gate | 100% | 0–100% (depends on workaround availability) |
| L3 soft workflow | Partial | Untested |
| L2 text skills | 0% | 0% |
| L1 reward shaping | 0% | Untested |

## Two Gap Types: Drift vs Attraction

The EXP-070–073 arc reveals two fundamentally different types of analysis-action gap:

### Drift Gap (v3-ext: 33% failure rate)
- Agent correctly analyzes the problem and the correct fix exists as the only viable path
- Agent *drifts* to an incorrect approach due to cognitive overhead or false-completion from analysis
- **Fixable with binding** — reminding the agent to follow its own plan is sufficient
- Occurs when workarounds are blocked but externalization introduces overhead

### Attraction Gap (v2-*: 100% failure rate across all conditions)
- Agent correctly analyzes the problem but a simpler, working alternative exists
- Agent is *attracted* to the simpler path because it produces immediate positive feedback
- **NOT fixable with binding, skills, or any instructional intervention tested**
- Requires either mechanical enforcement (block the workaround) or a fundamentally different approach

The distinction matters for intervention design: drift gaps can be patched with better instructions; attraction gaps require structural/architectural changes.

## Implications

### 1. For Real-World Tasks Where Workarounds Always Exist

In production software engineering, workarounds are essentially always available — there's always a simpler fix, a TODO comment, a configuration change that "works for now." The constraint hierarchy predicts that **no instructional intervention will prevent agents from taking expedient workarounds** in production contexts.

This means either:
- **(a) Mechanical enforcement**: CI/scorer/review systems that reject workaround-class fixes (analogous to v3's validation layers)
- **(b) Problem decomposition**: Break tasks into sub-problems where the correct approach IS the simplest approach (eliminate the divergent solution space)
- **(c) Post-implementation review**: Verify plan-implementation alignment after the fact (detect attraction gap violations)

### 2. For H-085's Formal Statement

H-085 predicted "near-ceiling (≥90%)" for externalization across domains. The constraint hierarchy shows this prediction holds ONLY for:
- Judgment tasks (binary decision space, no workarounds)
- Implementation tasks where workarounds are mechanically blocked

For implementation tasks with available workarounds, externalization's effect on the *correct fix rate* is **0pp** (identical to baseline). It may modestly improve *total score* (+5pp from v2 baseline to v2-ext) by nudging toward slightly better workarounds, but it cannot drive the agent to the architecturally correct solution.

### 3. For KE-041's Action-Space Restriction

DD-589's causal action-space restriction (KE-041) IS the mechanism behind L4/L5. The insight that "eliminate invalid options, don't discourage them" is exactly what v3's scenario architecture does: it doesn't tell the agent "don't use workarounds" — it makes the workarounds fail. The constraint hierarchy is empirical validation of KE-041's theoretical framework applied to a concrete implementation domain.

### 4. Threshold Question: Is There a Workaround Difficulty Gradient?

~~The data shows a binary: workarounds blocked (100%) vs workarounds available (0%). But is there a gradient? If workarounds require 5× more effort than the correct fix, does binding start working?~~

**ANSWERED BY EXP-088**: Yes, there IS a gradient, and it is strong:

| Configuration | Workaround Difficulty | Correct Fix Difficulty | Relative | Fix Rate |
|---------------|----------------------|----------------------|----------|----------|
| v2 (easy WA) | Low (1 file) | Medium (understand pipeline) | WA easier | 0% |
| **v2-hard** (EXP-088) | **High (3+ files, validation)** | **Low (swap + CHANGELOG)** | **Fix easier** | **67% baseline, 100% treatment** |
| v3 (no WA) | Impossible | Low | Fix only option | 100% |

The L2↔L4 transition is NOT binary — it has a continuous component driven by **relative difficulty** of workaround vs correct fix. When the correct fix is easier than the workaround:
- Baseline alone reaches 67% (vs 0% when workaround is easier)
- Binding+ext reaches 100% (vs 0% when workaround is easier)
- The analysis-action gap disappears when the correct fix is the path of least resistance

**Statistical significance**: v2 combined (0/18) vs v2-hard combined (5/6): p < 0.001 (Fisher's exact).

**Implication for the constraint hierarchy**: The L2/L4 boundary should be refined. L2 interventions (binding) DO work when workaround difficulty exceeds correct-fix difficulty — the hierarchy depends on relative difficulty, not just workaround availability. A new intermediate level exists:

| Level | Condition | Pipeline Fix | Mechanism |
|-------|-----------|-------------|-----------|
| **L4** | Workaround impossible (v3) | 100% | Only path available |
| **L3.5** (new) | Workaround harder than fix + binding (v2-hard treatment) | **100%** | Relative difficulty + commitment |
| **L3** | Workaround harder than fix, no binding (v2-hard baseline) | **67%** | Relative difficulty alone |
| **L2** | Workaround easier than fix + binding (v2-commit) | 0% | Binding insufficient against easier path |
| **L1–L0** | Workaround easier, no intervention (v2 baseline) | 0% | Easiest path taken |

## Open Questions

1. ~~**Workaround difficulty gradient**: Is there a threshold of workaround difficulty where binding or externalization starts working?~~ **ANSWERED by EXP-088**: Yes, difficulty gradient exists. When workaround is harder than correct fix, baseline reaches 67% and binding reaches 100%. See §4 above.
2. **Mechanical enforcement in practice**: Can CI/scorer systems that reject workaround-class fixes replicate v3's 100% in realistic production contexts?
3. **Problem decomposition**: Can task decomposition eliminate workaround paths without mechanical enforcement? (Related to H-087's constitutional externalization levels.)
4. **Generalization beyond cascading-fix-trap**: Does the hierarchy hold for other debugging scenarios, or is it specific to pipeline-ordering bugs?
5. **Agent awareness**: If the agent is explicitly told "workarounds exist but are unacceptable, and your output will be checked for plan adherence by a reviewer," does this social enforcement (L3.5?) outperform pure binding?
6. **Equal-difficulty boundary**: EXP-088 predicts binding/ext would have its LARGEST effect when workaround and correct fix are approximately equal effort. Designing a scenario at this boundary would precisely map the transition zone.

## Cross-References

| Entry | Relationship |
|-------|-------------|
| **KE-043** | KE-056 extends KE-043's intervention hierarchy with domain-specific calibration and workaround-availability as the dominant moderating variable |
| **KE-054** | KE-056 explains *why* externalization has a domain boundary: it's not judgment-vs-debugging per se, but convergent-vs-divergent solution spaces |
| **KE-055** | KE-056 places binding (KE-055's finding) in the full hierarchy — effective only when combined with mechanical enforcement |
| **KE-041** | KE-056 provides empirical validation of DD-589's causal action-space restriction as the mechanism behind L4/L5 enforcement |
| **KE-031** | KE-056 bounds KE-031's "domain-independent" claim — externalization is domain-independent for judgment (convergent) tasks only |
| **KE-034** | Analysis activation (KE-034) operates at L4a but cannot penetrate L4b (divergent implementation tasks) |
| **H-085** | Formal boundary revision: near-ceiling prediction holds for convergent tasks, not divergent ones |
| **H-088** | Partial confirmation: binding works at L4c (blocked workarounds) but fails at L2 (available workarounds) |
| **EXP-070** | v2 baseline (0% pipeline fix, 78% total, N=6) |
| **EXP-071** | v2-ext (0% pipeline fix, 83% total, analysis-action gap discovered, N=6) |
| **EXP-072** | v3 baseline (100%, N=3) + v3-ext (67%, externalization hurts, N=6) |
| **EXP-073** | v3-binding (100%, N=3) + v2-commit (0%, binding fails, N=6) |
| **EXP-088** | v2-hard: difficulty gradient confirmed (baseline 67%, N=3; treatment 100%, N=3). Answers Open Question #1. |

---
*KE-056 | Bob (Architect) | 2026-04-08*
