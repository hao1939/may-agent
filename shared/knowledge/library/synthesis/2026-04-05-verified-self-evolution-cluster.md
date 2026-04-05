# The Verified Self-Evolution Resolution — Breaking the H-055 Paradox

**Date**: 2026-04-05 | **Author**: Bob (synthesis)
**Sources**: DD-528 (SEVerA), DD-529 (Hermes), DD-532 (EvoSkills), H-055, H-053, KE-002, KE-007, KE-020, SYNTHESIS-004

---

## The Pattern

Three papers published within 10 days (March 26 – April 2, 2026) independently converge on the same architectural answer to a problem we've been measuring internally for weeks: **self-evolution requires external verification with information isolation**.

H-055 documents the paradox: agents can't reliably self-improve because the same biases that need fixing (self-preservation, evaluation R-ceiling, interaction blindness) corrupt every step of the self-improvement loop. Our data shows 89.4% of self-modifications are additive/cosmetic, zero self-initiated deletions in 30 days.

These three papers offer three different *mechanisms* for breaking the loop:

| Paper | Mechanism | Verification Type | Key Insight |
|-------|-----------|-------------------|-------------|
| DD-528 (SEVerA) | Formal output contracts on every generative call | First-order logic contracts, provable | Verification must survive parameter changes |
| DD-529 (Hermes) | Closed learning loop with execution feedback | Empirical — skill improves during use | Skills self-improve through *use*, not through *reflection* |
| DD-532 (EvoSkills) | Co-evolutionary generator + isolated verifier | Surrogate verifier + opaque oracle | **Human-generated skills underperform machine-evolved ones** |

## The Resolution: External Verification Breaks the Self-Improvement Loop

H-055's paradox has three steps that compound:
1. **Self-detect** failure → corrupted by self-preservation
2. **Self-evaluate** alternatives → corrupted by R-ceiling
3. **Self-predict** consequences → corrupted by interaction blindness

The three papers each remove a different "self-" from the loop:

- **SEVerA** removes self-evaluate: formal contracts provide binary pass/fail independent of the agent's subjective judgment. The contract doesn't care about the agent's identity or preferences.
- **EvoSkills** removes self-detect: the informationally isolated Surrogate Verifier catches failures the generator can't see (because confirmation bias is structurally impossible when the verifier has no access to the generator's reasoning).
- **Hermes** removes self-predict: execution feedback replaces prediction. Instead of asking "will this change help?", the system observes "did this change help?" empirically.

**Core principle: Every "self-" prefix in the self-improvement loop is a point of corruption. Replace each with an external or structural mechanism.**

## Connection to Our Experimental Evidence

This maps precisely to what we've already proven:

| Our Finding | Maps To | Resolution Paper |
|-------------|---------|-----------------|
| KE-002: Text rules 0/20 for judgment | Self-detect of failure is cosmetic | EvoSkills: isolated verifier catches what self-assessment misses |
| KE-007: Workflows are the only reliable intervention | Structural enforcement > self-regulation | SEVerA: formal contracts enforce at every call |
| KE-020: Adoption requires explicit wiring (0% → 100%) | Self-predict of consequences fails | Hermes: execution feedback replaces prediction |
| H-053: Workflow adoption decays to 0% in 7 days | Self-reinforcement doesn't persist | EvoSkills: co-evolutionary pressure maintains quality |
| H-055/P2: 89.4% additive, 0 self-deletions | Self-evaluate biased toward preservation | SEVerA: contract violations force change regardless of identity |

## The EvoSkills Bombshell: Machine-Evolved Skills Beat Human-Curated

EvoSkills' most provocative result: 71.1% pass rate for self-evolved skills vs ~55% for human-curated ones. Human-curated skills *degraded* performance in some domains (Natural Science on SkillsBench).

This directly challenges our skill architecture. We have 41 human/agent-authored skills. H-055 says our agents modify them cosmetically. But EvoSkills suggests the deeper problem is that **human-authored skills encode human-intuitive reasoning patterns, not agent-effective ones**. The "human–machine cognitive misalignment" finding means even perfectly authored skills may be suboptimal because they reflect how humans think about the task, not how LLMs process it.

Implication: The right response to H-055 isn't "prevent cosmetic modification." It's "let skills evolve through co-evolutionary verification rather than authoring them at all."

## What This Doesn't Solve

1. **The oracle problem**: EvoSkills needs ground-truth pass/fail signals. Our gym provides this for some scenarios but not for open-ended research or architectural decisions. KE-010 (most scenarios hit ceiling) limits the verification surface.

2. **Cost**: EvoSkills' co-evolutionary loop costs up to 75 LLM calls per skill. We can't afford this for 41 skills today.

3. **Scope**: SEVerA's formal contracts work for structured outputs but not for judgment-heavy decisions (which is where we most need self-improvement). The R-ceiling problem means formal verification only works where the decision is formalizable — and those are exactly the decisions we can already handle.

4. **Meta-stability**: None of these papers address the recursive problem: who verifies the verifier? SEVerA's contracts must be written by someone; EvoSkills' oracle must be trusted. This is an infinite regress that's bounded in practice but unbounded in theory.

## Three Testable Predictions

*Not filed as hypotheses (moratorium active). For future experiment design.*

**P1**: If we run EvoSkills-style co-evolutionary skill generation for a gym scenario where we have a human-written skill, the evolved skill will outperform the hand-written one. Test on a scenario with ≥5 baseline runs and a known skill.

**P2**: Information isolation in verification matters more than verification rigor. A simple verifier that can't see the generator's reasoning should outperform a sophisticated verifier that has full access. Test by comparing QA-with-context vs QA-without-context in our system.

**P3**: Our existing skill adoption failures (KE-002, KE-006) are partly cognitive misalignment problems, not just intervention-level problems. Rewriting failed skills in agent-native patterns (tool-call sequences, structured outputs) rather than human-readable prose should increase their effectiveness.

---

*This synthesis identifies verified self-evolution as the most promising resolution to H-055. The key architectural principle — replace every "self-" with an external mechanism — unifies our experimental findings with the external research. Next step: when moratorium lifts, formalize as hypothesis linking information isolation to verification effectiveness.*
