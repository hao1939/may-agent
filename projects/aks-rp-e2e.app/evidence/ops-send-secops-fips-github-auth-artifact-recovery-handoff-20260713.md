# Secops-fips GitHub-authenticated artifact-recovery handoff send proof — 2026-07-13

- Task: `ops/send-secops-fips-github-auth-artifact-recovery-handoff-20260713`
- Attempt: `a_ops_send-secops-fips-github-auth-artifact-recovery-handoff-20260713_20260713191741`
- Mode: Task Worker Mode

## Result

Actually routed one exact GitHub-authenticated artifact-recovery handoff for the maintained secops-fips two-run family:

- live wait: `wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708`
- governed runs: `28618650515` and `28621344506`
- routed recipient lane: `human:operator`
- packet used: `../aks-rp-e2e/evidence/archive/ops-send-secops-fips-github-auth-artifact-recovery-handoff-20260713.md`
- path id: `spec-secops-fips-terminal-runs-28618650515-28621344506-artifact-recovery-20260713`

No unchanged rerun was reopened.

## Preserved reviewed diagnosis used for the handoff

This send used the accepted review at `evidence/ops-recover-secops-fips-authenticated-artifact-visibility-family-20260713.md`, which preserved these exact facts:

- `spec.secops-fips.extension-blocked` / run `28618650515` and `spec.secops-fips.windows` / run `28621344506` are still the truthful review surface;
- both runs remain historically confirmed terminal GitHub failures;
- neither run has an app-visible local bundle under `/app/projects/aks-rp-e2e.app/.state/spec-loop/artifacts/<runId>`;
- the current runtime has no usable `gh` helper surface;
- the only exposed credential surface here is `GH_TOKEN`, and authenticated GitHub API calls for the exact run, artifact, and log endpoints return `401 Bad credentials` for both runs;
- so the current blocker is **GitHub access from this worker surface**, not a justified unchanged rerun and not yet a proven retention-expiry diagnosis.

## Exact owner/runtime ask routed

The routed packet asks the receiving lane to preserve the maintained family wait and return exactly one bounded same-lineage outcome:

1. recovered same-run artifacts/logs/result bundle for run `28618650515` and/or run `28621344506`, made reviewable with durable path or attached reference;
2. durable proof of one GitHub-auth-capable runtime or credential surface that can inspect/download the exact run artifacts/logs for these run ids and either performs that recovery or names the exact recovery surface handed back for use; or
3. an exact decline/reroute naming the owner or runtime-provider surface that controls GitHub Actions artifact access for this repo, plus any reviewed diagnosis if same-run recovery is unavailable from the current lane.

## Durable send proof

### 1) Approval request accepted

Dispatch command emitted:

```bash
DAEMON_INSTANCE=background may-agent --emit project.approval.requested '<packet json>'
```

Observed CLI result:

```text
Event emitted: project.approval.requested
```

### 2) Controller-visible event lineage

Controller-visible event rows now include:

- `project.approval.requested` event `3144970`
- `message.created` event `3144973`

Shared exact lineage fields:

- `packetPath = evidence/archive/ops-send-secops-fips-github-auth-artifact-recovery-handoff-20260713.md`
- `pathId = spec-secops-fips-terminal-runs-28618650515-28621344506-artifact-recovery-20260713`
- `approvalId = aks-rp-e2e:approval:spec-secops-fips-terminal-runs-28618650515-28621344506-artifact-recovery-20260713:evidence-archive-ops-send-secops-fips-github-auth-artifact-recovery-handoff-20260713.md`
- `waitId = wait:aks-rp-e2e:approval:spec-secops-fips-terminal-runs-28618650515-28621344506-artifact-recovery-20260713:evidence-archive-ops-send-secops-fips-github-auth-artifact-recovery-handoff-20260713.md`
- expected response type: `project.approval.submitted`

### 3) Approval-dispatch ledger row

`/app/projects/aks-rp-e2e.app/.state/approval-dispatch-runs.jsonl` now contains the exact send-proof row:

- `ts = 2026-07-13T19:19:53.014Z`
- `workflow = approval-dispatch`
- `result = message.created`
- `target = human:operator`
- same `packetPath`, `pathId`, `approvalId`, and `waitId`

## Live family wait updated in place

I kept one truthful live carrier for the family and updated
`wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708`
so it now references the routed handoff lineage rather than the completed review leaf.

### Applied bounded task-tree repairs

```bash
cd /app/projects/aks-rp-e2e.app
bun run task-tree update-text wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708 --blocker-json '<structured blocker json>'
bun run task-tree set-outputs wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708 \
  --output ../aks-rp-e2e/evidence/archive/review-terminal-secops-fips-family-runs-28618650515-28621344506-20260707.md \
  --output evidence/archive/ops-apply-reconcile-spec-loop-terminal-blocked-frontier-20260712-state-r.md \
  --output evidence/archive/ops-repair-overdue-resourcedisk-secops-fips-frontiers-20260713.md \
  --output evidence/ops-recover-secops-fips-authenticated-artifact-visibility-family-20260713.md \
  --output ../aks-rp-e2e/evidence/archive/ops-send-secops-fips-github-auth-artifact-recovery-handoff-20260713.md \
  --output evidence/ops-send-secops-fips-github-auth-artifact-recovery-handoff-20260713.md
```

### Resulting wait contract

The wait now records:

- `blocker.waiting_for.type = project.approval.submitted`
- same-lineage `pathId`, `packetPath`, `approvalId`, and `waitId` for the 2026-07-13 handoff
- accepted returned decisions: `approve`, `adjust`, `hold`, `decline`, `reroute`
- `next_check_at = 2026-07-14T21:30:00Z`
- `fallback_at = 2026-07-15T21:30:00Z`
- resume rule: only resume when the same-lineage approval return yields recovered same-run artifacts/logs, a GitHub-auth-capable recovery surface, or an exact decline/reroute for runs `28618650515` and `28621344506`

Its outputs now include both the accepted 2026-07-13 recovery review and this exact same-lineage handoff/send-proof.

## Bottom line

One exact secops-fips GitHub-authenticated artifact-recovery handoff is now routed to `human:operator`, and the maintained family wait is rebound to that exact approval-return lineage without reopening unchanged reruns.
