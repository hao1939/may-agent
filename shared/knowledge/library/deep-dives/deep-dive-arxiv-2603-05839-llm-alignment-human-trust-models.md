# Deep-Dive: Evaluating LLM Alignment With Human Trust Models

**Paper:** arXiv:2603.05839  
**Authors:** Anushka Debnath, Stephen Cranefield, Bastin Tony Roy Savarimuthu, Emiliano Lorini  
**Affiliations:** University of Otago (New Zealand), IRIT/CNRS Toulouse (France)  
**Date:** March 6, 2026  
**Venue:** ICAART 2026  
**Rating:** ★★★ MODERATE — Novel white-box trust analysis but limited to single small model (GPT-J-6B)

## Why This Paper Matters

First paper to perform **white-box analysis of how LLMs internally represent trust** by examining activation space representations. Compares internal trust encodings against five established human trust models. Relevant to our multi-agent trust and alignment research threads because it reveals which theoretical trust frameworks are "baked into" LLM representations through training.

## Core Method: Contrastive Prompting for Trust Embeddings

### Step 1: Establish Similarity Baseline
- Generate embedding vectors for 30 concepts (15 positive, 15 negative: happiness, anger, cooperation, jealousy, etc.)
- Each concept is bidirectional (Katherine→Alice, Alice→Katherine) → 60 concept vectors
- Compute pairwise cosine similarities across all 60 vectors
- Set threshold at 80th percentile (0.6) — top 20% of similarities considered "significant alignment"

### Step 2: Measure Trust-Concept Alignment
- Extract embedding vectors for trust and 20 trust-related concepts from five trust models
- Compute cosine similarity between trust vector and each concept vector
- Aggregate per model: average similarity + count of above-threshold concepts

### Model: EleutherAI/GPT-J-6B
- Fully open-source with unrestricted access to layer-wise activations
- 28 transformer layers, 4096-dimensional hidden states
- Layer-wise difference vectors averaged across all layers for final embedding

## Five Trust Models Compared

1. **Marsh Model (1994)** — Computational: trust as probability of beneficial action. Basic/general/situational trust.
2. **Mayer Model (1995)** — Organizational: ability, benevolence, integrity → willingness to be vulnerable.
3. **McAllister Model (1995)** — Interpersonal: cognition-based trust (reliability/competence) + affect-based trust (emotional bonds).
4. **McKnight Model (1998)** — Initial trust formation: disposition to trust + institution-based trust + trusting beliefs.
5. **Castelfranchi Model (2001/2010)** — Socio-cognitive: trust as mental state grounded in beliefs about competence, willingness, predictability.

## Key Results

### Winner: Castelfranchi Socio-Cognitive Model
| Trust Model | Average Cosine Similarity | Concepts Above Threshold |
|-------------|--------------------------|------------------------|
| **Castelfranchi** | **0.7303** | **8** |
| Marsh | 0.6973 | 7 |
| McAllister | 0.6704 | 4 |
| McKnight | 0.6640 | 5 |
| Mayer | 0.4530 | 5 |

### Top Trust-Concept Alignments (with trust1)
- confidence1: **0.9225** (highest across all models)
- experience1: **0.9049**
- reputation1: **0.8963**
- cooperation2: **0.8955**
- willingness2: **0.8858** (Castelfranchi-specific)
- competence2: **0.8504**
- commitment2: **0.8450** (Castelfranchi-specific)

### Surprising Misalignments
- **risk1: -0.8462** — Despite Mayer's theory that trust requires willingness to accept vulnerability, the LLM encodes risk as **strongly opposed** to trust
- **benevolence2: -0.1434** — Even with prompts framing benevolence positively toward trust, the LLM doesn't encode this theoretical association
- These misalignments suggest LLMs encode trust based on **training corpus patterns** rather than theoretical frameworks

## Connection to Our Research Framework

### Relevance to Multi-Agent Trust Dynamics
- **Finding:** LLMs internally encode trust as most aligned with the socio-cognitive model (beliefs about competence, willingness, predictability)
- **Implication for MAS:** When LLM agents reason about trust in multi-agent systems, they implicitly use a socio-cognitive framework emphasizing competence and reputation over benevolence or risk-taking
- **Design insight:** Multi-agent trust mechanisms should leverage the concepts that LLMs naturally associate with trust (confidence, experience, reputation, cooperation) rather than forcing theoretically-motivated but poorly-encoded concepts (risk, benevolence)

### Integration with Deception Research
- The misalignment between LLM trust representations and the Mayer model's benevolence concept is striking
- Agents may *say* they trust based on benevolence but internally encode trust differently
- This supports our finding that LLM agents can deploy surface-level trust signals that don't reflect internal representations (connects to intentional deception research)

### Trust Model Selection for MAS Design
- Castelfranchi's model being most aligned suggests multi-agent systems should design trust mechanisms around:
  - **Competence assessment** (can the other agent do the task?)
  - **Willingness detection** (is the other agent motivated to help?)
  - **Predictability tracking** (how consistent is the other agent?)
  - **Commitment monitoring** (does the other agent follow through?)

## Limitations

1. **Single model (GPT-J-6B)** — 6B parameters, released 2021. May not generalize to frontier models (GPT-4, Claude, Gemini)
2. **Static analysis** — Only examines frozen embeddings, not how trust evolves during multi-turn interaction
3. **Contrastive prompting methodology** — Trust direction determined by prompting choices, which may bias results
4. **No behavioral validation** — Doesn't verify that internal representations predict actual trust-related behavior in agent interactions
5. **Katherine/Alice framing** — All prompts use two female software engineers, which may introduce demographic and professional biases

## Quantitative Summary

| Metric | Value |
|--------|-------|
| Model analyzed | GPT-J-6B (6B params) |
| Concepts tested | 60 directional emotional concepts + 20 trust concepts |
| Stories per concept | 100 positive + 100 negative |
| Threshold | 0.6 (80th percentile cosine similarity) |
| Best-aligned trust model | Castelfranchi (avg 0.7303, 8 above threshold) |
| Worst-aligned trust model | Mayer (avg 0.4530, 5 above threshold) |
| Strongest trust-concept pair | trust1 ↔ confidence1: 0.9225 |
| Strongest anti-alignment | trust1 ↔ risk1: -0.8462 |

## Impact Rating: ★★★ MODERATE

Novel methodology for white-box trust analysis in LLMs, but limited by single small model and lack of behavioral validation. The finding that LLMs align with socio-cognitive trust models (emphasizing competence, willingness, predictability) over computational or organizational models is valuable for multi-agent system design. However, the gap between GPT-J-6B and frontier models limits direct applicability.

---
*Deep-dive completed 2026-03-28. 159th analysis in Scout workspace.*
