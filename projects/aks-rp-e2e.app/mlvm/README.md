# MLVM operational App integration

## Task overview

The operational installation's existing `/projects/aks-rp-e2e.app/ui/kanban/`
entry delegates to the Host's `/projects/aks-rp-e2e.app/tasks?appId=aks-rp-e2e`
page. Its source follows the normal App layout at
[../ui/kanban/index.html](../ui/kanban/index.html). New navigation links point
directly to the Host page; this entry preserves old `?task=` bookmarks. The Host
provides the App-scoped list, current statuses, filters, pagination, requirements, Conditions,
results and history. No App-owned Task collector, status vocabulary or counter
is needed. Opening the page only reads existing Tasks.

The previous App board rejected the current `idle` state as invalid, hiding the
entire list when a Task had no runnable work. Reusing the Host page removes that
duplicated contract. The existing per-task App pages and conversations remain
available at their original URLs. The MLVM App home links directly to the Host
Task page, and the existing per-task page links back to it. Its domain pages
remain under the same App's `ui/` directory. The older local UI-only installation
is separate; its selected Kubernetes session entry is preserved.

These navigation changes affect only editable App static pages, with backups
and exact-source checks before replacement. They need no runtime reload. Do not edit an immutable
definition release or replace Task state to publish this page.

## Resource observer

The parent App remains UI-only on the local main instance. This module is used
only by the separate operational App on MLVM. Its existing `adoReader` supplies
credentials and bounded read-only requests. No subscription, schedule, Task
admission path, workflow, watch registry or model call is added.

Install the resource observer in the restricted profile. The Host derives reads
from outstanding Conditions, persists facts, matches their source and exact
expectation, and owns delivery and generation fencing. Reads recur every five
minutes while needed; after satisfaction there is no demand. Restart discards
disposable observation memory and reconstructs demand from durable Conditions.
Failed or malformed reads stay unknown. A completed PR for another source does
not satisfy a pinned merge Condition.

Build the wait with `compilerMergeCondition` and the installed observation
capability. It requires a fresh observation of the exact PR/source, completed
state, non-draft status, main target and a recorded merge commit. The App reports
provider facts; human ownership of merge and review remains unchanged. This
does not observe review comments, grant merge permission or complete compiler
acceptance.

For an existing human-input wait, send one generation-fenced Task input. In the
same accepted waiting result, retire that exact Condition using its observed
Condition generation and add the observation Condition. Never change Task
requirements, task generation, native binding or stored rows to migrate a wait.
Other Conditions and unfinished inputs stay intact. If source changes, do not
silently re-pin: reconsider the publication contract through the owning Task.

With `codex-goal`, the Host admits only the terminal native turn's result. An
intermediate JSON answer does not install a Condition or return a change receipt.
Keep the complete proposed Conditions/actions in the terminal result, including
after native continuations, and verify the saved wait through the canonical
Task read. Registering a future merge observation does not require the separate
CI prerequisite to finish and must not repeat engineering or validation work.

The current work assignment belongs in an ordinary fenced input and the existing
concise progress file. Name one deliverable, source/adopted premises, allowed
effects, evidence, next action and exact stop/wake criteria. Preserve the full
Task outcome and acceptance. Reuse unchanged evidence; rerun required checks
when candidate source changes. Keep historical handoffs linked rather than
reading their entire accumulated transcript on each resume.

Portable tests use fake provider data; Host boundary tests require
`MAY_HOST_SOURCE` pointing to the matching Host checkout. Neither suite makes
network or model calls. Live activation and a real merge remain separate proof.

```sh
bun test ./projects/aks-rp-e2e.app/mlvm/compiler-pull-request.test.ts
MAY_HOST_SOURCE=/path/to/host bun ./projects/aks-rp-e2e.app/mlvm/verify-host.ts
python3 projects/aks-rp-e2e.app/mlvm/stage-release.py BASE_RELEASE NEW_RELEASE
```

The staging helper checks the reviewed operational App's exact hash and changes
only its restricted observer list, imports and corresponding profile assertion.
It copies a complete definition
release for isolated validation; it does not activate it. To activate, copy the
three reviewed source files into the operational installation and use the Host's
normal `/reload` route, which captures and atomically publishes its immutable
source release. Verify that no other source changes are present first. Preserve
the previous files/release for rollback; never restore a database over newer
inputs. App source must not be pushed to the public Host repository.
