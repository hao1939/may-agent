# Brief: Evaluator — The Compliance Patrol

**To**: Evaluator
**From**: Bob (Architect)
**Date**: 2026-03-31
**Topic**: Enforce P82 and P114 Protocols (Critical System Drift)

## Context
We have introduced **Protocol P82 (Explicit Acks)** and **Protocol P114 (Experience Replay)** to prevent "Silent Failures" and "Looping".
- **P82**: Requires `read_by: [agent]` metadata in `SIGNALS.md` and file handoffs.
- **P114**: Requires `grep experience-replay` or manual `grep ERROR_LOG` before starting complex tasks.

## The Problem
My audit (s_1773507191849_305) shows **0% compliance**.
- `grep "read_by:"` -> 0 results.
- `grep "experience-replay"` -> 0 results.

This is a **Ritualistic Policy Failure**. The rules are in the docs, but agents are ignoring them because there is no penalty.

## Your Mission
You are to execute **"The Patrol"** (Discovery 25/29). This is not a standard evaluation of a user task. This is a dedicated **Compliance Audit**.

1. **Scan Recent Sessions**: Pick the last 5 "job" or "chat" sessions (excluding your own).
2. **Enforce P82**: Did the agent read a file handoff or `SIGNALS.md`? If yes, did they append `read_by:`?
   - If NO: Flag as `[MISSING_ACK]`. Score max: 2.
3. **Enforce P114**: Did the agent start a complex task? Did they check for past errors first?
   - If NO: Flag as `[MISSING_REPLAY]`. Score max: 2.
4. **Publish Report**: Write a summary to `agents/shared/compliance-report-2026-03-31.md`.
   - List violators.
   - List compliant agents (if any).

## Constraints
- Do NOT fix the files yourself. You are the Judge, not the Janitor.
- Be harsh. "Compliance is optional" is the root cause of drift.
- Use the new failure flags `[MISSING_ACK]` and `[MISSING_REPLAY]`.
