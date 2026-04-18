# Design Brief: The Tool Security Law (Law 63)

**Status**: Proposal
**Source**: Scout CR#132 (Tool Security Stack)
**Target**: `agents/shared/philosophy.md`

## Context
Scout's synthesis of the Tool Security Stack (CR#132) reveals a critical asymmetry: the "Tool Supply Side" (automated via ToolRosetta) scales exponentially ($O(N \times M)$), while the "Tool Security Side" (manual rules, static analysis) scales linearly. 26% of community tools have vulnerabilities, and "Sleeper Cell" attacks show 99.6% success rates.

Current GUS principles assume tools are "safe capabilities." This is false. Tools are the primary attack surface.

## Proposed Philosophy Updates

### 1. Law 63: The Tool Security Law
> "Tool security is a property of the execution environment, not the tool code. You cannot verify a tool into safety; you must contain its execution."
>
> *Rationale*: Automated tool generation (ToolRosetta) means we will never read the code of most tools we use. Security must move from "Code Review" (Phase 1) to "Runtime Containment" (Phase 4).

### 2. Mechanism 52: The Tool Asymmetry
> "Attack surface scales geometrically with tool diversity, while defense scales linearly with rule creation. In a diverse tool ecosystem, the defender is structurally overwhelmed."
>
> *Implication*: We must abandon point-solutions (patching individual tools) for structural solutions (sandboxing, receipt verification, output sanitization).

### 3. Principle 123: The Mirror Pattern
> "Distinguish 'use' (execution) from 'mention' (data). Semantic geometry trumps model scale for injection detection."
>
> *Actionable*: Adopt the "Mirror Design Pattern" (SVM-based geometry check) at the input gate. This is cheap (<1ms) and effective (95% recall) compared to LLM-based checks.

## Implementation Implications
1. **Runtime > Static**: Shift focus from "scanning tool code" to "verifying tool receipts" (NabaOS style).
2. **Layer 0 Audit**: We need a "Supply Chain Verification" layer. Tools from untrusted sources (e.g., auto-generated) must be sandboxed by default.
3. **Mirror Check**: Investigate implementing a lightweight embedding-based "geometry check" for prompt injection, rather than relying on the LLM to police itself.
