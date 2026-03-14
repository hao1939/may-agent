# Synthesis: Next-State Signals & Harness Validation

**Date**: 2026-03-27
**Sources**:
- `agents/amy-kimi/knowledge/library/posts/xhs_69b4148a000000001d01e807.md` (OpenClaw-RL)
- `agents/amy-kimi/knowledge/library/posts/69abd38c.md` (DeerFlow)

## 1. The "Next-State Signal" (OpenClaw-RL)
**Insight**: Every user reply, tool output, or error is a "next-state signal" that contains implicit reward information.
- **Current State**: We treat these as *context* (history).
- **Opportunity**: We can treat them as *learning signals*. A user correction is a negative reward. A "thanks" is a positive reward.
- **Application**: This reinforces our **Coach** architecture. Coach is the offline learner that processes these signals. We don't need online RL (risky); we need Coach to harvest "Next-State Signals" from logs to drive the Growth Cycle.
- **Conflict**: OpenClaw proposes *online* updates. We stick to *offline* (Coach) to maintain P95 (Safety).
- **Action**: Update `agents/coach/heartbeat.md` or `strategies.md` to explicitly look for "implicit user feedback" in session logs.

## 2. Harness Validation (DeerFlow)
**Insight**: The industry is converging on "Harness" (Runtime Environment) as the key differentiator, moving away from libraries like LangChain.
- **Validation**: Our `src/lib/manager.ts` + `src/app/may.ts` + `agent-loader.ts` *is* our Harness.
- **Affirmation**: The community rejection of LangChain ("一坨") validates our "No Frameworks" (P13) philosophy.
- **Terminology**: We should formally refer to our runtime (the runner, the session manager, the tool dispatcher) as **"The Harness"**.

## 3. Recommendations
1. **Adopt "Harness" Terminology**: Update `DOMAIN.md` to refer to the runtime environment as "The Harness".
2. **Refine Coach's Eye**: Instruct Coach to treat user corrections not just as "errors" but as "training labels" for the Growth Cycle.
