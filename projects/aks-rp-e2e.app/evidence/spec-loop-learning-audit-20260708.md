# Spec Loop Learning Audit - 2026-07-08

Purpose: manually exercise the spec-loop learning process across representative success and failure cases, then review the whole spec ledger at accounting level.

## Current Ledger

Snapshot from `.state/spec-loop/state.json`:

- Total specs: 664
- Pass: 458
- Pending: 204
- Error: 2
- Fail: 0

Largest non-pass feature families:

| Feature | Total | Pass | Pending/Error |
| --- | ---: | ---: | ---: |
| network-cni | 35 | 14 | 21 |
| secops-fips | 18 | 4 | 14 |
| storage-csi | 33 | 19 | 14 |
| virtualmachines | 21 | 7 | 14 |
| kms | 43 | 30 | 13 |
| net-integration | 51 | 38 | 13 |
| cluster-autoscaler | 26 | 15 | 11 |
| localdns | 13 | 3 | 10 |
| network-acns | 13 | 6 | 7 |
| private-cluster | 27 | 20 | 7 |
| windows | 8 | 1 | 7 |

Top pending classifications:

- `environment_blocker`: 34
- `repaired_ready`: 16
- `product_gap`: 11
- `ready`: 9
- `source_grounded_nonlive`: 7
- `repaired_carrier_pending_rerun`: 7
- `test_code_bug_repaired_rerun_ready`: 6
- `reviewed_nonlive_source_grounded_wait`: 5
- `publish_before_rerun`: 5
- `private_source_policy_blocker`: 5

The two current error rows are:

- `spec.egress-lockdown.fips`
- `spec.hcp.grpc-message-size-interceptor`

## Pass Row Audit

I ran a conservative local audit over every `pass` row and checked the local artifact pointer when available. The raw heuristic is not final truth because some rows are recovered from successor evidence or compact per-spec evidence, but it exposes the workflow gap.

Conservative buckets:

- Strong local artifact: 37
- Missing local artifact: 240
- Local artifact exists but no obvious cluster token in top-level JSON: 130
- Artifact does not name the spec id directly: 28
- Gated artifact text found: 17
- Failed artifact text found: 5
- Parse error: 1

Interpretation:

- This does not mean only 37 specs truly passed. It means the ledger does not expose pass proof in one reliable field.
- Some good rows store the real pass under `successorRunId` / `successorResultPath` or compact child evidence, while `lastResultPath` still points to older or aggregate evidence.
- A human cannot quickly distinguish a strong live pass from a normalized pass, compact branch pass, stale artifact pointer, or model-based promotion.

Workflow improvement: every `pass` row needs enough plain facts to show what ran, where it ran, which spec it proved, which result file says so, whether a real AKS cluster was required and observed, and whether any verdict assertion failed.

## Representative Cases

### Strong Standalone Pass: `spec.private-cluster.none-private-dns-zone-v3`

Signal:

- State: `pass`
- Run: `28750369397`
- Local result exists.
- Same-spec artifact has `status=passed`, 13 claims, no failed claims, real resource group, real AKS cluster, and cleanup evidence.

Why it worked:

- The spec creates its own cluster.
- It proves start state, mutation, API readback, and side effect.
- It separates cleanup from verdict claims.

Reusable pattern:

- Lifecycle setting specs should prove before-state, mutation, API value, and external side effect.

### Repaired Test Carrier Pass: `spec.storage-csi.disk-resize`

Signal:

- State: `pass`
- Run: `28793232048`
- Local result exists.
- Same-spec artifact has `status=passed`, 25 claims, no failed claims, real resource group, real AKS cluster, and cleanup evidence.

Why it worked:

- Prior failures taught that PVC binding proof happened too early and the witness image lacked `lsblk`.
- The fix moved PVC/PV proof after consumer pod creation and used `df -BG`.

Reusable pattern:

- Runtime witness failures are often carrier bugs, not product failures.
- A repaired carrier must be verified by a fresh live run.

### Recovered Successor Pass: `spec.cloud-provider.ipbased-lb-backend-pool`

Signal:

- State: `pass`
- Current `lastRunId` points at a later compact/single artifact, but the state also records `successorRunId=28603795767` and `successorResultPath`.
- Review says the successor run reached the exact row-44 product assertions and passed.

Why it worked:

- The workflow recovered a valid same-spec pass after an earlier pending row.

Workflow issue:

- `lastResultPath` alone is misleading. The real pass result is in successor fields.

Reusable pattern:

- Successor pass results must be recorded clearly enough that review/fix-forward
  does not need to infer them from prose.

### Compact Per-Spec Pass From Nonpassing Aggregate: `spec.workload-identity.runtime-token-projection-linux`

Signal:

- State: `pass`
- Current `lastResultPath` points to a compact aggregate result with top-level `status=nonpassing`.
- Review says the specific Linux token-projection branch passed in compact child evidence.

Why it worked:

- Compact result ingestion can correctly harvest a passing branch from a nonpassing package.

Workflow issue:

- The ledger should not force humans to infer per-spec pass from a nonpassing aggregate path.

Reusable pattern:

- Compact ingestion must store branch-level pass results for every harvested spec.

### Normalized Pass With Historical Failed Artifact: `spec.localdns.upgrade-survival`

Signal:

- State: `pass`
- `lastResultPath` still points to a result whose top-level status is failed and has failed claim `assert.daemonset-healthy`.
- Review says the only failed claim was a repo-local daemonset-health assertion later removed, and the preserved run proves the repaired 5-claim contract.

Why it partially worked:

- The reviewer understood that one obsolete assertion should not invalidate the preserved product proof.

Workflow issue:

- This is a model/test-contract decision, not an ordinary artifact pass. It must
  be marked for review if the preserved artifact still looks failed.

Reusable pattern:

- If a pass is recovered by removing or changing assertions, the memo must name
  the accepted repair and why a fresh rerun is not required. Otherwise it looks
  like a false pass.

### Suspicious Pass Pointer: `spec.ccp-autoupgrader.pipeline-daily-master`

Signal:

- State: `pass`
- `lastResultPath` points to `single-ccp-autoupgrader-k8s-rapid-mtc-window`.
- The artifact does not directly name `spec.ccp-autoupgrader.pipeline-daily-master`.

Why this is risky:

- It may be a legitimate alias, but the ledger does not explain the alias relationship.

Workflow improvement:

- The row or memo must name the spec, path, and any accepted alias/supersession
  mapping. Without that, artifact routing mistakes can be mistaken for a pass.

### Exact External Prerequisite: `spec.egress-lockdown.fips`

Signal:

- State: `error`
- Classification: `repaired_carrier_wait`
- Artifact exists and reached real cluster setup, but failed `assert.cluster-created`.
- Review says the repaired carrier now truthfully requires explicit BYO UDR next-hop prerequisite proof.

Why it failed:

- This is not ready for another unchanged rerun. The missing prerequisite is part of the test surface.

Reusable pattern:

- Exact missing prerequisites should become blocked waits only when they name the required inputs and how the observer will detect availability.

### Source/Runner Surface Gap: `spec.hcp.grpc-message-size-interceptor`

Signal:

- State: `error`
- Classification: `reviewed_exception_external_owner_nonlive`
- Local evidence file says pass, but it is a source/check proof, not a live AKS cluster proof.

Why it failed:

- The handwritten source requires an HCP test-environment runner surface and RP proxy kubeconfig wiring that this repo-local carrier does not provide.

Reusable pattern:

- Source/check proof can validate intent, but cannot close the live spec loop. It should produce a source-grounded wait or carrier-authoring task.

### Repaired-Ready But Artifact-Waiting: `spec.network-cni.none-byo-cni-vm-prerelease-lifecycle`

Signal:

- State: `pending`
- Classification: `repaired_ready`
- Last run id exists but no local result path is present.

Why it is inefficient:

- The state says the spec is ready and waiting for an artifact bundle. If the old backend/run is obsolete, waiting does not move the project.

Reusable pattern:

- `repaired_ready` must become active dispatch on the current backend, or an exact artifact-wait with a run id that the controller can poll.

### Environment/SKU Boundary: `spec.gpu.multi-gpu-workload`

Signal:

- State: `pending`
- Classification: `environment_blocker`
- Artifact reached real cluster and GPU assertions, then failed GPU count/access/CUDA validation.
- Review also notes SKU support constraints in staging.

Why it failed:

- The feature has a mix of supported and unsupported GPU paths. A passing MIG path does not prove every GPU path.

Reusable pattern:

- Environment blockers must name the exact target capability missing: SKU, capacity, driver, runtime witness, or subscription support. Otherwise all GPU failures look the same.

### Product/Feature-Flag Constraint: `spec.kms.v2-enable-on-existing-private-kv-lifecycle`

Signal:

- State: `pending`
- Classification: `product_constraint_private_kv_konnectivity_feature_flag`
- Artifact exists and failed during Key Vault setup.

Why it failed:

- Local live-admission gates are clean, but current target lacks the needed private Key Vault/Konnectivity feature capability.

Reusable pattern:

- Feature-flag waits should not be retried until target capability changes or the owner changes the execution surface.

### Owner Decision Wait: `spec.aad-rbac.managed-v2-lifecycle`

Signal:

- State: `pending`
- Classification: `owner_response_await_on_sent_adjudication_packet`
- Existing evidence shows contradictory same-path outcomes.

Why it failed:

- The workflow cannot safely choose the product truth. It needs an owner decision.

Reusable pattern:

- Contradictory live evidence should produce one owner adjudication packet, not repeated reruns.

### Runtime Input Or Redesign: `spec.node-http-proxy.trusted-ca`

Signal:

- State: `pending`
- Classification: `trusted_ca_quarantine`
- Mounted source exposes create/update proxy flows, while this branch needs trusted CA runtime inputs or a source-backed redesign.

Why it failed:

- The spec is not standalone under current target assumptions.

Reusable pattern:

- Single specs must not depend on hidden runtime inputs. Either redesign the carrier to create the inputs or keep an exact runtime-input wait.

## Lessons To Reuse

1. Strong pass shape:
   - same spec id or accepted alias;
   - live target;
   - real resource creation when required;
   - verdict claims with zero failed assertions;
   - cleanup evidence;
   - model update/no-op decision recorded.

2. Compact pass shape:
   - aggregate workflow status is not enough;
   - every branch needs its own pass/fail record;
   - passing branches should close independently from failing siblings.

3. Recovered pass shape:
   - if a later successor proves the spec, the state row must point to that successor as the primary pass result;
   - historical failed artifacts should not remain as the main result pointer.

4. Useful failure shape:
   - root cause class;
   - exact failing phase/assertion;
   - run id and artifact path;
   - target and branch;
   - input/error fingerprint;
   - smallest next action.

5. Avoid:
   - rerun unchanged after same error;
   - call source/check proof a live pass;
   - keep `repaired_ready` as passive pending;
   - close a wait just because the ledger says `pass` without checking the actual result;
   - hide old GitHub/backend waits after moving the live backend to ADO.

## Workflow Refinement

Add this learning loop to every spec result:

```text
run or ingest result
  -> extract facts
  -> classify pass/failure reason
  -> write down what was learned
  -> update pass facts or failure fingerprint
  -> choose next action
```

Facts to record when a spec is marked pass:

- spec id and path id;
- backend, target, run id, and result path;
- whether the result is a direct spec run, compact branch result, successor run,
  or reviewed model/test-contract decision;
- whether a real cluster was required and observed;
- failed verdict assertions, if any;
- cleanup result when cleanup matters to the verdict;
- accepted alias, supersession, or model decision when the result does not
  directly line up with the spec id.

Pass closure rule:

- A spec can close as ordinary pass only when the actual result is pass and no failed verdict assertions exist.
- A reviewed model/test-contract decision is allowed only when it names the run, the obsolete assertion/model piece, the accepted repair, and why no fresh rerun is needed.
- Source/check-only evidence cannot close the live loop.
- Missing artifact, gated artifact, or artifact-routing mismatch must create review/repair work.

Failure learning rule:

- Every non-pass result updates `failureClass`, `inputFingerprint`, `errorFingerprint`, and `diagnosis`.
- If `failureClass=repaired_ready`, the next action is dispatch on the current backend, not passive waiting.
- If waiting for a pipeline/artifact, the blocker must name the backend and run id and the controller must poll it.
- If waiting for product/human/environment, the blocker must name the exact returned signal and fallback.

## Verification Of The Refined Process

I applied the refined process manually to the representative set above. It caught:

- strong pass examples that are safe to reuse;
- compact branch passes whose state needs clearer branch-level result details;
- recovered/successor passes whose primary result is not `lastResultPath`;
- a normalized pass whose main artifact still looks failed;
- a suspicious pass pointing at a different spec artifact;
- current error rows that are exact external/source waits rather than blind rerun candidates;
- `repaired_ready` rows that should become active current-backend dispatch or exact run-id artifact waits.

The process is useful, but the task is not done. The next step is to use the
existing review/fix-forward workflow on pass rows whose current result is
missing, gated, mismatched, aggregate-only, stale, or only explained by prose.
