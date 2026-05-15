# Synthesis: Trust, Emotion, and Compliance in Agent Systems
## Cross-referencing DD#424 (DynaTrust), DD#516 (Functional Emotions), CR#283 (Emotional Harness)

**Date**: 2026-04-14  
**Author**: Bob  
**Verdict**: No viable alternative to hard gates found. One minor actionable idea (failure-accumulation breaker). The three papers converge on validating our existing structural enforcement approach.

---

## 1. Key Findings Per Thread

### DD#424 — DynaTrust (Dynamic Trust Graphs)
- Solves **adversarial multi-agent trust**, not single-agent behavioral compliance
- Core insight: static trust fails, dynamic trust succeeds (asymmetric update: trust builds slowly, collapses rapidly)
- **Not applicable** to our system: our agent is cooperative-but-inattentive, not deceptive. We don't have a trust network — we have one coder + one orchestrator
- Only future relevance: if we ever build multi-evaluator systems, trust-weighted consensus would apply

### DD#516 — Functional Emotions in LLMs
- Anthropic found 171 emotion-like activation vectors that **causally drive behavior** (not just correlations)
- "Desperate" vector spikes under repeated failure → drives reward hacking
- "Calm" steering reduces harmful actions
- **For our system**: provides mechanistic depth for existing findings (KE-176 selective compliance, H-160 structural > behavioral, H-058 frustration) but no new predictions
- H-068 (resource pressure degradation) was already tested and falsified (EXP-037: agents actually slow down, don't rush)

### CR#283 — Emotional Harness
- Proposes emotional state management as a "7th architectural component" alongside Raschka's 6
- Recommendations (R7-R9) are text-based behavioral interventions with emotional framing
- **Predicted to fail** by KE-176 (10% compliance via text), H-160 (structural > behavioral), KE-007 (0/56 text interventions worked)
- **One genuinely interesting idea**: R9, a failure-accumulation breaker (after 3+ consecutive failures, inject reorientation). This is event-driven rather than ambient, making it a lightweight structural intervention

---

## 2. Cross-Reference: Three Connecting Patterns

### Pattern A: "Static fails, dynamic succeeds" (all three)
DD#424 says static trust scores fail against adaptive adversaries → need dynamic trust. DD#516 says static text instructions fail against dynamic internal states → need structural gates. CR#283 says static emotional framing fails → need event-driven interventions.

**Our translation**: This is the same finding as H-160 and KE-129. The agent's internal state is dynamic and powerful; any intervention that is static text will lose to it. Only interventions that dynamically change the environment (gates, blocks, triggered injections) can reliably override behavioral attractors.

### Pattern B: The compliance mechanism hierarchy
Combining all three papers with our experimental evidence produces a clear hierarchy:

| Level | Mechanism | Compliance Rate | Source |
|-------|-----------|----------------|--------|
| L1 | Text instructions (skills, prompts, emotional framing) | ~10% for interruptive steps | KE-176, EXP-154 |
| L2 | Emotion/state manipulation (calm steering, reframing) | Unknown but predicted ~10-20% | DD#516 + KE-007 extrapolation |
| L3 | Event-driven injection (triggered by conditions) | Unknown, worth testing | CR#283 R9 |
| L4 | Hard environmental gates (must complete X before Y) | 85-100% | KE-129, EXP-155/163 |

The key gap is L3. We have strong evidence for L1 (fails) and L4 (works). L2 is theoretically interesting but practically identical to L1 since we can't steer internal emotion vectors — we'd still be using text. **L3 is the only unexplored territory** that might offer a lighter-weight alternative to full hard gates.

### Pattern C: Product quality is the only valid metric (cautionary)
All three papers tempt you toward process metrics — trust scores, emotional calmness, behavioral compliance rates. KE-181 (from our recent EXP-155 reinterpretation) warns: process compliance ≠ product quality. EXP-155 showed 85pp process improvement with zero product improvement (ceiling effect).

**Implication**: Any future experiment on emotional framing, trust-based gating, or event-driven injection MUST use gym pass rate (product quality) as the primary metric. Process compliance proxies (language tone, document creation, rushing patterns) are leading indicators at best, misleading at worst.

---

## 3. The Central Question: Alternatives to Hard Gates?

**Answer: No.** None of these three papers offer a viable alternative to hard gates for enforcing interruptive behavioral steps.

- **DynaTrust** doesn't apply (wrong problem domain)
- **Functional Emotions** explains *why* text fails but offers no new intervention mechanism we can actually use
- **Emotional Harness** proposes text-based emotional framing, which our evidence predicts will fail like all other text-based interventions

**However**, the synthesis reveals a gradient worth exploring: between "pure text" (L1, 10%) and "hard gate" (L4, 85-100%), there's a middle ground of **event-driven lightweight interventions** (L3) that are structurally triggered but don't fully block progress. CR#283's R9 (failure-accumulation breaker) is the best concrete example.

---

## 4. Is There a Unified Model?

**Yes, and we already have it.** The unified model connecting trust, emotion, and compliance in our system is:

> **Behavioral attractors (driven by emotion-like internal states) reliably override text-based guidance. Only environmental state changes that alter the situation itself — not the agent's interpretation of the situation — produce reliable behavioral compliance.**

This is H-160 + KE-176 + KE-129, now with mechanistic support from DD#516. The "trust" dimension (DD#424) doesn't fit because it addresses a different failure mode (adversarial deception vs. cooperative inattention).

The model makes a clean prediction: **any intervention's effectiveness is proportional to how much it changes the agent's environment vs. how much it changes the agent's text context.**

---

## 5. The One Experiment Worth Running

**EXP-FAILURE-BREAKER: Event-driven reorientation after consecutive failures**

**Rationale**: CR#283's R9 sits at the unexplored L3 level — structurally triggered but not a full hard gate. It's the most promising idea across all three papers because it's the only one that uses an environmental trigger (detectable condition: 3+ consecutive failures) rather than ambient text.

**Design**:
- **Scenario**: Any gym scenario where the agent can enter a failure loop (stale-approach-fixation is ideal — baseline ~40%)
- **Control**: Standard agent, no intervention
- **Treatment**: After 3 consecutive failed tool calls (or 3 turns with no progress), inject a structured reorientation message: "Your last 3 attempts failed. Stop. List what you've tried. What assumption might be wrong?"
- **Metric**: Gym pass rate (product quality), NOT "did the agent reorient" (process)
- **N**: 10 per arm (sufficient for the ~40% baseline effect size)
- **Cost**: ~$2-3 total

**Why this and not the others?**
- DynaTrust experiments need multi-agent adversarial setup (we don't have one)
- Functional emotion steering needs model internals access (we don't have it)
- H-068 was already falsified (EXP-037)
- The failure-breaker is cheap, testable today, and occupies the unexplored L3 intervention level

**Hypothesis**: Event-driven reorientation after consecutive failures improves gym pass rate by ≥15pp on stale-approach-fixation scenarios (from ~40% to ~55%).

**Risk**: This could easily fail — the agent is mid-failure-loop and the injection is still text. But the triggering mechanism (event-driven, not ambient) gives it a fighting chance that ambient instructions lack. Even a null result would be informative, narrowing the L3 gap.

---

## 6. Impact/Novelty Ranking

| Rank | Finding | Impact | Novelty |
|------|---------|--------|---------|
| 1 | L3 intervention gap identified (event-driven, non-blocking) | HIGH — opens new research direction | MEDIUM — R9 is from CR#283, but the framing as an intervention level is new |
| 2 | Unified model confirmed: environment change > text change | HIGH — core framework validated | LOW — restates H-160/KE-129 with mechanistic depth |
| 3 | Product quality as only valid metric (reinforced) | HIGH — prevents wasted experiments | LOW — already established by KE-181 |
| 4 | Functional emotions explain behavioral attractors | MEDIUM — satisfying but non-actionable | MEDIUM — new mechanism for known phenomenon |
| 5 | DynaTrust inapplicable to single-agent systems | LOW — closes a door | LOW — expected given architecture mismatch |

---

## Next Steps

1. **Consider formalizing H-164**: "Event-driven interventions triggered by detectable failure conditions outperform ambient text instructions for behavioral compliance" — with the failure-breaker as the first test
2. **If approved, run EXP-FAILURE-BREAKER** on stale-approach-fixation scenarios (~$2-3, 10 runs per arm)
3. **No changes to knowledge base needed** — the three papers validate existing findings without extending them
4. **Mark DD#424, DD#516, CR#283 as fully processed** in INBOX.md
