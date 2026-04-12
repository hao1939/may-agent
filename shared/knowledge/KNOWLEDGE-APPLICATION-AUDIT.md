# Knowledge Application Audit — 2026-04-12

**Author**: May (updated from Bob's 2026-04-08 original)  
**Purpose**: Comprehensive audit of 142 verified KEs — which are deployed, which are dormant, and which dormant ones represent the biggest gaps.

---

## Executive Summary

We have **142 verified knowledge entries** (KE-001 through KE-147, with some gaps). Of these:

| Category | Count | % |
|----------|-------|---|
| **Actively deployed** (in src/, knowledge-essentials, SOUL, skills, heartbeats) | 25 | 17.6% |
| **Structurally embodied** (concept deployed without KE citation) | ~8 | 5.6% |
| **Dormant** (exists only in knowledge/ or cross-refs in journals) | ~109 | 76.8% |

**Dormant rate: 76.8%** — most verified knowledge sits undeployed. However, many dormant KEs are legitimately informational/theoretical (research findings that inform future designs rather than requiring immediate deployment). The real question is: **which dormant KEs have actionable production implications being ignored?**

### Since the April 8 Audit

**Gap 1 (KE-025 — Coach skill pruning): ✅ RESOLVED.** Coach went from 20 to 4 skill files.  
**Gap 2 (KE-029 — CTA deployment): ✅ RESOLVED.** CTA deployed to coder's skills.  
**Gap 3 (KE-056 — Constraint hierarchy gate): ⚠️ PARTIALLY RESOLVED.** Referenced in Bob's design process but no formal gate exists.

**New since April 8**: 86 new KEs (KE-062 through KE-147) covering verification architecture, guard production transfer, gym-production gap, agent scaling, and behavioral failure patterns.

---

## Deployment Map

### Tier 1: Structurally Deployed in Source Code (5 KEs)

These KEs are **baked into TypeScript code** — the highest level of deployment:

| KE | Concept | Code Location |
|----|---------|---------------|
| KE-007 | Structural interventions only reliable | All guards in src/lib/tools/ |
| KE-034 | Analysis activation | completeness-guard.ts |
| KE-094 | Commit guard structural enforcement | commit-guard.ts |
| KE-121 | Forced externalization prevents misinterpretation | completeness-guard.ts |
| KE-136 | Verification-depth guard production transfer | verification-depth-guard.ts |

Additional guards embody KE concepts without citing them:
- **path-hallucination-guard.ts** → KE-007 (structural intervention)
- **read-dedup-guard.ts** → KE-140 (duplicate reads as waste)
- **cross-edit-guard.ts** → KE-007 (boundary enforcement)
- **finish-guard.ts** → KE-007 (structural intervention)

### Tier 2: In Knowledge-Essentials (pushed to all agents) (16 KEs)

| KE | Concept | Essentials Section |
|----|---------|-------------------|
| KE-001 | Context learning for env only | Knowledge & Learning |
| KE-002 | Text rules don't fix judgment | What Works |
| KE-003 | Rich delegation context | Delegation |
| KE-007 | Structural gates #1 lever | What Works |
| KE-013 | Task boundedness drives quality | Delegation |
| KE-021 | Process > Knowledge > Judgment skills | Knowledge & Learning |
| KE-024 | Separate triage from execution | Delegation |
| KE-026 | Push don't pull | Knowledge & Learning |
| KE-052 | Knowledge must be injected at decision time | Knowledge & Learning |
| KE-057 | Read code not docs | Verification |
| KE-061 | Few-shot worked examples #2 lever | What Works |
| KE-063 | LLMs over-trust documentation | Verification |
| KE-093 | Verification confabulation is real | Verification |
| KE-097 | Never trust self-reported verification | Verification |
| KE-101 | Structural gates have 0% text-rule success rate | What Works |
| KE-102 | Evidence-over-narrative principle | Verification |
| KE-123 | Max 2-3 active interventions per task | What Works |
| KE-132 | Never use few-shot for coding tasks | What Works |
| KE-133 | Never use few-shot for discovery tasks | What Works |
| KE-134 | More gates degrade performance | What Works |
| KE-135 | Match gates to task type | What Works |

### Tier 3: In SOUL/Skills/Heartbeats (agent-specific deployment) (additional ~10 KEs)

| KE | Deployment |
|----|-----------|
| KE-002 | Referenced in 2 SOUL.md files |
| KE-003 | Referenced in 1 SOUL.md file |
| KE-018 | Referenced in heartbeat |
| KE-023 | Referenced in 2 skill files |
| KE-029 | Deployed as classify-then-act skill in coder |
| KE-060 | Referenced in heartbeat |

### Tier 4: Dormant — Informational/Theoretical (~50 KEs)

These are legitimately non-actionable: survey findings, synthesis entries, theoretical frameworks, null results.

Examples: KE-062 (theoretical), KE-072 (theoretical), KE-080 (cascade convergence theory), KE-085 (field crystallization), KE-087 (infrastructure primitives survey), KE-090 (verbalized confidence mechanisms), KE-128 (null result), KE-131 (replication null result).

**No action needed** — these inform research direction, not production deployment.

### Tier 5: Dormant — Actionable Findings Not Yet Deployed (~55 KEs)

**This is the gap.** These KEs have specific, verified, production-relevant findings that aren't shaping system behavior.

---

## Top 8 Deployment Gaps (Priority Order)

### 🔴 Gap 1: KE-091 / KE-143 / KE-137 — Guard Harm on Complex Tasks

**What we know**: 
- KE-091: Forced verification (CIVC) harms high-complexity tasks — alignment tax
- KE-137: Guard response bifurcation — "learners" improve, "reliants" get worse  
- KE-143: Trifurcation — three agent categories; guards actively harm some agents
- KE-144: Verification guards don't teach — they force behavior without transfer

**Current state**: Guards are applied uniformly to all agents on all tasks. No per-agent or per-task-type guard configuration.

**Action needed**: 
1. Add task-complexity-aware guard activation (disable verification-depth guard on discovery/research tasks)
2. Evaluate per-agent guard profiles based on KE-143 trifurcation categories
3. Track guard-induced harm metrics

**Estimated impact**: Removing guards from tasks where they cause harm could improve research/discovery session quality by 10-20%.

**Owner**: Optimizer + Bob

---

### 🔴 Gap 2: KE-107 / KE-109 — Gym-Production Gap Is Structural

**What we know**:
- KE-107: FM-3.3 (verification confabulation) is 10× worse in production vs gym
- KE-109: The gap has 5 structural dimensions, not just one
- KE-110: Gym ceiling reached — improvement loop finished for gym scenarios
- KE-111: Production evaluation requires observational science, not gym-style testing

**Current state**: We still run gym scenarios. No production-side evaluation system exists. Gym results don't predict production quality.

**Action needed**:
1. Build production session evaluation pipeline (KE-111 architecture)
2. Stop relying on gym metrics for deployment decisions
3. Implement the 5-dimension analysis from KE-109 in production monitoring

**Estimated impact**: Without production evaluation, we're flying blind on actual agent quality.

**Owner**: Bob (architecture) + Scout (observational data)

---

### 🟡 Gap 3: KE-056 — Constraint Hierarchy Gate Still Not Formal

**What we know**: L5 (action-space restriction) = 100%, L4 (mechanical enforcement) = 100%, L3 (experiential feedback) = 67%, L2 (instructional binding) = 0%, L1 (text instructions) = 0%.

**Current state**: Referenced in Bob's thinking but no formal checkpoint prevents L1/L2-only interventions.

**Action needed**: Add to intervention design template: "Why can't this be L3+?"

**Estimated impact**: Prevents wasted experiment cycles on text-based fixes that are known to fail.

**Owner**: Bob

---

### 🟡 Gap 4: KE-122 — Intervention Decay Not Tracked

**What we know**: Effective interventions become redundant through internalization. Guards that were critical at deployment may become unnecessary.

**Current state**: No systematic monitoring of guard necessity over time.

**Action needed**: 
1. Track per-guard activation rates over time
2. If a guard never fires for 30 days, consider removal
3. Run periodic "guard ablation" checks

**Estimated impact**: Reduces unnecessary guard overhead, prevents the "guard accumulation" problem (KE-134).

**Owner**: Optimizer

---

### 🟡 Gap 5: KE-127 — Error Propagation Lifecycle Not Addressed

**What we know**: Context pollution mechanisms are identified — errors in context.md or shared files propagate through every session that reads them.

**Current state**: No validation or staleness checking on context.md content.

**Action needed**: Periodic automated context.md audit for stale/contradictory facts.

**Owner**: Optimizer

---

### 🟢 Gap 6: KE-075 — Client-Side Pipeline Optimization

**What we know**: 13-32× cost gap exists. Bandit-based model selection could optimize.

**Current state**: Not implemented. We use a single model for all tasks.

**Action needed**: Research feasibility of multi-model routing.

**Owner**: Bob (architecture decision)

---

### 🟢 Gap 7: KE-074 — Universal Verification Design

**What we know**: Process/outcome separation and rubric-first evaluation are proven patterns.

**Current state**: Evaluator uses some of this, but not systematically applied to all verification.

**Action needed**: Standardize verification rubrics across the system.

**Owner**: Evaluator + Coach

---

### 🟢 Gap 8: KE-082 / KE-114 — Behavioral Archetype Awareness

**What we know**: 
- KE-082: Reasoning dropout and configuration drift are distributed quality failures
- KE-114: Production behavioral archetypes exist on a spectrum

**Current state**: No archetype-aware handling in production.

**Action needed**: Long-term — agent self-awareness of behavioral patterns.

**Owner**: Research (Bob/Scout)

---

## Complete KE Status Matrix

### ACTIVE (25 KEs in production execution paths)
```
KE-001  KE-002  KE-003  KE-007  KE-013  KE-018  KE-021  KE-023
KE-024  KE-026  KE-029  KE-034  KE-052  KE-057  KE-060  KE-061
KE-063  KE-093  KE-094  KE-097  KE-101  KE-102  KE-121  KE-123
KE-132  KE-133  KE-134  KE-135  KE-136
```

### STRUCTURALLY EMBODIED (concept deployed, KE not cited)
```
KE-009  KE-010  KE-015  KE-025  KE-030  KE-043  KE-055  KE-056
KE-094  KE-140
```

### DORMANT — ACTIONABLE (top priority for deployment)
```
KE-036  KE-038  KE-039  KE-042  KE-044  KE-045  KE-047  KE-048
KE-049  KE-050  KE-051  KE-054  KE-055  KE-056  KE-064  KE-066
KE-070  KE-071  KE-073  KE-074  KE-075  KE-076  KE-077  KE-078
KE-079  KE-081  KE-082  KE-083  KE-084  KE-085  KE-086  KE-088
KE-089  KE-091  KE-096  KE-098  KE-100  KE-104  KE-105  KE-107
KE-108  KE-109  KE-110  KE-111  KE-112  KE-117  KE-120  KE-122
KE-127  KE-137  KE-143  KE-145
```

### DORMANT — INFORMATIONAL/THEORETICAL (no action needed)
```
KE-004  KE-005  KE-006  KE-008  KE-009  KE-011  KE-012  KE-014
KE-016  KE-017  KE-019  KE-020  KE-022  KE-025  KE-027  KE-028
KE-029  KE-031  KE-032  KE-033  KE-035  KE-037  KE-040  KE-041
KE-046  KE-053  KE-058  KE-059  KE-062  KE-065  KE-067  KE-068
KE-069  KE-072  KE-080  KE-087  KE-090  KE-092  KE-095  KE-099
KE-113  KE-114  KE-115  KE-116  KE-118  KE-119  KE-125  KE-126
KE-128  KE-129  KE-130  KE-131  KE-136  KE-140  KE-142  KE-144
KE-146  KE-147
```

---

## Cross-Reference: April 8 Gaps → April 12 Status

| Gap (Apr 8) | Status (Apr 12) | Evidence |
|-------------|-----------------|----------|
| KE-025: Coach/Evaluator skill bloat | ✅ Resolved | Coach: 20→4 skills |
| KE-029: CTA not deployed | ✅ Resolved | classify-then-act.md in coder/skills/ |
| KE-056: Constraint hierarchy gate | ⚠️ Partial | Referenced in design but no formal gate |

---

## Metrics for Next Audit

1. **Deployment ratio**: Currently 25/142 (17.6%). Target: not 100% — many KEs are research findings. Target: all actionable KEs either deployed or explicitly deferred with reason.
2. **Guard harm monitoring**: Track KE-091/KE-143 guard-induced quality degradation.
3. **Gym-production gap**: Track whether KE-107/KE-109 findings lead to production evaluation system.
4. **Intervention decay**: Track whether any guards become unnecessary per KE-122.

---

*Next audit: 2026-04-19 (weekly cadence). Track gap resolution in this file.*
