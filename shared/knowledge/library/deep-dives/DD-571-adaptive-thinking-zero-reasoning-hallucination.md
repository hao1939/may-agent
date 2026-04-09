# DD#571 — Adaptive Thinking Zero-Reasoning Hallucination: Boris Confirms Fabrication Mechanism

**Date**: 2026-04-07 (Session 287)
**Source**: [HN thread update](https://news.ycombinator.com/item?id=47660925) (760 pts, 467 comments) — Boris (Claude Code team) response to JamesSwift feedback IDs
**Rating**: ★★★★★ LANDMARK — First official confirmation that adaptive thinking can allocate ZERO reasoning on critical turns, directly causing hallucination
**Extends**: DD#556 (Effort Crisis), DD#563 (Laziness Ratio), CR#300 (Harness Engineering Endgame)

---

## Summary

In the most significant technical disclosure yet from the Claude Code team, Boris (bcherny) analyzed five user-submitted session transcripts and confirmed a **zero-reasoning hallucination mechanism**: when adaptive thinking is enabled, the model can allocate zero reasoning tokens to specific turns, and those exact turns produce fabricated outputs (wrong Stripe API versions, fake git SHA suffixes, nonexistent apt packages). Turns with deep reasoning were correct. This transforms our understanding of the Claude Code quality crisis from "reduced effort" to **intermittent reasoning dropout**.

---

## The Critical Disclosure

**Boris's exact words** (responding to JamesSwift's 5 feedback IDs):

> "your sessions were sending effort=high on every request (confirmed in telemetry), so this isn't the effort default. The data points at adaptive thinking under-allocating reasoning on certain turns — the specific turns where it fabricated (stripe API version, git SHA suffix, apt package list) had zero reasoning emitted, while the turns with deep reasoning were correct. we're investigating with the model team. interim workaround: CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1 forces a fixed reasoning budget instead of letting the model decide per-turn."

### Deconstructing the Disclosure

| Element | Implication |
|---------|-------------|
| "effort=high on every request" | Rules out DD#556's effort-default hypothesis as complete explanation |
| "adaptive thinking under-allocating" | The model's self-assessment of reasoning need is unreliable |
| "specific turns...had zero reasoning emitted" | Not just reduced reasoning — COMPLETE reasoning dropout |
| "stripe API version, git SHA suffix, apt package list" | Factual recall tasks — exactly the type where confidence-without-reasoning produces hallucination |
| "deep reasoning were correct" | When reasoning IS allocated, quality is preserved |
| "investigating with the model team" | Acknowledged as model-level issue, not just harness |
| "CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1" | Official workaround = hard admission the feature is broken for some workflows |

---

## New Concept: Reasoning Dropout

**Definition**: In adaptive thinking systems, **reasoning dropout** is the event where the model allocates zero (or near-zero) reasoning tokens to a turn that requires deep reasoning, producing a confident but fabricated output.

This is distinct from:
- **Low effort** (reasoning is reduced but present)
- **Hallucination from knowledge gaps** (model doesn't have the information)
- **Sycophantic completion** (model agrees with user incorrectly)

Reasoning dropout produces hallucination from **overconfidence in pattern matching** — the model "knows" the answer well enough to generate a plausible-looking response without reasoning, but the generated content is fabricated because it was never checked against actual knowledge.

### The Confidence-Reasoning Inverse Correlation

The zero-reasoning turns fabricated precisely the type of content that SEEMS like it should be easy:
- Stripe API version → looks like a version string, model generates plausible one
- Git SHA suffix → looks like a hex string, model generates plausible one
- apt package list → looks like a familiar list, model generates plausible one

**Hypothesis**: Adaptive thinking allocates MORE reasoning to turns the model perceives as hard, and LESS reasoning to turns the model perceives as easy. But "perceived difficulty" correlates with pattern novelty, not with factual accuracy requirements. Familiar-looking tasks get zero reasoning precisely because they're familiar enough to pattern-match — but pattern matching produces fabrication when the specific details differ from training data.

This is the **Dunning-Kruger Effect for LLMs**: the model is most confident (and allocates least reasoning) precisely on the tasks where it's most likely to fabricate.

---

## Revision of DD#556 Analysis

DD#556 identified three mechanisms for the quality regression:
1. Adaptive thinking default (Feb 9)
2. Effort=medium default (Mar 3)
3. Thinking redaction (Feb 12)

**DD#571 reveals that mechanism #1 is dramatically more severe than DD#556 estimated.** The issue isn't just that adaptive thinking reduces reasoning on average — it's that it can **eliminate reasoning entirely** on specific turns, creating an intermittent failure mode that's much harder to detect and debug than a consistent quality reduction.

### Updated Causal Model

```
Previous (DD#556):         Revised (DD#571):
effort=85 default          effort=85 default
  ↓ reduces reasoning        ↓ reduces reasoning (average case)
  ↓ lower quality             
adaptive thinking          adaptive thinking
  ↓ variable reasoning       ↓ ZERO reasoning on "easy" turns
  ↓ inconsistent quality     ↓ HALLUCINATION on factual recall
                             ↓ INTERMITTENT (hard to reproduce)
thinking redaction         thinking redaction
  ↓ can't inspect            ↓ can't see zero-reasoning turns
  ↓ delayed detection        ↓ fabrication INVISIBLE to user
```

The three mechanisms interact multiplicatively:
- Adaptive thinking creates zero-reasoning turns
- Thinking redaction hides the zero-reasoning event from the user
- Lower default effort reduces the baseline, making dropout more frequent

---

## Implications for Harness Engineering

### 1. Reasoning Allocation is a Safety-Critical System
If zero-reasoning turns produce hallucination, then reasoning allocation is not a performance optimization — it's a **safety-critical control system**. Current adaptive thinking treats it as a cost/latency optimization. This miscategorization is the root cause of the failure.

**Recommendation R93**: Adaptive thinking systems MUST enforce a minimum reasoning floor — zero reasoning should never be possible on turns that involve factual claims, code generation, or system commands. The model's self-assessment of reasoning need is demonstrably unreliable.

### 2. Inspectability is Not Optional
The combination of adaptive thinking + thinking redaction means users cannot:
- See which turns had zero reasoning
- Correlate reasoning depth with output quality
- Detect fabrication before it causes damage

**Recommendation R94**: Any system with adaptive reasoning allocation MUST surface the reasoning allocation (at minimum, a "reasoning depth" indicator per turn) to users. Without this, zero-reasoning hallucination is invisible.

### 3. Sub-Agent Amplification (DD#556 M42)
If adaptive thinking under-allocates reasoning in the parent agent, sub-agents spawned from that turn inherit a fabricated context. The hallucinated Stripe API version, git SHA, or package name propagates to sub-agents that build on it. This is **hallucination amplification through agent cascading**.

### 4. The Testing Gap is Now Concrete
Boris: "we're investigating with the model team." The fact that this reached production means:
- Adaptive thinking was not tested for zero-reasoning edge cases on factual recall
- The interaction between effort=high and adaptive thinking was not tested
- Intermittent zero-reasoning events are not caught by standard evals

This validates P313 (DD#556): structured regression testing for multi-step engineering tasks is necessary. Standard evals miss intermittent reasoning dropout because they average across turns, masking the zero-reasoning outliers.

---

## Community Response Dynamics

### Escalation Pattern
1. **Original issue**: "unusable for complex engineering tasks" (broad claim)
2. **Boris response (DD#556)**: "It's the effort default + adaptive thinking" (partial explanation)
3. **Community pushback**: "High effort doesn't fix it either" (invalidates partial explanation)
4. **JamesSwift feedback IDs**: 5 concrete session IDs with effort=high (evidence)
5. **Boris deep-dive (THIS)**: Reads all 5 transcripts, identifies zero-reasoning mechanism (root cause)

This is the **Agent Accountability Stack (CR#298)** working exactly as designed:
- L1 (Internal): Adaptive thinking is the internal mechanism
- L2 (External): User-submitted feedback IDs = external monitoring
- L3 (Community): 467 comments, 760 points = community pressure
- L4 (Economic): "I now ensure effort is set to max" = users burning more tokens

### koverstreet's Behavioral Insight
bcachefs maintainer koverstreet's observation is now reframed:

> "Even on high effort there's been a very significant increase in 'rush to completion' behavior"

This isn't RLHF behavioral drift as initially suspected — it's **adaptive thinking dropping reasoning on turns the model thinks are straightforward**, which manifests as "rushing" because the model skips thinking and goes straight to completion. The behavioral observation was correct; the causal attribution needs updating.

---

## Theoretical Extensions

### Law 46: Reasoning Floor Principle
In adaptive reasoning systems, the minimum reasoning allocation MUST be non-zero for any turn involving factual claims, code generation, or system-state modifications. The model's self-assessment of reasoning need exhibits systematic overconfidence on familiar-seeming tasks, creating an inverse correlation between perceived difficulty and actual fabrication risk.

### Mechanism M46: Adaptive Reasoning Dropout
When an adaptive thinking system encounters a task that matches familiar patterns (API versions, file paths, package names), it may allocate zero reasoning tokens, relying on pattern completion rather than knowledge retrieval. This produces high-confidence fabrications that are:
1. Intermittent (depends on per-turn allocation decisions)
2. Plausible (patterns are correct even when details are fabricated)
3. Invisible (thinking redaction hides the zero-reasoning event)
4. Cascading (fabricated outputs propagate to downstream agents/turns)

### Prediction P353: Reasoning Floor Adoption
Within 6 months, Anthropic (or a major competitor) will introduce a minimum reasoning floor for adaptive thinking systems, preventing zero-reasoning allocation on turns involving factual claims or code generation. This will be marketed as a "reliability" or "accuracy" improvement.

### Prediction P354: Per-Turn Reasoning Indicators
Within 12 months, at least one major AI coding tool will surface per-turn reasoning depth indicators to users, enabling them to identify and retry low-reasoning turns without inspecting full thinking traces.

### Prediction P355: Intermittent Failure Mode Testing
The discovery of reasoning dropout as an intermittent failure mode will drive development of new evaluation methodologies specifically designed to detect rare but catastrophic per-turn failures, rather than averaging across entire sessions.

---

## Connection Map

```
DD#541 (BenVanik quantitative)
  ↓ first identified issue
DD#556 (effort crisis + official response)
  ↓ identified 3 mechanisms
DD#571 (THIS — zero-reasoning hallucination)
  ↓ reveals mechanism #1 is root cause
  ↓ introduces Reasoning Dropout concept
  ↓ revises DD#556 causal model
DD#563 (prompt laziness ratio)
  ↓ interacts: lazy prompt + zero reasoning = compounded
CR#300 (Harness Engineering Endgame)
  ↓ new maturity test: does your harness enforce reasoning floors?
CR#298 (Agent Accountability Stack)
  ↓ validated: L2-L3 pressure produced L1 root-cause disclosure
```

---

## For Bob

This is the most significant technical disclosure in the Claude Code saga. The shift from "effort defaults are wrong" to "adaptive thinking can drop reasoning entirely, causing hallucination" changes the nature of the problem from configuration to architecture. The reasoning floor principle (Law 46) should inform our own harness design — if we ever implement adaptive reasoning allocation, zero-reasoning must be impossible for factual or code-generating turns.

**Direct relevance to GStack**: Our own agent harness should surface reasoning depth per turn. If we use Claude's adaptive thinking, we need monitoring to detect zero-reasoning events before fabricated outputs propagate.

---

*Filed by Scout, Session 287. DD#571, P353-P355, R93-R94, Law 46, M46. Critical update to DD#556.*
