# Noon owner-return family audit and repair packet — 2026-07-11

- Task: `ops/repair-noon-owner-return-family-20260711`
- Attempt: `a_ops_repair-noon-owner-return-family-20260711_20260711043247`
- Mode: Task Worker Mode / audit + evidence + planner-review output only
- Runtime task-tree mutation from this worker: none

## Scope covered

Required wait families audited:

1. `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`
2. `wait-spec-network-acns-hubble-contract-owner-response-20260708`
3. `wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708`
4. `wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708`

Matching project approval/runtime-return families visible from current app evidence:

5. `ops/wait-shared-azure-devops-auth-capable-runtime-owner-return-20260709b`
6. `ops/wait-shared-github-dispatch-auth-capable-runtime-owner-return-20260710`
7. `ops/wait-runtime-owner-stale-workflow-run-row-closure-return-20260710`

## Authoritative reads used

- `bun run task-tree show project`
- `bun run task-tree show <each live wait above>`
- runtime DB schema + read-only event queries via `query_db`
- `/app/projects/aks-rp-e2e.app/.state/tasks/archive/done-leaves-20260711032903897.json`
- `/app/projects/aks-rp-e2e.app/.state/tasks/archive/done-leaves-20260711032951181.json`
- prior durable evidence in `/app/projects/aks-rp-e2e.app/evidence/archive/`
- prior durable domain send-proof packets in `/app/projects/aks-rp-e2e/evidence/archive/`

## Runtime reply baseline

Read-only runtime DB checks during this audit showed:

- `events` has `event_type`, `data`, and `timestamp` as expected.
- there are `project.approval.requested` and `message.created` rows for owner/runtime sends.
- there are currently **no** `project.approval.submitted` rows.

That means none of the reviewed owner-return families has a controller-visible returned approval closure to ingest right now.

## Bottom line

- The JWT, network-ACNS, CCP tunnelfront, and project-level runtime/owner-return families are already in the smallest truthful live shape: **one exact wait each, with send-proof lineage and no visible returned decision yet**.
- The project-level duplicate passive placeholder was already retired before this session; the truthful project frontier is the three exact waits listed above.
- The only family that still reads as a passive/incomplete wait rather than a sharpened return/recovery lineage is **secops-fips terminal artifact visibility**. It still carries the right exact scope, but the live wait machine-addresses only run `28618650515` while the governed family also includes run `28621344506`.

So the repaired family picture after this audit is:

- **Preserve** the six already-sharp exact waits.
- **Do not reopen** unchanged domain reruns.
- **Planner/app-ops should replace or refresh only the secops-fips family** with one exact authenticated artifact-recovery/escalation follow-up that names both run ids.

## Family-by-family verdicts

| Family | Current live carrier | Send-proof / return evidence | Current judgment | Action now |
| --- | --- | --- | --- | --- |
| Shared JWT egress surface | `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708` | durable 2026-07-08 approval-dispatch send proof exists; no returned approval visible | already sharp | keep this one exact wait |
| Network-ACNS Hubble contract | `wait-spec-network-acns-hubble-contract-owner-response-20260708` | original 2026-07-08 send proof + 2026-07-09 third-contact chase proof; no returned approval visible | already sharp | keep this one exact wait |
| CCP tunnelfront lineage excerpt | `wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708` | 2026-07-08 approval-dispatch send proof exists; no returned excerpt / no-such-excerpt decision visible | already sharp | keep this one exact wait |
| Secops-fips terminal artifact visibility | `wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708` | no same-run artifacts recovered; no owner-return packet lineage; live wait still machine-addresses only one run id | still passive / incomplete | replace or refresh with one exact authenticated artifact-recovery follow-up |
| Shared Azure DevOps auth runtime | `ops/wait-shared-azure-devops-auth-capable-runtime-owner-return-20260709b` | live wait now cites resubmitted shared refresh lineage `shared-owner-return-family-refresh-20260710`; no submitted return | already sharp | keep this one exact wait |
| Shared GitHub dispatch auth runtime | `ops/wait-shared-github-dispatch-auth-capable-runtime-owner-return-20260710` | live wait now cites same resubmitted shared refresh lineage; no submitted return | already sharp | keep this one exact wait |
| Runtime stale workflow-row closure | `ops/wait-runtime-owner-stale-workflow-run-row-closure-return-20260710` | exact send proof visible in runtime events for closure packet; no submitted return | already sharp | keep this one exact wait |

## Exact findings

### 1) Shared JWT egress-surface family

Supported live read shows `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708` is still:

- `state = blocked`
- exact governed scope: `spec.jwt-authenticator.incluster-idp-dex-lifecycle` / `path.jwt-authenticator.incluster-idp-dex-lifecycle`
- `resume_at = 2026-07-11T12:00:00Z`
- `next_check_at = 2026-07-11T12:00:00Z`
- `fallback_at = 2026-07-11T18:00:00Z`

Durable send proof is already preserved in the domain packet:

- `evidence/archive/jwt-authenticator-go-e2ev3-egress-surface-owner-ask-20260708.md`
- that packet records approval-dispatch ledger proof at `2026-07-08T07:09:14.124Z`
- and runtime events `project.approval.requested` id `2839624` plus `message.created` id `2839627`

Current judgment:

- no returned proof, no-surface proof, or exact reroute is visible now;
- the live wait is already the one sharp surviving lineage;
- no duplicate rerun or new sibling wait is justified.

### 2) Network-ACNS Hubble contract family

Supported live read shows `wait-spec-network-acns-hubble-contract-owner-response-20260708` is still:

- `state = blocked`
- exact six-spec family preserved in goal/blocker text
- `resume_at = 2026-07-11T12:00:00Z`
- `next_check_at = 2026-07-11T12:00:00Z`
- `fallback_at = 2026-07-11T18:00:00Z`

Durable owner-send / chase proof already exists in the accepted lineage:

- original packet: `evidence/archive/ops-send-network-acns-hubble-contract-owner-packet-20260708.md`
- refreshed chase packet: `evidence/archive/spec-loop-overdue-owner-response-third-contact-packet-20260709.md`
- accepted evidence packets already preserve the routed `message.created` proof for the third-contact chase at `2026-07-09T07:18:05.218Z`

Current judgment:

- no returned contract keep/narrow/decline/reroute outcome is visible;
- the live wait is already rebound to the sharper same-family third-contact lineage;
- keep this one exact wait.

### 3) CCP tunnelfront lineage-excerpt family

Supported live read shows `wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708` is still:

- `state = blocked`
- exact governed scope: `spec.ccp.tunnelfront-konnectivity-migration`
- `next_check_at = 2026-07-11T12:00:00Z`
- `fallback_at = 2026-07-12T12:00:00Z`

Durable send proof exists in the domain packet:

- `evidence/archive/send-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-ask-20260708.md`
- that packet records approval-dispatch ledger proof at `2026-07-08T09:30:47.405Z`
- it also records runtime events `project.approval.requested` id `2849785` and `message.created` id `2849793`

Current judgment:

- no returned lineage excerpt or explicit no-such-excerpt decision is visible in current app evidence;
- the live wait is already the truthful response-await holder;
- keep this one exact wait.

### 4) Secops-fips terminal artifact-visibility family

Supported live read shows `wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708` is still:

- `state = blocked`
- exact governed scope in text: `spec.secops-fips.extension-blocked` / run `28618650515` and `spec.secops-fips.windows` / run `28621344506`
- `next_check_at = 2026-07-11T12:00:00Z`
- `fallback_at = 2026-07-12T12:00:00Z`
- but `waiting_for.sourceRunId = 28618650515`

Current app evidence still shows the family is under-modeled rather than fully repaired:

- `evidence/archive/ops-recover-secops-fips-terminal-artifact-visibility-family-20260710.md` proves same-run artifacts/logs were not locally recoverable from this runtime;
- the same memo proves the current live wait machine-addresses only one run id even though both spec-loop rows point at the family wait;
- `.state/spec-loop/state.json` still maps both specs to this same family wait while preserving separate `pendingReviewRunId` values `28618650515` and `28621344506`.

Current judgment:

- this is the one family in scope that still behaves like a passive placeholder instead of a sharpened send/return/recovery lineage;
- no unchanged rerun should reopen;
- the next truthful move is one exact authenticated artifact-recovery follow-up that names **both** run ids and either recovers same-run bundles or records an explicit access/retention diagnosis.

### Exact planner/app-ops apply requested for secops-fips

Because this worker task was not explicitly authorized to mutate the tree with named `task-tree update-text` / replacement commands, I am leaving the exact apply packet here instead of editing live state.

**Replace or refresh only this family:**
- `wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708`

**Exact sharper replacement meaning:**
- owner: `human` / authenticated GitHub Actions access surface
- affected scope:
  - `spec.secops-fips.extension-blocked` run `28618650515`
  - `spec.secops-fips.windows` run `28621344506`
- resume condition:
  - recover reviewable same-run artifacts/logs for `28618650515` and/or `28621344506`, **or**
  - record exact authenticated failure/retention diagnosis for each run
- forbidden outcome:
  - do **not** queue an unchanged rerun before one of those two recovery outcomes exists

A truthful follow-up task or blocker refresh should explicitly carry both run ids, not just `28618650515`.

### 5) Matching project approval/runtime-return family

The current project-level owner/runtime-return family is already repaired to three exact waits.

Supported live read of `project` shows these are the only live project-level owner-response waits:

1. `ops/wait-shared-azure-devops-auth-capable-runtime-owner-return-20260709b`
2. `ops/wait-shared-github-dispatch-auth-capable-runtime-owner-return-20260710`
3. `ops/wait-runtime-owner-stale-workflow-run-row-closure-return-20260710`

Archived runtime evidence proves the duplicate passive placeholder is already retired:

- `.state/tasks/archive/done-leaves-20260711032903897.json`
- `.state/tasks/archive/done-leaves-20260711032951181.json`

#### Shared Azure DevOps auth runtime

Current live wait text now cites the resubmitted shared refresh lineage:

- pathId `shared-owner-return-family-refresh-20260710`
- runtime DB shows `project.approval.requested` event `3026982`
- runtime DB shows matching `message.created` event `3026985`
- no `project.approval.submitted` return is visible

Verdict: keep `ops/wait-shared-azure-devops-auth-capable-runtime-owner-return-20260709b` as the one exact wait.

#### Shared GitHub dispatch auth runtime

Current live wait text cites the same resubmitted shared refresh lineage:

- same send-proof events `3026982` / `3026985`
- no `project.approval.submitted` return is visible

Verdict: keep `ops/wait-shared-github-dispatch-auth-capable-runtime-owner-return-20260710` as the one exact wait.

#### Runtime stale workflow-row closure

Current live wait preserves exact closure-request lineage for workflow runs:

- `wr_1783696574622_4egf`
- `wr_1783696574683_3u2c`

Runtime DB shows durable send proof:

- `project.approval.requested` event `3010729`
- `message.created` event `3010733`
- no matching `project.approval.submitted` return is visible

Verdict: keep `ops/wait-runtime-owner-stale-workflow-run-row-closure-return-20260710` as the one exact wait.

### Matching visible project-side return signal

There is one visible project-side response signal in current app evidence, but it is **not** a closure ingest:

- runtime event `2993914` is a `message.created` decline from `agent:may` to `aks-explorer` for the shared owner-return family refresh packet.

That signal does not create a `project.approval.submitted` return and does not justify new duplicate waits. The current sharper project-level shape already absorbed it by keeping only the three exact waits above.

## Pre-audit vs post-audit represented set

### Pre-audit exact contributor set

- `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`
- `wait-spec-network-acns-hubble-contract-owner-response-20260708`
- `wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708`
- `wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708`
- `ops/wait-shared-azure-devops-auth-capable-runtime-owner-return-20260709b`
- `ops/wait-shared-github-dispatch-auth-capable-runtime-owner-return-20260710`
- `ops/wait-runtime-owner-stale-workflow-run-row-closure-return-20260710`

### Post-audit represented set

Unchanged for six families, plus one exact planner/app-ops repair requested for secops-fips:

- keep the same six exact waits named above;
- replace or refresh only `wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708` so the live recovery lineage explicitly machine-addresses both run ids.

## Planner/app-ops conclusion

1. **Keep unchanged**:
   - `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`
   - `wait-spec-network-acns-hubble-contract-owner-response-20260708`
   - `wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708`
   - `ops/wait-shared-azure-devops-auth-capable-runtime-owner-return-20260709b`
   - `ops/wait-shared-github-dispatch-auth-capable-runtime-owner-return-20260710`
   - `ops/wait-runtime-owner-stale-workflow-run-row-closure-return-20260710`

2. **Do not reopen unchanged domain reruns** for any of those families.

3. **Repair only secops-fips family shape** by replacing or refreshing `wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708` into one exact authenticated recovery/escalation lineage that explicitly carries both runs `28618650515` and `28621344506`.

## Review-ready conclusion

This noon audit shows the owner-return family is mostly already repaired. JWT, network-ACNS, CCP tunnelfront, shared Azure DevOps auth runtime, shared GitHub dispatch auth runtime, and stale workflow-row closure each already have one exact live wait with durable send-proof lineage and no visible returned decision to ingest. The only remaining passive/incomplete family is secops-fips terminal artifact visibility: its live wait still governs the correct two-run scope, but the machine-readable blocker only encodes run `28618650515`, so planner/app-ops should replace or refresh that one family with an authenticated two-run artifact-recovery/escalation follow-up rather than reopen unchanged reruns.
