# Synthesis: EXP-148 × EXP-147 Track B — Workflow Adoption Meets Context Isolation

**Date**: 2026-04-12  
**Inputs**: EXP-148 results (H-102 workflow adoption), EXP-147 Track B results (H-097 context isolation)

---

## 1. Key Findings Per Experiment

### EXP-148: Workflow Adoption Mechanism (H-102)
- **Core question**: Does workflow adoption explain declining convention violation rates?
- **Result**: 3/4 predictions failed. The decline in convention violations is **universal** across all agent types (learner, reliant, neutral), not concentrated in workflow-adopting agents.
- **Critical finding**: A sharp structural break on Mar 30–31 (EventBus refactor, DbWriter, agent calling infrastructure) drove the decline, not gradual workflow adoption.
- **Per-convention insight**: C12.1 (session-start orientation) dropped from 95% → 1.5% fire rate, dominating the workflow-gated category. WF-Gated conventions declined ~2-3× more than WF-Independent ones, but this asymmetry appeared in ALL agent groups.
- **H-102 update**: P(H) 0.65 → 0.55. Workflow adoption is a modest secondary factor, not the primary mechanism.

### EXP-147 Track B: Context Isolation (H-097/P-120c)
- **Core question**: Does scoping dispatched context to task-relevant info improve task success?
- **Result**: +0.5pp (not significant, p=0.43), but severely compromised by 97% ceiling in both conditions and only 4 of 8 scenarios executed.
- **Critical finding**: The easy scenarios showed no differentiation. The 4 harder scenarios (cascading-fix-trap, stale-approach-fixation, contradictory-requirements, misleading-stacktrace) were never run.
- **Methodological insight**: Static context reduction (893→119 tokens in context.md) may be the wrong operationalization — active_recall injects 1,000–8,000 tokens in both conditions, potentially washing out the treatment.
- **H-097 update**: P(H) 0.55 → 0.53. Inconclusive, not falsified.

---

## 2. Cross-References and Connections

### 2.1 Shared Pattern: Infrastructure Dominates Behavioral Interventions

Both experiments found that **system-level factors overpower targeted behavioral manipulations**:

- **EXP-148**: Infrastructure changes (EventBus, DbWriter) drove convention compliance more than individual workflow adoption. The Learner–Neutral gap converged to zero by Apr 10 despite different workflow usage patterns.
- **EXP-147B**: Active_recall injection (an infrastructure-level context mechanism) potentially swamped the targeted context.md reduction. The uncontrolled infrastructure variable may have masked any real treatment effect.

**Implication**: Agent improvement may be more about **getting the environment right** (tooling, infrastructure, default context injection) than training individual agents to adopt better practices. This connects to the broader debate between environmental design vs. agent-level learning.

### 2.2 Ceiling Effects Appear in Both Lines of Research

- **EXP-148**: Convention compliance converged to ~3-5% fire rate by Apr 10+ — a floor/ceiling that makes further decline hard to detect. Also, EXP-138 (the workflow prototype gym test) hit a 100% ceiling — gym scenarios were too easy to differentiate.
- **EXP-147B**: Task success hit 97% ceiling on the 4 easy scenarios. The gym scenarios that ran were insufficiently difficult.

**Implication**: Our experimental infrastructure (gym scenarios, convention checks) may be **approaching saturation** for measuring improvement. To detect effects of targeted interventions, we need harder test conditions or more discriminating metrics. This echoes EXP-138's finding that production conditions produce failures that lab conditions don't reproduce.

### 2.3 The C12.1 Anomaly Connects Both Stories

EXP-148 found C12.1 (session-start orientation) had the most dramatic decline (64.2% → 2.6% for learners). This convention is about **initial context-gathering at session start** — essentially the same domain as EXP-147B's context isolation manipulation.

If infrastructure changes automatically provide better session-start context (through improved dispatching, agent calling, or context injection), then:
- C12.1 violations drop because agents no longer need to manually orient (EXP-148 finding)
- Context.md reduction has no effect because the infrastructure already provides context through other channels (EXP-147B finding)

Both findings are explained by the same mechanism: **the system learned to inject context automatically, making both manual orientation (C12.1) and static context files (context.md) less relevant**.

### 2.4 Convention Compliance ≠ Task Quality (Both Experiments)

- **EXP-147 Track A** found that 19.7% of "good"-verdict sessions had 3+ convention violations. Quality and compliance measure different dimensions.
- **EXP-148** found that convention violations declined universally, but this likely reflects infrastructure maturation, not task quality improvement.

**Combined implication**: Declining convention fire rates (the signal H-102 tried to explain) may not indicate that agents are getting *better at their tasks* — just that the infrastructure is doing more of the convention-compliance work. This is an important distinction for evaluating agent improvement claims.

---

## 3. Impact Ranking

| # | Finding | Novelty | Impact | Source |
|---|---------|---------|--------|--------|
| 1 | Infrastructure changes dominate behavioral interventions in driving compliance | High | High — reframes how we think about agent improvement | EXP-148 §6, §9 |
| 2 | Gym/lab conditions consistently hit ceilings that production doesn't | Medium | High — fundamental measurement problem | Both |
| 3 | C12.1 connects workflow adoption and context isolation stories | High | Medium — explains both null results | EXP-148 §7, EXP-147B §11 |
| 4 | Active_recall injection may be the dominant context mechanism, not context.md | Medium | Medium — redirects context-isolation research | EXP-147B §11.3, §14.4 |
| 5 | Convention compliance and task quality are orthogonal dimensions | Medium | Medium — changes evaluation strategy | EXP-147A §6.2, EXP-148 |

---

## 4. Proposed Research Directions

### 4.1 NEW HYPOTHESIS CANDIDATE: "Environmental Primacy"

**Draft**: "Infrastructure-level changes (tooling, dispatch mechanisms, default context injection) explain >70% of observed agent behavioral improvement, with agent-level learning contributing <30%."

**Evidence base**: EXP-148 (Mar 30–31 break), EXP-147B (active_recall confound), EXP-138 (gym ceiling), C12.1 trajectory. Multiple independent experiments converge on infrastructure as the dominant factor.

**Why this matters**: If true, the research program should prioritize infrastructure experiments (new tools, dispatch improvements, default configurations) over behavioral interventions (context files, guard training, convention enforcement).

### 4.2 Active Recall as Treatment Variable

EXP-147B's design identified but didn't control active_recall. A follow-up experiment should:
- Use active_recall presence/absence as the treatment (not context.md size)
- Run on scenarios with 30-60% baseline pass rates
- Measure total injected tokens, not just context.md size

This would give P-120c a real test while addressing the confound that compromised Track B.

### 4.3 Production-Condition Difficulty Scaling

Both experiments hit ceilings in lab conditions. We need:
- Harder gym scenarios calibrated to 40-60% baseline pass rates
- Or production-trace replay experiments that reproduce real failure conditions
- This connects to H-095 (which already has P(H)=0.88) — production complexity creates failures that lab conditions can't reproduce

### 4.4 H-102 Reframe

Rather than abandoning H-102 entirely, reframe it narrowly: "After controlling for infrastructure improvements, workflow-adopting agents show 5-10pp faster convergence on process conventions." This is testable via the interaction effect already measured (7.4pp, Z=-4.91) but requires isolating the infrastructure confound more carefully.

---

## 5. Hypothesis Updates Summary

| Hypothesis | Prior → Post | Rationale |
|------------|-------------|-----------|
| H-102 | 0.65 → 0.55 | 3/4 predictions failed; universal decline driven by infrastructure |
| H-097 | 0.55 → 0.53 | P-120b moot, P-120c inconclusive (ceiling + incomplete) |
| H-095 | 0.88 (confirmed) | Both experiments add supporting evidence for production-lab gap |
| H-101 | 0.72 (untested) | EXP-148 data is compatible with H-101 — infrastructure = architectural readiness |

**New candidate**: Environmental Primacy hypothesis (see §4.1) — worth formalizing if another experiment confirms the pattern.

---

## 6. Bottom Line

EXP-148 and EXP-147B tell a convergent story: **the system's infrastructure improvements are the dominant driver of behavioral change, and our lab measurements are approaching saturation**. Targeted behavioral interventions (workflow adoption, context scoping) show modest or undetectable effects against this backdrop. Future research should either (a) study infrastructure changes directly, (b) develop harder measurement instruments, or (c) isolate behavioral effects by controlling for infrastructure variables.
