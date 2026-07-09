# ccp-agent compact holder mixed-frontier repair note

- Task: `ops/repair-compact-ccp-agent-reviewed-exception-mixed-frontier-holder-20260709l`
- Attempt: `a_ops_repair-compact-ccp-agent-reviewed-exception-mixed-frontier-holder-20260709l_20260709114527`
- Reviewed at: 2026-07-09T11:43Z

## Result

Under worker-mode constraints, I did **not** mutate the runtime task tree directly.
Instead, I reviewed the live holder, compact summary, compact state, and the
existing spec-level wait, and I wrote the **smallest exact planner-side repair**
needed to remove the misleading environment-style overblock shape.

The smallest truthful repair is:

1. **keep** `wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708` as the exact spec-level migration wait;
2. **rewrite** `hold-compact-ccp-agent-reviewed-exception-frontier` into an explicit **represented mixed-frontier carrier** for the feature-level compact surface;
3. **do not** reopen unchanged compact reruns.

No additional rerun leaf is justified. No broad environment wait is justified.
The live compact frontier is exactly:

- `spec.ccp-agent.connectivity-tunnel` — execute-ready promotion candidate
- `spec.ccp-agent.lifecycle-deployment` — execute-ready promotion candidate
- `spec.ccp.connected-cluster-proxy-auth` — execute-ready promotion candidate
- `spec.ccp.tunnelfront-konnectivity-migration` — already represented by
  `wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708`

## Current facts proving the live frontier is mixed, not an environment wait

### 1) Live compact state already says the holder is not a pure reviewed-exception wait

Current app state for `ccp-agent` in
`/app/projects/aks-rp-e2e.app/.state/feature-compact-loop/state.json` says:

- `status: blocked`
- `errorClass: reviewed-exception`
- `taskId: hold-compact-ccp-agent-reviewed-exception-frontier`
- `blockedReason` / `retryReason` explicitly say:
  - compact check passes;
  - three members are now execute-ready promotion candidates;
  - the remaining blocker is owner promotion/reclassification plus the
    reviewed-exception tunnelfront migration frontier.

So the current state text already contradicts the holder's generic
"exact reviewed-exception wait" framing.

### 2) Maintained compact summary names the exact mixed frontier

`/app/projects/aks-rp-e2e/features/ccp-agent/compact/staging.summary.md`
currently says:

- exact blocker kind = `repo-local-mixed-terminal-and-promotion-frontier`
- execute-ready promotion candidates:
  - `spec.ccp-agent.connectivity-tunnel`
  - `spec.ccp-agent.lifecycle-deployment`
  - `spec.ccp.connected-cluster-proxy-auth`
- remaining reviewed-exception carrier:
  - `spec.ccp.tunnelfront-konnectivity-migration`

It also says the local check rerun passed all 4 selected specs and that no live
rerun-ready member set remains after compact eligibility filtering.

That is a mixed frontier, not one shared environment/setup blocker.

### 3) The migration carrier already has one exact spec-level wait

`wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708`
in the runtime task tree already provides the exact open wait for
`spec.ccp.tunnelfront-konnectivity-migration`:

- owner: `human`
- category: `external-wait`
- wait condition: owner/archive response to the already-sent lineage-excerpt
  packet
- resume condition: returned excerpt or explicit no-such-excerpt decision

So the migration boundary does **not** need to be re-expressed as another broad
compact-family wait.

### 4) The current compact holder remains misleading

`hold-compact-ccp-agent-reviewed-exception-frontier` still says:

- goal: `Hold compact feature ccp-agent on exact reviewed-exception wait until the named condition changes.`
- blocker owner: `operator`
- `waiting_for.type = publish.auth.ready`

That live wording is misleading for two reasons:

1. the maintained compact authority does **not** describe a publish/auth gate;
2. the real frontier is mixed: three promotion candidates plus one existing
   spec-level owner-response wait.

## Smallest exact planner-side repair

### A. Rewrite the compact holder in place

The smallest truthful repair is to keep the same task id
`hold-compact-ccp-agent-reviewed-exception-frontier` but rewrite it as a
**represented mixed-frontier carrier**.

### Proposed replacement text

#### Proposed goal

> Hold compact feature ccp-agent only as a represented mixed-frontier carrier while the exact represented frontier remains three execute-ready promotion candidates plus the existing spec-level owner-response wait `wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708`.

#### Proposed acceptance

1. This compact holder remains blocked only while:
   - `spec.ccp-agent.connectivity-tunnel`,
   - `spec.ccp-agent.lifecycle-deployment`, and
   - `spec.ccp.connected-cluster-proxy-auth`
   still require accepted promotion/reclassification, and while
   `wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708`
   still controls the migration carrier
   `spec.ccp.tunnelfront-konnectivity-migration`.
2. Do not create duplicate environment setup, diagnosis, or unchanged rerun
   work from this holder; the exact represented frontier is one migration wait
   plus three execute-ready promotion candidates.
3. Resume compact work only after one of those three promotion candidates is
   accepted/reclassified or the migration wait materially changes or is
   replaced by returned lineage evidence.

#### Proposed blocker.condition

> Represented mixed frontier: `wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708` remains the exact human-owned owner/archive response wait for `spec.ccp.tunnelfront-konnectivity-migration`, while `spec.ccp-agent.connectivity-tunnel`, `spec.ccp-agent.lifecycle-deployment`, and `spec.ccp.connected-cluster-proxy-auth` are execute-ready promotion candidates with check-passing repo-local carriers but no accepted live-ready promotion yet. No duplicate environment setup task or unchanged compact rerun is truthful unless one of those three promotion candidates is accepted/reclassified or the migration wait materially changes.

#### Proposed blocker owner / wait shape

- `blocker.owner`: `human`
- `blocker.category`: keep `external-wait`
- replace `waiting_for.type = publish.auth.ready` with
  `waiting_for.type = owner.decision`

That still compresses the mixed frontier to one backward-compatible compact
holder id, but it stops falsely projecting the family as a publish/auth or
shared-environment block.

### B. Keep the existing spec wait as the exact migration boundary

No new migration holder is needed. Keep:

- `wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708`

unchanged as the exact open wait for the migration-only carrier.

### C. Do not reopen unchanged compact reruns

The maintained compact summary already says:

- compact check passed;
- the three non-migration members are execute-ready promotion candidates;
- the migration carrier is blocked on lineage/source proof;
- no rerun-ready member set exists under the current live-ready filter.

So reopening the same feature compact rerun would be a false retry.

## Optional sharper follow-up for app/runtime backbinding

This is **not required** for the minimal wording repair above, but it is the
smallest extra step if planner/app-ops wants the existing migration wait to
show up in compact-side multi-frontier runtime projection.

Current app code in
`/app/projects/aks-rp-e2e.app/workflows/lib/feature-compact-runtime-projection.ts`
collects cross-loop frontier ids only when a blocked task matches either:

- `feature:ccp-agent`
- `feature-compact:ccp-agent`
- `spec:spec.ccp-agent.*`

The existing migration wait currently has conflict scope:

- `spec-loop-followup:pending:ccp`
- `spec:spec.ccp.tunnelfront-konnectivity-migration`

So it will **not** be discovered automatically as a `ccp-agent` cross-loop
frontier by the current projection logic.

If planner wants future `frontierTaskIds` backbinding to include the migration
wait, the smallest supporting metadata repair is to add at least:

- `feature:ccp-agent`

(and optionally `feature-compact:ccp-agent`)

to the wait task's `conflict_scope`.

That is optional for this task's immediate tree-shape repair, but it explains
why the existing wait is not currently enough for automatic compact-side
frontier linkage.

## Exact recommendation to planner/app-ops

Apply the **in-place holder rewrite** above as the smallest exact repair.

Do **not** create a new broad environment blocker.
Do **not** reopen unchanged reruns.
Do **not** replace the existing migration wait.

If you want better runtime frontier linking after that wording repair, add
`feature:ccp-agent` scope to
`wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708`
so the compact runtime can discover it as a cross-loop frontier member.

## Files / runtime surfaces reviewed

- `/app/projects/aks-rp-e2e.app/.state/feature-compact-loop/state.json`
- `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`
- `/app/projects/aks-rp-e2e/features/ccp-agent/compact/staging.summary.md`
- `/app/projects/aks-rp-e2e/features/ccp-agent/compact/staging.diagnostics.json`
- `/app/projects/aks-rp-e2e/features/ccp-agent/specs/ccp-tunnelfront-konnectivity-migration.json`
- `/app/projects/aks-rp-e2e/features/ccp-agent.yaml`
- `/app/projects/aks-rp-e2e.app/workflows/lib/feature-compact-runtime-projection.ts`
