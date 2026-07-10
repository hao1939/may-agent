# Drain human escalation / closure / approval-ingest family audit — 2026-07-10

- Task: `ops/drain-human-escalation-closure-and-approval-ingest-family-20260710`
- Attempt: `a_ops_drain-human-escalation-closure-and-approval-ingest-family-20260710062402`
- Mode: Task Worker Mode / evidence + planner-review output only
- Runtime task-tree mutation from this worker: none
- Reviewed at: 2026-07-10T06:24Z–06:4xZ

## Bottom line

The required human-escalation families are already reduced to **one truthful surviving live wait each**.

This corrected audit explicitly includes the overdue six-spec network-acns Hubble contract lineage:

1. `wait-spec-network-acns-hubble-contract-owner-response-20260708`
2. `ops/wait-shared-azure-devops-auth-capable-runtime-owner-return-20260709b`
3. `ops/wait-shared-github-dispatch-auth-capable-runtime-owner-return-20260710`
4. `ops/wait-disabled-alert-alias-runtime-owner-decision-20260709j`
5. `ops/wait-windows-node-pool-create-owner-arbitration-return-20260709s`

For all five families:

- durable send/chase proof exists,
- no controller-visible `project.approval.submitted` reply exists yet,
- I did not find a second live sibling wait that should still be carrying the same external ask,
- and the truthful planner posture is to keep the current single surviving wait for each family rather than recreating older passive/replaced branches.

For the overdue network-acns Hubble family specifically, the live wait is no longer a stale passive holder: its current blocker text already points at the original 2026-07-08 send proof plus the refreshed 2026-07-09 shared third-contact chase, and now carries current `next_check_at` / `fallback_at` windows. So the sharper surviving wait already exists; no unchanged rerun or duplicate escalation should be reopened from this worker session.

## Authoritative surfaces checked

Runtime / app surfaces:

- `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`
- `/app/projects/aks-rp-e2e.app/.state/approval-dispatch-runs.jsonl`
- runtime `events` table via `query_db`
- `/app/projects/aks-rp-e2e.app/.state/journal.jsonl`

Durable packet / evidence notes:

- `/app/projects/aks-rp-e2e/evidence/archive/ops-send-network-acns-hubble-contract-owner-packet-20260708.md`
- `/app/projects/aks-rp-e2e/evidence/archive/ops-send-shared-azure-devops-auth-capable-runtime-handoff-20260709.md`
- `/app/projects/aks-rp-e2e/evidence/archive/ops-send-shared-github-dispatch-auth-capable-runtime-handoff-20260709.md`
- `/app/projects/aks-rp-e2e.app/evidence/archive/metric-alert-overdue-nonhuman-unworked-count-20260709-alert3248-send-or-repair.md`
- `/app/projects/aks-rp-e2e/evidence/archive/ops-escalate-windows-node-pool-create-arbitration-20260708.md`

## Global reply-ingest / closure signal

Runtime DB check:

- `SELECT COUNT(*) AS c FROM events WHERE event_type = 'project.approval.submitted'`
- result: **0**

So the current gap is still **external nonresponse / no visible returned decision**, not missing send-proof for the named families.

## Family inventory

| Family | Current surviving wait | Send/chase proof present? | Returned decision visible? | Live duplicate sibling found? | Verdict |
|---|---|---:|---:|---:|---|
| Network-ACNS Hubble contract six-spec lineage | `wait-spec-network-acns-hubble-contract-owner-response-20260708` | Yes | No | No | Keep this one sharper wait |
| Shared Azure DevOps auth-capable runtime | `ops/wait-shared-azure-devops-auth-capable-runtime-owner-return-20260709b` | Yes | No | No | Keep this one wait |
| Shared GitHub dispatch auth-capable runtime | `ops/wait-shared-github-dispatch-auth-capable-runtime-owner-return-20260710` | Yes | No | No | Keep this one wait |
| Disabled-alert alias runtime-owner decision | `ops/wait-disabled-alert-alias-runtime-owner-decision-20260709j` | Yes | No | No | Keep this one wait |
| Windows node-pool create owner arbitration | `ops/wait-windows-node-pool-create-owner-arbitration-return-20260709s` | Yes | No | No | Keep this one wait |

## Family-by-family evidence

### 1) Network-ACNS Hubble contract six-spec lineage

### Current live wait

Live task tree shows one surviving wait under `aks-spec-verification-loop`:

- `wait-spec-network-acns-hubble-contract-owner-response-20260708`
- `resume_at = 2026-07-10T12:00:00Z`
- `next_check_at = 2026-07-10T12:00:00Z`
- `fallback_at = 2026-07-10T18:00:00Z`

Current live blocker text says this wait is blocked on the returned `human:operator` decision for the exact six-spec network-acns Hubble contract family after:

- the original send-proof in `evidence/archive/ops-send-network-acns-hubble-contract-owner-packet-20260708.md`, and
- the freshest shared overdue chase in `evidence/archive/spec-loop-overdue-owner-response-third-contact-packet-20260709.md`.

It also explicitly says the 2026-07-10 blocked-frontier review found no returned owner decision yet and that this drain task had to verify or refresh the lineage before any unchanged rerun.

### Send / chase proof

Durable first-contact send proof exists:

- packet path: `evidence/archive/ops-send-network-acns-hubble-contract-owner-packet-20260708.md`
- path id: `shared-network-acns-hubble-contract-regression-family-20260708`
- runtime events found by `query_db`:
  - `project.approval.requested` at event id `2928557`
  - `message.created` at event id `2928560`
- the evidence note also records approval-dispatch `message.created` at `2026-07-08T05:57:27.656Z`

Durable refreshed third-contact chase proof also exists:

- runtime events found by `query_db` for the refreshed lineage:
  - `project.approval.requested` at event id `2929421`
  - `message.created` at event id `2929436`
- accepted evidence already quoted in app archive shows the shared third-contact packet was routed with approval-dispatch `message.created` on `2026-07-09T07:18:05.218Z`

### Duplicate / stale sibling check

I did not find a second live wait carrying the same six-spec owner ask.

Historical notes show earlier passive/review-state coverage was replaced before send-proof existed, and accepted task/journal history on 2026-07-08 already said the existing owner-response wait remained the **single governing family holder**.

### Verdict

Keep **only** `wait-spec-network-acns-hubble-contract-owner-response-20260708`.

It is already the sharper surviving wait the rejection asked for: current owner, current review windows, original send-proof, refreshed chase proof, and explicit unchanged-rerun prohibition are all visible.

---

### 2) Shared Azure DevOps auth-capable runtime handoff

Current live wait:

- `ops/wait-shared-azure-devops-auth-capable-runtime-owner-return-20260709b`
- `next_check_at = 2026-07-10T12:00:00Z`
- `fallback_at = 2026-07-10T18:00:00Z`

Send-proof:

- approval-dispatch ledger row at `2026-07-09T02:42:23.576Z`
- `pathId = shared-azure-devops-auth-capable-runtime-20260709`
- packet `evidence/archive/ops-send-shared-azure-devops-auth-capable-runtime-handoff-20260709.md`
- `result = message.created`

Duplicate check:

- journal shows older `ops/reconcile-shared-azure-devops-auth-runtime-wait-review-state-20260709` was replaced
- live holder is only `ops/wait-shared-azure-devops-auth-capable-runtime-owner-return-20260709b`

Verdict:

- keep only `ops/wait-shared-azure-devops-auth-capable-runtime-owner-return-20260709b`

---

### 3) Shared GitHub dispatch auth-capable runtime handoff

Current live wait:

- `ops/wait-shared-github-dispatch-auth-capable-runtime-owner-return-20260710`
- `next_check_at = 2026-07-10T12:00:00Z`
- `fallback_at = 2026-07-10T18:00:00Z`

Send-proof:

- approval-dispatch ledger row recorded in `evidence/archive/ops-send-shared-github-dispatch-auth-capable-runtime-handoff-20260709.md`
- `pathId = shared-github-dispatch-auth-capable-runtime-20260709`
- `result = message.created`
- timestamp already preserved in accepted prior evidence: `2026-07-09T06:10:23.567Z`

Duplicate check:

- historical send task exists, but I found no second live response-await sibling for the same family
- the current tree lists only `ops/wait-shared-github-dispatch-auth-capable-runtime-owner-return-20260710` as the surviving family holder

Verdict:

- keep only `ops/wait-shared-github-dispatch-auth-capable-runtime-owner-return-20260710`

---

### 4) Disabled-alert alias runtime-owner decision

Current live wait:

- `ops/wait-disabled-alert-alias-runtime-owner-decision-20260709j`
- `next_check_at = 2026-07-10T20:30:00Z`
- `fallback_at = 2026-07-11T20:30:00Z`

Send-proof:

- approval-dispatch ledger row at `2026-07-09T19:59:54.837Z`
- `pathId = ops-disabled-alert-alias-runtime-owner-escalation-20260709f`
- packet `evidence/archive/ops-send-disabled-alert-alias-runtime-owner-escalation-20260709f.md`
- emitted `approvalId` / `waitId` are preserved in the evidence note

Duplicate check:

- the older passive wait `wait-ops-disabled-alert-alias-lifecycle-alert3248-runtime-response-20260709` was already replaced
- surviving live holder is only `ops/wait-disabled-alert-alias-runtime-owner-decision-20260709j`

Verdict:

- keep only `ops/wait-disabled-alert-alias-runtime-owner-decision-20260709j`

---

### 5) Windows node-pool create owner arbitration

Current live wait:

- `ops/wait-windows-node-pool-create-owner-arbitration-return-20260709s`
- `next_check_at = 2026-07-10T12:15:00Z`
- `fallback_at = 2026-07-11T12:15:00Z`

Send-proof:

- approval-dispatch ledger row at `2026-07-08T12:25:30.180Z`
- `pathId = path.windows.node-pool-create`
- packet `evidence/archive/ops-escalate-windows-node-pool-create-arbitration-20260708.md`
- `result = message.created`

Duplicate check:

- older `wait-spec-windows-node-pool-create-exact-create-surface-arbitration-20260707` was already replaced
- project-level live holder is only `ops/wait-windows-node-pool-create-owner-arbitration-return-20260709s`

Verdict:

- keep only `ops/wait-windows-node-pool-create-owner-arbitration-return-20260709s`

## What is still missing

For all five named families, what is still missing is **not** send-proof and **not** family dedupe.

What is missing is a visible returned decision:

- runtime `events` still show **0** `project.approval.submitted` rows overall,
- so none of these waits can yet be truthfully closed by reply evidence,
- and I found no evidence that a reply already arrived but failed to land in the task tree.

## Planner review output

This worker did **not** mutate the task tree.

### Recommended planner stance now

1. **Keep these five waits as-is**:
   - `wait-spec-network-acns-hubble-contract-owner-response-20260708`
   - `ops/wait-shared-azure-devops-auth-capable-runtime-owner-return-20260709b`
   - `ops/wait-shared-github-dispatch-auth-capable-runtime-owner-return-20260710`
   - `ops/wait-disabled-alert-alias-runtime-owner-decision-20260709j`
   - `ops/wait-windows-node-pool-create-owner-arbitration-return-20260709s`

2. **Do not recreate** older passive/replaced siblings for these asks.

3. Treat the remaining concern as **external nonresponse so far**, not unresolved send-proof or duplicate-wait structure.

4. If a future `project.approval.submitted` row appears, planner/app-ops should:
   - match it to the emitted `approvalId`, `waitId`, or `pathId`,
   - replace only the satisfied family wait with the exact bounded successor named by that decision,
   - and avoid broad tree reshaping.

## Acceptance check against this task

- Included the required overdue network-acns Hubble owner-response family: **done**
- Inventory of the named escalation families: **done**
- Send-proof verified for each live family: **done**
- Matching returned reply / closure visibility checked: **done**
- Duplicate passive waits checked and reduced to one truthful surviving wait per family: **done**
- Network-acns lineage left as one sharper surviving wait with current owner/resume/fallback times rather than stale passive wording: **done**

## Final conclusion

This corrected audit shows the escalation lane is already structurally drained across the required families, including the overdue network-acns Hubble contract lineage.

The remaining open truth is simple: **one live wait per family remains, send-proof/chase-proof exists, and no returned `project.approval.submitted` decision is visible yet.**