# Content-First Guards: Difficulty-Adaptive Passive-Injection Architecture

**Author**: Bob  
**Date**: 2026-04-16  
**Status**: Design proposal  
**Based on**: EXP-166 (N=120), KE-195, KE-196, H-165

---

## Problem Statement

Current guard patterns often require agents to **produce** analysis before acting (analyze-then-fix, plan-then-execute). EXP-166 proved this is catastrophic on hard tasks: when expert analysis is available, requiring the agent to also produce its own analysis destroys the expert benefit entirely (100% → 7% pass rate, a 93pp loss). This "production-displacement effect" means our guards are actively harming performance on the tasks where help matters most.

We need guards that **inject expert knowledge passively** — providing information without requiring production — and that adapt their behavior based on task difficulty.

---

## 1. Guard Mechanism: Passive Injection

### Core Principle

**Provide, don't require.** Guards inject expert analysis into the agent's context as pre-existing artifacts. The agent reads and applies the information directly — no intermediate production step (no "write your own plan," no "summarize the analysis," no "produce ANALYSIS.md first").

### Concrete Implementation

```
PASSIVE INJECTION (for hard tasks):
1. Guard detects relevant expert knowledge exists for this task pattern
2. Guard injects knowledge as a file in the workspace (e.g., EXPERT_ANALYSIS.md)
3. Task prompt includes: "A colleague has already investigated this. Read EXPERT_ANALYSIS.md, then proceed with the fix."
4. Agent reads → fixes. No intermediate production required.

ACTIVE INJECTION (for easy tasks, optional):
1. Same injection as above
2. Task prompt MAY additionally say: "After reading, write a brief plan before fixing."
3. Production step is permitted because easy tasks have slack capacity to absorb it.
```

### What Guards Must NOT Do

- ❌ Require agents to produce analysis before seeing expert content (F2-first pattern)
- ❌ Require agents to restate/summarize expert content in their own words (triggers displacement)
- ❌ Gate progression on production artifacts ("you must write PLAN.md before Phase 2")
- ❌ Delete expert content after a production phase

### What Guards SHOULD Do

- ✅ Inject expert content as a pre-existing workspace artifact
- ✅ Frame it as a colleague's prior work (natural reading, no production obligation)
- ✅ Let the agent proceed directly to the task after reading
- ✅ Optionally validate that the agent *read* the file (low-cost check) without requiring production

---

## 2. Difficulty Classification

### The Problem

The displacement effect is difficulty-moderated (KE-196). Production is harmless on easy tasks but catastrophic on hard ones. We need to classify difficulty to decide the injection mode.

### Difficulty Signals

| Signal | Easy (>60% baseline) | Hard (<25% baseline) | Measurability |
|--------|---------------------|---------------------|---------------|
| **Historical pass rate** | High baseline on this scenario/pattern | Low or zero baseline | High (requires prior data) |
| **Workaround availability** | Single fix path | Multiple surface-level workarounds that pass tests | Medium (requires scenario analysis) |
| **Root cause depth** | Shallow (single file, obvious bug) | Deep (architectural, multi-file, causal chain) | Medium (heuristic) |
| **Environmental misleads** | None or weak | Strong (docs/comments point wrong direction) | Medium |
| **Agent self-analysis reliability** | Agent finds root cause >60% of time | Agent finds root cause <25% of time | High (requires F2-only trials) |

### Classification Heuristic

**Default to passive injection (treat as hard).** The asymmetry in costs makes this safe:

| Misclassification | Cost |
|---|---|
| Treat easy task as hard → passive injection | **0pp** (no degradation; agent just doesn't produce unnecessary analysis) |
| Treat hard task as easy → allow production | **~93pp** (catastrophic displacement) |

The expected cost of over-caution is zero. The expected cost of under-caution is catastrophic.

### Practical Classification

For **known scenarios** with baseline data: use historical pass rate directly.
- Baseline ≥ 60%: easy → production permitted
- Baseline < 25%: hard → passive only
- Baseline 25-60%: medium → default passive (untested zone, see §5)

For **novel tasks** without baseline data: use structural heuristics:
- Single-file bug with clear test failures → likely easy → production OK
- Multi-file architectural issue with misleading context → likely hard → passive only
- When uncertain → passive (safe default)

---

## 3. Expected Performance Improvement

### Based on EXP-166 Data (N=120)

| Scenario | Current (no guard) | With Passive Injection | Δ |
|----------|-------------------|----------------------|---|
| Hard tasks (0% baseline) | 0% | **100%** | **+100pp** |
| Easy tasks (67% baseline) | 67% | **100%** | **+33pp** |

### Projected Impact by Difficulty Band

| Difficulty | Baseline | Passive Injection | Production Guard | Passive Advantage |
|-----------|---------|-------------------|-----------------|-------------------|
| Hard (<25%) | 0-25% | 80-100% | 0-25% (no benefit) | **+55 to +100pp** |
| Medium (25-60%) | 25-60% | 70-90% (predicted) | 30-70% (predicted partial displacement) | **+20 to +40pp** (predicted) |
| Easy (>60%) | 60-100% | 90-100% | 90-100% | **0pp** (equivalent) |

### Conservative Estimate

Across a mixed-difficulty task portfolio (30% hard, 40% medium, 30% easy), passive injection over production guards yields an estimated **+25-40pp average improvement** — driven almost entirely by hard tasks where production guards currently provide zero benefit.

---

## 4. Implementation Risks

### Risk 1: Expert Knowledge Availability
**Problem**: Passive injection requires pre-existing expert analysis. For novel failure patterns, no expert content exists.  
**Mitigation**: Build a library of expert analysis templates for known failure patterns. For truly novel failures, fall back to baseline (no injection) rather than forcing production. Over time, failures generate expert knowledge for future injection.  
**Severity**: Medium — limits applicability, doesn't cause harm.

### Risk 2: Over-Classifying as Hard (False Positives)
**Problem**: Defaulting to passive injection means easy tasks get expert help they don't need.  
**Mitigation**: This is explicitly **costless** per KE-196 — passive injection on easy tasks shows 0pp degradation vs production guards. The only cost is unnecessary expert content generation effort.  
**Severity**: Low — no performance risk, only effort cost.

### Risk 3: Expert Content Quality
**Problem**: If injected expert analysis is wrong or incomplete, it could mislead the agent.  
**Mitigation**: EXP-047 (from H-085) showed agents can override wrong *external* analysis — they trigger verification rather than blind following. Still, expert content should be validated. Use the same review process as any documentation.  
**Severity**: Medium — wrong expert content is still better than wrong self-generated content (agents verify external claims more than self-generated ones).

### Risk 4: Difficulty Boundary Is Uncertain
**Problem**: The medium-difficulty band (25-60% baseline) is untested. Displacement could have a cliff/threshold rather than gradual onset.  
**Mitigation**: EXP-167 or a follow-up should test medium-difficulty scenarios (see §5).  
**Severity**: Medium — affects prediction accuracy but not the safe-default policy.

### Risk 5: Scenario-Specificity of Results
**Problem**: EXP-166 tested two scenarios (sql-injection, cascading-fix-trap-v2). Results may not generalize to all task types.  
**Mitigation**: EXP-165 tested additional scenarios confirming the pattern. The mechanism (capacity displacement) is domain-general. Still, expand testing.  
**Severity**: Low-medium — mechanism is well-explained, but more replication is always better.

---

## 5. Validation Experiment: Medium-Difficulty Band Test

### Rationale

The critical unknown is the medium-difficulty band (25-60% baseline). EXP-166 showed the extremes: 0pp displacement on easy tasks, 93pp on hard tasks. The shape of the curve between these points determines how aggressively we need the difficulty classifier.

### Design: EXP-168 (proposed)

**Scenarios**: 2-3 scenarios with baseline pass rates in the 30-50% range.  
**Arms**: Same as EXP-166 — A (baseline), B (F2-only), C (F1-only), D (F1→F2).  
**N**: 15 per arm per scenario (same power as EXP-166).  
**Key question**: Is D ≈ C (no displacement at medium difficulty) or D < C (displacement begins before hard threshold)?

**Expected outcomes**:
- If displacement is a cliff (threshold at ~25% baseline): D ≈ C at medium difficulty → passive-only needed for <25% tasks only
- If displacement is gradual: D < C by ~30-50pp → passive preferred for anything below ~60%
- If displacement is always present: D < C even at medium → always use passive (current default is correct)

**Decision criteria**:
- D ≈ C at medium difficulty → relax default; allow production for >25% baseline tasks
- D < C at medium difficulty → keep current conservative default (passive for ≤60%)

### Cost: ~$6-9 (60-90 runs depending on scenario count)

### Pre-Rollout Checklist

Before deploying content-first guards in production:

1. ✅ Hard-task validation (EXP-166): passive injection +100pp vs production guard 0pp
2. ✅ Easy-task validation (EXP-166): no degradation from passive injection
3. ⬜ Medium-task validation (EXP-168 proposed): determine displacement curve shape
4. ⬜ Expert content library: build templates for top-10 failure patterns
5. ⬜ Integration test: verify guard injection mechanism works with gym runner

---

## Summary

| Design Decision | Choice | Rationale |
|----------------|--------|-----------|
| Default mode | Passive injection | 0pp cost if wrong, 93pp cost if production allowed on hard task |
| Difficulty classifier | Conservative (default=hard) | Asymmetric risk: over-caution is free, under-caution is catastrophic |
| Production requirement | Never on hard, optional on easy | EXP-166 D arm: production destroys F1 benefit on hard tasks |
| Expert content format | Workspace file, framed as colleague's work | Natural reading pattern, no production obligation |
| Validation needed | Medium-difficulty band (EXP-168) | Determines curve shape and classifier precision needed |

**Bottom line**: Stop making agents produce analysis on hard tasks. Give them the answer and let them work. The data is unambiguous: 100% vs 7%.
