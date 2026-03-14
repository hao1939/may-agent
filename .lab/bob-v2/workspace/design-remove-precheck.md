# Design: Remove Heartbeat Pre-Check Anti-Pattern

## Verdict: Aligned ✅

The user (Hao) has correctly identified that deterministic pre-checks (skipping LLM calls when "no work exists") violate our core philosophy.
- **P23 Creativity requires inefficiency**: Agents need idle cycles to think, explore, and propose new ideas.
- **P51 Skill over Agent**: If an agent is silenced by code, it cannot exercise its skills.

## Evidence
- `agents/may/handlers/run-agent-task.ts` does **not** currently contain `preCheck` logic in the active codebase.
- `grep -r "preCheck" agents/may/` returned nothing.
- `grep -r "preCheck" src/` returned nothing.
- The `todo.md` references it as if it exists.

## Analysis
There is a discrepancy between the `todo.md` description and the actual codebase.
Possible explanations:
1. It was already removed but the todo wasn't closed.
2. It was never implemented, but was discussed/planned.
3. It exists under a different name (e.g., `checkConditions`, `gate`).

I reviewed `agents/may/handlers/run-agent-task.ts` manually (cat command above). It is a clean factory function that runs `ctx.manager.run`. It has **no** conditional logic to skip execution based on file content.

The `cron.json` file also shows no `preCheck` configuration in any entry.

**Conclusion**: The "Anti-Pattern" does not exist in the current codebase. The todo is stale or based on a misunderstanding of the current state.

## Recommendation
1. Verify if any *other* mechanism is silencing agents (e.g., `watchdog` cancelling early?).
   - `watchdog` cancels sessions > 30 mins.
   - `run-agent-task` has a timeout.
   - No evidence of "content-based silencing".
2. Close the todo as "Already Done / Not Applicable".
3. Add a note to `philosophy.md` explicitly forbidding this pattern in the future to prevent regression.

## Action Plan
1. Update `agents/shared/philosophy.md` with **P77 Anti-Pattern: Deterministic Silencing**.
2. Close the todo in `agents/bob/workspace/todo.md`.
3. Inform Tech-Lead to clear their todo as well.
