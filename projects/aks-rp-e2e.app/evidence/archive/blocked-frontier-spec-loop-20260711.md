# Spec-loop blocked-frontier family audit — 2026-07-11

Assigned task: `ops/reduce-spec-loop-blocked-frontier-family-20260711`
Attempt: `a_ops_reduce-spec-loop-blocked-frontier-family-20260711_20260711135038`
Mode: Task Worker Mode — audit/evidence only

## Scope and worker-mode constraint

This pass audited the live spec-loop blocked frontier for over-represented blocker families and checked whether the largest overdue families still preserve **one exact carrier per live blocker family**.

I did **not** mutate the task tree from this worker session. The assigned task does not explicitly authorize exact supported task-tree mutation commands against named task ids, so under Task Worker Mode the correct deliverable is planner-ready evidence plus exact repair/no-op conclusions.

## Baseline used

For this task, the baseline must be computed from the **controller-visible live task tree**, not the checked-in snapshot.

### Live tree baseline

Using `.state/tasks/tree.json` and `bun run task-tree show aks-spec-verification-loop`:

- `aks-spec-verification-loop` has **73 blocked child leaves**
- it has **0 active/review/waiting/backlog child leaves**
- `workflowProgress.reason` says the loop is drained and the remaining frontier is exact blocked-wait stewardship only

### Important shape note

The checked-in `tasks/tree.json` still contains older superseded/stale children and shows **92 blocked direct children** under `aks-spec-verification-loop`, but the live task-tree CLI and `.state/tasks/tree.json` agree on the current controller-visible baseline of **73**.

For blocked-frontier truth, the runtime/app-owned tree is the ground truth for this audit.

## Pre-audit contributor set for examined families

This pass examined the largest and/or most duplication-prone overdue families visible in the live 73-child frontier:

### Family A — serverless-schedulerctrl underlay-kubeconfig

Pre-audit contributor set from stale snapshot lineage:

1. `wait-spec-serverless-schedulerctrl-underlay-kubeconfig-frontier-20260707f`
2. `hold-spec-serverless-schedulerctrl-underlay-kubeconfig-frontier-20260708`

Post-action represented set in the **live** tree:

1. `hold-spec-serverless-schedulerctrl-underlay-kubeconfig-frontier-20260708`

### Family B — LocalDNS

Live contributor set:

1. `hold-spec-localdns-managed-cluster-quota-family-frontier-20260708`
2. `hold-spec-localdns-reviewed-exception-authoritative-return-family-20260706c`
3. `wait-localdns-hosts-plugin-create-http400-body-or-surface-change-20260703`
4. `wait-localdns-create-http400-residual-family-return-20260704`

### Family C — net-integration

Live contributor set:

1. `wait-spec-net-integration-basiclb-create-deprecation-boundary-20260702`
2. `wait-spec-net-integration-managednatgatewayv2-byo-request-shape-support-20260702`
3. `wait-spec-net-integration-outbound-none-topology-constraint-20260702`
4. `wait-spec-net-integration-outbound-udr-virtualappliance-prerequisite-supply-20260702`
5. `wait-spec-net-integration-cross-subscription-vnet-response-20260702`

## Family audit 1 — serverless-schedulerctrl underlay-kubeconfig

### Why this family was examined

This family previously looked duplicated in the checked-in snapshot because both `wait-spec-serverless-schedulerctrl-underlay-kubeconfig-frontier-20260707f` and `hold-spec-serverless-schedulerctrl-underlay-kubeconfig-frontier-20260708` described the same missing `AKS_RP_E2E_UNDERLAY_KUBECONFIG` prerequisite.

### Live-tree finding

The live task tree has **already converged** this family.

Evidence:

- `bun run task-tree show wait-spec-serverless-schedulerctrl-underlay-kubeconfig-frontier-20260707f` returned `Task not found`
- `.state/tasks/tree.json` contains `hold-spec-serverless-schedulerctrl-underlay-kubeconfig-frontier-20260708`
- that surviving holder now explicitly says it is a **projection of the shared family wait** `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
- its blocker now carries refreshed timing and exact resume/fallback wording:
  - `next_check_at = 2026-07-11T18:30:00Z`
  - `resume_at = 2026-07-11T18:30:00Z`
  - `fallback_at = 2026-07-12T15:30:00Z`

### Truthfulness judgment

This family is now **minimally represented in the live tree**.

The older `20260707f` holder is no longer a live child, so no further worker-side dedupe is needed. The surviving `20260708` holder is the single truthful carrier for the four schedulerctrl lifecycle specs waiting on reviewed underlay access.

### Planner/app-ops action

No new tree change is needed for this family.

## Family audit 2 — LocalDNS

### Why this family was examined

LocalDNS is one of the largest still-open spec-loop families and includes several overdue holders, so it is a likely candidate for accidental over-representation.

### Live holders reviewed

1. `wait-localdns-create-http400-residual-family-return-20260704`
2. `hold-spec-localdns-managed-cluster-quota-family-frontier-20260708`
3. `hold-spec-localdns-reviewed-exception-authoritative-return-family-20260706c`
4. `wait-localdns-hosts-plugin-create-http400-body-or-surface-change-20260703`

### Distinct blocker meanings

These four holders are not duplicates of one another:

- `wait-localdns-create-http400-residual-family-return-20260704`
  - shared residual create-time HTTP 400 family
  - six bounded members across cni-matrix and network-policy
- `hold-spec-localdns-managed-cluster-quota-family-frontier-20260708`
  - shared westus2/staging managed-cluster quota/headroom family
  - separate from HTTP 400 create residuals
- `hold-spec-localdns-reviewed-exception-authoritative-return-family-20260706c`
  - owner/product/source-authority response wait
  - covers multipool-consistency and windows-nodepool reviewed-exception lineage
- `wait-localdns-hosts-plugin-create-http400-body-or-surface-change-20260703`
  - exact spec-level hosts-plugin create-time HTTP 400 branch
  - intentionally narrower than the shared residual family

### Timing status checked

At audit time:

- the residual, managed-cluster-quota, and authoritative-return holders are due for owner review at or after `2026-07-10T18:00:00Z`
- the hosts-plugin holder is already fresher and not due until `2026-07-11T18:00:00Z`

### Truthfulness judgment

The LocalDNS family is **already minimally represented** in the live tree.

Collapsing these four leaves would erase useful blocker distinctions across:

- residual create-time HTTP 400 members
- environment/headroom quota frontier
- owner/source-authority response wait
- exact hosts-plugin branch

### Planner/app-ops action

Keep all four LocalDNS holders unchanged.

Optional future hygiene is limited to timing refresh only; do **not** merge them.

## Family audit 3 — net-integration

### Why this family was examined

Net-integration is one of the largest overdue families in the live spec-loop frontier with five blocked holders, all carrying `2026-07-10T18:00:00Z` review timing.

### Live holders reviewed

1. `wait-spec-net-integration-basiclb-create-deprecation-boundary-20260702`
2. `wait-spec-net-integration-managednatgatewayv2-byo-request-shape-support-20260702`
3. `wait-spec-net-integration-outbound-none-topology-constraint-20260702`
4. `wait-spec-net-integration-outbound-udr-virtualappliance-prerequisite-supply-20260702`
5. `wait-spec-net-integration-cross-subscription-vnet-response-20260702`

### Distinct blocker meanings

These five holders remain materially different and should not be consolidated:

- **Basic LB deprecation boundary**
  - product/API create-time deprecation for new cluster creation
- **managedNATGatewayV2 BYO request-shape support**
  - request-shape/product-gap frontier across the BYO IP/prefix variants
- **outboundType=none topology constraint**
  - topology composition boundary, not an environment or product-gap wait
- **outbound-udr VirtualAppliance prerequisite supply**
  - missing BYO next-hop/NVA prerequisite proof and input contract
- **cross-subscription VNet response**
  - explicit external pairing/access reply wait after already-routed ask

### Timing status checked

All five remain due for review based on `next_check_at` and, where present, `resume_at` at `2026-07-10T18:00:00Z`, with `fallback_at = 2026-07-11T18:00:00Z`.

### Truthfulness judgment

The net-integration family is **already minimally represented**. It is large, but not duplicated.

The needed follow-up is timing refresh or escalation of the existing exact waits, not family collapse.

## Net result

### What this audit proved

1. The live spec-loop blocked frontier baseline is **73**, not 92.
2. A previously duplicated-looking family (`serverless-schedulerctrl` underlay-kubeconfig) is **already reduced in live state** to one exact carrier.
3. The examined large overdue families (`LocalDNS` and `net-integration`) are **already minimally represented** and should not be merged.
4. This pass found **no new live duplicate spec-loop wait family** that requires worker-side mutation.

### Post-action represented set

Because worker mode forbids planner-style mutation for this task and the examined live families were already minimal, the represented set after this audit remains:

- one live schedulerctrl holder: `hold-spec-serverless-schedulerctrl-underlay-kubeconfig-frontier-20260708`
- four live LocalDNS holders with distinct blocker meanings
- five live net-integration holders with distinct blocker meanings

## Planner-ready conclusion

- **Do not reopen unchanged cloud execution.**
- **Do not merge** the LocalDNS or net-integration holders reviewed here.
- Treat `tasks/tree.json` as a stale checked-in snapshot for this purpose; use `.state/tasks/tree.json` / `bun run task-tree show` for controller-visible blocked-frontier decisions.
- If planner wants a follow-up, it should be **timing refresh only** on the overdue exact waits already preserved in the live tree.

## Evidence used

- `/app/projects/aks-rp-e2e.app/design/README.md`
- `/app/projects/aks-rp-e2e.app/tasks/README.md`
- `bun run task-tree summary`
- `bun run task-tree show aks-spec-verification-loop`
- live read of `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`
- stale snapshot comparison against `/app/projects/aks-rp-e2e.app/tasks/tree.json`
- `bun run task-tree show hold-spec-serverless-schedulerctrl-underlay-kubeconfig-frontier-20260708`
- `bun run task-tree show wait-spec-serverless-schedulerctrl-underlay-kubeconfig-frontier-20260707f` → `Task not found`
- live reads of:
  - `wait-localdns-create-http400-residual-family-return-20260704`
  - `hold-spec-localdns-managed-cluster-quota-family-frontier-20260708`
  - `hold-spec-localdns-reviewed-exception-authoritative-return-family-20260706c`
  - `wait-localdns-hosts-plugin-create-http400-body-or-surface-change-20260703`
  - `wait-spec-net-integration-basiclb-create-deprecation-boundary-20260702`
  - `wait-spec-net-integration-managednatgatewayv2-byo-request-shape-support-20260702`
  - `wait-spec-net-integration-outbound-none-topology-constraint-20260702`
  - `wait-spec-net-integration-outbound-udr-virtualappliance-prerequisite-supply-20260702`
  - `wait-spec-net-integration-cross-subscription-vnet-response-20260702`
