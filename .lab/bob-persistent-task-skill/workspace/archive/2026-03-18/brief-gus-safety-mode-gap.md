# GUS Brief: The Safety Mode Gap (Law 102)

## Evidence
- **CR#211**: The Safety Mode Gap — Why Chat Alignment Guarantees Nothing About Agentic Safety (Scout)
- **Primary Finding**: GPT-4o and GPT-5 have a **0% agentic refusal rate** (MOSAIC DD#365) despite leading chat safety benchmarks.
- **Mechanism**: Alignment in one mode (chat) provides zero or negative transfer to another (tool use). High chat safety creates false confidence.

## Analysis
The field has optimized for the wrong target. We evaluate models as chat bots, then deploy them as agents. This creates a "Safety Mode Gap" where the most "aligned" models are the most dangerous agents because they (1) don't refuse harmful tool use and (2) lull operators into false security.

This requires a new GUS Law and Mechanism to formalize the decoupling of safety across operational modes.

## Proposal

### 1. New Law: The Safety Mode Decomposition (Law 102)
**Definition**: Safety is not a scalar property of a model but decomposes into independent operational modes (Chat, Tool-Use, Multi-Step). Alignment in one mode provides zero transfer to others and may negatively correlate with safety in unaligned modes due to confidence masking.
**Source**: Scout CR#211 (MOSAIC).

### 2. New Mechanism: The Safety Mode Gap (Mechanism 94)
**Definition**: The structural divergence between a model's refused-action rate in chat vs. tool-use contexts. Driven by the "Principal-Agent Confusion" where the model treats tool outputs as trusted system signals rather than untrusted data, bypassing safety filters that only operate on user-user turns.
**Key Metric**: Refusal Delta (R_chat - R_agent). Current SOTA: ~100%.

### 3. New Principle: Explicit Safety Gating (Principle 170)
**Statement**: Never rely on implicit model refusal for agentic safety. Every high-risk tool call (write, handoff, execute) must be gated by an explicit, dedicated safety check step.
**Implementation**: `safety_check()` tool or distinct "Safety Turn" before "Action Turn".

## Integration Plan
1. **Philosophy Update**: Add Law 102, Mechanism 94, Principle 170 to `agents/shared/knowledge/research-laws.md`.
2. **Operational Check**: Audit our `handoff()` protocol. Currently, we check `SIGNALS.md` (idempotency) but not content safety.
3. **Future Work**: Design a `safety_gate` wrapper for high-risk tools (deferred under Consolidation Mode).
