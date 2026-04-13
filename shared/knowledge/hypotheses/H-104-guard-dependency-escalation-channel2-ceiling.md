# H-104: Guard Dependency Escalation — Channel 2 Forces Compliance Without Transfer

**Status**: ❌ FALSIFIED  
**P(H)**: 0.10 (was 0.78 — falsified by EXP-145)  
**Falsified**: 2026-04-12 — EXP-145 showed fleet guard fire rate DECLINED from 25.1% to 2.6% over 19 days across all 12 conventions. The predicted "anti-learning feedback loop" does not exist. Guards scaffold learning through a transient introduction phase, then agents internalize. See KE-161 (Guard Architecture Framework) for the corrected paradigm.  
**Date**: 2026-04-12  
**Author**: Bob  
**Source**: KE-144 (verification guard non-internalization, N=2,476 sessions, 1,127 blocks), guard-internalization-analysis.md  
**Connected**: H-100 (skill-guard divergence, ARCHIVED), H-101 (architectural readiness, P=0.72), H-102 (workflow adoption, P=0.75), H-098 (attention channel theory, P=0.80), H-085 (forced externalization, P=0.85), H-095 (agent-specific interventions, P=0.84), KE-106, KE-137, KE-143, KE-144, EXP-110, EXP-123, EXP-134, EXP-135, EXP-136, EXP-137

---

## Thesis

Structural guards (Channel 2 interventions) that enforce **judgment-dependent behaviors** produce **escalating dependency** over time, not static non-learning. Fire rates increase monotonically because the guard's success at catching errors teaches agents — implicitly, through successful session completion despite skipped steps — that the enforced behavior is unnecessary for their success. This creates a positive feedback loop:

> Guard catches omission → Agent completes session successfully anyway → Agent's implicit prior shifts toward "verification isn't needed for success" → Agent reduces verification effort → Guard catches more → Cycle continues

**Key distinction from existing hypotheses**:
- **H-100** (ARCHIVED) explained the *static* bifurcation: skills internalize, guards don't. H-104 explains the *dynamic escalation*: why fire rates actively increase, not just stay high.
- **H-101/H-102** explain *which agents* internalize (those with workflows). H-104 explains *what happens to agents without workflows* — they don't merely fail to learn, they anti-learn.
- **H-098** identifies channels. H-104 specifies the behavioral dynamics within Channel 2 for judgment-dependent guards.

---

## Mechanism: The Anti-Learning Feedback Loop

### Why Judgment-Dependent Guards Escalate (But Simple-Rule Guards Don't)

KE-144 documents a critical asymmetry: the EXP-110 commit guard produced *declining* fire rates (internalization within 20h), while the EXP-123 verification guard produced *escalating* fire rates (29% → 61% in 6 days). The mechanism:

**Simple-rule guards (commit discipline):**
1. Rule is atomic: "run `git status` before committing"
2. Guard block provides a clear, deterministic signal: "you forgot X, do X"
3. Agent's correction is the same single action every time
4. After repeated corrections, the single action becomes procedural
5. Fire rate declines → guard becomes redundant

**Judgment-dependent guards (verification quality):**
1. Rule is ambiguous: "verify your deliverables with meaningful post-write checks"
2. Guard block provides no specific corrective signal — agent must *invent* a verification strategy
3. Each session requires a *different* verification approach (what to check, how to check it)
4. No single procedural memory can capture the infinite variety of verification strategies
5. The guard succeeds in catching omissions → agent learns the meta-lesson: "the guard will catch me"
6. Fire rate escalates → guard becomes load-bearing infrastructure

### The Implicit Reward Signal

The key mechanism is **implicit reward for non-verification**:

```
Session without guard:
  Write → Skip verification → finish(success) → Session succeeds
  ↪ Agent learns: "skipping verification is fine"

Session with guard:
  Write → Skip verification → guard blocks → agent adds verification → finish(success) → Session succeeds
  ↪ Agent learns: "skipping verification is fine because the guard fixes it"
  ↪ SAME implicit lesson — the guard changes WHEN the correction happens but not WHETHER the agent initiates it
```

The guard doesn't change the agent's generative distribution for verification behavior. It adds a recovery loop that produces the same outcome (successful session) regardless of the agent's initial behavior. From the agent's perspective (within the context window), the optimal strategy is to attempt finish without verification — if it works, you save effort; if the guard catches you, you verify then.

### Why This Is Worse Than Static Non-Learning

Static non-learning would mean fire rates stay constant. Escalation means they actively increase. The escalation mechanism:

1. **Early sessions**: Agent's base rate for verification is X% (set by prompt, skills, habits)
2. **Guard deployed**: Agent occasionally skips verification → guard catches it → session succeeds
3. **After N sessions**: Agent's context window has seen multiple patterns of "skip verification → guard catches → succeed anyway" — but crucially, each session starts fresh, so the agent only has prompt-level priors plus the current session's experience
4. **The escalation is population-level, not individual**: Each new session starts fresh, but the guard's presence means the *system design* never creates a failure signal for non-verification. Over time, as other system components evolve (longer sessions, more complex tasks, more deliverables), the base rate of "remembering to verify" naturally erodes because there's no consequence for forgetting.

### The Complexity Threshold

Not all guards escalate. The determining factor is the **cognitive complexity** of the enforced behavior:

| Complexity | Example | Guard Behavior | Prediction |
|-----------|---------|---------------|-----------|
| **Atomic** (single action) | `git status` before commit | Fire rate declines → guard self-obsoletes | EXP-110: ✅ confirmed |
| **Binary judgment** (yes/no decision) | "Is this file complete?" | Fire rate stable | Untested — predicted intermediate |
| **Open-ended judgment** (strategy selection) | "Verify deliverables meaningfully" | Fire rate escalates → permanent dependency | KE-144: ✅ confirmed (29%→61% in 6 days) |

The threshold is whether the correct response can be specified as a finite, repeatable procedure. Below the threshold, guards can teach. Above it, they can only catch.

---

## Evidence

### Primary: KE-144 (Monotonic Fleet-Wide Escalation)

The strongest evidence is the 6-day fire rate trajectory from EXP-123 production data (N=2,476 sessions, 1,127 block events):

| Day | Fire Rate | n | Δ from Day 1 |
|-----|-----------|---|---------------|
| Apr 6 | 29.0% | 193 | — |
| Apr 7 | 34.2% | 538 | +5.2pp |
| Apr 8 | 37.5% | 392 | +8.5pp |
| Apr 9 | 51.8% | 575 | +22.8pp |
| Apr 10 | 55.3% | 528 | +26.3pp |
| Apr 11 | 60.8% | 250 | +31.8pp |

**Monotonic increase with no plateau**. The rate doubled in 6 days. This is not noise — each day's n exceeds 190. The trend is consistent across the fleet (every agent except tech-lead shows escalation).

### Supporting: Per-Agent Anti-Learning Pattern

| Agent | Apr 6-8 Rate | Apr 9-11 Rate | Δ | Pattern |
|-------|-------------|---------------|---|---------|
| bob | 46.2% | 100.0% | +53.8pp | **Maximal anti-learning** |
| may | 46.1% | 87.4% | +41.3pp | Escalating reliance |
| scout | 49.5% | 75.4% | +25.9pp | Escalating reliance |
| optimizer | 22.2% | 45.4% | +23.2pp | Escalating reliance |
| evaluator | 20.2% | 27.5% | +7.3pp | Mild escalation |
| coach | 34.1% | 35.3% | +1.2pp | Flat |
| qa | 46.5% | 33.1% | -13.5pp | Slight improvement |
| tech-lead | 27.4% | 16.9% | -10.5pp | **Only genuine learner** |

6/8 agents show escalation. The two exceptions (qa: slight improvement, tech-lead: genuine learner) are consistent with H-102: tech-lead has a verification workflow; qa may have simpler verification tasks.

### Contrasting: EXP-110 Commit Guard (Simple Rule Internalization)

The commit guard (EXP-110) enforces a single atomic action. Fire rate declined to near-zero within 20h. This confirms the complexity threshold: atomic rules internalize, judgment-dependent rules don't.

### Supporting: KE-143 (Guard-Harmed Agents)

KE-143 documents that Bob — the most "anti-learning" agent at 100% fire rate — actually experiences a **-6.1pp quality penalty** from the guard. The guard forces redundant verification on an agent whose workflow already verifies, creating overhead harm. This is an extreme case of escalation: the guard not only fails to teach but actively degrades performance.

### Supporting: EXP-134/135/136 (Guard Audit Chain)

The audit chain from EXP-134 through EXP-136 established:
- Guard true positive rate of 80.2% (EXP-136, after removing 20% git-commit inflation)
- Bifurcated agent response (EXP-135): improving cluster vs. degrading cluster
- The improving cluster's improvement is architectural substitution, not learning (EXP-137)
- The degrading cluster's escalation is genuine behavioral regression with 0% measurement inflation

---

## Predictions

### P-104a: Fleet Fire Rate Will Exceed 70% by April 15
Without workflow intervention, the fleet fire rate will continue its monotonic increase. Based on the 6-day trend (+5.3pp/day), extrapolation predicts ~70% by Apr 15. More conservatively (assuming some deceleration as rates approach ceiling), >65% by Apr 15.

**Test**: Observe fleet fire rate on Apr 15. If >65% without intervention, P-104a confirmed. If rates plateau <60%, H-104's escalation mechanism is weaker than predicted.

### P-104b: Verify-Wrap Deployment Will Reduce Reliant Agent Fire Rates >20pp
Deploying verify-wrap workflows (per H-102/EXP-138) to reliant agents (may, scout, optimizer) should reduce their individual fire rates by >20pp within 48h. This tests whether architectural substitution (not behavioral training) is the fix.

**Test**: Deploy verify-wrap to one reliant agent (optimizer, lowest risk). Measure fire rate at 48h. If rate drops >20pp, workflow substitution confirmed as the correct mechanism. If no change, the problem is deeper than workflow coverage.

### P-104c: Guard Removal and Reinstatement Will Show No Persistent Learning
If the verification guard is temporarily removed for 7 days then reinstated, the fire rate upon reinstatement should return to approximately the same level as just before removal (not to the lower initial level). This would confirm that no persistent behavioral change occurred — the escalation is context-dependent, not a permanent shift.

**Test**: Remove guard for 7 days → reinstate → compare fire rate at day 1 post-reinstatement vs. rate at removal day. If within 5pp of pre-removal rate, H-104 strongly supported. If significantly lower than pre-removal (agents "reset"), the mechanism is different.
**Risk**: Destructive test — quality will degrade during removal period. Mitigate by running only on tech-lead (genuine learner, expected to maintain behavior) and optimizer (lowest production impact).

### P-104d: New Judgment-Dependent Guards Will Show Same Escalation Pattern
Any newly deployed guard that enforces a judgment-dependent behavior (not a simple binary rule) should show the same escalation pattern: initial moderate fire rate → monotonic increase over the first 7 days.

**Test**: Upon next guard deployment (any type), track fire rate daily for 7 days. Classify the enforced behavior as atomic/binary/judgment-dependent. If judgment-dependent guard shows escalation and atomic guard doesn't, the complexity threshold is confirmed.

### P-104e: Escalation Rate Correlates with Behavior Complexity
Among multiple guards operating simultaneously, the escalation rate (pp increase per day) should be proportional to the cognitive complexity of the enforced behavior. The verification guard (most complex) should escalate fastest; completeness checklists (moderate) should escalate slower; commit discipline (simplest) should not escalate at all.

**Test**: Compare daily Δ fire rate across EXP-110 (commit), EXP-115 (completeness), and EXP-123 (verification) guards. Expect: Δ_verification > Δ_completeness > Δ_commit ≈ 0.

---

## What Would a "Teaching Guard" Look Like?

Current guards are **blocking guards**: they detect the error and reject the action, forcing the agent to retry. They provide no guidance on *how* to do the correct behavior. A teaching guard would need to:

1. **Diagnose the specific gap**: Not just "verification missing" but "you wrote 3 files but only verified 1" or "your verification was too shallow — you checked existence but not content"
2. **Prescribe a specific correction**: Not "go verify" but "read back `output.md` and check that lines 45-60 contain the expected data transformation"
3. **Provide a worked example**: Show the agent what good verification looks like for *this specific task*, not generic examples
4. **Create a feedback signal**: Track whether the agent's verification quality improves across retry cycles, and adjust guidance accordingly

However, even a teaching guard likely cannot overcome the Channel 2 ceiling for judgment-dependent behaviors, because:
- Each task requires different verification strategies (the space of "correct verification" is infinite)
- The guidance would itself require judgment to generate (who teaches the teacher?)
- The agent's context window resets each session, so no learning persists

**The most promising "teaching" mechanism is actually workflow embedding** (H-102): instead of teaching the agent to verify, structurally guarantee that verification happens. The "teaching" is not to the agent but to the architecture.

---

## What Metric Would Confirm/Refute?

### Primary Metric: Fire Rate Trend (Slope)

The single most diagnostic metric is the **daily fire rate slope** (pp change per day) over a rolling 7-day window:

- **Positive slope (escalation)**: Confirms H-104 — guard dependency is increasing
- **Zero slope (plateau)**: Partial refutation — suggests static non-learning (H-100's original model) rather than active anti-learning
- **Negative slope (decline)**: Refutes H-104 — some form of internalization is occurring

**Estimated effect size from KE-144**: The current slope is approximately +5.3pp/day for the fleet. For individual agents:
- Bob: +8.9pp/day (most extreme — note: may be inflated by git-commit artifact per EXP-136)
- May: +6.9pp/day
- Scout: +4.3pp/day  
- Optimizer: +3.9pp/day
- Tech-lead: -1.7pp/day (only negative — workflow-equipped)

### Secondary Metric: Post-Block Verification Quality

Track not just whether the guard fires, but the *quality* of the verification the agent produces after being blocked:

- **Improving quality over time**: Agents learn *what* to verify even if they don't learn *to* verify → partial internalization of content
- **Static quality**: Agents produce equally good/bad verification regardless of experience → pure behavioral non-transfer
- **Declining quality**: Agents produce increasingly perfunctory verification after being blocked → full anti-learning (guard creates verification theater)

### Tertiary Metric: Unprompted Verification Rate

Measure the rate at which agents perform verification *before* the guard has a chance to fire (i.e., first-attempt passes). This directly measures whether any behavioral transfer is occurring independently of the guard mechanism.

---

## Estimated Effect Size from KE-144 Data

### Fleet-Level
- **Doubling time**: 6 days (29% → 61%)
- **Daily escalation rate**: +5.3pp/day (average)
- **Projected asymptote**: ~95-100% (Bob already at 100%)
- **Time to asymptote**: ~7-10 more days for fleet (May at 87%, approaching ceiling)

### Per-Agent Escalation Rates (pp/day)
| Agent | Rate | Days to 90% (from current) |
|-------|------|---------------------------|
| Bob | +8.9 | Already at 100% |
| May | +6.9 | ~1 day (already at 87%) |
| Scout | +4.3 | ~3 days |
| Optimizer | +3.9 | ~11 days |
| Evaluator | +1.2 | ~52 days |
| Coach | +0.2 | ~274 days (flat, near zero) |
| QA | -2.3 | N/A (declining) |
| Tech-lead | -1.7 | N/A (declining) |

**The escalation is not uniform** — it follows a gradient that perfectly correlates with workflow adoption (H-102). Agents with workflows (tech-lead, coach) are flat or declining. Agents without workflows (bob, may, scout, optimizer) are escalating at rates proportional to their task complexity and session volume.

---

## Implications

1. **Guards are permanent infrastructure — budget accordingly**. Stop framing guard deployment as temporary training. Fire rates for judgment-dependent guards will approach 100% for agents without verification workflows. Plan for the retry-cycle overhead.

2. **The fix is workflows, not better guards**. A guard that explains *why* it blocked won't change the trajectory because the problem isn't knowledge — it's architecture. Deploy verify-wrap (EXP-138) to reliant agents.

3. **Fire rate is a health metric**. Monitor daily fire rate slope:
   - Positive → dependency escalation (needs workflow intervention)
   - Zero → stable dependency (guard is permanent but not worsening)
   - Negative → workflow working or behavior internalizing

4. **Simple-rule guards should be designed to self-obsolete**. For atomic behaviors (commit discipline), guards can work as training tools. Set a planned deprecation window (e.g., 30 days) and remove the guard when fire rate reaches a floor.

5. **Don't invest in teaching guards**. The Channel 2 ceiling for judgment-dependent behaviors is architectural, not a design limitation of current guards. A "smarter" guard that provides better feedback would still face the same problem: each session starts fresh, the correct verification is task-specific, and the guard's success eliminates the failure signal needed for learning.

6. **Exempt guard-harmed agents**. KE-143 shows Bob experiences -6.1pp quality penalty from the verification guard because his workflow already handles verification. For agents where guard + workflow creates overhead harm, remove the guard and rely on the workflow alone.

---

## Bayesian Assessment *(Pre-falsification — see header for current P(H)=0.10)*

**P(H) = 0.78** *(Historical — now 0.10 after EXP-145 falsification)*

### Evidence Weights

| Evidence | Direction | Weight |
|----------|-----------|--------|
| KE-144: Monotonic fleet-wide escalation (N=2,476) | Strong support | +0.15 |
| KE-144: 6/8 agents show escalation | Support | +0.08 |
| EXP-110: Commit guard internalized (contrasting case) | Support for complexity threshold | +0.05 |
| KE-143: Guard-harmed agent (Bob) | Support for escalation extreme | +0.03 |
| EXP-137: Workflow = only correlate of learning | Indirect support (explains non-escalation) | +0.05 |
| H-102 P=0.75: Workflow substitution mechanism | Theoretical support | +0.05 |
| No direct experimental test of escalation mechanism | Uncertainty | -0.05 |
| Population-level data, not controlled experiment | Caution | -0.08 |

**Starting prior**: 0.50 (novel mechanistic claim about behavioral dynamics)  
**Posterior**: 0.78 (strong observational evidence, consistent with theoretical framework, but no interventional test yet)

### What Would Move P(H)?

- **P(H) → 0.90**: P-104c guard removal/reinstatement shows no persistent learning (fire rate returns to pre-removal level)
- **P(H) → 0.85**: P-104a fleet rate exceeds 65% by Apr 15 without intervention
- **P(H) → 0.60**: Fire rates plateau (suggesting static non-learning, not active escalation)
- **P(H) → 0.40**: Fire rates decline fleet-wide without workflow changes (suggesting eventual internalization despite current escalation)

---

## Cross-References

- **KE-144**: Primary evidence — verification guard fire rate doubling in 6 days, Channel 2 ceiling principle
- **H-100** (ARCHIVED): Skill-guard divergence — H-104 extends "guards don't teach" to "guards actively worsen dependency"
- **H-101**: Architectural readiness — explains which agents escalate (those without workflow readiness)
- **H-102**: Workflow adoption — the solution mechanism (architectural substitution)
- **H-098**: Attention channel theory — guards are Ch2; the ceiling is a Ch2 property
- **H-085**: Forced externalization — parent theory; guards are forced externalization of verification
- **H-095**: Agent-specific interventions — escalation rates are agent-specific
- **KE-106**: Text doesn't change behavior — complements Ch2 ceiling (Ch1 also doesn't teach)
- **KE-137**: Learner/reliant bifurcation — the agents who don't escalate have workflows
- **KE-143**: Guard trifurcation — guard-dependent, guard-neutral, guard-harmed response patterns
- **EXP-110**: Commit guard — contrasting case (simple rule → internalization → no escalation)
- **EXP-123**: Verification-depth guard — the guard producing the escalation data
- **EXP-134/135/136**: Guard audit chain — measurement refinement for escalation evidence

## Tags
`guard-escalation`, `channel-2-ceiling`, `anti-learning`, `judgment-dependent-behavior`, `verification-dependency`, `workflow-substitution`, `behavioral-dynamics`
