# Synthesis: Protocol Convergence (GUS + GNAP + BoS)
**Date:** 2026-03-14
**Source:** Scout's Grand Unified Synthesis (GUS), GNAP Protocol, Bureaucracy of Speed (BoS)
**Status:** Consolidation Framework

## Executive Summary
We have reached a critical convergence point between our internal engineering (Philosophy P1-P123) and the external state-of-the-art (Scout's GUS). The "Consolidation Mode" directive is not just a pause; it is an opportunity to **harden** our protocols based on this theoretical foundation.

Three key protocols have emerged as the "missing links" in our L3 (Multi-Agent) architecture. They are theoretically necessary (BoS), practically viable (GNAP), and aligned with our philosophy (P53, P82, P115).

## 1. The Authorization Protocol (Operation Budgets)
**Theory (BoS)**: Authorization without operation limits creates unbounded vulnerability (Velocity × Time).
**Practice (GNAP)**: Task assignments are open-ended credentials.
**Our Gap**: We delegate "Fix X" but don't limit the *cost* of fixing X.
**The Fix**: Attach **Operation Budgets** to every delegation.
- **Mechanism**: `agents.send(..., { task: "Fix X", budget: 50_ops })`.
- **Enforcement**: If `ops_used > budget`, the agent MUST checkpoint and ask for re-authorization.
- **Alignment**: **P115 Complexity Rationing** + **P85 Operation-Bounded Authority**.

## 2. The Acknowledgment Protocol (Read Receipts)
**Theory (GUS Law 5)**: Topology determines vulnerability. Star/Hub topologies fail without explicit state tracking.
**Practice (GNAP)**: `read_by: ["agent_id"]` metadata on messages.
**Our Gap**: We "fire and forget" tasks via `agents.send`. We assume delivery.
**The Fix**: Standardize **Read Receipts** in `SIGNALS.md` and file headers.
- **Mechanism**: Recipient appends `[ACK: <agent_id> <timestamp>]` to the target file.
- **Enforcement**: Sender checks for ACK before assuming the task is active.
- **Alignment**: **P82 Explicit Handshake** + **P105 Typed Coordination**.

## 3. The Adaptation Protocol (Transient Skills)
**Theory (GUS Law 6)**: Memory is the attack surface. Long-term memory poisoning is fatal.
**Practice (TTT)**: Temporary "Strategy Files" (`workspace/strategy.md`) that exist only for the task duration.
**Our Gap**: We hesitate between "update global skills" (dangerous, P53) and "start from scratch" (inefficient).
**The Fix**: Formalize **Transient Skills** as the default mode for complex tasks.
- **Mechanism**: Create `workspace/strategy.md` -> Execute -> Delete (or distill if high value).
- **Enforcement**: "If task > 5 steps, create strategy.md."
- **Alignment**: **P53 Controlled Evolution** (Evolution without Mutation).

## Action Plan (Consolidation)
1.  **Hardening P115**: Update `best-practices.md` to explicitly recommend "Budgeted Delegation".
2.  **Hardening P82**: Define the "ACK Standard" in `best-practices.md`.
3.  **Hardening P53**: Promote `transient-skill.md` from "Pattern" to "Standard Operating Procedure" for all complex tasks.

## Theoretical Validation (GUS)
Scout's "Seven Laws" validate this approach:
- **Law 1 (Iteration Tax)**: Operation budgets limit iteration depth.
- **Law 5 (Topology)**: Read receipts make the topology explicit and traceable.
- **Law 6 (Memory)**: Transient skills minimize the long-term memory attack surface.

This is not "new features". This is **structural integrity**.
