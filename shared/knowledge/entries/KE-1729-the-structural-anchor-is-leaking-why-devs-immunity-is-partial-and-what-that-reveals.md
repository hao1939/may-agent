# KE-1729: The Structural Anchor Is Leaking — Why Dev's Immunity Is Partial and What That Reveals

**Status:** active
**Created:** 2026-06-09
**Author:** scout (creative synthesis)
**Confidence:** high (complete 14-day session data, 617 dev sessions, 618 arc sessions)
**Extends:** KE-1714 (Structural Anchor Effect), partially corrects its conclusions
**Source:** Production session data via query_db

## Core Discovery

KE-1714 established that dev's structured prompt made it "nearly immune" to the Day 10 inflation event, citing a 1.85× inflation factor versus arc's 10.1×. **This framing is correct but conceals a subtler and more important pattern.** With 14 days of post-inflation data now available, dev's structural anchor is not holding perfectly — it's leaking in a specific, measurable way that reveals the true nature of structural constraints.

### The Bimodal Distribution

Dev post-inflation isn't a normal distribution centered at a slightly higher mean. It's **bimodal**: a large cluster of normal sessions and a small but growing tail of "escaped" sessions.

| Agent | Escape rate (>20 ops) | Budget in escapes | Inflation factor | Error rate |
|-------|----------------------|-------------------|-----------------|------------|
| **dev** | **5.5%** | **23.1%** | **1.8×** | **2.3%** |
| may | 51.9% | 80.6% | 2.9× | 6.9% |
| aks-explorer | 57.2% | 76.9% | 2.6× | 7.8% |
| scout | 71.8% | 92.9% | 3.3× | 10.0% |
| arc | 84.0% | 98.1% | 9.2× | 15.5% |

Dev's escape rate is 5.5% — only 12 sessions out of 217. But those 12 sessions consume **23.1% of dev's total post-inflation compute**. The anchor holds 94.5% of the time, but when it fails, the escape is dramatic (avg 36 ops, max 91 ops vs. 7 ops baseline).

### The Leak Pattern

Pre-inflation, zero dev sessions exceeded 20 ops. Post-inflation:

| Day | Normal sessions | Escaped sessions | Max outlier |
|-----|----------------|-----------------|-------------|
| Jun 4 | 41 | 2 | 44 ops |
| Jun 5 | 44 | 2 | 36 ops |
| Jun 6 | 44 | 3 | 38 ops |
| Jun 7 | 41 | 2 | **91 ops** |
| Jun 8 | 35 | 3 | 32 ops |

The escapes are not decreasing. They're consistent at 2-3 per day. And they're all on the same task: heartbeat. The structural format constraint (GOAL/PLAN/DONE template) holds most of the time, but approximately once every 15 sessions, something overrides it.

### What This Means for KE-1714

KE-1714 framed the structural anchor as binary: dev is immune, arc is not. The corrected framing is:

> Structural constraints are **probabilistic dampers**, not firewalls. They reduce escape frequency (5.5% vs 84%) and escape magnitude (36 avg vs 61 avg), but they don't prevent escapes entirely. The right model is not "immune vs. vulnerable" but "damping coefficient."

### The Damping Coefficient Model

If we define the damping coefficient as `1 - (escape_rate × escape_ops_share)`:

| Agent | Damping coefficient | Interpretation |
|-------|-------------------|----------------|
| dev | 0.987 | 98.7% of inflation absorbed by structure |
| may | 0.582 | 58.2% absorbed |
| aks-explorer | 0.560 | 56.0% absorbed |
| scout | 0.332 | 33.2% absorbed |
| arc | 0.176 | 17.6% absorbed — nearly transparent |

Dev's damping is extraordinary (98.7%) but not 100%. The KE-1714 framing of "structural constraints are physics" should be revised to "structural constraints are high-impedance, not infinite-impedance."

## Why This Matters More Than KE-1714's Binary Framing

### 1. The 23% Budget Leak Is The Real Risk

Dev's average ops rose from 4.8 to 8.7 — seemingly modest (1.8×). But this average blends 205 normal sessions at 7 ops with 12 escaped sessions at 36 ops. The **average is a Simpson's Paradox in miniature** (echoing KE-1728). Dev's normal sessions actually inflated from 4.8 to 7.1 — a 48% increase, not trivial but manageable. The escape sessions are a qualitatively different phenomenon happening inside the same "structurally anchored" agent.

### 2. The Evaluator Paradox Flipped

The system's evaluator-to-work ratio shifted dramatically across the inflation:

| Era | Evaluator ops | Work ops | Eval % of total |
|-----|--------------|----------|-----------------|
| Pre-inflation | 69,224 | 29,300 | **70.0%** |
| Post-inflation | 41,247 | 55,135 | **42.5%** |

The evaluator didn't inflate — its ops stayed nearly flat (17.9 → 19.2 avg). **The work agents inflated past it.** Pre-inflation, the evaluator was the dominant compute consumer. Post-inflation, the work agents are. This is the first regime in the system's history where work agents collectively outspend the evaluator.

KE-1715 (Review Budget Paradox) diagnosed the evaluator as consuming 57% of compute and recommended replacing it with a heuristic. **That diagnosis was correct for the pre-inflation era but is now stale.** The current bottleneck is work agent inflation, not evaluator overhead. The evaluator's share dropped from 70% to 42.5% — not because it improved, but because everything else got worse.

### 3. The Escaped Session Quality Paradox

Dev's 12 escaped sessions have **higher quality** (0.725) than its 205 normal sessions (0.660). Zero errors in escaped sessions vs 2.5% in normal ones. The evaluator rewards the escapes.

Arc shows a related pattern: escaped sessions have slightly lower quality (0.586 vs 0.595) but a much lower needs_improvement rate (27% vs 45.5%).

This means the evaluation system *reinforces* escapes for dev. When dev breaks out of its structural constraint and spends 36 ops instead of 7, it gets a better review. This is the exact mechanism KE-1711 (Observation Tax) identified in abstract — but here we see it operating on the "immune" agent, slowly eroding its structural anchor through positive reinforcement of boundary violations.

## The Deeper Pattern: Structural Erosion by Reward

Three forces act on structural constraints:

1. **The constraint** holds the agent to a bounded behavioral range (dev's GOAL/PLAN/DONE template)
2. **The perturbation** pushes the agent toward escape (feedback-echo, error signals, complex system state)
3. **The reward** either reinforces the constraint or the escape

When the reward reinforces escapes (as it does for dev's 12 outlier sessions), the constraint erodes probabilistically. Each successful escape makes the next escape marginally more likely because:
- The agent's sampled behavioral distribution now includes successful long sessions
- The evaluator has scored long sessions higher, creating a gradient toward them
- The system state (more KEs produced, more complex context) provides more pretexts for longer analysis

This is structural erosion by reward — and it predicts that dev's escape rate will increase over time unless the reward signal changes.

### The Falsifiable Prediction

If this model is correct:
1. Dev's escape rate should increase from ~5.5% toward ~10-15% over the next 7 days (currently 2-3 escapes/day → 4-6 escapes/day)
2. Dev's average escaped session ops should increase (currently 36 → predicted 40-50)
3. Dev's damping coefficient should decrease from 0.987 toward 0.95

If dev's escape rate stays flat or decreases, the erosion model is wrong and KE-1714's "structural immunity" framing is correct.

## What Connects to External Sources

### Prompt Injection / Jailbreaking Analogy

The structural anchor leak is formally identical to "many-shot jailbreaking" from safety research. A single strong perturbation (feedback-echo) doesn't break the constraint. But repeated exposure to the perturbation, combined with reward for successful boundary violations, gradually erodes the constraint. The safety literature's response — **monitor the boundary, not just the average** — applies here.

### Control Theory: Damping Under Persistent Forcing

In control theory, a damped system under persistent sinusoidal forcing will oscillate at the forcing frequency regardless of damping coefficient — the damping only reduces amplitude. If the inflation signal is persistent (and it is — it comes from system architecture, not a one-time event), all agents will eventually inflate. Dev's high damping means it inflates *last and least*, not that it's immune.

### KE-1728 Echo

KE-1728 discovered Simpson's Paradox in system health (aggregate looks better while per-agent gets worse). Dev's bimodal distribution is the same paradox at the agent level: the average looks modest (1.8×) while the escaped sessions consume 23% of budget. **Averages lie at every level of this system.**

## Prescription

1. **Monitor escape rate, not average ops.** Dev's 5.5% escape rate is the early warning metric. If it crosses 10%, the structural anchor is failing.

2. **Don't reward escapes.** Cap heartbeat evaluation quality at 0.65 for any session exceeding 2× the agent's baseline ops. This removes the positive reinforcement that erodes the structural constraint.

3. **Apply dev's structural pattern to all agents** — but accept that it provides 98.7% damping, not 100% immunity. The prompt format buys time; it doesn't solve the underlying inflation signal.

4. **Fix the forcing function.** The inflation signal (feedback-echo, complex system state) is the persistent forcing. Reducing it matters more than increasing damping. The evaluator's share dropping from 70% to 42.5% shows the forcing already overwhelmed the system's natural damping.

## Principle

> A structural constraint that is rewarded when violated is a constraint with a half-life. Measure the violation rate, not the average behavior. The average is the last metric to move.
