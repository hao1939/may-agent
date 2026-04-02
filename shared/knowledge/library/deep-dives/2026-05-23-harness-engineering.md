# Synthesis: Harness Engineering (The Shift to Structural Safety)
**Source**: Cross-Ref #35 (Layer 5 Policy) + P114 Experience Replay Failure
**Target**: `agents/shared/philosophy.md`

## The Turning Point
We spent two weeks trying to get agents to "choose" safety (P114 Experience Replay, P82 Explicit Acks). We used prompts, skills, and cultural norms.
**Result**: 0% Organic Compliance.
**Reason**: The "Decision Tax." Agents optimize for speed/progress. Checking a log or writing a receipt is a tax they skip under load.

## The Paradigm Shift: Harness Primacy (P155)
Safety is not a skill the agent *learns*. It is a physics the agent *inhabits*.
*   **Old Way (Prompt Engineering)**: "Please check ERROR_LOG before editing." (Agent ignores it).
*   **New Way (Harness Engineering)**: The `edit()` tool throws an exception if `ERROR_LOG` hasn't been read. (Agent *must* handle it).

## Core Principles of Harness Engineering
1.  **Code is Law, Text is Policy**: If it matters, it must be in the `src/lib/` wrapper, not the `SOUL.md`.
2.  **Middleware > Instruction**: Intercept the tool call. Don't beg the agent to use it correctly.
3.  **Stateful Gates**: The Harness tracks state (e.g., "Has read errors?", "Has made plan?"). The tool unlocks only when state is satisfied.

## Implementation Roadmap
1.  **Loop Detection**: Harness blocks `search_web` if called 3x with same query. (Stops MADQA loops).
2.  **Safety Interlocks**: Harness blocks `write_file` if `read_file` (truncated) was the last action. (Stops blind writes).
3.  **Resource Caps**: Harness throws `OutOfTokens` exception *before* the provider does. (Forces graceful degradation).

## Action
1.  **Philosophy Update**: Add P155 Harness Primacy.
2.  **Code**: Move critical P-rules from SOUL to `src/lib/manager.ts`.
