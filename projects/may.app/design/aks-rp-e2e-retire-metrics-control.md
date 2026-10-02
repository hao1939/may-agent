# AKS RP E2E `retire-metrics` control candidate

Task: `may/goal/appdep_3b8a01a40248c98c6d59ce4c`

Status: **non-applied candidate**. This file and the workflow do not authorize retirement. Final human worth/apply review must bind the exact manifest bytes, candidate commit, and then-current Task generation before anyone invokes it.

## Control

`agents/may/workflows/retire-metrics.ts` accepts only:

```json
{
  "manifestJson": "<the exact saved JSON bytes>",
  "manifestSha256": "<lowercase sha256 of those exact bytes>"
}
```

The version-1 manifest has these exact top-level fields:

```json
{
  "version": 1,
  "binding": {
    "appId": "may",
    "taskId": "goal/appdep_3b8a01a40248c98c6d59ce4c",
    "generation": 1
  },
  "capture": {
    "capturedAt": "ISO-8601",
    "source": "supported read receipt",
    "sourceRevision": "pinned Host revision"
  },
  "metricIds": ["39 exact, unique, sorted IDs"],
  "before": ["39 complete raw metric rows"],
  "definitions": ["39 complete camel-case MetricDefinition rows"],
  "expectedAfter": ["39 complete raw rows"],
  "excludedClosed": ["7 complete raw witness rows"],
  "openAlerts": [{ "alertId": 1, "metricId": "exact ID", "createdAt": 0 }],
  "baselines": {
    "snapshotCountByMetric": { "each exact ID": 0 },
    "measurementFailureCutoff": 0
  }
}
```

Every raw row must explicitly contain exactly:

```text
id name type owner current target threshold unit priority status blocker project
source source_query source_command sensitivity measure_interval alert_op speed
description direction config created_at updated_at closed_at
```

Every definition must explicitly contain exactly:

```text
id name owner type target threshold unit priority status blocker project source
sourceQuery sourceCommand sensitivity measureInterval alertOp speed description
direction config
```

`config` in a raw row is either null or canonical compact JSON whose parse/stringify round trip is byte-identical. Null-sensitive fields remain explicit in the saved definition. Each expected-after row repeats the entire before row, changes only `status` from `active` to `retired`, and uses the literal `"$operation-time"` for `updated_at`. The workflow derives its payload by copying each validated complete definition and changing only `status`; it never trusts a separately supplied retired payload.

## Preparation and later application commands

Capture must use May's supported read-only owner/control route and save its receipt; do not open the runtime database from a shell. The concrete export operation must return the complete raw columns above for the exact reviewed IDs, the seven excluded rows, exact open alerts, snapshot counts, and failure cutoff. Save the emitted bytes without reformatting, then bind them:

```sh
MANIFEST=projects/may.app/outputs/aks-rp-e2e-retirement-manifest-v1.json
sha256sum "$MANIFEST" | tee "$MANIFEST.sha256"
bun -e 'const p=process.argv[1]; const m=JSON.parse(await Bun.file(p).text()); if(m.metricIds.length!==39||m.before.length!==39||m.definitions.length!==39||m.expectedAfter.length!==39||m.excludedClosed.length!==7) process.exit(1)' "$MANIFEST"
```

A later approved Task-owned invocation supplies the file's exact text as `manifestJson` and the saved digest as `manifestSha256`. Do not invoke the workflow while preparing or reviewing this candidate. The control verifies the digest, exact schema/count/order/identity, Task and generation binding, definition round-trip, active public projections, and expected status-only after rows before its first write. It makes one `ctx.metrics.defineMany` call and reads all 39 public per-ID projections afterward.

The public metric projection cannot prove raw `blocker`, `source_command`, `closed_at`, or config bytes. Therefore the later operator must use the same supported owner read route after invocation, save a complete after export, and compare it with `expectedAfter`; a successful workflow projection is not full raw verification. `defineMany` is sequential, not transactional or compare-and-set. On failure the workflow returns all observable per-ID states and must not be blindly retried.

If the reviewed manifest contains exact open alerts, resolve only those IDs separately after metric retirement through the canonical endpoint:

```sh
curl -fsS -X POST "$MAY_HTTP/api/alerts/$ALERT_ID/resolve" \
  -H 'content-type: application/json' \
  --data '{"reason":"retired: configured producer unavailable; metric definition and history retained"}'
```

Then verify canonical alert projection; HTTP acceptance alone is not projection completion. Current parent evidence reports zero open AKS RP E2E alerts, so the expected present cost is zero such calls. The workflow never calls `MetricService.resolveAlert`.

## Verification and operational boundary

Focused check:

```sh
bun test projects/may.app/agents/may/workflows/retire-metrics.test.ts --timeout 30000
```

Project check:

```sh
(cd projects/may.app && bun run check)
```

The production-path fixture uses the real `MetricService`, schema, and `measureSourceMetrics` from Host revision `264ded592ac98387f8f54050d87b8f44eb009708`. It proves active definitions are attempted, complete replay changes only `status` and `updated_at`, subsequent collection selects none, snapshots/history and all producer/cadence fields remain, and seven excluded definitions remain byte-for-field unchanged. It also proves partial manifests and stale/substituted scope cause zero writes, while a simulated mid-batch failure returns mixed per-ID readback.

A collector that selected active rows before retirement may finish that in-flight pass. After approved application, observe one former 300000 ms cadence plus tolerance and verify no later snapshot/failure growth, unchanged seven witnesses, retained history, and no startup registration reactivation.

Expected application cost is 39 sequential definition updates, bounded pre/post reads, zero current alert calls, and one cadence-plus-tolerance observation; no cloud or deployment cost. Rollback is not deletion or timestamp reversal. It requires a new owner decision, restored supported producer/ownership, and replay of the saved complete definitions with only `status: "active"`; preserve the operation's new `updated_at` and all historical evidence.
