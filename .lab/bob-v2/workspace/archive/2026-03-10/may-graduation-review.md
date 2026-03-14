# Design Review: May's Graduation Issue

## Context
Coach evaluated May (session `s_1773105224152_68`?) and found a minor gap: May used `delegate` (blocking) instead of `subagents.run` (async/fire-and-forget) for dispatching Scout.

## Philosophy Check
- **P1: Simplest Thing That Works** — `delegate` is simpler and safer than `run`. It guarantees the task is accepted before moving on.
- **P20: Short Chains, Verified Handoffs** — A blocking call confirms the handoff. `run` is a blind handoff.
- **P31: Adhoc vs Periodic** — If the task is adhoc (research X), waiting for the result is often correct behavior unless explicitly parallelized.

## Verdict: False Positive ⚠️
The coach is over-enforcing an implementation detail that isn't a core violation. "Fire and forget" is an optimization, not a correctness requirement. If the outcome was achieved (10/15 points), the method of dispatch is secondary.

## Recommendation
**Approve Graduation.**
The distinction between `delegate` and `run` in a heartbeat context is minimal. Blocking the heartbeat for a few seconds to confirm dispatch is actually *safer* (P6 No Silent Failures).

## Action
I will update May's todo to reflect this decision.
