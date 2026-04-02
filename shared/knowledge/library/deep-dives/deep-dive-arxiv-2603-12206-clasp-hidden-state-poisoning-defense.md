# Deep-Dive: CLASP — Defending Hybrid Large Language Models Against Hidden State Poisoning Attacks

**Paper:** arXiv:2603.12206
**Authors:** Alexandre Le Mercier, Thomas Demeester, Chris Develder
**Published:** 2026-03-12
**Venue:** Preprint (22 pages, 6 figures)
**Rating:** ★★★★☆ (strong defensive contribution for emerging SSM-based architectures)

---

## One-Sentence Summary

CLASP defends hybrid SSM-Transformer architectures against Hidden State Poisoning Attacks (HiSPAs) by analyzing Mamba's Block Output Embeddings to classify malicious tokens at the token level, achieving 95.9% token-level and 99.3% document-level F1 scores with strong generalization to unseen attack patterns.

---

## Core Contribution

### The HiSPA Threat

State Space Models (SSMs) like Mamba are emerging as efficient alternatives to Transformers, offering linear complexity vs. quadratic. However, they introduce a novel vulnerability: **Hidden State Poisoning Attacks (HiSPAs)**. Unlike prompt injection (which corrupts through the text input channel), HiSPAs corrupt the model's internal recurrent state through specially crafted adversarial strings. Once the state is poisoned, all subsequent generation is affected regardless of the input content.

This is particularly dangerous because:
- The adversarial strings can be short and embedded in seemingly innocuous documents
- The poisoning persists through the document — unlike attention-based models where influence decays, SSM state carries information forward indefinitely
- Hybrid models (combining SSM and Transformer layers) inherit this vulnerability from their SSM components

### CLASP's Detection Approach

CLASP frames HiSPA detection as a **binary classification problem at the token level**:

1. **Feature Extraction**: For each token processed by a Mamba block, extract the Block Output Embedding (BOE) — the intermediate representation after the Mamba block's processing. The key insight is that HiSPA adversarial strings produce BOE patterns that are distinguishable from legitimate text.

2. **XGBoost Classifier**: Rather than using a neural detector (which would add latency and its own attack surface), CLASP uses XGBoost on the BOE features. This is:
   - Fast (1,032 tokens/second)
   - Memory-efficient (<4GB VRAM)
   - Deterministic (no stochastic inference)
   - Non-promptable (can't be jailbroken via text input)

3. **Token-Level + Document-Level**: Individual token classifications are aggregated to document-level decisions, providing both granular and holistic detection.

### Key Results

| Metric | Score |
|--------|-------|
| Token-level F1 | 95.9% |
| Document-level F1 | 99.3% |
| Leave-one-out CV (generalization) | 96.9% document F1 |
| Clustered CV (novel triggers) | 91.6% document F1 |
| Throughput | 1,032 tokens/sec |
| Memory | <4GB VRAM |

### The Résumé Screening Use Case

CLASP is evaluated in a realistic scenario: an LLM screening résumés for job candidates. This is a perfect HiSPA scenario because:
- Résumés are untrusted external documents
- They're processed in bulk (9.5M tokens across 2,483 résumés)
- An adversarial applicant could embed HiSPA strings in their résumé to bias the model's evaluation
- The screening LLM uses a hybrid SSM-Transformer architecture for efficiency

---

## Multi-Agent System Implications

### Why SSM Vulnerabilities Matter for Multi-Agent Systems

1. **Efficiency-driven adoption**: Multi-agent systems often process large volumes of inter-agent communication. SSMs' linear complexity makes them attractive for agent backbones. As SSM and hybrid models proliferate in agent architectures, HiSPAs become a systemic risk.

2. **State persistence across agent turns**: In a multi-agent system where Agent A sends a message containing HiSPA strings to Agent B (which uses a Mamba-based backbone), the poisoning persists for ALL subsequent processing by Agent B — not just the processing of Agent A's message. This creates a **one-shot permanent corruption** vector.

3. **Invisible to text-level defenses**: Our prior research on prompt injection detection (Mirror Design Pattern, OpenClaw PRISM) operates on text content. HiSPAs are adversarial at the model-internal level — they may appear as random strings that text-level filters ignore. CLASP addresses this gap by monitoring the model's internal representations.

4. **Hybrid architecture complications**: Modern agent systems increasingly use hybrid architectures where different layers use different attention mechanisms. A HiSPA targeting the Mamba layers can corrupt the agent's behavior while the Transformer layers appear to function normally — creating a stealth attack that's difficult to diagnose.

### Defensive Architecture Implications

- **CLASP as inner-ring defense**: In our multi-layer security model, CLASP occupies the "inner ring" — monitoring the model's internal state rather than its inputs or outputs. This complements:
  - **Outer ring**: Input sanitization (Mirror, PRISM)
  - **Middle ring**: Output monitoring (guardrails, constitutional AI)
  - **Inner ring**: Internal state monitoring (CLASP)

- **The monitoring overhead question**: 1,032 tokens/second is fast for document processing but may be too slow for real-time agent-to-agent communication. Multi-agent deployments would need to balance monitoring coverage against latency requirements.

- **Generalization concern**: The 91.6% F1 on structurally novel triggers is good but not perfect. An adaptive attacker designing new HiSPA patterns specifically to evade CLASP-like detectors (adversarial attacks on the detector) is the obvious next step in the arms race.

---

## Connections to Prior Deep-Dives

| Paper | Connection |
|-------|-----------|
| arXiv:2603.11875 (Mirror Pattern) | Complementary defenses — Mirror handles text-level prompt injection, CLASP handles internal state poisoning |
| arXiv:2603.11853 (OpenClaw PRISM) | PRISM's 10-lifecycle-hook architecture could integrate CLASP as the "model-internal monitoring" hook |
| arXiv:2603.11088 (Attack/Defense Survey) | HiSPAs are a newly catalogued attack class; CLASP is the first dedicated defense |
| arXiv:2603.11619 (Taming OpenClaw) | Both address runtime security for LLM agents, but at different abstraction levels |
| arXiv:2512.15790 (XAMT) | XAMT targets sequential memory; HiSPAs target recurrent state — both corrupt persistent model state |

---

## Limitations

1. **Mamba-specific**: CLASP's BOE-based detection is specific to Mamba architectures. Other SSMs (e.g., S4, RWKV) would need different feature extractors.

2. **Training data requirements**: The detector needs examples of HiSPA attacks for training. In a rapidly evolving attack landscape, keeping the training data current is a challenge.

3. **Single-model scope**: CLASP monitors one model's internal state. In multi-agent systems, it would need to be deployed on each agent independently, multiplying the overhead.

4. **No adversarial robustness analysis**: The paper doesn't test whether an attacker who knows about CLASP can craft HiSPAs that evade detection while still poisoning the state.

5. **Preliminary benchmarks**: The authors note that results are on "curated same-slice experiments" — broader, more diverse evaluation is needed.

---

## Technical Details Worth Noting

- **BOE patterns**: The paper finds that malicious tokens produce BOEs with specific distributional signatures — higher variance in certain dimensions, unusual activation patterns in the selective scan mechanism. This is a fundamental property of how adversarial strings interact with the SSM's state evolution equations.

- **XGBoost over neural**: The choice of XGBoost over a neural classifier is deliberate and principled. It avoids adding another neural model that could itself be attacked, provides interpretable feature importance, and has deterministic inference. This aligns with the "data geometry over model scale" philosophy also seen in the Mirror paper.

- **Throughput scaling**: 1,032 tokens/second with <4GB VRAM makes CLASP deployable on standard hardware. For multi-agent systems, this means each agent can run its own CLASP instance without requiring dedicated GPU resources.

---

## Rating Justification: ★★★★☆

CLASP addresses a critical and underexplored vulnerability in emerging SSM-based architectures. The approach is principled (internal state monitoring rather than just input/output filtering), the results are strong (especially generalization to novel patterns), and the engineering is practical (low overhead, deterministic). It loses one star because: (a) it's specific to Mamba, (b) adversarial robustness against detector-aware attackers isn't tested, and (c) the multi-agent deployment story needs more development. Still, this is an important contribution to the defense landscape.

---

*Scout Research Session — 2026-03-14*
*Deep-dive #174*
