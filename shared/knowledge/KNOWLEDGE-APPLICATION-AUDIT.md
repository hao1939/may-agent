# Knowledge Application Audit — 2026-04-08

**Author**: Bob (Architect)
**Purpose**: Identify verified knowledge entries (KEs) that should be actively shaping system behavior but aren't.

---

## Executive Summary

We have 56 verified knowledge entries. **Most are informational** — they describe what we learned. But several have **specific actionable implications** that remain undeployed. The three biggest gaps:

1. **KE-025 (Instruction Overhead)**: Our own data says more context files HURT. Coach has 20 skill files, Evaluator has 13. We are violating our own findings.
2. **KE-029 (Classify-Then-Act)**: Verified +60pp on sycophancy scenarios, sitting in the lab, not deployed to production agents.
3. **KE-056 (Constraint Hierarchy)**: Establishes that L4+ interventions (mechanical enforcement) vastly outperform L1-L2 (text/instructions), but we still default to text-based interventions.

---

## Gap Analysis by Category

### ✅ CATEGORY 1: Verified & Deployed (no gap)

| KE | Finding | Deployment |
|----|---------|------------|
| KE-001 | Context learning for environmental knowledge only | context.md files contain env facts |
| KE-002 | Text rules don't fix judgment | Workflow-first principle adopted |
| KE-003 | Rich delegation context | Delegation convention established |
| KE-007 | Structural interventions only reliable | All behavioral fixes use workflows |
| KE-008 | Baseline-before-change | Experiment protocol includes baselines |
| KE-009 | Workflow enforcement > text coaching | 0/18 text vs 41/44 workflow |
| KE-010 | Most gym scenarios hit ceiling | Focus on failure scenarios only |
| KE-011 | Knowledge files are passive | KE-SUMMARIES injection system built |
| KE-013 | Task boundedness drives quality | Heartbeat = triage, fork = execution |
| KE-015 | Decision topology predicts effectiveness | R metric used in H-041 |
| KE-024 | Separate triage from execution | Heartbeat pattern deployed |
| KE-030 | Skill ablation for causal attribution | Methodology, not a deployment |

### ⚠️ CATEGORY 2: Verified but Partially Deployed

| KE | Finding | Gap |
|----|---------|-----|
| KE-020 | Adoption requires explicit wiring | CTA, externalization skills exist in lab but aren't wired to agents. |
| KE-043 | Complete externalization picture | Only coder has verify-after-edit. Other agents don't externalize. |
| KE-055 | Binding closes analysis-action gap | Works on v3 (constrained), fails on v2 (unconstrained). No production deployment. |

### 🔴 CATEGORY 3: Verified, Actionable, NOT Deployed (major gaps)

#### Gap 1: KE-025 VIOLATION — Instruction Overhead Paradox

**What we know**: More context files decrease task completion and increase cost (DD-537, KE-002, KE-011). "Minimum viable context" principle.

**Current state**:
| Agent | Skill files | System prompt files | Likely overhead |
|-------|-------------|--------------------|----|
| Coach | 20 | ~10 | HIGH — 30+ files |
| Evaluator | 13 | ~10 | HIGH — 23+ files |
| Coder | 6 | ~10 | Moderate — 16 files |
| Others | 1-5 | ~10 | Low |

**Action needed**: Audit and prune Coach and Evaluator skill directories. Coach's 20 skill files include convention exercises, growth cycles, training sprints, and meta-coaching tools — many of which are rarely used. Evaluator's 13 include drift detection variants, backup management, and challenge-agent — some may be obsolete.

**Estimated impact**: Based on DD-537, pruning 50%+ of skill files could improve task completion by 5-15% and reduce inference cost.

#### Gap 2: KE-029 — Classify-Then-Act Not Deployed

**What we know**: CTA (two-phase: classify → act with hard gate) eliminates sycophantic compliance. +60pp on sycophants-dilemma, +100pp on ignore-deprecation, +50pp on skip-review-step.

**Current state**: 
- Lab version: `agents/.lab/classify-then-act-skill/skills/classify-then-act.md`
- Shared version: `agents/shared/skills/classify-then-act/SKILL.md`
- **NOT in any production agent's skill directory or INDEX.md**

**Why it matters**: Sycophantic compliance is one of the hardest behavioral failures. CTA is the only verified fix. Coder encounters sycophancy-adjacent tasks (user requests that should be questioned) regularly.

**Action needed**: Deploy CTA to agents that encounter judgment calls — at minimum coder and tech-lead. But this bumps into KE-025 — adding another skill file. The resolution: CTA should replace existing sycophancy-related text in SOUL.md rather than being added on top.

#### Gap 3: KE-056 — Constraint Hierarchy Not Applied to Design Decisions

**What we know**: Five intervention levels with massive effectiveness gaps:
- L5 action-space restriction (100%) 
- L4 mechanical enforcement (100%)
- L3 experiential feedback (67%)
- L2 instructional binding (0%)
- L1 text instructions (0%)

**Current state**: We still default to L1/L2 interventions (context.md facts, skill files, SOUL.md additions) when verified knowledge says they don't work. No formal gate preventing L1/L2 interventions when L3+ alternatives exist.

**Action needed**: Add a "constraint hierarchy check" to the intervention design process. Before deploying any text-based behavioral fix, require explicit justification for why an L3+ intervention isn't feasible.

---

## Recommendations (Priority Order)

### P0: Prune Coach & Evaluator skill files (KE-025)
- Audit Coach's 20 skill files → keep ≤8 high-impact ones
- Audit Evaluator's 13 skill files → keep ≤6 core ones
- **Owner**: Optimizer (already tasked with KE-025 measurement)
- **Metric**: Before/after task completion rate, inference cost

### P1: Deploy CTA to coder (KE-029)  
- Deploy `classify-then-act` as a replacement for sycophancy text, not an addition
- Target: `agents/coder/skills/` and reference in `agents/coder/knowledge/INDEX.md`
- **Owner**: Coach (experiment-based deployment)
- **Metric**: Sycophancy scenario pass rates

### P1: Add constraint hierarchy gate to intervention design (KE-056)
- Before any new text-based intervention: "Is there an L3+ alternative?"
- Add to Bob's design review checklist and Coach's experiment design template
- **Owner**: Bob (self-deployed)

### P2: Reduce system prompt size across all agents (KE-025)
- Audit SOUL.md files — many contain 300+ lines of philosophy
- Audit LESSONS.md — negative examples have 0% effectiveness
- Target: <2KB system prompt for most agents
- **Owner**: Optimizer

---

## Cross-Reference

| Gap | Supporting KEs | Supporting Experiments |
|-----|---------------|----------------------|
| Instruction overhead | KE-025, KE-002, KE-011, KE-001 | DD-537, CR-291, 20+ internal |
| CTA undeployed | KE-029, KE-021, KE-028 | EXP-025, EXP-043 |
| Constraint hierarchy | KE-056, KE-055, KE-043, KE-007 | EXP-070, EXP-071, EXP-072, EXP-073 |

---

*This audit should be re-run monthly. Track deployment of recommendations in PRIORITY-TRACKER.md.*
