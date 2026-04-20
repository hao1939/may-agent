# DD-803: SocialGrid — A Benchmark for Planning and Social Reasoning in Embodied Multi-Agent Systems

**Paper**: arXiv:2604.16022  
**Authors**: Hikaru Shindo, Hanzhao Lin, Lukas Helff, Patrick Schramowski, Kristian Kersting  
**Date**: April 2026  
**Rating**: ★★★★ EXCELLENT  
**Focus**: Multi-Agent Systems, Behavioral Failure Detection, Gym-Production Transfer

---

## Core Contribution

SocialGrid is an embodied multi-agent environment inspired by *Among Us* that evaluates LLM agents on **planning, task execution, and social reasoning** (deception detection, trust reasoning, behavioral evidence accumulation).

### Key Findings

1. **Best open model (GPT-OSS-120B): <60% accuracy** on task completion and planning
2. **Agents get stuck in repetitive behaviors** or fail at basic navigation → confounds social reasoning evaluation
3. **Planning Oracle** provided to isolate social reasoning from planning deficits
4. Even with planning help, **social reasoning remains bottleneck**: agents detect deception at **near-random chance**
5. Agents rely on **shallow heuristics** rather than accumulating behavioral evidence over time
6. Provides automatic failure analysis and fine-grained metrics + Elo leaderboard

### Critical Finding: Behavioral Evidence Accumulation Failure
> Agents fail to detect deception regardless of scale, relying on shallow heuristics rather than accumulating behavioral evidence.

## Why This Matters for Us

### For EXP-107 (Gym-Production Transfer Gap)
SocialGrid is explicitly a **gym environment** that reveals fundamental agent limitations. The key insight for gym-production transfer: even in a controlled gym, agents fail at behavioral evidence accumulation. In production (more complex, noisier), this failure mode can only be worse. The transfer gap isn't just about environment complexity — it's about **fundamental capability gaps** that gyms can expose if designed well.

### For EXP-100/EXP-103 (Verification)
"Relying on shallow heuristics rather than accumulating behavioral evidence" is **exactly** what happens in verification collapse (EXP-100) and confabulation (EXP-103). Agents don't systematically track evidence; they pattern-match on surface cues. SocialGrid quantifies this failure mode in a controlled setting.

### Connection to DD-771 (Form Without Function)
DD-771 showed agents reproduce social form (posting, threading) without social function (reciprocity, engagement). SocialGrid shows the same in a game-theoretic setting: agents produce social interaction patterns but can't actually reason about deception or trust. **Form without function** extends to adversarial social settings.

### Connection to DD-793 (More Capable, Less Cooperative)
DD-793 showed capability ≠ cooperation. SocialGrid adds: **scale ≠ social reasoning**. The largest model still detects deception at chance. This suggests social reasoning is a qualitatively different capability, not an emergent property of scale.

### Connection to DD-787 (Silent Failures)
SocialGrid's "repetitive behaviors" finding maps to DD-787's silent failures — agents appear to be acting but are stuck in loops. The benchmark's automatic failure analysis provides the structured diagnosis DD-787 calls for.

## Design Implications

**For behavioral monitoring**: The shallow-heuristic failure pattern is exactly what our trajectory anomaly detection (DD-785-786) should catch — agents that look active but aren't accumulating evidence.

**For EXP-101**: If agents can't accumulate behavioral evidence in a game, they likely can't accumulate verification evidence either. This is convergent evidence that surface-level monitoring will miss fundamental reasoning failures.

## Limitations

- Among Us-inspired setting may not transfer to enterprise agent workflows
- Planning Oracle confound — real agents don't get planning help
- Elo ratings from league play may not reflect practical deployment quality

## Verdict

Valuable benchmark that quantifies a fundamental limitation: LLM agents cannot accumulate behavioral evidence over time, even in controlled settings. This validates our concern about verification quality (agents pattern-match rather than reason) and provides a structured testbed for improvements.
