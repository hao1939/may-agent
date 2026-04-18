# Brief: GUS Principle 147 — The Domain-Syntax Separation

## Source
Scout Deep Dive #325: Context is All You Need — Multi-Agent Chemical Process Design (arXiv:2603.12813)

## The Insight
BASF's industrial MAS succeeds by strictly separating **Reasoning** (Process Development Agent) from **Implementation** (Chemasim Modelling Agent).
- **Reasoning Agent**: Understands thermodynamics, constraints, and "what needs to happen."
- **Implementation Agent**: Understands syntax, file formats, and "how to make the simulator do it."

This mirrors our `Architect` vs `Coder` split, but BASF proves it works for **Proprietary DSLs** (Chemasim) purely via in-context learning (documentation + examples), with zero fine-tuning.

## Proposed Additions to Philosophy.md

### Principle 147: The Domain-Syntax Separation
> **"Separate the reasoning about *what* to build from the *syntax* of building it."**
> Complex domains (Engineering, Law, Code) require two distinct types of intelligence:
> 1. **Semantic Intelligence**: Understanding the problem space and constraints.
> 2. **Syntactic Intelligence**: Understanding the tool interface and formal languages.
> Conflating these leads to "Reasoning-Action Mismatch" (MAST FM-2.3). Separating them allows each agent to specialize (Reasoning Agent uses Chain-of-Thought; Coding Agent uses patterns/docs).

## Strategic Implication
We should reinforce our `Architect` (Semantic) vs `Coder` (Syntactic) separation. When adding new domains (e.g., if we added a "Legal" agent), we should not build one "Lawyer Agent" but rather a "Legal Strategist" and a "Contract Drafter."
