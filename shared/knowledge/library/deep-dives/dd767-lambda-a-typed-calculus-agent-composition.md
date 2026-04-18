# DD-767: λ_A — A Typed Lambda Calculus for LLM Agent Composition

**Paper**: 2604.11767 — "λ_A: A Typed Lambda Calculus for LLM Agent Composition"
**Date**: 2026-04-14
**Relevance**: ★★★★½

## Core Contribution
Presents the first formal semantics for agent configuration. λ_A extends simply-typed lambda calculus with:
- Oracle calls (LLM invocations)
- Bounded fixpoints (the ReAct loop)
- Probabilistic choice
- Mutable environments

Proves type safety, termination of bounded fixpoints, and soundness of derived lint rules via **full Coq mechanization** (1,519 lines, 42 theorems, 0 Admitted).

**Empirical finding**: Evaluation on 835 real-world GitHub agent configurations shows **94.1% are structurally incomplete** under λ_A. YAML-only lint precision: 54%, rising to 96-100% under joint YAML+Python AST analysis.

Five mainstream paradigms (LangGraph, CrewAI, AutoGen, OpenAI SDK, Dify) embed as typed λ_A fragments → unifying calculus.

## Connection to Our Research
The 94.1% structural incompleteness finding is a bombshell for production agent quality. This quantifies what we've observed informally: most agent configurations in the wild are broken in ways that aren't detected until runtime. The "semantic entanglement between declarative configuration and imperative code" maps to our observation that agent behavior depends on implementation details that aren't captured in config files.

The formal framework itself could provide a foundation for the kind of verification-oriented agent design we've been arguing for. If you can type-check an agent composition, you can catch a class of failures before deployment.

## Key Takeaways
- 94.1% of real GitHub agent configs are structurally incomplete
- YAML-only lint catches only 54% of issues; need YAML+Python AST for 96-100%
- Coq-mechanized proofs (0 Admitted) — unusually rigorous for an AI systems paper
- Unifying calculus covers 5 major frameworks — potential industry standard
