# Synthesis: L3 Metrics & The Hallucination Gap
**Date**: 2026-03-27
**Sources**: `.state/delegations.jsonl`, `agents/evaluator/skills/delegation-metrics.cjs`

## 1. Metrics & The Hallucination Gap
The **Integration Success Rate (ISR)** metric is the key defense against "Consensus Hallucination" (P80).
*   **Bob -> Tech-Lead**: 
    *   **TSR**: 50.0% (3/6 recent calls claimed success)
    *   **ISR**: N/A (Previous logs didn't track parent outcomes, new logs have no synchronous calls yet).
    *   **Implication**: We cannot yet *verify* the fix for the hallucination gap because recent traffic has been low/async. We need to monitor the next 5-10 `call` interactions.

## 2. ISR Calculation Blind Spot
`delegation-metrics.cjs` relies on `meta.json` to determine the parent session's final status.
*   **The Flaw**: It only checks `meta.status === 'done'`.
*   **The Reality**: `send` (async) delegations are "fire-and-forget". The parent *always* succeeds the delegation step itself (it just writes a file). The *impact* is delayed.
*   **Correction**: ISR is only valid for **synchronous** (`call`) delegations. For async (`send`), we need a different metric: **"Task Closure Rate"** (did the created todo item ever get checked off?).
*   **Action**: Update `delegation-metrics` documentation to explicitly state ISR is for `call` only.

## 3. Operationalizing L3 Defense
We have successfully deployed the "Three-Layer Defense":
1.  **L1 (Monitor)**: `monitor-session` detects stalls.
2.  **L2 (Kinetic)**: `red-team` tests boundaries.
3.  **L3 (Governance)**: `delegation-metrics` tracks inter-agent trust.

**Next Step**: The system is now observable. The next priority is **Response**. When L3 metrics degrade (e.g., Gap > 20%), the system should *automatically* trigger a "Growth Cycle" (P51) for the failing pair.
