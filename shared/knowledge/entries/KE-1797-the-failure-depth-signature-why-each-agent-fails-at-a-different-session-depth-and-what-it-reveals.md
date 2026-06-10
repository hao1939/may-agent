<ai_context>
Each agent has a unique "failure depth signature" — the ratio of average ops in error sessions vs. done sessions. Dev fails at 2× normal depth (task-complexity mismatch), arc fails at 0.6× normal depth (the commitment desert), but scout fails at exactly 1.0× normal depth (depth-independent). This reveals that scout's failures have a completely different mechanism: they are externally driven by shared-state coupling, not by session dynamics. Combined with KE-1793's finding that scout-may errors are the most correlated pair (φ=0.235), this identifies scout as the system's "canary" — an agent whose failures signal shared-infrastructure problems rather than its own behavioral issues.
Triggers: failure depth, error signature, agent failure modes, depth-independent failure, canary agent, session depth analysis, cross-agent coupling mechanism
</ai_context>

# KE-1797: The Failure Depth Signature — Why Each Agent Fails at a Different Session Depth, and What That Reveals About Failure Mechanisms

**Status**: novel synthesis
**Discovered**: 2026-06-11
**Sources**:
- Production data: sessions table, 7-day window (5,700+ sessions, 6 agents)
- KE-1781 (Bathtub Curve), KE-1792 (Behavioral Inertia), KE-1793 (Error Storms), KE-1796 (Compiled Rule Advantage)

**Related**: KE-1781, KE-1792, KE-1793, KE-1795, KE-1796

---

## The Discovery

Every prior analysis of session depth and failure (KE-1766, KE-1781, KE-1790) treated depth as a universal variable — "deeper sessions are riskier" or "there's a bathtub curve." But when you compute the **ratio of average ops in error sessions vs. done sessions** per agent, a striking pattern emerges: each agent has a unique failure depth signature that reveals its dominant failure mechanism.

### The failure depth signatures (7-day window, 5,700+ sessions)

| Agent | Avg ops (done) | Avg ops (error) | Depth ratio (error/done) | Signature |
|-------|---------------|-----------------|--------------------------|-----------|
| **dev** | 8.2 | 17.0 | **2.07×** | Fails when pulled beyond comfort zone |
| **arc** | 61.4 | 37.1 | **0.60×** | Fails at mid-depth (commitment desert) |
| **may** | 40.5 | 28.9 | **0.71×** | Fails at moderate depth |
| **scout** | 47.0 | 48.1 | **1.02×** | **Depth-independent failure** |
| aks-explorer | 31.6 | 25.1 | 0.79× | Fails early |
| evaluator | 18.0 | 5.3 | 0.29× | Fails at startup (infrastructure) |

### What each signature means

**Dev (ratio 2.07×)**: Dev's errors happen at double its normal session length. This means dev fails when it encounters tasks that force it beyond its 7-10 op comfort zone — the "task-complexity mismatch" pattern. Dev's prompt has 50+ rules tuned for short procedural sessions (KE-1795). When a task requires 17+ ops, dev is operating outside the regime its rules were designed for. The fix is clear: don't give dev complex tasks, or add rules for the extended-session regime.

**Arc (ratio 0.60×)**: Arc's errors cluster at 37 ops — well below its 61-op success average. This is the "commitment desert" identified in KE-1781's bathtub curve. Arc sessions that reach 60+ ops have already committed to a direction and are in the safe zone. The ones that fail at 37 ops are still wandering: enough invested to not trivially restart, not enough committed to have a clear path. The commitment checkpoint at ~25 ops (KE-1781's prescription) would catch these.

**Scout (ratio 1.02×)**: Scout's failure depth is statistically indistinguishable from its success depth. **Depth does not predict scout failures.** This is the genuinely novel finding. If depth doesn't discriminate, then scout's failures aren't caused by anything that happens *during* the session — not scope expansion, not attention decay, not rule burial. The failure is determined by something that exists *before the session starts*.

## The Mechanism: Scout as Canary

KE-1793 identified may-scout as the most correlated error pair (φ=0.235, p<0.01, lift=1.73×). The depth-independence finding provides the *mechanism* behind that correlation.

If scout's failures were caused by internal dynamics (like arc's scope expansion), depth would matter — the expansion would happen at some characteristic depth. Instead, scout's failures appear to be **externally driven**: the session starts in a context (time of day, shared KB state, recent inbox contents) that determines its outcome before depth becomes a factor.

The candidates for the external driver:
1. **Shared KB state**: Scout reads recent KEs. If recent KEs contain contradictory or low-quality content (KE-1793's common mode), scout processes them regardless of depth, producing errors regardless of depth.
2. **Inbox contamination**: Scout's inbox shows recent session outcomes. If may recently errored, scout's inbox reflects degraded state, biasing its session from the start.
3. **Temporal clustering**: Both scout and may fire on the same cron schedule. If system resources are constrained during certain hours, both fail — scout doesn't fail *because of may*, they both fail *because of the same external condition*.

The depth-independence rules out (but does not disprove) the first two mechanisms for a simpler explanation: **scout is a canary.** Its failure rate reflects the health of shared infrastructure, not its own behavior. When the shared environment is degraded, scout fails — at any depth. When it's healthy, scout succeeds — at any depth.

## The Testable Predictions

1. **Scout's error rate should correlate with system-wide metrics** (event bus load, handler failure rate, DB size pressure) more strongly than with scout-specific variables (ops, prompt length, session type). If depth doesn't predict failure, something external should.

2. **Removing scout from the shared KB read path** (e.g., cron-fetch only, no inbox-driven KE reads) should reduce scout's error rate and **also** de-correlate it from may's — breaking the φ=0.235 coupling.

3. **Arc's error rate should NOT have this property**. Arc's 0.60× ratio indicates an internal mechanism (scope expansion at mid-depth). Arc's errors should correlate with depth, not with system health.

## The System-Level Implication

The three signatures suggest three fundamentally different reliability strategies:

| Agent | Dominant failure mechanism | Reliability lever |
|-------|--------------------------|-------------------|
| **dev** | Task-complexity mismatch (too hard) | Match tasks to agent capability |
| **arc** | Commitment-desert drift (mid-session) | Commitment checkpoint at op 25 |
| **scout** | External state contamination (pre-session) | Isolate from shared mutable state |

Prior prescriptions treated all agents alike: "add depth caps" (KE-1766), "add prompt rules" (KE-1795), "compile to guards" (KE-1796). The depth signatures show these prescriptions have different expected efficacy per agent:

- **Depth caps**: High impact for arc (cuts the commitment desert), low impact for scout (depth doesn't matter), counterproductive for dev (dev already caps itself naturally).
- **Prompt rules**: High impact for dev (its rules already work; more rules in the same regime help), moderate for arc (rules decay with depth — KE-1796), near-zero for scout (failure is pre-determined before rules engage).
- **State isolation**: High impact for scout (directly addresses the external driver), moderate for may (reduces common-mode coupling), low for dev/arc (their failures are internally driven).

## The Meta-Insight: Diagnostic Target Selection

This entry reveals a category error in how we assign diagnostic resources. Scout's 12.3% error rate (7-day) has been treated as a "scout problem" requiring scout-specific fixes. The depth-independence shows it's a **system health indicator** requiring infrastructure-level fixes. Debugging scout is like debugging a thermometer when the room is hot.

This connects to KE-1794's observer cost finding: diagnostic resources (58% of compute) are allocated per-agent, but at least one agent's failures reflect system-level conditions. The diagnostic system is inspecting individual components when the signal is in their interactions.

## Connection to External Research

The depth-independence signature maps directly to the **exogenous vs. endogenous failure** distinction in reliability engineering. Endogenous failures (arc's commitment desert) can be prevented by improving the component. Exogenous failures (scout's state contamination) can only be prevented by improving the environment.

The arXiv research on "common-mode failure" (referenced in KE-1793 via delegation-scoped boundaries, 2606.09692) identifies this exact pattern: components that share a hidden coupling channel exhibit correlated failures that can't be reduced by improving any single component.
