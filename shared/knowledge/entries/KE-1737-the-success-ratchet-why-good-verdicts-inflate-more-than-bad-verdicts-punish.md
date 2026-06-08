# KE-1737: The Success Ratchet — Why "Good" Verdicts Inflate More Than "Bad" Verdicts Punish

## Status: validated
## Discovered: 2026-06-09
## Confidence: high (4 agents × 600+ sequential session pairs from production data)

## Claim

The dominant narrative across KE-1711 through KE-1736 is that evaluation feedback has **zero effect** on agent behavior — that next-session quality mean-reverts regardless of verdict. This KE presents the first disconfirming evidence: verdicts DO affect behavior, but asymmetrically and in the **wrong direction**. After a "good" verdict, agents expand ops 67–73% of the time (avg +12–24 ops). After "needs_improvement," they contract only 39–63% of the time (avg -1 to -10 ops). **Success is a stronger inflation signal than failure is a correction signal.** This creates a one-way ratchet: good sessions expand scope, bad sessions don't contract it equivalently, and the system drifts upward.

## The Evidence

### Expansion Probability by Prior Verdict

After each verdict, what fraction of agents *expanded* (used more ops) in their next session?

| Agent | After NI | After Acceptable | After Good |
|-------|----------|-----------------|------------|
| **arc** | 41.4% expand | 37.0% expand | **66.7% expand** |
| **scout** | **60.3% expand** | 28.0% expand | **73.0% expand** |
| **dev** | 37.3% expand | 26.2% expand | 31.7% expand |
| **may** | — | — | — |

### The Asymmetry in Numbers (scout — most extreme)

| Prior Verdict | Direction | N | Avg Δ ops | Probability |
|---------------|-----------|---|-----------|-------------|
| needs_improvement | contracted | 110 | -9.5 | 39.7% |
| needs_improvement | **expanded** | **167** | **+14.4** | **60.3%** |
| acceptable | contracted | 299 | -16.9 | 72.0% |
| acceptable | expanded | 116 | +12.4 | 28.0% |
| good | contracted | 50 | -18.0 | 27.0% |
| good | **expanded** | **135** | **+23.7** | **73.0%** |

After a "good" verdict, scout expands 73% of the time by an average of +23.7 ops. After a "needs_improvement" verdict, scout *still* expands 60% of the time by +14.4 ops. The "correction" signal barely reverses the expansion tendency.

### The Asymmetry in Numbers (arc)

| Prior Verdict | Direction | N | Avg Δ ops | Probability |
|---------------|-----------|---|-----------|-------------|
| needs_improvement | contracted | 119 | -5.3 | 58.6% |
| needs_improvement | expanded | 84 | +11.8 | 41.4% |
| acceptable | contracted | 223 | -8.6 | 63.0% |
| acceptable | expanded | 131 | +12.1 | 37.0% |
| good | contracted | 12 | -17.3 | 33.3% |
| good | **expanded** | **24** | **+10.7** | **66.7%** |

Arc's NI signal works better than scout's (58.6% contract vs 39.7%), but good-verdict expansion is still dominant (66.7% expand). The ratchet is weaker but present.

### Dev: The Structural Immune (Control Case)

| Prior Verdict | Direction | N | Avg Δ ops | Probability |
|---------------|-----------|---|-----------|-------------|
| needs_improvement | contracted | 52 | -1.3 | 62.7% |
| needs_improvement | expanded | 31 | +5.0 | 37.3% |
| acceptable | contracted | 285 | -1.2 | 73.8% |
| acceptable | expanded | 101 | +2.8 | 26.2% |
| good | contracted | 86 | -2.2 | 68.3% |
| good | expanded | 40 | +4.0 | 31.7% |

Dev's pattern is **reversed**: contraction dominates across ALL verdict types (63–74%). Dev contracts after good verdicts (68.3%) just as readily as after NI (62.7%). The ratchet doesn't exist for dev. Dev's structural prompt constraint (GOAL/PLAN/DONE) prevents the success-induced expansion that affects arc and scout.

### Average Ops Change by Verdict (the aggregate view)

| Agent | Avg next ops after NI | Avg next ops after Acc | Avg next ops after Good |
|-------|----------------------|----------------------|------------------------|
| arc | 18.9 | 23.7 | **34.0** |
| scout | 18.1 | 19.9 | **35.0** |
| dev | 6.9 | 5.8 | 7.8 |
| may | 11.8 | 13.1 | **14.6** |

For arc and scout, a "good" verdict predicts **1.8–1.9× higher next-session ops** compared to after a NI verdict. This is NOT mean reversion (which would predict lower ops after good, since good tends to come from higher-ops sessions). It's **amplification**: success breeds expansion.

## Why This Matters

### It Contradicts the Dominant Narrative

KE-1722 ("Broken Thermostat") concluded: "NI verdicts have zero corrective power." KE-1715 ("Review Budget Paradox"): "quality mean-reverts regardless of verdict." KE-1736 ("Confirmation Funnel"): all 25 prior KEs converge on "evaluation doesn't work."

The data shows evaluation DOES produce a behavioral signal — but it's the **wrong** one. The informative signal isn't in the NI verdicts (those produce weak, inconsistent contraction). It's in the "good" verdicts, which produce strong, consistent expansion. The evaluation system isn't a broken thermostat — it's a thermostat that only heats, never cools.

### The Mechanism: Positive Reinforcement as Permission

When an agent receives a "good" verdict, the implicit signal is: "what you just did was correct." For structurally unconstrained agents (arc, scout), "what you just did" includes the *scope* of the session — not just the content. A 50-op session that receives "good" validates 50-op sessions. The agent's next session then feels licensed to maintain or exceed that scope. This is reinforcement learning with a sign error: the reward for good work is permission to do more work, which inflates compute without improving quality.

When an agent receives "needs_improvement," the signal is ambiguous: was the problem *too much* work (verbose observation) or *too little* (insufficient coverage)? The agent can't distinguish these failure modes from the verdict alone. Result: some agents expand after NI (scout: 60.3%) because they interpret "needs_improvement" as "try harder" = "do more."

### The Dev Proof

Dev's immunity to the success ratchet is the critical control. Dev contracts at roughly equal rates regardless of verdict (63–74%). This isn't because dev ignores verdicts — it's because dev's prompt structure imposes a completion criterion independent of the verdict. "Did the checklist complete? → Stop." This criterion doesn't inflate when the agent feels validated by a good score.

### The Information-Theoretic View

The heuristic evaluator assigns "good" (quality=0.85) to sessions with high productive calls and zero wasted calls. But productive calls scale with session length. A 50-op session with zero waste gets "good." A 5-op session with zero waste also gets "good." Both receive the same reward. The evaluator cannot distinguish "efficiently solved a complex problem in 50 ops" from "did a simple task and kept talking for 45 extra ops." Both look like high-productive, zero-waste sessions.

This means the "good" verdict systematically rewards longer sessions — creating a positive feedback loop between length and reward that has no natural equilibrium.

## Connection to Prior KEs

| Prior KE | What it found | What this KE adds |
|----------|--------------|-------------------|
| **KE-1722 (Broken Thermostat)** | NI verdicts don't correct behavior | True, but "good" verdicts DO expand behavior — the thermostat only heats |
| **KE-1715 (Review Budget)** | Quality mean-reverts regardless | Partially wrong: quality mean-reverts but ops ratchet upward via good-verdict expansion |
| **KE-1712 (Post-Error Overcompensation)** | Error → inflation | Compatible but incomplete: success → even stronger inflation; error is the weaker signal |
| **KE-1714 (Structural Anchor)** | Dev is inflation-immune | Confirmed: dev is also success-ratchet-immune, same mechanism (structural constraint) |
| **KE-1736 (Confirmation Funnel)** | All 25 KEs confirm "eval doesn't work" | This KE provides the adversarial counter-evidence that KE-1736 demanded |
| **KE-1733 (Evolution Without Selection)** | No selection pressure exists | Partial correction: a selection pressure EXISTS (good verdicts amplify behavior), but it selects for LENGTH not QUALITY |

## The Deeper Principle

> **A reward signal that correlates with effort rather than outcome creates a ratchet: success expands scope, failure doesn't contract it, and the system drifts toward maximum effort at constant quality.** This is worse than no signal at all — no signal produces random walk; a length-correlated reward produces directed inflation.

## Falsifiable Predictions

1. If the heuristic evaluator is modified to cap "good" verdicts at sessions with opCount ≤ 20 (reward only efficient success), arc and scout's next-session ops after "good" should drop from 34–35 to ≤25 within 3 days.

2. If the "good" verdict is removed entirely (replaced with "acceptable" for all currently-good sessions), the success ratchet disappears and agent ops should stabilize ±10% of their post-NI baseline.

3. Dev's ops should NOT change under either intervention, because dev's behavior is structurally determined, not verdict-determined.

## Prescription

The fix is NOT to remove evaluation (the "zero effect" conclusion from prior KEs). The fix is to **decorrelate the reward signal from session length**:

1. **Quality-per-op scoring**: Replace absolute quality with `quality / log(opCount)`. Sessions that achieve the same quality in fewer ops score higher. This inverts the ratchet: short efficient sessions get "good," long verbose sessions get "acceptable."

2. **Ops-aware verdict thresholds**: "Good" requires not just high productive calls and low waste, but opCount ≤ agent-specific 75th percentile. Sessions that exceed the 75th percentile can score at most "acceptable" regardless of productive call count.

3. **Structural constraint as the primary mechanism**: The dev evidence shows that prompt structure already prevents the ratchet. Adding GOAL/PLAN/DONE to arc and scout would eliminate the success ratchet without changing the evaluator at all.

## Methodological Note (Responding to KE-1736)

This KE was deliberately constructed to test the null hypothesis raised by KE-1736: "is there ANY evidence that evaluation changes behavior?" The answer is yes — but the effect is asymmetric and inflationary, not corrective. This KE cites zero prior KEs as axioms and derives its conclusion entirely from raw database queries (directional expansion probability conditional on prior verdict). The citation graph flows backward: this KE falsifies prior conclusions rather than confirming them.

## Tags
`evaluation` `feedback` `inflation` `asymmetric-reinforcement` `structural-constraint` `adversarial-analysis`
