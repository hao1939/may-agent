# reconcile-human-escalation-open-families-20260710b

- Task: `ops/reconcile-human-escalation-open-families-20260710b`
- Attempt: `a_ops_reconcile-human-escalation-open-families-20260710b_20260710042638`
- Reviewed at: `2026-07-10T11:43:09Z`
- Mode: Task Worker Mode / planner-review output only
- Runtime tree mutation from this worker: none

## Result

I inventoried the currently open **human escalation / approval-return families** from the live runtime tree at `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`, matched each family to durable send-proof, checked for controller-visible return-proof in the runtime `events` table, and classified the live residue.

### Bottom line

- The live backlog is **not** primarily an ingest-gap problem.
- It is **mostly operator nonresponse**, with a smaller amount of **stale duplicate wait coverage / stale references**.
- I found **controller-visible send proof** for the active approval-return families, but **no controller-visible `project.approval.submitted` return event at all for `aks-rp-e2e`**.
- The highest-value family to keep as the single exact owner wait is:
  - `ops/wait-shared-azure-devops-auth-capable-runtime-owner-return-20260709b`
- The older family id
  - `wait-shared-azure-devops-auth-capable-runtime-provider-response-20260709`
  is **already replaced** in the live `.state` tree and should be treated as stale review/snapshot residue if it still appears in planner notes or the static `tasks/tree.json` snapshot.

## Method / baseline

Per worker-mode audit rules, I computed the baseline as if this audit task itself did not exist.

Checked sources:

- live runtime tree: `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`
- static snapshot for comparison: `/app/projects/aks-rp-e2e.app/tasks/tree.json`
- approval-dispatch ledger: `/app/projects/aks-rp-e2e.app/.state/approval-dispatch-runs.jsonl`
- runtime `events` table for:
  - `project.approval.requested`
  - `message.created`
  - `project.approval.submitted`
- existing app/domain evidence packets for the active human-return families

## Global runtime findings

### 1) Send-proof exists

Runtime query and evidence notes show many accepted approval-dispatch sends for AKS RP E2E.

Current runtime query result:

- `message.created` rows matching `AKS RP E2E approval packet dispatch`: **13**

### 2) Return-proof does not exist in controller-visible runtime state

Runtime query result for `aks-rp-e2e`:

- `project.approval.submitted`: **0 rows**

This is the strongest system-wide signal in the audit:

- the app is generating outbound approval/escalation packets,
- but the controller-visible return path has not produced a single `project.approval.submitted` event for this project.

### 3) Some stale/duplicate references still exist in non-authoritative surfaces

I found one important stale-name drift:

- static snapshot / older evidence still references `wait-shared-azure-devops-auth-capable-runtime-provider-response-20260709`
- live `.state/tasks/tree.json` now carries the sharper replacement
  `ops/wait-shared-azure-devops-auth-capable-runtime-owner-return-20260709b`

That means part of the evaluator concern is real backlog, but part is also **stale wait naming / duplicate coverage in older review surfaces**, not a missing live owner wait.

## Inventory of open human escalation / approval-return families

The table below lists the active lineages I found that are explicitly in human owner-response / approval-return state.

| Family | Exact live wait(s) owned now | Send-proof evidence | Controller-visible return-proof | Classification |
|---|---|---|---|---|
| Shared Azure DevOps auth-capable runtime | `ops/wait-shared-azure-devops-auth-capable-runtime-owner-return-20260709b` | `projects/aks-rp-e2e/evidence/archive/ops-send-shared-azure-devops-auth-capable-runtime-handoff-20260709.md` records `Event emitted: project.approval.requested` and approval-dispatch `message.created` for `pathId=shared-azure-devops-auth-capable-runtime-20260709`. | None found in runtime `events`; no `project.approval.submitted` for this lineage. | **Mixed**: exact live wait is good, but older wait id / stale references still exist. Dominant live residue is **operator nonresponse**. |
| Shared GitHub dispatch auth-capable runtime | `ops/wait-shared-github-dispatch-auth-capable-runtime-owner-return-20260710` | `projects/aks-rp-e2e/evidence/archive/ops-send-shared-github-dispatch-auth-capable-runtime-handoff-20260709.md` records accepted request plus approval-dispatch `message.created` for `pathId=shared-github-dispatch-auth-capable-runtime-20260709`. | None found. | **Operator nonresponse** |
| Disabled alias runtime-owner decision | `ops/wait-disabled-alert-alias-runtime-owner-decision-20260709j` | `evidence/archive/metric-alert-overdue-nonhuman-unworked-count-20260709-alert3248-send-or-repair.md` records accepted `project.approval.requested`, approval-dispatch `message.created`, and explicit `approvalId` / `waitId`. | None found. | **Operator nonresponse**; older passive alias wait was already replaced. |
| KMS SVC underlay owner decision | `wait-kms-svc-cert-rotation-underlay-owner-decision-return-20260709` | `projects/aks-rp-e2e/evidence/archive/ops-send-kms-svc-cert-rotation-underlay-kubeconfig-owner-ask-20260709s.md` records accepted request, approval-dispatch `message.created`, and exact `approvalId` / `waitId` for `path.kms.v2plus-svc-cert-rotation`. | None found. | **Operator nonresponse** |
| Windows create-surface arbitration | `ops/wait-windows-node-pool-create-owner-arbitration-return-20260709s` | `projects/aks-rp-e2e/evidence/archive/ops-escalate-windows-node-pool-create-arbitration-20260708.md` records actual send via `project.approval.requested` and approval-dispatch `message.created` for `path.windows.node-pool-create`. | None found. | **Operator nonresponse**; exact owner wait exists. |
| App Routing rollback existing-target return | `wait-spec-app-routing-rollback-istio-to-nginx-existing-target-return-20260708` | `projects/aks-rp-e2e/evidence/archive/ops-refresh-app-routing-rollback-existing-target-response-20260709u.md` records accepted request, `message.created`, and exact `approvalId` / `waitId` for `path.app-routing.nginx-to-istio-migration`. | None found. | **Operator nonresponse** |
| Extension-addon execution identity permission | `wait-spec-extension-addon-execution-identity-permission-response-20260702` plus compact-facing holder `hold-compact-extension-addon-reviewed-exception-frontier` | `evidence/archive/ops-chase-extension-addon-execution-identity-permission-owner-response-20260709k.md` records accepted follow-up request, `message.created`, exact `approvalId` / `waitId`, and says no `project.approval.submitted` exists yet. | None found. | **Operator nonresponse** |
| Network-ACNS Hubble contract family | `wait-spec-network-acns-hubble-contract-owner-response-20260708` | Live blocker text now points at the original send plus the shared **third-contact** packet `evidence/archive/spec-loop-overdue-owner-response-third-contact-packet-20260709.md`, and prior evidence records routed `message.created` proof for that packet. | None found. | **Operator nonresponse**; third-contact rebinding already fixed earlier stale wording. |
| CCP security-patch owner/source-authority family | `wait-ccp-security-patch-reviewed-exception-owner-response-20260708` plus compact-facing holder `hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier` | Live blocker text now points at the original owner packet plus the shared **third-contact** packet `evidence/archive/spec-loop-overdue-owner-response-third-contact-packet-20260709.md`. | None found. | **Operator nonresponse**; earlier stale second-contact wording already repaired. |
| Shared JWT egress surface | `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708` | `evidence/archive/ops-chase-shared-overdue-jwt-underlay-waits-20260709.md` records routed `project.approval.requested -> approval-dispatch -> message.created -> human:operator` for the JWT second-contact lineage. | None found. | **Operator nonresponse** |
| Shared underlay/runtime-input family | `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708` | The same JWT/underlay audit note records that the existing underlay family already had fresh exact escalation packet lineage and durable `message.created` proof from `2026-07-08T14:27:13.334Z`. | None found. | **Operator nonresponse** |
| LocalDNS authoritative return family | `hold-spec-localdns-reviewed-exception-authoritative-return-family-20260706c` | Live blocker text states the 2026-07-06 owner packet was sent with durable approval-dispatch proof and no returned owner outcome is present. | None found. | **Operator nonresponse** |
| CCP tunnelfront lineage excerpt family | `wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708` | Live blocker text states the owner/archive ask packet was already sent with durable proof and no returned excerpt / no-such-excerpt decision exists yet. | None found. | **Operator nonresponse** |
| Secops-identity SP workflow secret contract | `wait-secops-identity-sp-workflow-secret-contract-return-20260704` | Live blocker text cites accepted 2026-07-02 handoff proof chain (`project.approval.requested` plus packet lineage). | None found. | **Operator nonresponse** |

## Highest-value unresolved family

## Family selected

**Shared Azure DevOps auth-capable runtime**

### Why this is the highest-value family

It gates multiple otherwise-bounded next steps at once:

- trusted-ref publication slices,
- authoritative Azure DevOps artifact recovery,
- and the validating rerun for repaired `spec.network-cni.cilium-preview-upgrade`.

So this is a sharper process bottleneck than any single spec-specific owner-response family.

### Exact remaining owner wait to keep

Keep exactly this live wait:

- `ops/wait-shared-azure-devops-auth-capable-runtime-owner-return-20260709b`

### Exact resume contract from live runtime tree

- **resume condition:**
  - return lands for `pathId=shared-azure-devops-auth-capable-runtime-20260709`, or
  - a reviewed replacement runtime/helper proves `git ls-remote origin HEAD` and exact Azure DevOps artifact recovery can succeed
- **next check:** `2026-07-10T12:00:00Z`
- **fallback:** `2026-07-10T18:00:00Z`
- **fallback action:**
  - refresh the shared handoff evidence and escalate the exact missing auth-capable runtime/helper return,
  - **do not** reopen duplicate passive waits

### Exact stale duplicate / replacement judgment

The older wait id

- `wait-shared-azure-devops-auth-capable-runtime-provider-response-20260709`

is **not present** in the live `.state/tasks/tree.json` authority anymore.

The live tree already replaced it with:

- `ops/wait-shared-azure-devops-auth-capable-runtime-owner-return-20260709b`

So for this family the planner/app-ops action is:

1. **keep** `ops/wait-shared-azure-devops-auth-capable-runtime-owner-return-20260709b` as the single truthful live wait,
2. **retire/ignore stale references** to `wait-shared-azure-devops-auth-capable-runtime-provider-response-20260709` in older evidence, static snapshots, or review comments,
3. **do not** open a new sibling wait for the same auth-capable runtime family.

## Classification of the evaluator concern

## Conclusion

The evaluator concern is **mixed, but dominated by operator nonresponse**.

### Why it is not mainly a reply-ingest gap

Evidence against ingest-gap as the primary diagnosis:

- the runtime `events` table shows **0** `project.approval.submitted` rows for `aks-rp-e2e`, not a pattern of submitted replies failing to close waits selectively;
- the outbound side is working: there are multiple accepted `project.approval.requested` and `message.created` proofs;
- several families have already been rebound to fresher chase lineages (for example extension-addon, network-ACNS, CCP security-patch), so the app has been updating waits rather than silently dropping all outbound work.

### Why operator nonresponse is the dominant diagnosis

- many families have current send-proof,
- none has controller-visible return-proof,
- several waits explicitly state “already-sent” and “no returned outcome visible yet,”
- and the project-wide runtime query still returns zero `project.approval.submitted` rows.

### Why the diagnosis is still mixed

There is still some **stale duplicate coverage / stale reference** noise:

- old family ids remain in older evidence or static snapshots,
- at least one live family (`shared Azure DevOps auth-capable runtime`) has already been replaced by a sharper wait in `.state`,
- and some evaluator/planner review surfaces can therefore overcount “open families” unless they use the live `.state/tasks/tree.json` authority.

### Final classification

**Mixed: mostly operator nonresponse, with secondary stale duplicate wait coverage. No evidence-backed proof of a reply-ingest gap.**

## Planner / app-ops apply recommendations

Because this worker session was not authorized to mutate the task tree, the planner/app-ops follow-up should be:

1. **Use `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json` as authority** for the human-return backlog, not the static `tasks/tree.json` snapshot alone.
2. **Keep** `ops/wait-shared-azure-devops-auth-capable-runtime-owner-return-20260709b` as the exact remaining shared Azure DevOps auth wait.
3. **Retire/ignore** stale references to `wait-shared-azure-devops-auth-capable-runtime-provider-response-20260709` wherever they still appear.
4. **Do not create reply-ingest repair work yet.** Current evidence does not show replies being ingested and dropped; it shows sends without visible returns.
5. If another cleanup pass is desired, target **stale reference drift** only:
   - old wait ids in archived review language,
   - old passive alias wait names already superseded by live exact waits,
   - any review packet still naming second-contact where live waits already point at third-contact.

## Minimal review-ready answer to the task prompt

- **Open family inventory:** completed above.
- **Highest-value unresolved family:** shared Azure DevOps auth-capable runtime.
- **Exact remaining owner wait:** `ops/wait-shared-azure-devops-auth-capable-runtime-owner-return-20260709b`.
- **Resume condition / next check / fallback:** captured from live blocker above.
- **Concern classification:** mixed, dominated by operator nonresponse; no evidence-backed ingest gap.
- **Tree update needed:** planner should treat old `wait-shared-azure-devops-auth-capable-runtime-provider-response-20260709` references as stale and keep the newer `ops/wait-shared-azure-devops-auth-capable-runtime-owner-return-20260709b` as the sole live family wait.
