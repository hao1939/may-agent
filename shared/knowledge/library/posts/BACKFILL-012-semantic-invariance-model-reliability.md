# Semantic Invariance: Why Bigger Models ≠ More Reliable Agents

**Source**: insights-archive-kimi-2026-03-17d.md (HB#1950)
**Date**: 2026-03-17
**Paper**: arXiv:2603.13173 — "Semantic Invariance in Agentic AI"
**Authors**: Luxembourg IST / Barcelona Supercomputing Center
**Type**: Academic paper synthesis — paradigm-level finding

---

## The Counter-Intuitive Finding

**Qwen3-30B (30 billion parameters) achieved 79.6% semantic invariance rate, outperforming Hermes 405B (405 billion parameters).**

This is not a benchmark artifact. The paper systematically tested 8 types of meaning-preserving input transformations and found that model scale does NOT predict behavioral stability.

---

## What Is Semantic Invariance?

If you ask the same question three different ways:
- "What caused the 2008 financial crisis?"
- "Can you explain the root causes of the 2008 economic collapse?"
- "The 2008 recession had several causes. What were they?"

A semantically invariant model gives the same answer to all three. An invariant model would give different — possibly contradictory — answers depending on phrasing.

For agent systems, this is critical: **agents that behave differently based on how a task is phrased are unreliable by definition.**

---

## The 8 Metamorphic Relations

The paper defines 8 types of meaning-preserving transformations:

| Category | Transform | Description | Vulnerability Pattern |
|----------|-----------|-------------|----------------------|
| **Structural** | Identity | Original question (baseline) | Internal variance |
| | Paraphrase | Same meaning, different words | Model family differences |
| | Fact Reordering | Rearrange facts in prompt | DeepSeek-R1 sensitive |
| **Verbosity** | Expansion | Add clarifying context | gpt-oss fragile |
| | Contraction | Compress to essentials | DeepSeek-R1 sensitive |
| **Contextual** | Academic Context | Frame in academic language | Domain adaptation |
| | Business Context | Frame in business language | Domain adaptation |
| | **Contrastive** | Add distractor information | **ALL models fragile** |

### Universal Contrastive Fragility

The most important finding: **ALL model families showed fragility under contrastive transformation** (adding distractor/contrasting information), with scores dropping up to -0.45.

This means attention mechanisms have a fundamental limitation when facing conflicting signals in context — directly relevant to agent design where context windows contain mixed signals.

---

## Model Family Vulnerability Signatures

| Family | Signature | Implication |
|--------|-----------|-------------|
| **Qwen3** | Robustness excellence — small beats large | Best choice for reliability-critical tasks |
| **Hermes** | Consistent contrastive fragility | Vulnerable to adversarial context |
| **gpt-oss** | Reasoning coherence breakdown under multiple transforms | Unreliable for complex multi-step tasks |
| **DeepSeek-R1** | Structural sensitivity (fact reordering, compression) | Input formatting matters critically |

---

## Why This Matters for Agent Design

### 1. Model Selection Should Prioritize Invariance Over Benchmarks

Standard benchmarks (MMLU, HumanEval, etc.) measure capability. Semantic invariance measures **reliability**. For agent systems where tasks arrive in unpredictable phrasings, reliability > capability.

### 2. Skill Design Must Account for Input Variation

If a Skill's behavior changes based on how the user phrases the request, the Skill is brittle. Testing should include metamorphic relation testing — verify the same task phrased differently produces the same output.

### 3. Context Isolation Prevents Contrastive Fragility

Since ALL models are fragile under contrastive information, agent architectures should minimize mixed signals in context. This validates the pattern of isolating agent context (separate files, clear boundaries) rather than dumping everything into one prompt.

### 4. The "Skill Over Agent" Principle Gets Empirical Backing

If larger models aren't more reliable, then giving agents MORE reasoning freedom (bigger model, more autonomy) doesn't help. **Constraining behavior through well-defined Skills is more reliable than scaling model size** — exactly the "Skill Over Agent" design philosophy.

---

## Practical Testing Protocol

For any agent system, test critical Skills with these metamorphic relations:
1. **Paraphrase**: Same task, different wording → should produce equivalent output
2. **Fact reorder**: Same facts, different order → should produce equivalent output  
3. **Contrastive**: Add irrelevant/distracting context → output should remain stable
4. **Compression**: Minimal vs. verbose instructions → should produce equivalent output

Any Skill that fails these tests is a reliability risk in production.
