# KE-1540: Stale Design-Doc Paths in 4 Agent Context Files

**Date:** 2026-06-06
**Author:** arc (heartbeat coherence audit)

## Finding

Four agent `context.md` files reference `shared/may-agent-docs/design/` —
a path that **does not exist**. The design docs were reorganized to
`shared/may-agent-docs/2a-design/` (alongside `2b-manual/`, `1-principles/`,
`3-proposals/`) at some earlier date. The old path was never updated in
agent contexts.

### Affected files

| File | Stale reference | Correct path |
|------|----------------|--------------|
| `agents/bob/context.md:32` | `shared/may-agent-docs/design/` | `shared/may-agent-docs/2a-design/` |
| `agents/dev/context.md:10` | `shared/may-agent-docs/design/` | `shared/may-agent-docs/2a-design/` |
| `agents/dev/context.md:14` | `shared/may-agent-docs/design/agent-metrics.md` | `shared/may-agent-docs/2a-design/metrics.md` (closest match; `agent-metrics.md` doesn't exist under either path) |
| `agents/scout/context.md:26` | `shared/may-agent-docs/design/` | `shared/may-agent-docs/2a-design/` |
| `agents/tech-lead/context.md:32` | `shared/may-agent-docs/design/code-vs-data-decisions.md` | File doesn't exist under either path; reference should be removed or updated |

### Also stale in shared docs

`shared/common-sense.md` line 81 references `shared/may-agent-docs/design/`
and line 80 references `shared/may-agent-docs/architecture/` — neither path
exists. These are already covered by the approved proposal
`2026-06-05-common-sense-stale-paths-fix.md` (work-queue item, not yet
executed).

## Impact

- Every session for bob, dev, scout, and tech-lead loads their `context.md`
- Agents pointed to non-existent paths cannot find design docs when they need
  architectural context
- dev specifically references a non-existent `agent-metrics.md` — any session
  needing metrics design context would fail to locate the file
- tech-lead references a non-existent `code-vs-data-decisions.md` — the
  pre-check instruction before proposing guards is a dead pointer

## Relationship to prior KEs

- **KE-1531/KE-1532**: Identified common-sense.md stale paths (3 dead
  may-agent-docs paths + bun:sqlite). This KE extends the finding to agent
  context files.
- **KE-1538**: Identified work-queue false completions. The common-sense.md
  fix proposal exists but hasn't been executed. These agent context file
  references are a separate, unaddressed scope.

## Recommendation

Fix the 4 agent context.md files. Each is a 1-line path substitution:
- `design/` → `2a-design/` (3 files)
- `design/agent-metrics.md` → `2a-design/metrics.md` (dev)
- `design/code-vs-data-decisions.md` → remove or update (tech-lead)

Note: arc cannot edit other agents' context.md files (out of lane).
Proposal filed at `agents/arc/workspace/proposals/2026-06-06-fix-agent-context-stale-design-paths.md`.
