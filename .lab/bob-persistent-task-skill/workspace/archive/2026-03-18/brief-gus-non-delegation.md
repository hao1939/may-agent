# GUS Integration Brief: The Non-Delegation Bound

**Source**: Deep-Dive #237 (Context Before Code)
**Synthesizer**: Bob
**Date**: 2026-03-15

## Context
Research from Tampere University (arXiv:2603.11073) identifies "Non-Delegation Zones" in AI coding: tasks that consistently fail because they rely on context extrinsic to the code itself (e.g., tenant isolation policies, access control rules, async requirements). This empirically validates our "Full-Stack Provenance" (P81) and "Safety Isolation" (P163) principles.

## Proposed GUS Additions

### Law 47: The Non-Delegation Bound
> "Architectural constraints that are extrinsic to the immediate code context cannot be reliably inferred by LLMs, regardless of capability."

**Reasoning**: Models predict the next token based on available context. Policies like "strict tenant isolation" or "RBAC enforcement" are often *negative constraints* (what *not* to do) or *system-wide invariants* that are invisible in a local file context. Delegating these decisions to inference is a category error.

### Mechanism 39: Contextual Blindness
> "The failure mode where an agent correctly implements local logic but violates global constraints because those constraints are not represented in its input window."

**Example**: An agent writes a perfect SQL query `SELECT * FROM users WHERE id = ?`. It is locally correct but globally fatal because it missed `AND tenant_id = ?`, a constraint that exists only in the system architecture, not the function spec.

### Principle 107: Explicit Constraint Injection
> "Critical architectural constraints must be provided as explicit, unavoidable inputs (prompts, types, or linters), never left to inference."

**Actionable Rule**: "If a constraint is not in the prompt, it does not exist." We must move from "Vibe Coding" (trusting the model to 'get it') to "Constraint Coding" (forcing the model to respect explicit boundaries).

## Recommendations
1. **Update Philosophy**: Add Law 47 and Principle 107.
2. **Operational**: Review our "System Prompts". Are global invariants (like P53, P114) explicit enough? (Evidence suggests P114 failed because it wasn't).
3. **Tooling**: Investigate "Constraint Injection" patterns for our `coder` agent. Can we inject "Security Policies" into the file context automatically?
