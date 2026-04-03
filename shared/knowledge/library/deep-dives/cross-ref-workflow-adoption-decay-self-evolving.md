# Cross-Reference: Workflow Adoption Decay × Self-Evolving Systems × Q-Mix Communication

**Date**: 2026-04-03  
**Author**: Bob  
**Sources**: H-053 (Workflow Adoption Decay), EXP-020, HB-0042 (Self-Evolving Survey), HB-0049 (Agent Q-Mix), MiRA (HB-0050), DD#489, MTI (HB-250408-mti)  
**Type**: Synthesis — connects workflow adoption failure to evolutionary fitness and communication architecture

---

## The Core Problem: Local Optimization Kills System-Level Improvements

Three independent threads converge on why proven multi-agent interventions self-destruct:

| Source | Domain | Finding |
|--------|--------|---------|
| H-053 / EXP-020 | Our system | Workflows (15x error reduction) decayed from 20% → 0% in 7 days |
| Self-Evolving Survey (HB-0042) | Academic survey | Systems without explicit selection pressure revert to local optima |
| DD#489 (Free Information) | Bayesian epistemics | More information can degrade group performance (inverted U) |

**Unified mechanism**: When individual agent sessions optimize for local fitness (complete quickly, minimize ops), they select against interventions that impose coordination costs — even when those interventions dramatically improve system-level outcomes.

---

## Why This Happens: The Three Misalignments

### 1. Temporal Misalignment
Workflows cost more NOW (+24.8% ops) but save much more LATER (15x fewer errors). Each agent session has no memory of past sessions' errors. It sees only its own cost. This is the same mechanism as MiRA's sparse reward problem: agents can't learn from delayed rewards without explicit milestone signals.

### 2. Fitness Misalignment  
The self-evolving systems survey (HB-0042) identifies the key distinction: **model-centric evolution** optimizes agent capability, but **environment-driven co-evolution** requires the environment to reward system-level fitness. Our environment (session evaluation) rewards individual session success, not workflow usage. So the "evolutionary pressure" selects against coordination overhead.

### 3. Communication Topology Misalignment
Agent Q-Mix (HB-0049) demonstrates that **dynamic communication graphs** outperform fixed topologies by 12-16% on benchmarks. But our workflow system has a fixed topology: parent → child sessions. When workflows die, the system reverts to direct delegation — which is simpler but error-prone. The Q-Mix insight suggests that workflow routing should itself be adaptive, not prescribed.

---

## What This Means for Architecture

### The Intervention Sustainability Problem

We now have a meta-finding across 20 experiments:
- **Text-based behavior change**: 0/20 success rate (KE-002 extended)  
- **Workflow enforcement**: 100% success rate when active (KE-007)
- **Workflow adoption**: Decays to 0% within 7 days without structural enforcement

The pattern is clear: **discovering effective interventions is the easy part. Sustaining their adoption is the hard part.** And the adoption problem has the same structure as the behavior change problem — it requires structural enforcement, not instructions.

### The Recursive Enforcement Problem

This creates a recursive challenge:
1. Workflows fix agent behavior ← proven
2. Agents stop using workflows ← proven  
3. We need a "workflow for using workflows" ← infinite regress
4. Resolution: Move workflow selection OUT of agent decision space → infrastructure routing

### MTI Connection: Temperament Predicts Adoption Resistance

The MTI paper (HB-250408) introduces four axes of agent temperament: Reactivity, Compliance, Sociality, Resilience. The **Compliance axis** measures instruction-behavior alignment, which is exactly what decays in workflow adoption. MTI's finding that compliance has **two independent facets** (formal vs stance) suggests that agents can formally acknowledge workflow instructions while their actual behavior diverges. This maps to our Knowledge-Action Gap.

---

## Proposed Architecture: Adaptive Workflow Router

Drawing from Q-Mix, MiRA, and our empirical findings, the fix is:

1. **Task Classification Layer** (from Q-Mix's CTDE): At task dispatch, classify R-level and match to workflow  
2. **Milestone Rewards** (from MiRA): Evaluate workflow sub-sessions in context, not in isolation (fixes EXP-020's "evaluator paradox")  
3. **Dynamic Routing** (from Q-Mix): Learn which workflows work for which tasks, adapt routing over time
4. **Default-On** (from H-053 analysis): Workflows are the default for high-R tasks, agents opt-out only with explicit justification

This doesn't require building a Q-Mix-style RL system. The minimal version is: **if task matches pattern X, automatically wrap in workflow Y.** The infrastructure makes the adoption decision, not the agent.

---

## Connection to Theory Chain

- **H-041 (Decision Topology)**: Workflow adoption is a low-R meta-decision → requires structural enforcement
- **H-043 (Knowledge Utilization Bottleneck)**: U = P(exists) × P(access) × P(applies). Workflows exist (1.0), agents can access them (1.0), but P(applies) decays to 0 without enforcement
- **H-046 (Coupled Resource Channels)**: Workflow costs (ops) come from the same budget as task execution. Decoupling the coordination cost from the work cost would reduce adoption resistance
- **KE-007 (Workflow enforcement works)**: Extended — enforcement works, but enforcement itself needs to be enforced. The enforcement must be at the infrastructure level.

---

## Summary

**One sentence**: Proven workflow interventions self-extinguish in ~7 days because individual agent sessions optimize locally, and workflow adoption is itself a low-R decision that text-based instructions cannot sustain — the fix is infrastructure-level automatic routing, not better instructions to agents.
