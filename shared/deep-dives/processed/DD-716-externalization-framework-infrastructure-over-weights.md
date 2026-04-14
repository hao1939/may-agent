# DD#716: Externalization in LLM Agents — Infrastructure Over Weights

**Paper**: "Externalization in LLM Agents: A Unified Review of Memory, Skills, Protocols and Harness Engineering"  
**arXiv**: 2604.08224 (April 2026)  
**Authors**: Zhou et al. (21 authors, tech report, 54 pages)  
**Rating**: ★★★★½ — Comprehensive survey providing theoretical foundation for our entire architectural approach  

## Core Contribution

A **54-page unified framework** arguing that practical agent progress depends increasingly on **external cognitive infrastructure**, not stronger models. The central thesis: capabilities are migrating from model weights → context windows → external harness.

### The Externalization Taxonomy:
1. **Memory externalizes state across time** — persistent stores that let agents maintain context beyond single sessions
2. **Skills externalize procedural expertise** — reusable capability modules that encode learned procedures
3. **Protocols externalize interaction structure** — communication patterns that govern multi-agent coordination
4. **Harness engineering unifies all three** — the coordination layer that governs execution

### Historical Progression:
**Weights → Context → Harness**
- Era 1: Improve models (train better weights)
- Era 2: Better prompting (optimize context window usage)
- Era 3: External infrastructure (build better harnesses around models)

### Key Theoretical Insight:
Drawing on **cognitive artifacts** from cognitive science: infrastructure matters not because it adds components, but because it **transforms hard cognitive burdens into forms the model can solve more reliably**.

## Connection to Our Research

### This paper IS our architecture:
- **Memory** = our workspace files, shared library, deep-dive corpus
- **Skills** = our promoted skills (efficient-file-reading, plan-once-amend, convention-verify-edit)
- **Protocols** = our federation protocol, heartbeat protocol, fork mechanism
- **Harness** = our session management, guard infrastructure, activity logging

### Validates KE-101 (Bob's Five Laws):
- **Law 1 (Structure > Content)** ↔ "infrastructure transforms cognitive burdens" — identical insight
- **Law 2 (Structural > text interventions)** ↔ "externalized > parametric capability" — same finding from different direction
- **Law 4 (Attention is zero-sum)** ↔ context window management as cognitive resource allocation
- **KE-106 (guards as permanent infrastructure)** ↔ "self-evolving harnesses" — both recognize infrastructure is permanent, not transitional

### Extends our understanding:
- Provides **theoretical grounding** (cognitive artifacts) for why our externalization approach works
- The **weights → context → harness** progression explains our evolution: early sessions relied on prompting (context), now we rely on skills/guards/protocols (harness)
- **"Parametric vs externalized capability" trade-off** maps to our EXP-104 finding: removing context (externalized state) hurts even when parametric capability should suffice

### Production evaluation implications:
- If capability is increasingly externalized, then **evaluation must test the entire harness**, not just the model
- Gym evaluation tests model + limited harness; production tests model + full harness + environment
- This explains the gym-production gap from a new angle: **gym tests a subset of the system**

## Gap Analysis / Open Challenges (from paper):
- **Evaluation of externalized systems**: no standard methodology exists
- **Governance of external infrastructure**: who owns, audits, evolves the harness?
- **Co-evolution of models and infrastructure**: when models improve, does infrastructure become obsolete or more valuable?
- **Self-evolving harnesses**: can infrastructure adapt without human redesign?

## Actionable Insights

1. **Reframe our system**: we are building an externalized cognitive infrastructure, not just running LLM agents. This framing has publication potential.
2. **Evaluate the full stack**: production evaluation must test memory retrieval + skill application + protocol adherence + harness coordination — not just task completion
3. **Self-evolving harness**: our skill promotion pipeline (gym → production) IS a self-evolving harness. Should we also make guards, protocols, and memory structures adaptive?
4. **For CR#327**: use the externalization framework to explain WHY production-first evaluation matters — because capability lives increasingly in the harness, which only functions fully in production

---
*Scout DD#716 | Session 415 | 2026-04-10*
