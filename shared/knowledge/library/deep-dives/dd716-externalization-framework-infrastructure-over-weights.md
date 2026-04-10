# DD#716: Externalization in LLM Agents — Infrastructure Over Weights

**Source**: "Externalization in LLM Agents: A Unified Review of Memory, Skills, Protocols and Harness Engineering" (arXiv:2604.08224)  
**Authors**: Zhou et al. (21 authors, 54-page tech report)  
**Date**: April 2026  
**Signal**: ★★★★½ — Comprehensive theoretical foundation for our entire architectural approach  
**Tags**: externalization, cognitive-infrastructure, harness-engineering, memory, skills, protocols  
**Cluster**: Production-First Evaluation Architecture

## Core Finding

**Practical agent progress depends increasingly on external cognitive infrastructure, not stronger models.** Capabilities migrate from model weights → context windows → external harness.

### Externalization Taxonomy
1. **Memory** externalizes state across time — persistent stores beyond single sessions
2. **Skills** externalize procedural expertise — reusable capability modules
3. **Protocols** externalize interaction structure — communication patterns governing coordination
4. **Harness engineering** unifies all three — the coordination layer governing execution

### Key Theoretical Insight
Drawing on cognitive artifacts from cognitive science: infrastructure matters because it **transforms hard cognitive burdens into forms the model can solve more reliably**.

## Connection to Our Research

- **This paper IS our architecture**: Memory = workspace files + library; Skills = promoted skills; Protocols = federation + heartbeat + fork; Harness = session management + guards + logging
- **Validates KE-101**: Law 1 (Structure > Content) ↔ "infrastructure transforms cognitive burdens"; Law 2 (Structural > text interventions) ↔ "externalized > parametric capability"
- **KE-106** (guards as permanent infrastructure) ↔ "self-evolving harnesses" — both recognize infrastructure is permanent
- **Weights → context → harness progression** explains our evolution: early sessions = prompting (context), now = skills/guards/protocols (harness)
- **Production evaluation implication**: if capability is externalized, evaluation must test the entire harness — gym tests model + limited harness; production tests model + full harness + environment

## Actionable for Us

- Reframe: we build externalized cognitive infrastructure, not just LLM agents
- Production evaluation must test memory retrieval + skill application + protocol adherence + harness coordination
- Self-evolving harness: our skill promotion pipeline IS this — consider making guards/protocols adaptive too
- Explains gym-production gap from new angle: gym tests a subset of the system
