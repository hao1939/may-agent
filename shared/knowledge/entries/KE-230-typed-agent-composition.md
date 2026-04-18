# KE-230: Formal typing of agent compositions catches structural defects that config linting and runtime testing miss

**Date**: 2026-04-18
**Source**: DD-767 (λ_A paper, 2604.11767)
**Confidence**: Medium-High
**Connects**: KE-021 (process > knowledge > judgment skills)

## Core Finding

λ_A, a typed lambda calculus for agent composition, reveals that **94.1% of 835 real GitHub agent configurations are structurally incomplete**. YAML-only linting catches just 54% of defects; joint YAML+Python AST analysis reaches 96-100%. The gap is caused by "semantic entanglement" — agent behavior depends on imperative code details not captured in declarative config.

## Evidence

- 835 real-world GitHub agent configs analyzed across 5 frameworks (LangGraph, CrewAI, AutoGen, OpenAI SDK, Dify)
- 94.1% structurally incomplete under λ_A type rules
- Full Coq mechanization: 1,519 lines, 42 theorems, 0 Admitted — unusually rigorous
- All 5 major frameworks embed as typed λ_A fragments → unifying calculus exists

## Mechanism / Why

Agent configs are split between declarative (YAML/JSON) and imperative (Python) layers. Type errors span this boundary — e.g., a tool declared in config but missing its implementation, or a workflow edge referencing an undefined agent. Neither layer alone has enough information to detect the defect. λ_A models both layers in one typed calculus, making cross-boundary defects visible at "compile time."

## Implications

### 1. Our workflow pipelines have the same vulnerability class
Our workflows are also declarative-imperative hybrids (workflow definitions + agent code). We likely have structural incompleteness we'd only discover at runtime. A typed composition model could catch these statically.

### 2. Verification beats testing for compositional correctness
This aligns with KE-021: process-level interventions (type checking) outperform knowledge-level ones (documentation of correct configs). A type system is a process skill for pipelines.

### 3. Practically useful but adoption is distant
The calculus itself is too formal for direct use. The actionable insight is the **lint rules derived from it** — these are concrete checks implementable today without understanding the theory.

## Actionable

- Consider implementing structural completeness checks for our workflow definitions (do all referenced agents exist? do all declared tools have implementations?)
- When composing multi-agent pipelines, enumerate the cross-boundary contracts explicitly rather than relying on runtime discovery
- The 54% → 96-100% jump from YAML-only to YAML+code analysis suggests our config validation should always inspect both layers

## Open Questions

- What fraction of our own workflow definitions would pass λ_A-style structural completeness?
- Can the derived lint rules be extracted without the full formal machinery?
- Does the 94.1% incompleteness rate hold for production (vs. GitHub hobby) configurations?
