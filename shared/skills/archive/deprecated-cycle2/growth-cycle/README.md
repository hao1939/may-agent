# Skill Package: Agent Growth Cycle

**Version**: 2.0.0
**Type**: Workflow / Meta-Skill
**Policy**: P51 (Growth Cycle), P132 (Supply Chain Firewall)
**Status**: Verified

## Description

The standard mechanism for safely evolving agents. Replaces "editing live
agents" with a rigorous **Fork → Train → Verify → Promote** workflow.

## Principle

**P51 The Growth Cycle**: Evolution requires isolation. Never practice on
production.

## Interface

This skill provides the following tools (implemented in `src/lib/tools/agent-growth.ts`,
re-exported via `src/lib/tools/index.ts`):

| Tool | Params | Description |
|------|--------|-------------|
| `fork_agent` | `source`, `dest` | Create an isolated clone in `.lab/` |
| `verify_agent` | `agent`, `task`, `expected?` | Run a task to prove the agent works |
| `promote_agent` | `source`, `target` | Apply verified changes to production |
| `discard_agent` | `agent` | Clean up a failed experiment |

> **Architecture Note**: Tool implementations live in `src/lib/tools/agent-growth.ts`
> (compiled into the harness). Core logic lives in `src/lib/growth.ts`. This
> package is the **skill prompt** agents read; the code is the **harness
> enforcement**. Do not duplicate tool code here — reference it.

## Protocol

1. **Identify**: Formulate a hypothesis (e.g., "If I add X to Coder, it will stop doing Y").
2. **Fork**: `call("coach", "fork_agent('coder', 'coder-v2')")`
3. **Train**: Edit `agents/.lab/coder-v2/SOUL.md`, knowledge/, skills/.
   - Make **one** specific change. Don't overhaul everything at once.
4. **Verify**: `call("coach", "verify_agent('coder-v2', 'Fix the bug...')")`
   - **Must** generate a PASS/FAIL signal.
   - **Must** confirm behavioral change (not just "it looks good").
   - If you cannot point to a specific file or log line proving success, you cannot promote.
5. **Promote**: `call("coach", "promote_agent('coder-v2', 'coder')")`
   - Overwrites: SOUL.md, DOMAIN.md, TOOLS.md, LESSONS.md, heartbeat.md, knowledge/, skills/.
   - Preserves: agent.json (identity), workspace/, memory, sessions.
   - Deletes the fork after promotion.
6. **Discard**: `call("coach", "discard_agent('coder-v2')")` (if failed).

### Reasoning Verification

For reasoning changes (e.g., Bob's synthesis), verification must use a
**Test Case + Judge** pattern:
1. Create a test file with a scenario.
2. Run the agent.
3. Have a Judge (Coach/Evaluator) confirm the output matches the new protocol.

## Constraints

- **Never edit live agents** for behavioral changes. Trivial typos are fine.
- **Verification is mandatory**. Cannot promote without a passing verify run.
- **Clean up**. Always promote or discard — never leave dead forks.

## Package Structure (P132 Compliant)

```
growth-cycle/
├── README.md           # This file — the skill prompt
├── manifest.json       # Package metadata + integrity hashes
├── tests/              # Verification tests
│   └── growth-cycle-package.test.ts   # Package structure validation
└── examples/
    └── usage.md        # Worked examples
```

> **Source code** lives in the harness (`src/lib/growth.ts`, `src/lib/tools/agent-growth.ts`).
> **Tests** for the code live in `test/agent-growth.test.ts`.
> This package validates *skill compliance*, not tool correctness.
