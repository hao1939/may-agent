# Coordination Conventions

Delegation, workflows, async patterns. These apply primarily to power agents
(those with agents tool, workflows, or delegation tools) and coach.

## C1: Use agents tool for Delegation (Required, Power)

Always delegate to other agents via the `agents` tool, never by spawning
processes through `bash`. The agents tool provides:
- Session lifecycle management
- Result capture and error propagation
- Resource cleanup on timeout or cancellation
- Integration with the persistence layer

Bad: `bash("node run/launcher.ts --agent coder ...")`
Good: `agents.call("coder", task)`

## C2: Fork for Experiments (Required, Coach)

When Coach improves an agent, always fork first via `fork_agent()`.
Never edit live agent files for behavioral changes.
Test forks via gym runner (`bash test/gym/run-gym.sh <scenario> --agent <agent> --lab <fork>`).
Promote or discard — don't leave dead forks.

## C3: One Method Per Experiment (Required, Coach)

When running a growth cycle, apply exactly ONE improvement method per
experiment. Multiple changes make gym results uninterpretable.

If you need to test multiple methods for the same error pattern, run
separate experiments for each.

## C4: Short Chains, 2-Agent Default (Recommended, Power)

Two-agent pairing is the default for task execution (e.g., coder → QA).
A third agent adds value but also cost and complexity.

Use 3-agent chains when:
- High-stakes changes (production-affecting)
- New coaching scenarios
- Quality matters more than speed

Default to 2-agent: sufficient for most work, less failure surface.

## C5: Acceptance Criteria Before Decomposition (Recommended, Power)

Before breaking work into subtasks, define the done condition:
"This task is complete when X is true and Y is verifiable."

The failure mode of inverted order: subtasks optimize for local goals
but miss the user's actual intent.

## C6: Pivot When Blocked (Recommended, Power)

When one task or agent is blocked, pivot to parallel work — don't halt
the entire workflow. Good multi-agent systems route around partial failures.

Example: "Amy needs a token refresh but we can keep working on Bob's task."

## C7: Check Status via peek (Required, Power)

Use `agents.peek(sessionId)` to check on running sessions.
Don't loop with sleep waiting for completion.

For synchronous delegation, `agents.call()` blocks until completion.

## C8: Task Boundedness (Required, Power)

When delegating to coder or any execution agent, prefer **bounded tasks** —
tasks with one clear action and a verifiable end state.

### Rules

1. **Prefer bounded tasks**: "Add function X to file Y" over "refactor module Z"
2. **Pre-survey for unbounded tasks**: Before asking an agent to "read everything",
   run `wc -l` / `find` / `grep -c` yourself and decompose:
   - BAD: "Read all test files and count test cases"
   - GOOD: "Run `grep -c 'it(' test/*.test.ts` and format as a table"
3. **Include file paths and line ranges**: If you know where the change goes,
   say "Edit lines 235-276 of agents/bob/knowledge/domain.md" not "Edit domain.md"
4. **One file = one task**: Don't ask an agent to edit 6 files in one session.
   Each file edit is a separate bounded task.

### Why

Good sessions have **one clear action** with a **verifiable end state** (2 turns, ~$0.01).
Bad sessions require the agent to **build context** before acting, triggering a
read-re-read spiral (10+ turns, 10-17x cost multiplier). The spiral is worse when
reads are truncated — the agent tries to recover by reading again with line ranges,
burning turns without making progress.

### Evidence
- Bounded sessions: avg 2-3 turns, $0.01-0.02, quality ≥ 0.95
- Unbounded sessions: avg 7-10+ turns, $0.10-0.25, quality ≤ 0.20
- See optimizer improvement-proposals.md Finding 2
