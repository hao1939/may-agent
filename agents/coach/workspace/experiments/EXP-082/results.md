# EXP-082 Results: Knowledge Application Pipeline — Do Agents USE What We Know?

**Date**: 2026-04-08
**Status**: COMPLETE (Test 1 only — debugging domain)
**Sprint**: 31
**Tags**: knowledge-utilization, KE-054, KE-011, KE-026, H-043, injected-context
**Gym budget**: 3 treatment runs (baseline from EXP-072/073)

## Executive Summary

**P(applies) = 0.** Agents do not apply injected declarative knowledge, even when it directly contradicts their current task. When given KE-054's finding ("externalization hurts debugging — skip analysis on debugging tasks") alongside a debugging task that forces externalization, the agent:
- Wrote full-length analysis in 3/3 runs (average 3,455 bytes)
- Referenced KE-054 in 0/3 runs
- Adapted its approach in 0/3 runs
- Achieved 100% pipeline fix rate (3/3) despite ignoring the knowledge

This extends the knowledge utilization dead zone from **access** (KE-011, KE-026) to **application**: agents don't just fail to FIND knowledge — they fail to USE knowledge that's placed directly in their context.

## Design

### Scenario: cascading-fix-trap-v3-ke054

Created a variant of cascading-fix-trap-v3-ext (forced externalization on debugging task) with one addition: **injected_context.md containing KE-054's finding**.

The injected context stated:
- "Externalization hurts debugging task performance (–11 to –33pp)"
- "For debugging/implementation tasks: Skip or minimize the analysis phase"
- "This is a debugging task. KE-054 suggests the analysis phase may be counterproductive"

The task itself still instructed the agent to write ROOT_CAUSE_ANALYSIS.md — creating a **direct conflict** between task instructions and injected knowledge.

### Baselines (from prior experiments)

| Condition | Source | Pipeline Fix Rate | Analysis Written | Notes |
|-----------|--------|-------------------|------------------|-------|
| No externalization (v3) | EXP-072 | 100% (6/6) | N/A | Clean baseline |
| Externalization, no KE-054 (v3-ext) | EXP-072/073 | 67% (4/6) | 100% (6/6) | Externalization hurts |
| **Externalization + KE-054 (v3-ke054)** | **EXP-082** | **100% (3/3)** | **100% (3/3)** | **Agent ignores knowledge** |

### Measurement

**Primary metrics:**
1. analysis-references-ke054: Does the agent mention KE-054, domain boundaries, or externalization concerns?
2. analysis-adapted: Is the analysis streamlined (<1000 bytes, focused on action)?
3. Product quality: all-tests-pass, pipeline-order-fixed, grade-threshold-fixed

## Results

### Run-by-Run Data

| Run | Product Checks | Analysis Written | Analysis Size | References KE-054 | Analysis Adapted | Total Score |
|-----|---------------|------------------|---------------|-------------------|------------------|-------------|
| 1 | 3/3 ✅ | Yes | 2,026 bytes | ❌ No | ❌ No | 12/14 |
| 2 | 3/3 ✅ | Yes | 3,764 bytes | ❌ No | ❌ No | 12/14 |
| 3 | 3/3 ✅ | Yes | 4,575 bytes | ❌ No | ❌ No | 12/14 |

**Knowledge application rate: 0% (0/3)**
**Knowledge reference rate: 0% (0/3)**

### Analysis Content Review

All three analyses followed the standard pattern:
1. Full data flow description (all 8 pipeline stages)
2. Root cause identification (penalty/normalize order)
3. Proposed fix

None mentioned:
- KE-054 or domain boundaries
- That externalization might be inappropriate for this task
- That the analysis phase could be shortened or skipped
- Any conflict between the injected knowledge and task instructions

The analyses averaged 3,455 bytes — comparable to v3-ext baseline analyses (3,000-5,000 byte range). No evidence of adaptation.

### Grepping for any knowledge reference

```
grep -ci "ke-054|domain.boundary|externalization|analysis.action.gap|judgment|skip|minimize" across all 3 runs:
  Run 1: 0 matches
  Run 2: 0 matches
  Run 3: 0 matches
```

## Analysis

### Finding 1: Task Instructions Override Injected Knowledge (100%)

The agent received two conflicting signals:
- **Task instructions**: "Write ROOT_CAUSE_ANALYSIS.md with detailed analysis"
- **Injected knowledge**: "Externalization hurts debugging. Skip or minimize analysis"

In all 3 runs, the agent followed task instructions and completely ignored the injected knowledge. This is consistent with the prompt processing model: **explicit instructions > implicit context knowledge**.

### Finding 2: The Complete Knowledge Utilization Dead Zone

Combining EXP-082 with prior experiments, we now have the full pipeline:

| Pipeline Stage | Rate | Source |
|---------------|------|--------|
| P(exists) — knowledge is written | ~100% | 57 KE entries exist |
| P(accesses) — agent finds knowledge | ≈0 (0/30) | KE-011, KE-026 |
| P(applies when pushed) — agent uses pushed knowledge | **≈0 (0/3)** | **EXP-082** |
| P(applies correctly) — behavior changes | **≈0 (0/3)** | **EXP-082** |

**U = P(exists) × P(accesses) × P(applies) ≈ 0 at every stage**

### Finding 3: Possible Confound — Improved Pipeline Fix Rate

EXP-082 achieved 100% pipeline fix rate (3/3) vs EXP-072's 67% (4/6) for v3-ext. Two possible explanations:

1. **Random variation**: With 3 runs, 100% is within confidence interval of 67% baseline
2. **Implicit knowledge effect**: The KE-054 context might prime the agent to be more careful even though it doesn't explicitly reference it

We cannot distinguish these with n=3. But even if explanation (2) is correct, the agent shows ZERO explicit knowledge application — no references, no adapted behavior, no acknowledgment.

### Finding 4: Knowledge Application Requires Structural Enforcement

The pattern matches KE-002 at a meta level:
- KE-002: "Text rules don't fix judgment failures → need structural workflows"
- EXP-082: "Text knowledge doesn't change agent behavior → need structural knowledge gates"

Declarative knowledge ("X hurts Y, don't do X") has no effect when placed in context. Just as text rules saying "be careful with deletions" don't prevent sycophantic deletions, text knowledge saying "don't externalize for debugging" doesn't prevent externalization.

## Implications for H-043 and Knowledge Consumability

### P(applies) Update

H-043 estimates U ≈ 0.03-0.15. EXP-082 shows that even with P(accesses) artificially set to 1.0 (forced injection), P(applies) ≈ 0. This means:

**The bottleneck is NOT delivery alone. Even perfectly delivered knowledge is not applied.**

The Knowledge Consumability Plan focuses on making knowledge easier to FIND. EXP-082 suggests that findability is necessary but NOT sufficient. Knowledge must be:
1. Found (KE-011/026 say this fails)
2. Applied (EXP-082 says THIS ALSO fails)
3. Enforced structurally (the only mechanism that works — per KE-002, KE-029, KE-031)

### Updated Knowledge Utilization Formula

Previous: U = P(exists) × P(accesses) × P(applies)
Updated: U = P(exists) × P(accesses) × P(reads) × P(comprehends) × P(overrides_task_instructions)

The new terms reflect that even when knowledge is read (it's in the context), it must be:
- Comprehended as relevant to the current task
- Strong enough to override explicit task instructions

EXP-082 shows the last factor is effectively 0.

## Recommendations

### 1. Knowledge Must Be Encoded as Workflows/Skills, Not Declarations
KE-054 says "don't externalize for debugging" — this should become a **conditional workflow** that checks task domain before inserting externalization, not a knowledge entry that agents read.

### 2. Context Injection is Necessary but Not Sufficient
The Knowledge Consumability Plan's push delivery model is correct that pull discovery is dead. But push delivery alone doesn't cause behavior change. Push + structural enforcement is needed.

### 3. P(applies) Testing Should Be Standard
Every new KE entry should be tested: "If we inject this knowledge, does behavior change?" Most won't. Only those that survive this test deserve investment in delivery infrastructure.

## Connections to Knowledge Base

- **Extends KE-011**: From "agents skip knowledge files" to "agents skip injected knowledge too"
- **Extends KE-026**: From "pull discovery dead" to "push delivery insufficient"  
- **Validates KE-002**: Text declarations don't change behavior, at ANY level
- **Updates H-043**: P(applies|pushed) ≈ 0, not just P(accesses) ≈ 0
- **Refines KE-054**: The domain boundary finding is correct but CANNOT be applied declaratively — must be structural

## What's Next

- **Test 2 (KE-010 ceiling)**: Not yet run. Design exists but needs meta-task scenario.
- **Test 3 (KE-002 text rules)**: Not yet run. Design exists.
- **Structural KE-054 enforcement**: Build a task-domain classifier that conditions externalization on domain. This would be the STRUCTURAL form of KE-054's knowledge.
- **Created KE-058**: "Injected Declarative Knowledge Has No Effect on Agent Behavior (P(applies) ≈ 0)"
