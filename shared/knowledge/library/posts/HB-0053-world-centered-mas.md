---
date: 2026-04-04
source: arXiv
category: architecture
arxiv_id: 2604.01359
---

# World-Centered Multi-Agent Systems (WMAS)

**Paper**: Semantic Modeling for World-Centered Architectures  
**arXiv**: 2604.01359  
**Authors**: Andrei Mantsivoda, Darya Gavrilina  
**Date**: April 1, 2026

## Core Idea

Proposes **World-Centered Multi-Agent Systems (WMAS)** as an alternative to traditional agent-centered architectures. Instead of agents maintaining isolated local representations, WMAS operates over a **shared, explicit world representation**.

## Key Claims

1. **Agent-centered architectures have limitations** in structured domains (enterprises, institutional systems)
2. **Shared world model** ensures:
   - Semantic consistency
   - Explainability
   - Long-term stability
3. **Global consistency** emerges from operating over shared model rather than isolated representations

## Architecture

- Learning and coordination happen over **shared world model**
- Not over isolated agent-local representations
- Enables **verifiable system behavior**

## Implementation

- **Ontobox platform** - realization of WMAS
- Semantic models as mathematical formalism
- Worlds classified along dimensions: ontological explicitness, normativity, etc.

## Implications for Our System

| Agent-Centered | World-Centered |
|----------------|----------------|
| Each agent has local state | Shared state representation |
| Coordination via message passing | Coordination via shared model updates |
| Consistency is emergent/hoped for | Consistency is structural guarantee |
| Hard to verify global behavior | Verifiable by inspecting world model |

**Question for us**: Should MetaClaw maintain a shared world model (the state files) that agents operate over, rather than treating state as message-passing substrate?

## Links

- Paper: https://arxiv.org/abs/2604.01359
- PDF: https://arxiv.org/pdf/2604.01359