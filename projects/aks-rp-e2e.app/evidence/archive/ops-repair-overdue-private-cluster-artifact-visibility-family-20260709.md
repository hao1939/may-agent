# Overdue private-cluster artifact-visibility family repair review — 2026-07-09

Task: `ops-repair-overdue-private-cluster-artifact-visibility-family-20260709`
Attempt: `a_ops-repair-overdue-private-cluster-artifact-visibility-family-20260709_20260709080414`
Mode: worker evidence / planner review output only; no task-tree mutation from this session

## Result

Yes: one **shared workflow-surface recovery/escalation** is now the truthful overdue-family action for these two private-cluster waits:

- `hold-spec-private-cluster-shared-apiserver-subnet-run-28840446579-result-visibility-frontier-20260707h`
- `hold-spec-private-cluster-update-public-second-hop-run-28671841561-artifact-frontier-20260707h`

But that shared surface should replace the **duplicate overdue owner follow-up**, not collapse the underlying per-spec blocked holders.

The two blocked holders should stay separate because they still represent different specs and different final review semantics. What is shared is the next owner/app-ops recovery step: both waits are now overdue for the same controller-visible reason — the workflow surface still has not produced locally reviewable same-run artifacts/results for terminal GitHub runs `28840446579` and `28671841561`.

## Bottom line judgment

### Keep separate as blocked state

Keep these two exact blocked holders separate in steady state:

1. `hold-spec-private-cluster-shared-apiserver-subnet-run-28840446579-result-visibility-frontier-20260707h`
2. `hold-spec-private-cluster-update-public-second-hop-run-28671841561-artifact-frontier-20260707h`

They are not semantic duplicates:

- run `28840446579` governs only `spec.private-cluster.vnet-integration-shared-apiserver-subnet`
- run `28671841561` governs only `spec.private-cluster.vnet-integration-update-public-second-hop`
- the former is a same-run **result/artifact** visibility frontier after a repaired successor rerun
- the latter is a same-run **artifact/log** visibility frontier while the base `spec.private-cluster.vnet-integration-update` sibling remains settled pass on `28391426288`

### Share one overdue recovery/escalation surface

Use **one family-level owner recovery/escalation task** for both waits because the overdue condition is shared:

> recover or escalate the missing same-run workflow artifact/result visibility for terminal private-cluster runs `28840446579` and `28671841561`, then hand the recovered surfaces back for exact per-spec classification.

That single shared recovery surface truthfully covers **both** child waits because both are blocked on the same missing workflow-surface evidence class and both already point to the same observation/fallback mechanism.

## Current app-visible facts

### 1. Both spec-loop rows already point back to the exact `...20260707h` blocked holders

Current `/app/projects/aks-rp-e2e.app/.state/spec-loop/state.json` shows:

- `spec.private-cluster.vnet-integration-shared-apiserver-subnet`
  - `lastRunId = 28840446579`
  - `taskId = hold-spec-private-cluster-shared-apiserver-subnet-run-28840446579-result-visibility-frontier-20260707h`
  - `review.pendingReviewTaskId = hold-spec-private-cluster-shared-apiserver-subnet-run-28840446579-result-visibility-frontier-20260707h`

- `spec.private-cluster.vnet-integration-update-public-second-hop`
  - `lastRunId = 28671841561`
  - `taskId = hold-spec-private-cluster-update-public-second-hop-run-28671841561-artifact-frontier-20260707h`
  - `review.pendingReviewTaskId = hold-spec-private-cluster-update-public-second-hop-run-28671841561-artifact-frontier-20260707h`

So the current steady-state app binding is already back on the exact per-spec holders, not on the old `...20260707i` placeholders.

### 2. Both live blocked holders now have the same wait contract shape

Current `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json` shows both holders are:

- `state: blocked`
- waiting on `blocker.waiting_for.type = evidence.available`
- observed by the same workflow surface:
  - `observed_by.workflow = project-planner`
  - `observed_by.schedule = blocked-frontier-owner-review`
  - `observed_by.trigger = project.planning.requested`
- using the same observation method text
- carrying the same overdue fallback timestamp family:
  - `next_check_at = 2026-07-08T08:08:22.550Z`
  - `fallback_at = 2026-07-09T07:58:22.550Z`

The only meaningful difference is the exact run/spec semantics:

- shared-apiserver-subnet wait asks for authoritative results/artifacts for run `28840446579`
- public-second-hop wait asks for authoritative logs/artifacts for run `28671841561`

### 3. Repeated controller pulses still show the same workflow-surface lookup miss for both runs

Current `/app/projects/aks-rp-e2e.app/.state/journal.jsonl` pulses through `2026-07-09T08:02:26.027Z` repeatedly list both run ids under `terminal_github_wait_lookup_miss_run_ids`:

- `28840446579`
- `28671841561`

and do **not** show successful harvest or acceptance for either run in those pulses.

That is the strongest current app-side sign that these two waits now share one workflow-surface problem: the controller keeps checking the exact runs, but the same-run local artifact/result surface still does not become visible.

### 4. Local file search still found evidence notes, not recovered same-run artifact bundles

Bounded file search under:

- `/app/projects/aks-rp-e2e/evidence/archive`
- `/app/projects/aks-rp-e2e/workspace`
- `/app/projects/aks-rp-e2e.app/.state`

found only durable review/evidence notes for these run ids, not recovered same-run result bundles or artifact directories for either run.

So the current recovery gap is still artifact/result visibility, not spec semantics.

## Why one shared workflow-surface recovery is truthful

A shared overdue-family recovery is truthful because all current owner-action facts are aligned:

1. both waits are terminal-run artifact/result visibility blockers
2. both waits are overdue on the same fallback schedule
3. both waits use the same controller observation workflow
4. both exact run ids keep appearing in `terminal_github_wait_lookup_miss_run_ids`
5. neither run currently has a local artifact bundle in the searched app/domain evidence surfaces
6. neither branch should reopen an unchanged rerun before same-run evidence or a reviewed workflow-surface diagnosis arrives

So the next owner move is not two different product/domain actions. It is one shared app/workflow-surface recovery or escalation action against the same class of failure.

## Why the blocked holders should still remain separate

Even though the overdue recovery can be shared, the blocked holders should remain separate because each one preserves exact domain truth that would be lost in one merged hold:

### Run `28840446579`

Must preserve:

- spec: `spec.private-cluster.vnet-integration-shared-apiserver-subnet`
- same-run **result/artifact** visibility frontier
- repaired successor rerun is already the controlling witness
- do not collapse back to the older `28530927675` opaque HTTP 400 shell

### Run `28671841561`

Must preserve:

- spec: `spec.private-cluster.vnet-integration-update-public-second-hop`
- same-run **artifact/log** visibility frontier
- base sibling `spec.private-cluster.vnet-integration-update` remains settled pass on `28391426288`
- do not reopen that settled sibling

So one merged blocked wait would be less truthful than the current two-holder state.

## Exact shared recovery/escalation surface to use

Planner/app-ops should prefer **one shared owner recovery or escalation task** with a goal shaped like:

> Recover or escalate same-run artifact/result visibility for terminal private-cluster workflow runs `28671841561` and `28840446579`, using the workflow/artifact surface rather than reopening reruns, and return exact reviewable run artifacts so each spec can be classified on its existing blocked holder.

### This one shared surface should cover both child waits

- `hold-spec-private-cluster-shared-apiserver-subnet-run-28840446579-result-visibility-frontier-20260707h`
- `hold-spec-private-cluster-update-public-second-hop-run-28671841561-artifact-frontier-20260707h`

### Expected owner action inside that shared surface

One exact owner/app-ops recovery/escalation should do only workflow-surface work such as:

1. confirm whether GitHub/ADO/local artifact harvesting for these two terminal runs is broken, delayed, or inaccessible
2. recover the exact same-run logs/artifacts/results if available
3. if recovery is impossible from current access, produce one explicit workflow-surface escalation packet naming both run ids and the failed lookup surface
4. return the recovered artifacts or the escalation outcome without reopening unchanged reruns

## What should not happen

Do **not**:

- reopen unchanged reruns for either spec
- merge the two per-spec blocked holders into one broad private-cluster blocked wait
- regress the `28840446579` branch back to the older `28530927675` shell
- reopen `spec.private-cluster.vnet-integration-update`, which already remains settled pass on `28391426288`
- treat this as an AKS product correctness question before same-run evidence is visible

## Planner review output

Because worker mode forbids tree reshaping from this session, planner should apply the conclusion as follows:

1. **Preserve** the two current exact blocked holders as the live per-spec state.
2. **Replace duplicate overdue follow-up handling** with one shared workflow-surface recovery/escalation task that explicitly covers both run ids and both blocked holder ids.
3. After that shared recovery finishes, let domain review resume separately on each existing blocked holder.

## Final answer to the assigned question

- **Do the two waits share one truthful workflow-surface recovery/escalation family?** Yes.
- **Should that family replace the child blocked holders themselves?** No.
- **What should the shared family replace?** The duplicate overdue owner follow-up path for both waits.
- **Which child waits does it cover?**
  - `hold-spec-private-cluster-shared-apiserver-subnet-run-28840446579-result-visibility-frontier-20260707h`
  - `hold-spec-private-cluster-update-public-second-hop-run-28671841561-artifact-frontier-20260707h`
- **Why?** Because both are still blocked by the same unresolved workflow-surface artifact/result visibility failure, as shown by repeated terminal-run lookup misses and the continued absence of same-run artifact bundles in local evidence surfaces.
