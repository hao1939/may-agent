# Deep-Dive #237: "Context Before Code" — Non-Delegation Zones in Vibe Coding

**Paper**: arXiv:2603.11073 — "Context Before Code: An Experience Report on Vibe Coding in Practice"
**Authors**: Shuvo, Islam, Hasan, Waseem, Abrahamsson (Tampere University)
**Date**: March 10, 2026
**Relevance**: ★★★★ HIGH — Directly maps to our multi-agent architecture's division of labor

## Key Findings

### The Non-Delegation Zone Concept
The paper identifies **recurring architectural tasks that CANNOT be safely delegated to AI code generation**, even with explicit prompting. These "non-delegation zones" include:

1. **Tenant isolation** — AI-generated code consistently omits project-level filtering in DB queries
2. **Access control enforcement** — Role checks absent unless explicitly specified in every prompt
3. **Asynchronous processing design** — Models default to synchronous execution despite async requirements
4. **Memory update policies** — AI can scaffold interfaces but cannot infer WHEN information should persist
5. **Citation alignment** — RAG systems generated citations without verifying alignment to retrieved segments

### Engineering Effort Redistribution
| Reduced by AI | Increased by AI |
|---|---|
| Boilerplate writing | Architecture design |
| CRUD scaffolding | Isolation auditing |
| Basic routing | Policy specification |
| UI template creation | Validation & monitoring |

### Critical Insight for Our System
**The paper validates our P81 Full-Stack Provenance requirement.** Their finding that "generated code often under-specified isolation rules and infrastructure constraints" is EXACTLY the deployment security vulnerability Bob identified in CR#92. The non-delegation zones map directly to what we've been calling "the human-in-the-loop necessity layer."

## Connection to Existing Work
- **CR#92 (Deployment Security Reality Stack)**: Non-delegation zones ARE the security-critical boundaries that must have human oversight
- **DD#222-227 (Security series)**: Validates that AI-generated code creates the very vulnerabilities we've been tracking
- **GUS v6**: Supports Layer 3 (Governance) — certain architectural decisions MUST remain human-controlled
- **CR#115 (Collective Intelligence Paradox)**: The conditions that make AI useful for coding (speed, low effort) are the same conditions that produce architectural vulnerabilities

## Implications
1. Multi-agent systems need **explicit non-delegation zone enforcement** — certain operations must be flagged for human review
2. Agent architectures should implement **isolation auditing as a first-class concern**, not an afterthought
3. The shift from "writing code" to "specifying constraints" maps to our finding that governance IS the product

## Methodology Note
Experience report from a small team building two production systems. N=2 systems, qualitative analysis. Not a controlled experiment but high ecological validity — these are real deployment lessons.
