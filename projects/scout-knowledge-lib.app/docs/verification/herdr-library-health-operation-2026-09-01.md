# Herdr Scout library-health operation — 2026-09-01

## Outcome

Herdr ran the reviewed, non-hosted library-health observer without changing the
Scout application or knowledge library. The focused tests passed. The reviewed
enablement revision exposed a truncated historical snapshot, while a second
read-only observation of the current local checkout produced an untruncated
24-fact view. No production action, external-service mutation, task-state
change, credential action, or XHS access occurred.

The current facts do not justify editing the user-owned checkout. Eleven
tracked findings have unsupported November dates and need a provenance repair
after the owner's current maintenance state is preserved. The unsourced INDEX
backlog warrants one three-entry batch. Ten notes exceed the observer's size
threshold, but size alone does not identify a safe semantic split; eight of
those notes already have owner edits, so no speculative rollup goal was
created.

## Execution identity

- Goal-owned worktree: `/app/worktrees/g-e2cfd643-library-health`
- Branch: `codex/g-e2cfd643-library-health`
- Assessment base revision: `fd4c68ecd6fe2ce14afd93815b63f790c1514663`
- Reviewed enablement commits: `f654195455d95c552ca02d25e811da689a3f1273`
  and `fd4c68ecd6fe2ce14afd93815b63f790c1514663`
- Current local Git revision observed read-only: `386b445c236e4609cd8870d22cc773cc4641fec8`

## Commands and proof

From the goal-owned app directory:

```sh
bun test agents/scout/workflows/library-health.test.ts scripts/library-health-readonly.test.ts
bun scripts/library-health-readonly.ts \
  --app-dir "$PWD" \
  --project-dir "$PWD/../scout-knowledge-lib"
```

The test command passed 13 tests with 22 expectations and zero failures. The
assessment generated at `2026-09-01T09:17:01.236Z` reported the expected
goal-owned roots, 50 facts, 16 bounded wake signals, and `truncated: true`. The
visible facts were 40 future-dated filenames, one index coverage gap, and nine
oversized canonical notes. Because this revision predates the active local
maintenance state and hit the fact cap, it is validation of the portable pilot,
not the authoritative current library result.

Before and after that run, `git status --short --untracked-files=all -- .
../scout-knowledge-lib` was empty, `.state` was absent, and these Git tree IDs
were unchanged:

| Surface   | Tree ID                                    |
| --------- | ------------------------------------------ |
| Scout app | `ac6a01b00c4827d145156552467fdfbbb43f5536` |
| knowledge | `07b0edbce10de10d85749ba41c7391cf8a89f8c9` |
| reports   | `f64d8d0a0772c7eda83dd34d0c1641b7d660838f` |
| digest    | `b1c5acf09ada86697d136a9f1bd4b9ebe1711c04` |

The same verified observer then read the current checkout from the goal-owned
execution directory:

```sh
bun scripts/library-health-readonly.ts \
  --app-dir /app/projects/scout-knowledge-lib.app \
  --project-dir /app/projects/scout-knowledge-lib
```

The current assessment generated at `2026-09-01T09:17:32.588Z` reported 24
facts, zero wake signals, and `truncated: false`. All wake decisions were
`unchanged` against the existing local observer state. Before and after the
command, the scoped Git status contained the same 296 pre-existing paths with
status fingerprint
`7e4d09379a93e60fe584a87f6c40c8b8cc493ae059be289359a40a10bdc26a8a`.
The aggregate content fingerprint for knowledge, reports, and digest files was
unchanged at
`97db820891d13a9535b40fba34b2047f06039bfe2936332be8a7b4cd249a2293`.
The pre-existing app `.state` directory remained present. No file in the
discovery checkout was written.

## Current fact disposition

### Unsupported future chronology

Thirteen P1 facts cover filenames for HN scans 276, 277, 278, 279, 280, 282,
284, 285, and 286; filenames for two arXiv artifacts; and `last_updated` fields
in the two arXiv artifacts. The eleven paths claim dates from 2026-11-11 through
2026-11-18. Git shows that commit `a2d3df9f84` introduced every one of them at
`2026-07-13T13:05:36Z`, and their bodies cite July 1–12 activity. They are
tracked and unchanged at current `main`.

This is a real provenance defect, but an isolated repair from bare `main` would
ignore the owner's ongoing 296-path library maintenance, including adjacent
future-date removals and navigation edits. The ready-to-run follow-up is
`herdr/goals/future-dated-findings-276-286-repair.goal.json`; it waits only for
that owner state to be preserved as an explicit revision and forbids inventing
exact observation dates.

### Oversized canonical notes

The observer reported these line counts:

- `agent-architectures.md` 1116; `agent-evaluation.md` 992;
  `agent-protocols-mcp-a2a.md` 1033;
- `agent-security-defense-architectures.md` 1098;
  `agent-security-event-log.md` 1230; `agent-security-governance.md` 1014;
- `hn-agent-operational-memory.md` 1114; `the-oversight-inversion.md` 1414;
- `xhs-prediction-tracker.md` 966; `xhs-scan-log-june2026.md` 1989.

Eight of these ten paths already have owner modifications. The two unchanged
paths are `the-oversight-inversion.md` and `xhs-scan-log-june2026.md`. A line
threshold proves review pressure, not a safe split boundary, and the XHS log
must not be reinterpreted through unavailable live XHS access. No separate
rollup goal is justified until the active edits are preserved and a semantic
boundary is identified.

### Unsourced backlog

The P1 backlog is 222 INDEX markers, with observer evidence showing no count
change across 34 windows. `INDEX.md` already has owner modifications, so bulk
cleanup now would overlap active work and would not prove source absorption.
The follow-up `herdr/goals/unsourced-index-oldest-three.goal.json` selects only
the three oldest remaining markers on the preserved revision and requires
source-backed integration or an explicit no-op for each.

## Remaining limits and next workers

The lifecycle README referenced by the supervisory launch contract was absent
at `/home/hao/.local/state/herdr-supervisor/goals/README.md`; the canonical goal
contract and reviewed repository guide were available and sufficient to run
the workflow. The current checkout's maintenance state is not committed, so it
cannot safely be used as the base of either content-repair worker yet. Preserve
that state as a revision, then assign workers to the future-date repair first
and the three-entry backlog goal second. No worker should be assigned for XHS
exploration while `credential-ready:xhs` remains unsatisfied.

## Supervision

- Goal: Operate Scout Knowledge Library through Herdr by executing the safe library-health workflow, resolving locally actionable health failures, and producing evidence-backed follow-up goals for work that cannot yet be completed.
- Goal ID: "g_e2cfd643-e342-45f7-b632-f6c3bf732502"
- Worker: "goal-91aa724ce0fd0bbdabb83082091"
- Codex session: "01a05c41-228f-78a3-820f-87a999d6e699"
- Pane: "w1:p69"
