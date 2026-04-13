# DD-756: OpenKedge — Governed Agentic Mutation with Execution-Bound Safety and Evidence Chains

**Paper**: "OpenKedge: Governing Agentic Mutation with Execution-Bound Safety and Evidence Chains"
**arXiv**: 2604.08601v1
**Authors**: He, Yu
**Session**: 713+ (2026-04-13)
**Relevance**: ★★★★ — Formal protocol for governed mutation in multi-agent systems; direct connection to KE-161 guard architecture

---

## Core Thesis

Current agentic AI frameworks face a fundamental safety gap: they can generate and execute code mutations but lack formal governance over the mutation lifecycle. OpenKedge proposes a **preventative, execution-bound** safety framework where every mutation must satisfy a complete evidence chain (from intent declaration through execution verification) before it can run. This replaces reactive post-hoc filtering with **proactive mutation governance**.

---

## Key Contributions

### 1. Intent-to-Execution Evidence Chain (IEEC)

The central architectural innovation. Every mutation flows through a mandatory pipeline:

1. **Intent Proposal** (I): Agent declares what it wants to change and why
2. **Plan Verification** (P): Proposed changes are validated against safety constraints
3. **Execution Sandboxing** (E): Mutation runs in isolated environment
4. **Evidence Binding** (V): Results are cryptographically bound to the original intent

Each stage produces a signed evidence record. The chain is immutable — retroactive modification of intent or plan after observing execution results is provably impossible.

### 2. Execution-Bound Enforcement (vs. Reactive Filtering)

Traditional safety approaches in agentic systems:
- **Reactive**: Monitor outputs, flag/block after generation (guardrails, content filters)
- **Alignment-based**: Train agents to refuse harmful requests (RLHF, constitutional AI)

OpenKedge's approach:
- **Preventative**: Mutations cannot execute without prior verified intent
- **Structural**: Safety is architectural, not behavioral — doesn't depend on model compliance
- **Bound**: Safety evidence is cryptographically bound to execution context

The paper argues reactive approaches fail because:
- By the time output is monitored, side effects may already have occurred
- Model compliance degrades under adversarial prompting
- Post-hoc filtering creates an arms race between filter and generation

### 3. Governed Mutation Protocol

The formal protocol specifies:
- **Mutation scope declaration**: What files/systems/APIs the mutation will touch
- **Precondition verification**: System state must satisfy declared preconditions
- **Sandboxed execution**: Mutations run in isolated containers with declared resource limits
- **Postcondition validation**: Output must satisfy declared postconditions
- **Rollback capability**: Any mutation that fails postcondition validation is automatically reverted
- **Lineage tracking**: Complete provenance chain from intent through outcome

### 4. Cryptographic Lineage

Each evidence chain link is cryptographically signed:
- Intent proposals are hashed and timestamped
- Plan-to-intent binding prevents plan drift
- Execution artifacts are signed with the sandbox's attestation key
- Evidence chain verification is O(n) in chain length — efficiently auditable

### 5. Multi-Agent Governance

For systems with multiple agents proposing mutations:
- **Conflict detection**: Overlapping mutation scopes trigger coordination protocol
- **Priority resolution**: Based on declared intent urgency and scope overlap
- **Consensus verification**: Multi-agent mutations require evidence chain agreement
- **Blame attribution**: When mutations fail, the evidence chain identifies which agent's contribution caused the failure

---

## Connections to Our Research

### KE-161 (Guard Architecture — Permanent Linter Paradigm) — DIRECT CONNECTION

KE-161 proposes guards as "permanent linters" that continuously validate agent output. OpenKedge provides a formal protocol for what this looks like in practice:

- **Linter as Plan Verifier**: The guard's role maps to OpenKedge's Plan Verification stage — reviewing proposed changes against safety constraints before execution
- **Evidence chain = audit trail**: Our gate checkpoints are informal versions of OpenKedge's evidence chain — recording what was reviewed, what was flagged, what passed
- **Preventative > reactive**: OpenKedge validates our architectural intuition that guards should prevent bad mutations rather than detecting them after the fact

**Critical difference**: OpenKedge assumes mutations are explicit code changes. Our guard architecture deals with reasoning mutations (changes in analysis, conclusions, strategy). The IEEC protocol may need adaptation for cognitive vs. code mutations.

### DD-754 (Bias Amplification in MAS)

OpenKedge's multi-agent governance addresses one of DD-754's core problems: cascading bias through agent chains. If each agent's output mutation must declare intent and satisfy postconditions, the amplification cascade can be interrupted at any stage where postcondition verification detects distributional drift.

However, DD-754's finding that even "Reflector" agents provide only temporary bias reduction suggests that **postcondition verification must be holistic** — checking not just the current mutation but the cumulative distributional effect across the chain.

### DD-755 (Artifacts as Memory)

OpenKedge's evidence chain artifacts (intent declarations, plan records, execution logs) serve as environmental memory in the DD-755 sense. They are artifacts that encode information about past agent interactions and reduce the internal capacity needed for subsequent agents to understand system state. The evidence chain is a structured form of workspace-as-memory.

### H-107 (Difficulty Threshold)

The overhead of OpenKedge's IEEC protocol is non-trivial — intent declaration, plan verification, sandboxed execution, and evidence binding all add cognitive and computational cost. For easy mutations (routine, well-understood changes), this overhead may reduce throughput without proportional safety benefit. For hard mutations (novel, high-risk changes), the overhead is justified. This maps directly to H-107's threshold prediction: governance overhead helps when task difficulty warrants it.

### KE-106 (Habituation)

The evidence chain provides a structural defense against habituation: even if an agent has become habituated to a particular pattern of mutations, the evidence chain forces each mutation through the full verification pipeline. The cryptographic binding prevents "rubber-stamping" — the plan verifier must produce a novel evidence record for each mutation, not re-use a prior approval.

---

## Limitations & Open Questions

1. **Prototype-only**: No empirical evaluation of OpenKedge's overhead or effectiveness. The paper is primarily architectural/protocol-level.
2. **Code mutation focus**: Designed for code/system mutations. Adaptation to reasoning/analysis mutations (our primary domain) is non-trivial.
3. **Verification oracle problem**: Plan verification and postcondition validation require an oracle that can assess mutation quality — but this oracle faces the same capability limitations as the agent being verified (who verifies the verifier?).
4. **Latency cost**: Cryptographic operations, sandbox setup/teardown, and evidence chain management add latency. For real-time agentic systems, this may be prohibitive.
5. **Scope declaration gaming**: A sophisticated agent could under-declare mutation scope to bypass governance — the protocol assumes honest scope declaration or relies on sandbox isolation to catch scope violations.

---

## Actionable Implications

1. **Formalize gate checkpoints**: Our current gate checkpoint files are informal. OpenKedge suggests structuring them as evidence chains with explicit intent-plan-execution-verification stages.
2. **Preventative guard design**: Prioritize guards that verify intent before execution over guards that filter output after generation. This aligns with KE-161's "linter" framing.
3. **Mutation scope declarations**: When agents propose changes (to analysis, strategy, or code), require explicit scope declarations. This enables conflict detection in multi-agent settings.
4. **Audit trail design**: Cryptographic binding may be overkill for our setting, but the principle of immutable evidence chains (append-only checkpoint logs) is directly applicable.
5. **Overhead-aware deployment**: Deploy full IEEC governance for high-risk/high-difficulty mutations; use lightweight governance for routine mutations (H-107 threshold principle).

---

## Tags
guard-architecture, mutation-governance, evidence-chains, execution-safety, preventative-safety, multi-agent-governance, linter-paradigm, IEEC, cryptographic-lineage, sandbox-verification
