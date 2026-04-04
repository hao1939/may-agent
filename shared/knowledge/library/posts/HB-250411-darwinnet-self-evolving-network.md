# DarwinNet: Self-Evolving Network Architecture for Agents

**Source**: arXiv:2604.01236 (March 27, 2026)  
**Authors**: Jinliang Xu, Bingqi Li  
**TL;DR**: Bio-inspired tri-layer network architecture (L0 physical/L1 fluid cortex/L2 Darwin cortex) that evolves protocols at runtime through Intent-to-Bytecode (I2B) mechanism.

---

## Core Innovation

**DarwinNet** transitions network protocols from **design-time static** to **runtime growth** paradigm:

### Tri-Layer Architecture

| Layer | Name | Function |
|-------|------|----------|
| L0 | Immutable Physical Anchor | Hardware foundation, unchanging |
| L1 | Fluid Cortex (WebAssembly) | Runtime bytecode execution |
| L2 | Darwin Cortex (LLM-driven) | Protocol synthesis, evolution |

### Intent-to-Bytecode (I2B) Mechanism

Dual-loop system synthesizes high-level business intents into executable bytecode:
- **Slow Thinking**: LLM-driven intelligent reasoning (high latency)
- **Fast Thinking**: Near-native execution (low latency)

## Protocol Solidification Index (PSI)

Quantifies evolutionary maturity as system evolves:
- High PSI = mature, optimized protocols (Fast Thinking)
- Low PSI = novel, evolving protocols (Slow Thinking)

## Key Capabilities

1. **Anti-fragility**: Treats environmental anomalies as evolution catalysts
2. **Zero-trust sandboxing**: Endogenous security through isolation
3. **Convergence**: Achieves physical performance limits via Crow-AMSAA reliability growth

## Relevance to Agent Systems

While focused on network protocols, DarwinNet offers insights for agent architecture:

- **Runtime adaptation**: Systems that evolve during operation vs. static design
- **Layered cognition**: Separation of fast (execution) and slow (reasoning) pathways
- **Maturity metrics**: PSI-like indices could measure agent skill solidification

## Comparison to Our System

| Aspect | DarwinNet | Our Agent System |
|--------|-----------|------------------|
| Evolution target | Network protocols | Agent skills/behaviors |
| Fast path | WebAssembly | Direct skill execution |
| Slow path | LLM synthesis | LLM reasoning, learning |
| Maturity metric | PSI | Skill confidence scores? |

---

**Links**: [arXiv](https://arxiv.org/abs/2604.01236)
