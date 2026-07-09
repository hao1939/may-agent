# ops-restore-node-http-proxy-exact-wait-carrier-20260709

Task: `ops-restore-node-http-proxy-exact-wait-carrier-20260709`
Attempt: `a_ops-restore-node-http-proxy-exact-wait-carrier-20260709_20260709094348`
Session: `s_task_ops-restore-node-http-proxy-exact-wait-carrier-20260709`
Mode note: worker-mode restrictions did **not** permit direct task-tree reshaping from this session because the assignment did not explicitly authorize supported `task-tree` mutation commands. This memo records the exact repair the planner should apply.

## Scope

Verify which exact blocked carrier should represent the surviving compact `node-http-proxy` trusted-ca frontier, then record the smallest truthful tree repair so the misleading generic package-partial holder can be retired without reopening unchanged compact reruns.

## Authorities checked

### Live tree / controller-visible state
- `tasks/tree.json`
- `tasks/kanban.json`
- `.state/feature-compact-loop/state.json`
- `bun run task-tree summary`
- `bun run task-tree show hold-compact-node-http-proxy-package-partial-frontier-202607090544`

### Domain / feature authority
- `features/node-http-proxy/compact/staging.summary.md`
- `features/node-http-proxy/specs/node-http-proxy-trusted-ca.json`

### Prior accepted diagnosis / routing evidence
- `evidence/archive/diagnose-compact-node-http-proxy-trusted-ca-next-owner-path-20260708.md`
- `evidence/archive/route-node-http-proxy-trusted-ca-owner-decision-packet-20260708.md`
- `evidence/archive/ops-classify-compact-environment-overblock-family-20260709.md`
- `evidence/archive/ops-reconcile-compact-environment-overblock-family-first-batch-20260709.md`
- `evidence/archive/ops-rebind-compact-environment-overblock-exact-waits-20260709.md`

## Baseline: current pre-repair contributor set

The current compact `node-http-proxy` frontier is represented in **two** live places plus one evidence-only ghost reference:

1. **Generic blocked holder**
   - `hold-compact-node-http-proxy-package-partial-frontier-202607090544`
   - live and blocked
   - current `task-tree show` confirms it still points at the older quarantine wording in its blocker body

2. **Older exact quarantine holder**
   - `wait-compact-node-http-proxy-trusted-ca-quarantine-20260702`
   - still present in `tasks/tree.json` and `tasks/kanban.json`
   - still referenced by `.state/feature-compact-loop/state.json` in both `retryReason` and `observedBy.taskId`

3. **Evidence-only newer exact holder reference**
   - `wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708`
   - repeatedly named by 2026-07-08/09 diagnosis and overblock repair evidence as the truthful next carrier
   - **not present** in live `tasks/tree.json`, `tasks/kanban.json`, `tasks/seed.json`, or `.state/feature-compact-loop/state.json`

## What the current feature authority says

Current compact/domain authority is sharper than the older quarantine wording:

- `features/node-http-proxy/compact/staging.summary.md` says create/update are already accepted and rerun-ready; only `spec.node-http-proxy.trusted-ca` remains quarantined.
- `features/node-http-proxy/specs/node-http-proxy-trusted-ca.json` says the branch stays `reviewed-exception` / `environment` because mounted source still has no separate handwritten trusted-ca scenario and the current carrier still needs exact runtime inputs:
  - `AKS_RP_E2E_HTTP_PROXY`
  - `AKS_RP_E2E_HTTPS_PROXY`
  - `AKS_RP_E2E_TRUSTED_CA_BASE64`
- `diagnose-compact-node-http-proxy-trusted-ca-next-owner-path-20260708.md` further narrows the truthful next step: this is no longer just a passive quarantine. The exact next question is whether the branch should:
  1. receive an owner-approved source-shaped carrier redesign using the create-family infrastructure pattern, or
  2. remain on one explicit human-held runtime-input wait.

That means the surviving branch is not merely “reviewed-exception live-ready-filter residue.” It is an **owner decision about redesign vs explicit runtime-input-only hold**.

## Decision

### Preferred exact live carrier

`node-http-proxy` should **intentionally inherit the owner-decision-return form**, not keep the old quarantine wording as the steady-state carrier.

### Why

The older exact wait `wait-compact-node-http-proxy-trusted-ca-quarantine-20260702` is no longer the sharpest truthful meaning because:

- accepted diagnosis already proved the old passive quarantine wording is stale;
- a first-contact owner packet was already routed on 2026-07-08 for the redesign-vs-runtime-input decision;
- follow-up evidence on 2026-07-09 continues to treat that owner-decision lineage as the real blocker;
- create/update success is already separated and should not be re-blocked.

So the family should end with **one exact trusted-ca owner-decision wait**, not with:
- one generic package-partial holder **plus** one stale quarantine holder, and not
- a return to the older quarantine text as if the redesign question never existed.

## Smallest truthful repair the planner should apply

### Preferred repair

Represent the branch with exactly **one** blocked carrier:

- **keep/create/restore:** `wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708`

Then retire the duplicate/stale holders:

- **mark done / replaced:** `hold-compact-node-http-proxy-package-partial-frontier-202607090544`
- **mark done / superseded:** `wait-compact-node-http-proxy-trusted-ca-quarantine-20260702`

### Required meaning of the surviving carrier

The exact surviving wait should say the branch is blocked pending **one bounded returned owner outcome** for `spec.node-http-proxy.trusted-ca`:

1. approve a source-shaped trusted-ca carrier redesign reusing the create-family infrastructure pattern, or
2. decline redesign and keep the branch on one explicit human-held runtime-input wait for:
   - `AKS_RP_E2E_HTTP_PROXY`
   - `AKS_RP_E2E_HTTPS_PROXY`
   - `AKS_RP_E2E_TRUSTED_CA_BASE64`, or
3. decline/reroute and name the exact replacement owner surface.

That wait should preserve the already-routed lineage:
- packet path: `evidence/archive/route-node-http-proxy-trusted-ca-owner-decision-packet-20260708.md`
- path id: `feature-compact:node-http-proxy-trusted-ca-owner-decision-20260708`

## Why not restore the old quarantine as the final carrier

Keeping `wait-compact-node-http-proxy-trusted-ca-quarantine-20260702` as the sole steady-state carrier would be smaller mechanically, but not smaller truthfully.

It would discard the later accepted narrowing that says the branch now waits on an explicit owner decision about:
- source-shaped redesign, versus
- explicit runtime-input-only hold.

That later narrowing is already captured in the 2026-07-08 and 2026-07-09 evidence chain, so reverting to the older quarantine wording would reintroduce stale lineage.

## Before/after task ids

### Before
- `hold-compact-node-http-proxy-package-partial-frontier-202607090544`
- `wait-compact-node-http-proxy-trusted-ca-quarantine-20260702`
- evidence-only missing live target: `wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708`

### After (preferred truthful represented set)
- `wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708` — **single live exact carrier**
- `hold-compact-node-http-proxy-package-partial-frontier-202607090544` — done/replaced
- `wait-compact-node-http-proxy-trusted-ca-quarantine-20260702` — done/superseded by the owner-decision-return carrier

## Warning-family impact

This repair should **not** reopen any unchanged compact rerun.

It should only change representation:

- remove `node-http-proxy` from the misleading generic package-partial warning-holder surface;
- preserve the feature as one exact blocked trusted-ca owner-decision lineage;
- keep create/update accepted and out of scope;
- reduce duplicate warning-family representation by collapsing two live holders into one exact carrier.

## Planner-ready mutation outline

If the planner wants the exact minimal tree action sequence, it should do this in one repair pass:

1. add or restore live task `wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708` with human-owned blocked semantics tied to the routed packet/evidence chain;
2. update `.state/feature-compact-loop/state.json` for `node-http-proxy` so `taskId`, `retryReason`, and `observedBy.taskId` point at that owner-decision-return carrier instead of the old quarantine / generic holder;
3. mark `hold-compact-node-http-proxy-package-partial-frontier-202607090544` done as replaced by the exact owner-decision carrier;
4. mark `wait-compact-node-http-proxy-trusted-ca-quarantine-20260702` done as superseded by the sharper owner-decision-return carrier.

## If the planner refuses to create the missing owner-decision id

Second-best repair-in-place:
- rewrite the text/blocker semantics of `wait-compact-node-http-proxy-trusted-ca-quarantine-20260702` to the owner-decision-return meaning, and
- still retire `hold-compact-node-http-proxy-package-partial-frontier-202607090544`.

That is less ideal because it preserves stale naming, but it is still better than leaving both current holders live.

## Bottom line

The evidence chain does **not** support restoring the old quarantine as the final compact meaning. It supports one sharper surviving branch: **trusted-ca owner decision about redesign vs explicit runtime-input wait**. The smallest truthful repair is therefore to rebind `node-http-proxy` to one exact owner-decision carrier and retire both the misleading generic holder and the stale quarantine predecessor.
