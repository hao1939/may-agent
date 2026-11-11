---
name: github-pr-waits
description: Publish May-owned GitHub pull requests with Task metadata and configure exact github-pull-request Conditions.
---

# GitHub Pull-Request Ownership and Waits

Use this skill when publishing a May-owned GitHub pull request or waiting on PR
state, review, or merge transitions. Reference contract:
`/app/projects/may.app/design/github-pull-request-observation.md`.

## PR ownership block

Include this block in the initial body of any ordinary May-owned PR, preserve it
across `gh pr edit`, and read back the remote body before reporting publication:

```text
## May Task
- App ID: may
- Task ID: <exact current Task ID>
```

Keep the Host-supplied local Task branch intact during publication, and never
publish secrets, local worktree paths, Task prose, or session IDs.

## Waiting on PR changes via `github-pull-request`

1. Discover the installed observer contract via
   `tasks({ action: "contract", observation: { observerId: "github-pull-request", id: "pr-state", resource: "github:hao1939/may-agent#<number>", expected: { field: "fingerprint", notEquals: null } } })`
   (or `expected: { field: "state", equals: "closed" }` for closure-only waits),
   and save the returned Condition through `tasks({ action: "apply" })` or your
   `waiting` Task result.
2. Upgrade any legacy `pull-request:github:...` Condition through `tasks.contract`
   using its existing ID, resource, and saved predicate while preserving
   independent waits.
3. Treat observed PR state as provider evidence, never automatic merge/deploy/closure
   authority. Check head SHA, commit-scoped approvals, CI checks, and review
   threads separately when acceptance requires them; incomplete or rate-limited
   reads must leave the wait intact rather than retiring it.
4. When file bytes back a completion or recovery claim, retain verified
   `artifacts: [{ path, sha256 }]` references via `EvidenceStore` or hash read-back.
