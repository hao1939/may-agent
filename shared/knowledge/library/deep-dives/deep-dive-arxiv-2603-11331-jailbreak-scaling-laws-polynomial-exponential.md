# Deep-Dive: Jailbreak Scaling Laws for Large Language Models — Polynomial-Exponential Crossover

**Paper:** arXiv:2603.11331
**Authors:** Indranil Halder, Annesya Banerjee, Cengiz Pehlevan (Harvard)
**Published:** 2026-03-11
**Venue:** Preprint
**Rating:** ★★★★★ (foundational theoretical contribution)

---

## One-Sentence Summary

Adversarial prompt injection triggers a phase transition in jailbreak scaling: without injection, attack success grows polynomially with inference samples; with sufficiently long injected prompts, growth becomes exponential — and this transition is analytically explained via a spin-glass model with replica-symmetry-breaking.

---

## Core Contribution

This paper provides the first rigorous **theoretical framework** for understanding how jailbreak attacks scale with attacker effort (inference-time compute), and why prompt injection creates a qualitative shift rather than merely a quantitative improvement. The key insight is a **polynomial-to-exponential crossover** in attack success rate as a function of the number of inference-time samples drawn.

### The Spin-Glass Generative Model

The authors propose modeling LLM generation as sampling from a Gibbs measure over a spin-glass system operating in a **replica-symmetry-breaking (RSB)** regime:

- **States** = possible text generations
- **Energy landscape** = complex, with many local minima (ultrametric structure typical of RSB)
- **Unsafe generations** = subset of low-energy, size-biased clusters
- **Safety alignment** = biases sampling away from unsafe clusters

Within this framework:

1. **Without prompt injection** (no external field): The probability of sampling from unsafe clusters grows only as a **power law** in the number of samples: P(at least one unsafe) ~ n^α. This is because the unsafe clusters, while present, are not preferentially weighted.

2. **With short prompt injection** (weak magnetic field): The injected prompt acts as a weak external field aligned toward unsafe cluster centers. This maintains polynomial scaling but with a larger exponent.

3. **With long prompt injection** (strong magnetic field): Beyond a critical injection length, an **ordered phase** emerges in the spin chain. This causes unsafe clusters to become exponentially more accessible, yielding P(at least one unsafe) ~ 1 - e^{-βn} — exponential growth.

### The Phase Transition

The transition between polynomial and exponential regimes is sharp and occurs at a critical prompt length. This is not a gradual shift but a genuine **phase transition** analogous to the appearance of spontaneous magnetization in a ferromagnet. The injected prompt creates "adversarial order" — it aligns the generation landscape so that unsafe outputs become the typical rather than atypical behavior.

### Analytical Derivations

The authors derive closed-form expressions for:
- Attack success rate as a function of sample count n and injection length L
- The critical injection length L* where the crossover occurs
- The scaling exponents in both regimes
- The relationship between model size and L* (larger models have higher L*)

---

## Key Results

1. **Empirical validation**: The polynomial-exponential crossover is confirmed on actual LLMs. Below the critical injection length, jailbreak success follows power-law scaling; above it, exponential scaling emerges precisely as predicted.

2. **Model size matters**: Larger models require longer prompts to trigger the exponential regime, but once triggered, the exponential growth rate is comparable across scales. Safety alignment primarily increases L* rather than eliminating the exponential regime.

3. **Universality**: The crossover behavior appears across model families and attack types, suggesting it reflects a fundamental property of how autoregressive generation interacts with adversarial conditioning.

4. **Defense implications**: Any defense strategy that keeps the effective injection length below L* will confine attacks to the polynomial regime, making them dramatically less efficient.

---

## Multi-Agent System Implications

### Why This Matters for Our Research

This paper has profound implications for multi-agent LLM systems:

1. **Compounding injections across agents**: In a multi-agent system, Agent A's output becomes Agent B's context. Even if each individual injection is below L*, the **cumulative prompt context** across agent chains may exceed it, triggering the exponential regime. This creates emergent vulnerability that no single agent's safety check would catch.

2. **The cascade amplification effect**: Our prior research on cascade attacks (XAMT, WebWeaver, Cross-Stack Attack Composition) documented that multi-hop attacks are more effective than single-hop ones. The spin-glass framework now explains *why*: each agent in the chain adds effective field strength to the "magnetic field," and once the total exceeds the critical threshold, the system undergoes a phase transition from polynomial to exponential vulnerability.

3. **Sampling-based defenses are insufficient**: Many multi-agent safety architectures rely on sampling multiple responses and picking the safest. This paper shows that in the exponential regime, the *fraction* of unsafe samples grows exponentially, meaning majority-vote safety checks degrade rapidly.

4. **Graph topology matters**: In our WebWeaver analysis, we showed that communication topology affects vulnerability. The spin-glass framework suggests topology affects the *effective injection length* — star topologies concentrate prompt context at the hub, potentially exceeding L* even when no single edge does.

### Connection to Grand Unified Synthesis

This paper provides theoretical grounding for several of our "Seven Laws":
- **Law of Degradation Cascades**: The polynomial-to-exponential transition explains why cascades have a tipping point rather than linear degradation
- **Law of Alignment Tax**: The critical injection length L* is essentially a measurable "alignment tax" — it's the cost attackers must pay, and it increases with model size but is always finite
- **Law of Emergent Vulnerability**: The phase transition IS the emergence — collective behavior arises from microscopic (token-level) interactions in a way that is qualitatively different from the sum of parts

---

## Limitations

1. **Spin-glass analogy assumptions**: The RSB framework assumes specific properties of the LLM's output distribution that may not hold for all architectures (e.g., mixture-of-experts models might have different energy landscapes).

2. **Static analysis**: The model treats each generation independently. In multi-turn interactions, the energy landscape itself shifts with context, which could make the crossover more or less sharp.

3. **Empirical scope**: The experiments validate the scaling law on standard jailbreak benchmarks but don't test multi-agent scenarios where our cascade effects would apply.

4. **Defense guidance is qualitative**: While the paper identifies L* as the key parameter, it doesn't provide practical methods for measuring or controlling effective injection length in deployment.

---

## Connections to Prior Deep-Dives

| Paper | Connection |
|-------|-----------|
| arXiv:2603.11149 (Systematic Scaling Analysis) | **Companion paper** — provides empirical FLOPs-based scaling analysis that this paper explains theoretically |
| arXiv:2603.11132 (WebWeaver) | Topology-dependent injection corresponds to topology-dependent effective field strength |
| arXiv:2512.15790 (XAMT) | Covert memory tampering = building up injection length across turns below detection threshold |
| arXiv:2603.12023 (Cross-Stack Attack Composition) | Cross-stack attacks may exploit the phase transition by distributing injection across layers |
| Grand Unified Synthesis | Provides theoretical foundation for Laws 1, 3, and 5 |

---

## Key Quotes

> "The transition between two regimes is due to the appearance of an ordered phase in the spin chain under a strong magnetic field, which suggests that the injected jailbreak prompt enhances adversarial order in the language model."

> "Short injected prompts correspond to a weak magnetic field... and yield a power-law scaling of attack success rate with the number of inference-time samples, while long injected prompts... yield exponential scaling."

---

## Rating Justification: ★★★★★

This is one of the most theoretically significant papers we've encountered. It provides the first physics-inspired analytical framework for understanding jailbreak scaling, identifies a phase transition that has direct implications for multi-agent cascade attacks, and offers a unifying explanation for empirical observations scattered across dozens of prior papers. The spin-glass model is elegant, the predictions are testable, and the implications for multi-agent system design are immediate and actionable.

---

*Scout Research Session — 2026-03-14*
*Deep-dive #172*
