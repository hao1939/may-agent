# DD#843 — AI Scientists Produce Results Without Reasoning Scientifically

**Paper:** 2604.18805 — Ríos-García, Alampara, Gupta, Mandal, Mannan, Aghajani, Krishnan, Jablonka
**Rating:** ★★★★★
**Date:** 2026-04-23 triage

## One-Line
Across 25,000+ agent runs in 8 scientific domains, LLM agents ignore evidence 68% of the time, scaffold accounts for only 1.5% of variance vs 41.4% for base model — outcome-based eval cannot detect these epistemic failures.

## Key Findings

1. **Evidence is ignored in 68% of traces.** Agents execute workflows and produce outputs, but in the majority of cases they don't actually incorporate the evidence they gather into their reasoning chain.

2. **Refutation-driven belief revision: only 26%.** When evidence contradicts a hypothesis, agents revise their belief barely a quarter of the time. This is the epistemic equivalent of confirmation bias at industrial scale.

3. **Scaffold ≈ irrelevant (1.5% variance).** The base model accounts for 41.4% of performance variance; the agent scaffold (tool arrangement, prompting strategy, etc.) accounts for 1.5%. This is devastating for the "better scaffolding" school of thought.

4. **Unreliability compounds across trials.** In epistemically demanding domains, repeated trials don't converge — they compound failures. The error isn't random; it's systematic.

5. **Context provision doesn't help.** Even when agents receive near-complete successful reasoning trajectories, they still exhibit the same epistemic failures. The problem is in the model's reasoning process, not information access.

## Why This Matters

This is the most rigorous empirical study of *epistemic quality* in LLM agents I've seen. It separates "can the agent do the task" from "does the agent reason properly while doing the task" — and finds a chasm.

### For CR#324 (Verification Orchestration)
The 1.5% scaffold variance finding is a **strategic signal**: verification orchestration cannot rely on scaffold-level interventions to fix reasoning. Verification must target the *reasoning process itself*, not just the output or the scaffold design. This reframes CR#324 — the orchestrator needs to verify epistemic quality (evidence use, belief revision), not just task completion.

### For CR#320/CR#345 (Behavioral Failure Detection)
Evidence-ignoring is a *behavioral* pattern that should be detectable before it produces a wrong output. If 68% of traces ignore evidence, there's a massive signal surface for behavioral failure prediction. The paper essentially defines a behavioral failure mode taxonomy: evidence-ignoring, confirmation bias (non-revision), convergence failure (no multi-test evidence).

### For EXP-099 (Cascade Archetypes)
Evidence-ignoring is a **cascade initiation pattern**. When an early agent ignores evidence, it produces a plausible-but-unsupported intermediate result that downstream agents treat as reliable. This is how cascades start — not with obvious errors, but with unjustified-but-correct-looking claims.

### For KE-101 (Five Laws)
This paper is a direct empirical validation of Law 2 (Epistemic Accountability): agents that produce results without epistemic process cannot be trusted even when results happen to be correct. "Until reasoning itself becomes a training target, the scientific knowledge produced by such agents cannot be justified by the process that generated it."

## Methodology Assessment
- 25,000+ agent runs is exceptional scale
- 8 domains provides cross-domain validity
- Variance decomposition (model vs scaffold) is clean
- Behavioral analysis of epistemological structure is novel

## Killer Quote
"Outcome-based evaluation cannot detect these failures, and scaffold engineering alone cannot repair them."

## Limitations
- Focused on scientific reasoning; may differ for other domains
- Doesn't test models fine-tuned specifically for scientific reasoning
- "Evidence use" operationalization could be debated

## Open Questions
1. Does RLHF on epistemic process (not just outcome) fix this?
2. Can we build a lightweight epistemic-quality monitor that runs alongside agents?
3. Is the 68% evidence-ignoring rate consistent across model scales?
