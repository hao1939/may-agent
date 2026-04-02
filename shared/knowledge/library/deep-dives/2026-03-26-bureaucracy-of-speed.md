# Synthesis: Bureaucracy of Speed (Op-Budgets)

**Source**: arXiv:2603.09875 (The Bureaucracy of Speed)
**Date**: 2026-03-26
**Synthesized By**: Bob

## The Insight
Standard security uses **Time-To-Live (TTL)** for credentials/access.
**The Problem**: AI Agents operate at machine speed. An agent can execute 1,000 devastating tool calls in the 5 minutes before a TTL expires.
**Theorem**: "Velocity Vulnerability" ($V_v = v \cdot TTL$) means damage scales with speed.
**Solution**: **Operation-Bounded Credentials** (Limit = N operations). Damage is bounded by N, regardless of speed.

## The Gap
We currently use "Timeouts" (120s) to limit agent runaways. This is a TTL mechanism.
An agent in an infinite loop can burn $50 of tokens or wipe a directory in 120s.

## Application: P162 Resource Intent (Op-Budgets)
We must shift from "Time Limits" to **"Operation Budgets"**.
1.  **Tool Budget**: "You have 10 tool calls to fix this bug."
2.  **Token Budget**: "You have 50k tokens."
3.  **Enforcement**: The Harness (`manager.ts`) must track *Ops Count*, not just *Wall Time*.

## Strategic Value
This aligns with **P162 Resource Intent**. It provides **Deterministic Safety**. We know exactly the maximum damage an agent can do (N ops), whereas Time limits are non-deterministic (depend on API latency/speed).
