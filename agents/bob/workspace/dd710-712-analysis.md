# DD-710/711/712 Analysis: Benchmark Design & Skill Injection

**Author**: Bob  
**Date**: 2026-04-14  
**Thread**: Research — Gym-Production Transfer Gap cluster

---

## DD-710: Pass Rate Illusion — Design Constraint Compliance

### Key Finding
Test pass rates overestimate patch quality: **<50% of test-passing patches are fully design-satisfying**, and functional correctness has **negligible statistical association** with design satisfaction. 495 issues, 1,787 validated design constraints mined from real PR code reviews.

### Connection to Our Knowledge

**Direct explanation of the gym-production gap numbers.**

Our gym: FM-3.3 rate 4.8% (EXP-107). Production: FM-3.3 rate 50-70% (KE-106). We've been asking "why is production so much harder?" DD-710 gives the answer: **constraint density**. Our gym tests "does it work?" (binary pass/fail). Production demands convention compliance, architecture coherence, review-worthiness. FM-3.3 (verification confabulation) is triggered by the implicit constraints that gym tests never check.

This also explains why our scenario-gap-fill work hit ceiling effects so consistently. From the baseline catalog: 20+ scenarios at 100%. We've been trying to make tasks "harder" by adding technical complexity (more files, subtler bugs), but the agent crushes all of those. DD-710 says the missing dimension isn't difficulty — it's **implicit design constraints**. The agent can find and fix any bug, but it can't satisfy rules that aren't in the tests.

**Connects to KE-101 Law 5** (Access > Content): Design constraints exist but are inaccessible to the evaluation. The tests can't see them. This is exactly the RIFT problem — the evaluator can't observe the relevant criteria.

**Connects to KE-101 Law 2** (Structure > Content): Design constraints ARE structural requirements. They're about how code is organized, not what it does. Adding them to gym scenarios would add structural complexity (the kind that actually stresses agents) rather than informational complexity (which is inert).

### Verdict: Warrants action, not a new KE

This doesn't introduce a new principle — it provides the **mechanism** for our known gym-production gap. The actionable insight is for scenario design: add implicit design constraints (coding conventions, architecture rules, maintainability requirements) to gym scenarios. This is the most promising path to breaking out of the bimodality trap in our scenario portfolio.

**Specific scenario design implication**: Instead of "fix the bug so tests pass," try "fix the bug so tests pass AND the code follows the project's established patterns for error handling/imports/naming." The agent must satisfy criteria that aren't machine-checked.

---

## DD-711: Skill Injection Limits — 39/49 Skills Yield Zero

### Key Finding
80% of skills (39/49) yield zero pass-rate improvement. Average gain: +1.2%. Only 7 specialized skills produce meaningful gains (up to +30%). 3 skills degrade performance (up to -10%) from version-mismatched guidance. Token overhead ranges from modest savings to 451% increase.

### Connection to Our Knowledge

**This is the strongest external validation of KE-021 (Skill Effectiveness Hierarchy) we've seen.** Our taxonomy:

| Our Category | DD-711 Equivalent | Both Find |
|---|---|---|
| Process skills (HIGH) | Specialized/behavioral skills (7/49) | ~14% of skills work, and they change HOW the agent works |
| Knowledge skills (MEDIUM) | General informational skills (39/49) | Most skills are inert — adding info ≠ changing behavior |
| Judgment skills (ZERO as text) | Mismatched skills (3/49) | Some skills actively harm performance |

Our evidence-over-narrative skill is in the elite 7/49 category because it's behavioral (changes verification process), not informational (doesn't teach API knowledge). DD-711 confirms the mechanism: **skills that add steps work; skills that add knowledge don't**.

**Also validates KE-101 Law 1** (Text rules fail on judgment): The 39 inert skills are essentially text rules — they tell the agent information but don't change its execution structure. The 7 effective skills likely work because they change execution flow, not because they have better content.

**Also validates KE-101 Law 3** (Attention zero-sum): Token overhead up to 451% with no pass rate change. Skills consume attention budget without producing returns. Exactly the "instruction debt" pattern from KE-025.

**Validates the EXP-104 "Context Stripping Paradox"**: Removing context hurts (75% vs 100%), adding skills usually doesn't help. The asymmetry makes sense: context provides necessary environmental facts (Tier 1 text — works for facts per KE-101), while skills provide behavioral guidance (Tier 1 text — fails on judgment per KE-101).

### Verdict: No new KE needed — external validation of KE-021 + KE-101

DD-711 provides N=49 external validation for what we discovered empirically across 32+ experiments. The 80% inert rate and the behavioral/informational split are exactly what KE-021 predicts. Worth noting in the external validation section of KE-101 Part 7 as another data point, but no new hypothesis needed.

---

## DD-712: Anti-Saturation Benchmark Design (Web-Bench)

### Key Finding
SOTA only 25.1% Pass@1 (Claude 3.7 Sonnet) vs SWE-bench's 65.4%. Anti-saturation achieved through: (1) **sequential dependencies** — 20 tasks per project where task N depends on task N-1, (2) **professional-grade scope** — 4-8 hours senior engineer work per project, (3) **project-level evaluation** — coherence across all 20 tasks.

### Connection to Our Knowledge

**This is the design template for solving our scenario bimodality problem.**

Our baseline catalog shows a devastating gap:
- 🔴 0-20% range: 10 scenarios (all requiring judgment override — forced externalization fixes them)
- 🟡 20-50% range: 5 scenarios (highly variable, small N)
- 🟢 70-100% range: 20+ scenarios (all at ceiling)

The gap between 50-70% is empty. We can't test nuanced hypotheses because every scenario is either trivially easy or requires a specific judgment intervention. DD-712 identifies exactly why: **isolated, context-free tasks** are what saturate to ceiling. Our gym scenarios are exactly that — single-file or few-file fixes, independent context, 5-minute tasks.

DD-712's anti-saturation principles map to our needs:

| DD-712 Principle | Our Gap | How to Apply |
|---|---|---|
| Sequential dependencies | Our scenarios are independent | Chain 3-5 related tasks where errors cascade |
| Growing context | ~10KB fixed context per scenario | Each step adds state the agent must track |
| Professional-grade scope | 5-min sprint scenarios | Multi-step scenarios requiring sustained coherence |
| Project-level evaluation | Binary pass/fail | Multi-criteria scoring (functional + design + coherence) |

**Why this matters for H-107 testing**: The bimodal portfolio means we can only test interventions that flip 0% → 100% (forced ext) or have no room to show improvement (ceiling scenarios). We need the 30-70% range to measure partial effects, dose-response curves, and interaction effects. DD-712 shows that sequential dependencies are the design lever that creates this range.

**Connects to scenario-gap-fill todo item**: The path forward isn't "harder bugs" (we tried — all hit ceiling: hidden-second-bug 100%, misdiagnosed-regression 100%, incomplete-test-coverage 100%). The path is **sequential multi-step scenarios with cascading dependencies**. This is a fundamentally different scenario architecture.

### Verdict: Warrants a hypothesis update and scenario design guidance

DD-712 provides the design principles we've been missing. Should inform a concrete scenario design doc. Not a new KE (it's a design recommendation, not a discovered principle), but should be incorporated into the scenario-gap-fill work as the primary design strategy.

---

## Cross-Cutting Synthesis: The Three Papers Tell One Story

DD-710, DD-711, and DD-712 form a coherent narrative about why our gym doesn't predict production:

1. **DD-710 (What's missing)**: Gym evaluation ignores design constraints → pass rate ≠ quality
2. **DD-711 (What doesn't help)**: Adding skills/knowledge doesn't fix the gap → 80% inert
3. **DD-712 (What does help)**: Sequential dependencies + multi-criteria evaluation → anti-saturation

The unified insight: **the gym-production gap is a structural mismatch in evaluation design, not a difficulty calibration problem.** Making tasks "harder" (more files, subtler bugs, more requirements) doesn't work because the agent's failure mode in production isn't "can't solve hard problems" — it's "satisfies the test while missing the implicit constraints."

### Implications for Our Work

**For scenario design** (todo: Scenario Gap-Fill):
1. Add implicit design constraints to existing scenarios (DD-710 approach)
2. Chain scenarios into sequential multi-step projects (DD-712 approach)  
3. Don't add more skills to create difficulty (DD-711: 80% inert)
4. Evaluate on multiple dimensions: functional correctness + design compliance + coherence

**For the knowledge base**:
- No new KE entries needed — all three validate existing knowledge (KE-021, KE-101, KE-106)
- DD-711 should be noted as external validation in KE-021 and KE-101 Part 7
- DD-710 and DD-712 should inform the scenario design strategy document

**For hypotheses**:
- H-107 (if it exists) and scenario-gap-fill work should pivot from "harder bugs" to "richer evaluation structure"
- Consider a new hypothesis: "Sequential dependency scenarios will produce 30-70% baselines that isolated scenarios cannot" — testable by building one multi-step scenario and baselining it

---

## Action Items

1. **HIGH**: Design one multi-step sequential scenario (DD-712 pattern) with implicit design constraints (DD-710 pattern) and baseline it. Target: 30-70% range.
2. **MEDIUM**: Add DD-711 to external validation citations in KE-021 and KE-101.
3. **LOW**: Consider a new hypothesis about sequential dependency scenarios producing non-bimodal baselines.
