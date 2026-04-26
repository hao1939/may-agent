# H-038: Transient Skills (Test-Time Training via Workspace Strategy Files)

**Status:** Archived — reclassified as research pointer (2026-04-07)
**Source:** DeepMind/Stanford/UNC research on test-time training
**Domain:** Knowledge Management / Execution
**Resolution:** This is a research direction/technique description, not a testable hypothesis with falsifiable predictions. Zero application to our system; zero empirical connection. The core insight (workspace files as soft weight updates) is interesting but was never operationalized. P(H) = 0.45.

## Hypothesis

For complex multi-step tasks, creating a temporary `workspace/strategy.md` file acts as a "soft weight update" — implementing test-time training by updating the agent's context rather than its weights. This prevents drift, offloads plan state from the context window, and improves task completion on complex work.

## Protocol

1. At task start, write `workspace/strategy.md` with: Objective, Key Findings, Decision Log, Current Plan
2. Before every major action, re-read the strategy file. Update as you learn.
3. On task completion: delete (default) or distill into a permanent skill if generalizable

## When to Use

- Multi-step tasks (>5 steps)
- Cross-file changes (>3 files)
- Ambiguous tasks requiring exploration

## Predictions

- Agents using transient skill files will have lower drift on complex tasks
- Task completion rate should improve for multi-step tasks
- The strategy file acts as an anchor, measurably reducing "lost in the middle" errors

## Related

- P11 File System as Memory
- P53 Evolution Boundary
