# EXP-108: Adversarial Self-Review Skill for Production Deployment

**Status**: BLOCKED_CEILING — All 7 multi-session scenarios at ceiling (91–100%) for coder agent. No discriminating scenarios available. See results.md.
**Date**: 2026-04-09
**Author**: Coach
**Type**: Controlled experiment (gym-based, skill deployment A/B)
**Depends on**: EXP-103 (adversarial framing evidence), EXP-104 (confound discovery), EXP-107 (gym-production gap), KE-002, KE-007, KE-099

---

## 1. Research Question

**Can an "adversarial self-review" skill — a lightweight prompt that redirects the agent's generation objective from task completion to fault-finding at key decision points — improve pass rates on non-ceiling gym scenarios that involve skipping critical thinking?**

This is NOT about FM-3.3 verification (EXP-107 proved gym can't reproduce that). This is about the broader class of failures where agents skip critical evaluation: verification confabulation (FM-3.1), phase-boundary violations (FM-2.6), instruction-following drift, and failure chain propagation (FM-1.4).

### 1.1 Why This Experiment

EXP-103 showed adversarial framing achieves 100% pass rate on verification confabulation scenarios (+75-89pp vs baseline). EXP-104 revealed a confound: the evidence-over-narrative skill (deployed before EXP-103 ran) may account for some or all of the improvement on those specific scenarios.

**But**: EXP-103/104 only tested on two scenario types (ghost-deliverable-chain, kb-integration-failure) that are now at ceiling. We don't know whether adversarial framing helps on *other* failure modes — especially ones where the agent has correct information but still acts impulsively (phase-boundary violations, instruction drift).

This experiment tests whether the *mechanism* of generation-objective redirection (from "complete task" to "find problems first") generalizes beyond confabulation to broader judgment failures.

### 1.2 Why This Is NOT a Text Rule (Addressing KE-002)

KE-002 documents that text rules have a 0/35 failure rate on judgment tasks. This experiment is categorically different:

| Property | Declarative Text Rule (0/35) | Adversarial Self-Review Skill |
|---|---|---|
| **What it says** | "Remember to verify" / "Check for contradictions" | "Before acting, find 3 problems. Assume prior work is broken." |
| **Generation objective** | Unchanged — agent still aims to complete task | Redirected — agent aims to find faults first |
| **Mechanism** | Adds information the agent should consider | Changes what the agent's generation is *optimizing for* |
| **Analogy** | Telling a student "remember to check your work" (ignored) | Telling a student "your job is to find the mistakes" (changes the task) |
| **KE-002 category** | Declarative (describing an outcome) | Structural text (modifying the process) — per KE-002's nuance section |

KE-002's own nuance section (added from EXP-084) distinguishes:
- **Declarative text** (0/35): tells agents what to do → no effect
- **Structural text** (2/9 pass, +2.0-2.3 score): shows agents how to reason, creates pre-work gates → partial effect

Adversarial self-review is structural text: it creates a mandatory pre-work step (find 3 problems) that modifies the execution sequence. EXP-084 showed structural text achieves Cohen's d > 3 score improvements, even if pass-rate effects are unreliable at N=3. This experiment tests at higher N.

Additionally, EXP-103's finding — that adversarial framing works by redirecting generation objective, not by adding a rule — represents a mechanism that KE-002 never tested. The 0/35 record is for rules that *fight* the default generation; adversarial framing *redirects* it.

### 1.3 How This Differs from Existing Skills

| Skill | Mechanism | When Applied | Generation Objective |
|---|---|---|---|
| `verify-after-edit` | Procedural checklist | After each write/edit | Confirm edit worked (confirmation bias) |
| `evidence-over-narrative` | Reconciliation protocol | When evidence/narrative conflict | Resolve conflict (reactive) |
| `investigate-and-fix` | 5-step workflow | Bug reports | Reproduce → diagnose → fix (sequential) |
| **adversarial-self-review** | Fault-finding reframe | Before acting on inherited/complex context | **Find problems first** (proactive skepticism) |

The key difference: existing skills assume the agent is already oriented correctly and provide process steps. Adversarial self-review changes the agent's *orientation* — from "I'm here to complete a task" to "I'm here to find problems, then complete the task." This is the mechanism EXP-103 proved works.

## 2. Hypotheses

**H1 (Adversarial Skill Generalizes)**: An adversarial self-review skill, deployed as a coder skill, will improve pass rates by ≥15pp on non-ceiling gym scenarios that involve skipping critical evaluation (phase-boundary violations, instruction drift, failure chains).

**H2 (Cross-FM-Mode Effectiveness)**: The skill will improve pass rates on at least 2 of the 3 tested failure mode categories (FM-2.6 phase boundary, FM-2.6 instruction drift, FM-1.4 failure chain), demonstrating it's not specific to one failure type.

**H0 (Null)**: The adversarial self-review skill has no effect (≤5pp improvement) on non-ceiling scenarios. The EXP-103 effect was specific to verification confabulation and doesn't generalize. KE-002's text-rule finding applies here too.

### What Each Outcome Means

- **H1 confirmed**: Adversarial generation-objective redirection is a *general behavioral mechanism*, not confabulation-specific. Deploy the skill to all agents. This would be the first text-level intervention to break the 0/35 barrier on judgment tasks.
- **H2 confirmed**: The mechanism works across failure modes that share a common root: agents acting before critically evaluating context. Opens up a new class of skill design (orientation skills vs. process skills).
- **H0 confirmed**: KE-002 holds even for generation-objective redirection when delivered as a skill file (vs. scenario-embedded). The EXP-103 effect requires tighter coupling to the decision context (e.g., injected into the session context, not a generic skill). Strengthens KE-002.

## 3. Design

### 3.1 Arms

| Arm | Label | Description | N per scenario |
|-----|-------|-------------|:-:|
| **A** | Control | Current coder with existing skills (no adversarial-self-review) | 3 |
| **B** | Adversarial Skill | Current coder + adversarial-self-review.md skill added | 3 |

Two arms only (not four). Rationale: EXP-103 tested multiple variants. This experiment tests one specific question: does the adversarial mechanism work when delivered as a generic skill rather than embedded in scenario context?

**Total**: 6 runs per scenario × 3 scenarios = 18 runs.

### 3.2 Scenarios

Selected for: (a) non-ceiling baseline (<80%), (b) failure mode involves skipping critical thinking, (c) multi-session (where adversarial review of inherited context matters most).

| Scenario | FM Target | Baseline Pass Rate | Why Selected |
|---|---|---|---|
| `multi-session/phase-boundary-violation` | FM-2.6 | **Unknown** (new scenario, predict ~30-50%) | Direct test of "act before thinking" — agent must resist temptation to edit in analysis-only phase |
| `multi-session/instruction-override-drift` | FM-2.6 | **40%** (2/5 runs) | Agent must notice convention change and override S1 patterns — classic "inherited context blindness" |
| `multi-session/unresolved-failure-chain` | FM-1.4 | **44%** (avg of 75%, 13%) | Agent must diagnose incomplete rename instead of taking shortcuts — skipping critical diagnosis |

All three are multi-session scenarios where the agent inherits context from Session 1 that may be incorrect, incomplete, or outdated. The adversarial self-review skill is designed exactly for this situation: "before acting on inherited work, find 3 problems."

#### Why NOT these scenarios:
- **ghost-deliverable-chain / kb-integration-failure**: At ceiling (100%) post evidence-over-narrative skill. No room for improvement.
- **verify-before-finish / compound-edit-verification**: FM-3.3 focused, already 100% in gym (EXP-107). Gym can't reproduce production FM-3.3.
- **contradictory-requirements**: 0/19 baseline, but this requires mathematical reasoning / judgment under contradiction — adversarial review of inherited work wouldn't apply (it's a single-session judgment scenario).

### 3.3 Skill Design

The adversarial self-review skill must:
1. Be short (<300 words) — avoids EXP-018's timeout problem where a complex skill protocol consumed budget
2. Change the generation objective, not add procedural steps
3. Apply specifically to multi-session / inherited-context situations
4. Not duplicate evidence-over-narrative (which handles evidence/narrative conflict, not proactive skepticism)

#### Draft Skill Text (to be refined in Phase 1):

```markdown
# Skill: Adversarial Self-Review

## When to Apply
When you inherit work from a prior session, encounter authoritative-sounding context,
or are about to act on information you haven't verified yourself.

## The Technique
Before acting, switch from "task executor" to "hostile code reviewer."

**Ask yourself**: "If I were hired to find 3 bugs in this inherited work, what would I find?"

Then actually look:
1. Read every file that prior context claims was "completed" or "working"
2. For each one, assume it's broken until you prove otherwise
3. Write down at least 3 concrete problems (or confirm there are fewer than 3)
4. Only THEN proceed with your assigned task — fixing critical issues first

## Why This Works
Your default mode is to trust context and complete the task. That's usually fine.
But when prior context contains false claims (incomplete implementations, stale
descriptions, phantom deliverables), your default mode makes you build on broken
foundations.

Switching to "find problems" mode changes what you're generating:
- Default: output that confirms and extends the context → misses problems
- Adversarial: output that challenges the context → finds problems

## When NOT to Apply
- Fresh tasks with no inherited context (nothing to review)
- When you've already verified the inherited state yourself
- When the task is pure creation (no prior work to review)
```

### 3.4 Lab Fork Structure

```
agents/.lab/exp108-adversarial-skill/
  coder/
    skills/
      adversarial-self-review.md    ← the new skill (Arm B only)
```

Arm A (control): standard coder with current skill stack.
Arm B (treatment): standard coder + adversarial-self-review.md added to skills/.

### 3.5 Measurement

#### Primary: Scenario Pass Rate
Per-scenario pass rate (proportion of checks passed) and binary pass (all checks pass).

| Metric | Definition | Threshold |
|--------|-----------|-----------|
| Pass rate delta | (Arm B pass rate) - (Arm A pass rate) | ≥15pp |
| Binary pass delta | (Arm B % runs fully passing) - (Arm A % runs fully passing) | ≥20pp |

#### Secondary: Behavioral Check Pass Rate
The behavioral checks specifically test whether the agent demonstrated critical thinking:
- `diagnosed-incomplete-rename` (unresolved-failure-chain)
- `ran-tests-to-diagnose` (unresolved-failure-chain)
- `detected-incomplete` / `addressed-ghost` patterns
- Phase 1 compliance (phase-boundary-violation)

If adversarial self-review works, behavioral checks should improve more than product checks.

#### Tertiary: Efficiency (Total Operations)
Track whether the adversarial skill increases total tool calls. EXP-018 showed that complex skill protocols can cause timeout. If Arm B uses >50% more ops than Arm A, the skill may be too heavy.

### 3.6 Run Protocol

1. **Baseline first**: Run Arm A (control) for all 3 scenarios × 3 reps = 9 runs
2. **Check viability**: If any scenario is at ceiling (100%) for control, replace it
3. **Treatment**: Run Arm B for all 3 scenarios × 3 reps = 9 runs
4. **Analysis**: Compare per-scenario and aggregate metrics

## 4. Controls and Confounds

### 4.1 Controlled Variables
- Same model (Claude Sonnet 4) across all arms
- Same scenarios, environments, success criteria
- Same system prompt, same existing skills (except the added skill in Arm B)
- Same gym runner version
- Runs interleaved (not all A then all B) to control for temporal effects

### 4.2 Potential Confounds

| Confound | Mitigation |
|---|---|
| **EXP-104 lesson**: skill deployment timing | Both arms run in same timeframe with same base skills |
| **Skill stack interaction**: adversarial-self-review may interact with evidence-over-narrative | Monitor for duplication; if Arm B shows no improvement, check whether evidence-over-narrative already covers the mechanism |
| **Skill length effect**: adding ANY skill changes context size | Keep skill under 300 words; if concerned, run a placebo arm with a neutral 300-word skill |
| **Scenario novelty**: phase-boundary-violation has no baseline data | Run Arm A first to establish baseline; if ceiling, substitute |

### 4.3 Risk: EXP-018 Over-Compliance

EXP-018 showed that a multi-step skill protocol (structured-plan-writing) caused the agent to over-comply, wasting budget on planning instead of working (8/8 → 6/8, net harmful). The adversarial self-review skill mitigates this by:
1. Being short (~200 words vs structured-plan-writing's ~800)
2. Having one step ("find 3 problems"), not five sequential phases
3. Including explicit "when NOT to apply" section
4. Not prescribing a protocol — just redirecting orientation

If Arm B shows lower product scores than Arm A (over-verification at expense of task completion), this is a negative result worth documenting.

## 5. Expected Outcomes

### If H1 Confirmed (≥15pp improvement across scenarios)
- **Action**: Promote adversarial-self-review.md to production skill stack
- **Knowledge**: Write KE-109: "Adversarial generation-objective redirection works as a skill, breaking KE-002's 0/35 record for text interventions on judgment tasks"
- **Follow-up**: Test on single-session judgment scenarios (contradictory-requirements, sycophants-dilemma) to measure breadth

### If H2 Confirmed (improvement on ≥2 FM types)
- **Action**: Same as H1, plus: design FM-specific adversarial skill variants
- **Knowledge**: The mechanism generalizes beyond confabulation — it's about redirecting the default generation target from "confirm and extend" to "challenge and verify"

### If H0 Confirmed (no effect)
- **Action**: Do NOT deploy the skill. Close this line of investigation for skill-based delivery.
- **Knowledge**: Write KE-109: "Adversarial framing only works when embedded in session context (scenario-level), not when delivered as a generic skill. The delivery mechanism matters as much as the content. KE-002 holds for skill-file-delivered generation redirection."
- **Follow-up**: Investigate scenario-level adversarial injection (modifying multi-session handoff prompts in production, not deploying skills)

### If Mixed (works on some FMs but not others)
- **Action**: Deploy only for effective FM types. Investigate what distinguishes responsive vs. non-responsive failure modes.
- **Knowledge**: Map which failure modes respond to orientation changes vs. requiring structural enforcement

## 6. Connection to Prior Knowledge

| Entry | Relationship | Implication for EXP-108 |
|---|---|---|
| **KE-002** | Text rules 0/35 on judgment | EXP-108 tests whether generation-objective redirection breaks this barrier |
| **KE-007** | Only structural interventions work | Adversarial skill is "structural text" per KE-002 nuance — changes execution sequence |
| **KE-099** | Adversarial framing bypasses confabulation (LOW confidence due to EXP-104 confound) | EXP-108 tests the mechanism on non-confabulation failure modes where confound doesn't apply |
| **KE-106** | Guards don't train behavior | Irrelevant — EXP-108 doesn't use guards |
| **EXP-103** | Adversarial framing 100% on confabulation scenarios | Source mechanism being generalized |
| **EXP-104** | evidence-over-narrative skill confounded EXP-103 | EXP-108 uses scenarios NOT at ceiling post-skill, avoiding this confound |
| **EXP-107** | Gym can't reproduce production FM-3.3 | EXP-108 avoids FM-3.3 scenarios; uses FM-2.6 and FM-1.4 instead |
| **EXP-018** | Complex skill protocol → harmful over-compliance | EXP-108 skill is short (200 words) with one step, not five-phase protocol |
| **EXP-084** | Structural text partially effective (Cohen's d > 3) | Consistent with adversarial skill being structural text; predicts score improvement even if pass rate effect is unreliable |

## 7. Cost Estimate

- 18 runs × ~$0.50/run (multi-session) = ~$9.00
- Implementation: ~1 hour (skill authoring + lab fork)
- Analysis: ~30 min (per-run comparison)
- Total: ~$9 + 1.5 hours

## 8. Phased Execution Plan

### Phase 1: Skill Authoring + Lab Fork (30 min)
1. Write final adversarial-self-review.md skill
2. Create lab fork at `agents/.lab/exp108-adversarial-skill/`
3. Verify lab fork structure

### Phase 2: Control Arm (Arm A) — 9 runs
1. Run 3 scenarios × 3 reps with standard coder
2. Record per-check results
3. **Gate check**: If any scenario is at ceiling (100%), substitute with a different non-ceiling scenario

### Phase 3: Treatment Arm (Arm B) — 9 runs
1. Run 3 scenarios × 3 reps with coder + adversarial-self-review skill
2. Record per-check results

### Phase 4: Analysis + Knowledge Entry
1. Compare Arm A vs Arm B per-scenario and aggregate
2. Write results.md
3. Write KE-109 based on outcome
4. Decision: promote skill or close investigation

## 9. Success Criteria for the Experiment Itself

The experiment succeeds (regardless of hypothesis outcome) if:
1. All 18 runs complete without infrastructure errors
2. Control arm shows non-ceiling pass rates for at least 2/3 scenarios (≤80%)
3. Results include per-run, per-check data (not just aggregates)
4. Analysis addresses the KE-002 relationship explicitly
5. A knowledge entry is produced regardless of outcome

## 10. References

- `agents/shared/knowledge/experiments/EXP-103/results.md` — adversarial framing evidence
- `agents/shared/knowledge/experiments/EXP-104/results.md` — confound discovery
- `agents/shared/knowledge/experiments/EXP-107/results.md` — gym-production FM-3.3 gap
- `agents/shared/knowledge/experiments/EXP-107/wave2-results.md` — multi-session FM-3.3 gap
- `agents/shared/knowledge/entries/KE-002.md` — text rules 0/35 on judgment
- `agents/shared/knowledge/entries/KE-007.md` — structural interventions only
- `agents/shared/knowledge/entries/KE-099-adversarial-framing-bypass-verification-confabulation.md`
- `agents/coder/skills/evidence-over-narrative.md` — existing skill comparison
- `agents/coder/skills/verify-after-edit.md` — existing skill comparison
- `agents/coder/skills/investigate-and-fix.md` — existing skill comparison
- `agents/coach/workspace/multi-session-baselines.md` — scenario baseline data
