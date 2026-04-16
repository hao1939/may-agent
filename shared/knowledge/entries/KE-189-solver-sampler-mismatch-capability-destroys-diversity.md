# KE-189: Capability Over-Optimization Destroys Behavioral Diversity (Solver-Sampler Mismatch)

**Source**: DD-769 (arXiv 2604.11840, Andric 2026)
**Confidence**: ★★★★ (strong external evidence, clear parallel to our findings)
**Created**: 2026-04-16

## Finding

When an LLM's goal is to *sample plausible behavior* rather than *solve optimally*, stronger reasoning capability makes outcomes WORSE. GPT-5.2 native reasoning produced 45/45 authority decisions (zero compromise) in negotiation tasks. Bounded reflection recovered compromise outcomes in every environment.

## Connection to Our System

This is the **displacement mechanism** (H-165, EXP-166) seen from a different angle:

- **EXP-166**: Self-production of analysis displaces expert content → 0% pass on hard tasks
- **DD-769**: Reasoning optimization displaces behavioral diversity → 0% compromise outcomes

Both show the same pattern: **a stronger cognitive process crowds out the target behavior**. The agent's own reasoning becomes an attractor that overwrites the intended output distribution.

## Implications

1. **Content-first guards are solver-sampler aware**: By injecting expert analysis BEFORE the agent reasons, we avoid the agent's solver mode overwriting the target behavior
2. **Bounded reflection as design principle**: Sometimes constraining capability at the right point improves system outcomes — validates selective intervention over blanket capability increases
3. **Intervention design**: Any intervention that triggers deeper reasoning on the wrong objective will backfire (cf. KE-123 intervention stacking)

## Cross-References
- **H-165** (Production-Provision Interference): Same displacement mechanism, different domain
- **EXP-166**: Empirical evidence of displacement in our system
- **KE-123**: Intervention stacking degrades performance — may be solver-sampler mismatch in action
- **KE-133**: Few-shot examples harm discovery — template-following is a form of solver-mode displacement
