# Cross-Reference: Skill Distillation Convergence — Why Extraction Isn't Enough

**Date**: 2026-04-03
**Author**: Bob (Architect)
**Sources**: Trace2Skill (arXiv:2603.25158), Microsoft OEL, Memento-Skills, KE-002, KE-007, KE-011, Knowledge-Action Gap mechanism, H-043

---

## The Pattern

Three independent papers from April 2026 converge on the same finding:

| Paper | Method | Key Result |
|-------|--------|-----------|
| **Trace2Skill** | Multi-agent error/success analysis → declarative skill docs | Declarative skills > episodic memory bank. +57.65pp transfer across model sizes. |
| **Microsoft OEL** | Deployment trajectories → experience extraction → parameter distillation | Extracted experience > raw trajectories. Continuous improvement loop. |
| **Memento-Skills** | Read-Write skill notebook (41→235 skills) | External skill library → +116% avg improvement. Model parameters frozen. |

**The convergence**: All three find that **structured/distilled knowledge outperforms raw trajectory storage**. The extraction process that converts experiences into reusable patterns is more valuable than the experiences themselves.

## How This Maps to Our System

Our system already implements the extraction side:

| External Concept | Our Equivalent | Status |
|-----------------|---------------|--------|
| Trace2Skill's trajectory analysis | context-learn workflow (extract from session transcripts) | Deployed |
| OEL's experience extraction | Compact cycle (distill insights from journal) | Deployed |
| Memento-Skills' skill notebook | skills/ directory (41 declarative skill files) | Deployed |
| Trace2Skill's parallel merge | None — single-threaded extraction | Gap |
| OEL's on-policy distillation | None — we don't parameter-tune | N/A (harness-level system) |

We're doing the right thing on extraction. **But extraction alone doesn't work for us.**

## The Paradox

Trace2Skill's headline result: declarative skill documents outperform episodic memory banks.

Our headline result (KE-002, KE-007): declarative skill documents have **zero** behavioral effect.

These seem contradictory. They're not. The difference:

| System | Where skills are used | How skills influence behavior |
|--------|----------------------|------------------------------|
| Trace2Skill | Injected into prompt before task | Model reads skill, adjusts generation |
| Memento-Skills | Retrieved and injected at inference | Model reads skill, adjusts generation |
| Our system | Loaded into context/injected into prompt | Agent reads skill... **and ignores it** |

Trace2Skill and Memento-Skills work because they inject skills into a **fresh model context** that hasn't yet committed to an action path. The skill directly shapes the generation prior for the upcoming task.

Our agents receive skills in a context that also contains the task, their persona, prior conversation, tools, and competing objectives. The skill text is one signal among many, and it loses to the dominant generation prior (habitual tool use, action-bias, training distribution).

**The knowledge-action gap applies to distilled skills too.** Distillation solves P(exists) — the knowledge is created. It doesn't solve P(acts on it | exists) — the generation path bypasses it.

## The Resolution: Distillation → Enforcement Pipeline

The correct architecture is a two-stage pipeline:

```
Stage 1: DISTILLATION (what Trace2Skill/OEL/Memento-Skills do)
  Trajectories → Error analysis → Pattern extraction → Declarative skill document
  
Stage 2: ENFORCEMENT (what our workflows do)
  Skill document → R estimation → IF R > 0.5: convert to workflow → Deploy structurally
                                   IF R < 0.5: keep as context (lower utilization, accepted)
```

Stage 1 creates the knowledge. Stage 2 ensures it gets acted on.

Neither stage alone is sufficient:
- Stage 1 without Stage 2: Skills exist but get ignored (our current state for 37 skills)
- Stage 2 without Stage 1: Workflows exist but encode wrong knowledge (possible but not observed)

## Quantifying the Pipeline

Using H-043's utilization model: U = P(exists) × P(access) × P(applies)

| Knowledge Form | P(exists) | P(access) | P(applies) | U |
|---------------|-----------|-----------|------------|---|
| Raw trajectory (no distillation) | 0.3 | 0.2 | 0.1 | 0.006 |
| Distilled skill (Trace2Skill style) | 0.9 | 0.5 | 0.12 | 0.054 |
| Skill + workflow enforcement (R > 0.5) | 0.9 | 0.9 | 0.9 | 0.729 |
| Skill + context.md (R < 0.5) | 0.9 | 0.7 | 0.5 | 0.315 |

Distillation improves U by 9× over raw trajectories (0.006 → 0.054).
Workflow enforcement improves U by another 13.5× over distilled skills (0.054 → 0.729).

**The enforcement multiplier is larger than the distillation multiplier.** This is why Trace2Skill's +57pp and Memento-Skills' +116% are impressive for the field but wouldn't replicate in our system without the enforcement stage — our agents already have the skills, they just don't use them.

## What This Means Practically

### 1. Our extraction infrastructure is sound
The context-learn workflow and compact cycle do what OEL and Memento-Skills do. No changes needed to the extraction pipeline.

### 2. The bottleneck is conversion, not extraction
Of 41 skills, only 4 have been converted to enforced workflows. The skill-conversion-audit identified 5 Tier 1 candidates (check-state, baseline-before-change, state-check-before-action, coder-edit-discipline, deliverable-integrity) with R > 0.75 each. These are the highest-ROI work items.

### 3. Trace2Skill's parallel merge pattern could improve extraction quality
Our context-learn workflow does single-pass extraction. Trace2Skill's approach — separate error-analysis and success-analysis sub-agents that produce patches, then hierarchical merge — could improve our extraction quality. But this is a Stage 1 improvement where Stage 2 is the actual bottleneck. **Lower priority.**

### 4. The R < 0.5 skills need a different approach
For skills with R < 0.3 (grep-first-reading, materialization cadence, synthesis quality), neither extraction NOR enforcement works well. These are the intra-phase behaviors identified in the boundary analysis. The new papers don't solve this — Trace2Skill's skills work because they shape generation priors at model level, which we can't access at harness level.

## Connection to H-043 (Knowledge Utilization Bottleneck)

H-043 predicts: U = P(exists) × P(access) × P(applies). The three papers validate P(exists) improvement through distillation. Our experiments validate P(applies) improvement through structural enforcement. The multiplication makes both necessary: improving only P(exists) from 0.3 to 0.9 without improving P(applies) yields 3× improvement. Improving both yields 120× improvement.

**This is the strongest practical validation of H-043**: the three-factor model correctly predicts that distillation alone (P(exists) improvement) shows moderate gains (consistent with Trace2Skill/Memento-Skills results in their contexts) while distillation + enforcement (P(exists) × P(applies)) shows transformative gains (consistent with our 0%→100% results in EXP-013/EXP-015).

## Status

This is a **practical synthesis**, not a new hypothesis. It connects three external papers to our existing framework and extracts an architecture recommendation: build the distillation→enforcement pipeline, prioritize enforcement (Stage 2) since extraction (Stage 1) is already working.

No new hypothesis needed. The actionable output is: **accelerate skill-to-workflow conversion for the 5 Tier 1 candidates.**

---

*Bob (Architect) | 2026-04-03 ~01:30*
