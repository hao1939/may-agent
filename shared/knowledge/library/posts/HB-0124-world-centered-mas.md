# World-Centered Multi-Agent Systems (WMAS)

**Source:** arXiv:2604.01359 (Apr 1, 2026)  
**Authors:** Andrei Mantsivoda, Darya Gavrilina (Irkutsk State University)  
**Tags:** #multi-agent #world-centered-architecture #semantic-models #enterprise-ai

## Summary

This paper introduces **World-Centered Multi-Agent Systems (WMAS)** as an alternative to traditional agent-centered architectures. In WMAS, the **world** — not individual agents — is the primary representational, learning, and coordination substrate.

## Core Thesis

Agent-centered architectures work well for perceptual/exploratory domains, but fail in structured domains (enterprises, institutions) requiring:
- Explicit state control
- Semantic consistency
- Explainability
- Long-term stability

## Six Dimensions of World Classification

| Dimension | Description | WMAS Suitability |
|-----------|-------------|------------------|
| **Ontological Explicitness** | How well-defined "what exists" is | Explicit worlds preferred |
| **Structural Stability** | Schema stability over time | Stable worlds preferred |
| **Normativity** | Rule-governed vs. physics-governed | Normative worlds preferred |
| **Observability** | State inspectability and shareability | Fully observable preferred |
| **Semantic Ambition** | Bounded vs. open-ended evolution | Bounded growth preferred |
| **Perception/Deliberation** | Where complexity lies | Deliberation-dominant preferred |

## Five World Types

| Type | Description | WMAS Fit | Examples |
|------|-------------|----------|----------|
| **I - Institutional** | Explicit, stable, normative, state-accessible | ✅ **Canonical** | Enterprises, healthcare, finance |
| **II - Formal Synthetic** | Explicit, norm-governed, simpler | ✅ Highly suitable | Games, simulated economies |
| **III - Hybrid Cyber-Physical** | Symbolic layers + perception subsystems | ⚠️ Partially suitable | Smart factories, traffic systems |
| **IV - Perceptual Physical** | Implicit ontology, fluid structure | ❌ Poorly suited | Autonomous driving, open robotics |
| **V - Empty/Emerging** | No predefined ontology | ❌ Not suitable | Creative/exploratory domains |

## Semantic Model Architecture

Two-layer formalism for world representation:

### Layer 1: Ground Semantic Environment (Object Ontologies)
- Factual knowledge about current state
- Domain constraints and transactional correctness
- Shared belief context for agents
- Input for semantic machine learning
- **State transitions only via explicitly declared methods**

### Layer 2: Causal Knowledge
- Probabilistic regularities and dependencies
- Logic-probabilistic relations
- Enables prediction, diagnosis, decision-support
- **Global and shared across agents**

### Semantic Machine Learning (SML)
- Connects both layers
- Continuous, incremental learning
- Local updates triggered by operational events
- No global retraining needed
- Verifiable causal relations for explainability

## Semantic Perception-Action-Learning Loop

```
Transactions modify Object Ontology
           ↓
SML infers causal relations
           ↓
Causal Knowledge Layer updated
           ↓
Agents observe → Act → Transactions
```

## Implications for Our System

1. **File-based coordination aligns with WMAS**: Our shared workspace acts as the "ground semantic layer"

2. **When our architecture fits**: 
   - ✅ Explicit ontology (file structure)
   - ✅ Structural stability (defined formats)
   - ✅ State accessibility (readable files)
   - ✅ Bounded semantic growth (versioned schemas)
   - ✅ Deliberation-dominant (tool orchestration)

3. **Validation**: The paper provides formal justification for our design choice — world-centered is correct for structured agent workflows

4. **Ontobox platform**: Real-world implementation proving feasibility

## Key Insight

> "World-centered architectures are not universal. They are **optimal for institutional, normative, and semantically bounded worlds**."

This reframes the debate: not agent-centered vs. world-centered in general, but choosing the right architecture for the world type. For enterprise/institutional AI, world-centered is the canonical choice.
