# Task branch publication adoption trial — 2026-10-17

The live agent published once and continued in the same Task workspace under
the activated shared guidance. The fix uses the existing execution contract;
no Host runtime code was changed for this adoption.

## Purpose

This note records a two-attempt live adoption trial for the repository guidance that a Host-supplied Task worktree must keep its durable local branch while publishing `HEAD` to a separately named remote ref.

**Supports:** [Workspace ownership](../../2a-design/task-attempts.md#workspace-ownership-and-cleanup)
and [repository-change guidance](../../../../../shared/common-sense.md#repository-changes).
The choice follows [simple first](../../1-principles/core-principles.md#simple-first):
teach the supported publication path and reuse ordinary Task continuation.

## Integration, activation and accepted evidence

- Apps candidate: `dd6a5edbb95f0236b4964634afc142aac847e548`.
- Integrated Apps source: `697cc6c655c8c9e2cc02c0a0194abe220e6aae73`.
- Pinned reload request: event `6678606`; successful `runtime.reload.finished`:
  event `6678607`, with that same source commit. Nine agent definitions updated.
- The activated shared guidance, May instructions and workflow manual matched
  their integrated source bytes. May's trial reported the loaded release path.
- Host daemon PID remained `4974`; this was an App definition reload.
- `bun run check:may-design` passed; its existing unclassified `reports` warning
  is unrelated to this change.

The same May Task `goal/appdep_c7098340ee8c5de1b6bc9709` retained each result:

| Step | Attempt | Result |
| --- | --- | --- |
| Initial fixture check | `r_1_fc70b05a-751d-476d-b5de-d3a3a3520b2f` | Missing local `/tmp` fixture reported before mutation; corrected through ordinary input |
| Publication | `r_1_7c9155d0-5d33-4f50-9e8f-9c208e9a7c17` | One push; accepted `waiting` with `continue: true` at 08:38:50 UTC |
| Continuation | `r_1_9ecb1812-76fd-4e73-af56-e404410d71c0` | Normal next attempt began at 08:38:51 UTC and completed at 08:39:51 UTC |

The completed agent evidence note was committed as
`b07fec5853b8a90656a14f71b78291f502c05907`. Operator checks independently confirmed
the unchanged branch, clean checkout, published ref and ancestry of the
published commit. This reviewed note adds integration and activation evidence.

## First attempt: publication

- Workspace: `/app/worktrees/may/goal-appdep_c7098340ee8c5de1b6bc9709-9cfd5b5be2`
- Local branch before the evidence commit: `task/goal-appdep_c7098340ee8c5de1b6bc9709-9cfd5b5be2`
- Symbolic ref: `refs/heads/task/goal-appdep_c7098340ee8c5de1b6bc9709-9cfd5b5be2`
- Git common directory: `/app/.git`
- Worktree Git directory: `/app/.git/worktrees/goal-appdep_c7098340ee8c5de1b6bc9709-9cfd5b5be2`
- Starting HEAD: `dd6a5edbb95f0236b4964634afc142aac847e548`
- Loaded guidance: `/app/.state/releases/app-definitions/697cc6c655c8c9e2cc02c0a0194abe220e6aae73-definitions-v5/shared/common-sense.md`
- Authorized bare remote: `/app/.state/pr380-publication-trial-20261017/remote.git`
- Authorized destination ref: `refs/heads/fix/pr380-agent-adoption-trial`
- Remote verification before publication: `git --git-dir=/app/.state/pr380-publication-trial-20261017/remote.git rev-parse --is-bare-repository` returned `true`; `objects/info/alternates` contains `/app/.git/objects`.

The first attempted setup used `/tmp/may-pr380-publication-trial-20261017.git`, which was not visible in the execution environment. Codex identified that as a fixture-namespace setup error and moved the fixture to the shared runtime path above. No repository mutation or publication occurred during that failed-prerequisite attempt.

The note-only evidence commit was `c91588c09eb2452e082db13fbee8ba93f47feea7` (`docs: record task branch publication trial`). It was published once with:

```text
git push /app/.state/pr380-publication-trial-20261017/remote.git HEAD:refs/heads/fix/pr380-agent-adoption-trial
```

Immediately after publication, the local symbolic ref and worktree registration still named `refs/heads/task/goal-appdep_c7098340ee8c5de1b6bc9709-9cfd5b5be2`, local `HEAD` was the evidence commit, the destination ref resolved to the same commit, and the checkout was clean.

## Second attempt: ordinary continuation

A fresh normal attempt prepared and reused the same checkout successfully. Before updating this note, it independently observed:

- Workspace: `/app/worktrees/may/goal-appdep_c7098340ee8c5de1b6bc9709-9cfd5b5be2`
- Local branch: `task/goal-appdep_c7098340ee8c5de1b6bc9709-9cfd5b5be2`
- Symbolic ref and registered worktree branch: `refs/heads/task/goal-appdep_c7098340ee8c5de1b6bc9709-9cfd5b5be2`
- Git common directory: `/app/.git`
- Worktree Git directory: `/app/.git/worktrees/goal-appdep_c7098340ee8c5de1b6bc9709-9cfd5b5be2`
- Local `HEAD`: `c91588c09eb2452e082db13fbee8ba93f47feea7`
- Published remote ref: `c91588c09eb2452e082db13fbee8ba93f47feea7`
- Bare-remote status: `true`
- Remote alternates entry: `/app/.git/objects`
- Checkout status: clean

No second publication was performed. The ordinary retry preserved the deterministic local Task branch, commit, checkout, and separate published `fix/*` ref across the attempt boundary. This verifies the loaded agent guidance in the bounded local-remote trial; it does not establish GitHub publication permission, deployment, or any Host binary change.
