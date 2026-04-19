# KE-269: Formal type systems for agent composition reveal 94% structural incompleteness in real configs

**Date**: 2026-04-19
**Source**: DD-767 (λ_A paper, 2604.11767)
**Confidence**: High
**Connects**: KE-021 (process skills > knowledge skills), H-166

## Core Finding

λ_A, a typed lambda calculus for LLM agent composition, evaluated 835 real GitHub agent configs and found **94.1% are structurally incomplete**. YAML-only linting catches 54% of issues; joint YAML+Python AST analysis reaches 96-100%. The calculus unifies 5 major frameworks (LangGraph, CrewAI, AutoGen, OpenAI SDK, Dify) as typed fragments, with Coq-mechanized proofs (1,519 lines, 42 theorems, 0 Admitted).

## Evidence

- 835 GitHub agent configurations analyzed — 94.1% structurally incomplete under λ_A typing rules
- YAML-only lint precision: 54%; YAML+Python AST: 96-100%
- Full Coq mechanization with 0 Admitted — unusually rigorous for AI systems work
- Type safety, bounded-fixpoint termination, and lint-rule soundness all proven

## Mechanism / Why

Agent configurations split behavior across declarative YAML and imperative Python code ("semantic entanglement"). Static analysis of config alone misses constraints expressed in code. λ_A captures this by extending simply-typed lambda calculus with oracle calls (LLM invocations), bounded fixpoints (ReAct loops), probabilistic choice, and mutable environments — modeling the full computational structure.

## Implications

### 1. Most agent systems in production are undertested
94.1% incompleteness means nearly all deployed agent configs have structural gaps that manifest only at runtime. This quantifies what we've observed informally in our own system.

### 2. Config-only validation is insufficient
The jump from 54% to 96-100% precision when adding AST analysis shows that agent verification must cross the config/code boundary. Our own agent pipelines have similar entanglement (YAML-like context.md + TypeScript behavior).

### 3. Formal verification of agent composition is tractable
The Coq mechanization proves this isn't just theoretical — you can build practical type-checking tools for agent pipelines. The unifying calculus covering 5 frameworks suggests potential standardization.

## Actionable

- Consider whether our agent pipeline (context injection → LLM call → tool use → commit) could be expressed as λ_A terms for static verification
- The bounded-fixpoint formalization of ReAct loops is directly relevant to our retry/recovery patterns — could inform termination guarantees

## Open Questions

- Can λ_A handle the dynamic agent-spawning patterns we use (fork/call)? Paper covers static composition but our system is highly dynamic
- Would type-checking our agent configs actually catch the failure modes we see (FM-1.3 path errors, FM-2.6 drift)? These seem more semantic than structural
- How does this relate to the "process skills > knowledge skills" finding (KE-021)? Type systems enforce process constraints statically
