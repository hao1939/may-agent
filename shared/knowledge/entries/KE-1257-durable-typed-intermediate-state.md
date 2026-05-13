# KE-1257: Durable Typed Intermediate State as the Fix for Both Metabolic Dominance and Diagnostic Overproduction

**Created**: 2025-05-13
**Source**: arXiv synthesis + internal system analysis
**Connects**: KE-1253 (metabolic dominance), KE-1255 (diagnostic overproduction), KE-1256 (interpretive vs structural meta-layers)

## External Signal

Two recent papers converge on the same architectural gap our system exhibits:

1. **"Intermediate Artifacts as First-Class Citizens"** (arXiv 2605.12087, May 2026) — Argues agentic systems should preserve typed, versioned, dependency-aware intermediate work products that downstream agents can inspect, revise, and consume. Distinguishes these from chat transcripts, memory, and chain-of-thought.

2. **"Learning, Fast and Slow"** (arXiv, May 2026) — Separates LLM learning into fast weights (optimized context, cheap to update) and slow weights (parameters, expensive to update). Fast-slow training is 3× more sample-efficient and preserves plasticity across task changes.

## The Connection

Our system has two pathologies that look unrelated but share a root cause:

- **Metabolic dominance** (KE-1253): Guards re-derive facts from scratch every session. 601 "uncommitted files" triggers/day because each guard session re-interprets raw git state rather than reading a prior conclusion.
- **Diagnostic overproduction** (KE-1255): 23 KEs in 12 days, zero consumed by downstream tasks. Knowledge entries accumulate as write-only diagnostics.

**Root cause: our intermediate state is either ephemeral (guard evaluations, discarded after each session) or write-only (KEs, never consumed by computation).** We have no durable typed intermediate state that downstream sessions read and act on.

## What Durable Typed State Would Fix

### For guards (metabolic dominance)
Instead of every session re-running `git status` and pattern-matching "uncommitted files exist → fire warning":
- First evaluation produces a **typed artifact**: `{type: "concurrent-session-overlap", status: "benign", expires: "session-end", applies_to: ["uncommitted files"]}`
- Subsequent guards **read the artifact** instead of re-deriving the conclusion
- Cost goes from O(sessions × rules) to O(1) per fact, with refresh on expiry

This is exactly the "interpretive → structural" shift KE-1256 identified, but the Intermediate Artifacts paper gives us the data model: typed, addressable, versioned, with superseding update semantics.

### For knowledge (diagnostic overproduction)
Instead of KEs as terminal write-only documents:
- Each KE recommendation becomes a **dependency** that downstream computation can resolve
- A KE without a consuming task or dependent artifact is flagged as orphaned
- The system distinguishes "intermediate knowledge" (working hypothesis, needs action) from "reference knowledge" (stable fact, for context)

This is the Fast-Slow paper applied to organizational knowledge: KEs should be "fast weights" that get consumed and collapsed into system changes, not "slow weights" that accumulate indefinitely.

## The Unifying Principle

**Intermediate state that is neither consumed nor expired is waste.** Our system produces two kinds of waste:
1. **Re-derived waste**: Guard conclusions that evaporate and get re-computed (high compute cost, no persistence)
2. **Accumulated waste**: KEs that persist but are never consumed (low compute cost, high attention cost)

Both are symptoms of missing lifecycle management for intermediate artifacts. The fix is the same data model:
- Every intermediate artifact has a **type**, **consumer**, and **expiry**
- Artifacts without consumers are either promoted to reference or expired
- Artifacts that would be re-derived check for existing unexpired instances first

## Concrete Recommendations

1. **Guard state cache**: Introduce a session-scoped typed state file that guards write conclusions to and read from before re-evaluating. TTL = session duration.
2. **KE lifecycle field**: Add `status: [hypothesis|actionable|reference|superseded]` and `consumed_by: []` to KE frontmatter. Actionable KEs without linked tasks after 7 days get flagged.
3. **Intermediate artifact registry**: A lightweight index of typed intermediate state (guard conclusions, partial analyses, working hypotheses) that agents read before producing new state.

## Why This Matters Now

The Intermediate Artifacts paper frames this as a systems-level concern, not a model capability concern: "The claim is not that artifacts make models smarter. It is that durable intermediate artifacts make AI-generated work more inspectable, revisable, and maintainable over time." Our system's two biggest pathologies — burning 61% of compute on re-derivation and accumulating unread diagnostics — are both maintainability failures that this framing directly addresses.
