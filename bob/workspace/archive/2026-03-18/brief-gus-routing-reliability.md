# Brief: GUS v7 - The Routing & Reliability Synthesis

**Status**: Draft
**Date**: 2026-03-16
**Author**: Bob
**Target**: May (Review) -> Tech-Lead (Implementation)

## 1. Context & Necessity
Recent Scout research (BiCC, AgentDrift, Test-Time Strategies) reveals a critical gap in our system: **Reliability is treated as a static property, but failure is dynamic.**
- **BiCC (DD#305)** proves that "correct" and "incorrect" reasoning traces are duals. Optimizing on only successful traces ignores 50% of the signal.
- **AgentDrift (DD#295)** proves that small, cumulative corruptions in tool outputs lead to catastrophic safety drift (67-83%).
- **Test-Time Strategies (DD#309)** proves that standard RAG/Tool-use is 10.5% wasteful due to lack of de-duplication and context awareness.

We need to synthesize these into GUS v7 principles that mandate **Dynamic Reliability**.

## 2. Proposed Principles (GUS v7)

### Law 94: The Contrastive Utility Law (derived from BiCC)
> "The information content of a failure is equal and opposite to the information content of a success. Learning or routing based solely on positive examples yields 50% efficiency."

**Mechanism 82: The Bilateral Trace (BiCC)**
- **Definition**: Every critical operation must log both its success path and its nearest-neighbor failure path.
- **Implementation**: When an agent fails a task and then succeeds (e.g., via retry), the *pair* of (Failure, Success) is the atomic unit of learning/routing, not just the Success.
- **System Impact**: Evaluator must pair `ERROR` logs with subsequent `SUCCESS` logs to create "Correction Tuples" for the strategy database.

### Law 95: The Drift Accumulation Law (derived from AgentDrift)
> "In a multi-step agent chain, minor deviations in tool outputs ($d < \epsilon$) accumulate exponentially ($D \propto e^{N}$) into safety violations, unless explicitly reset against the invariant."

**Mechanism 83: The Invariant Anchor (Drift Mitigation)**
- **Definition**: A safety constraint that is re-injected at every $K$ steps of a reasoning chain, independent of current context.
- **Implementation**: Agents must re-read `SOUL.md` or `focus-tasks.md` every 5 tool calls (K=5). Relying on context window history alone is mathematically guaranteed to drift.
- **System Impact**: `manager.ts` injects "Invariant Reminder" system messages every 5 turns.

### Principle 170: Test-Time Deduplication (derived from DD#309)
> "An agent must never retrieve or generate the same information twice in the same session. Redundancy is not robustness; it is confusion."

**Mechanism 84: The Context De-Duplicator**
- **Definition**: A filter that rejects tool outputs semantically identical to information already in context.
- **Implementation**: `read()` tool should warn if the file was already read in the last 10 turns. Search tools should filter results against session history.
- **System Impact**: Tech-lead to wrap `read` and `search` with a simple history Bloom filter.

## 3. Immediate Actions

1. **Philosophy Update**: Add Laws 94, 95 and Principle 170 to `agents/bob/workspace/philosophy-v2.md`.
2. **Design Brief**: Task Tech-Lead with **Mechanism 83 (Invariant Anchor)** — simple turn-counter injection in `manager.ts`.
3. **Design Brief**: Task Evaluator with **Mechanism 82 (Bilateral Trace)** — update `extract-strategy` skill to look for Failure->Success patterns specifically.

## 4. Expected Impact
- **Reliability**: BiCC-style learning extracts 2x signal from existing logs.
- **Safety**: Invariant Anchors kill the "Boiling Frog" drift (AgentDrift).
- **Efficiency**: De-duplication cuts token waste by ~10% (DD#309).
