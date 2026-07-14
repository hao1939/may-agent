# Secops-fips authenticated artifact-visibility recovery review — 2026-07-13

- Task: `ops/recover-secops-fips-authenticated-artifact-visibility-family-20260713`
- Attempt: `a_ops_recover-secops-fips-authenticated-artifact-visibility-family-20260713_20260713191134`
- Mode: Task Worker Mode / evidence + planner-review output only
- Live task-tree mutation from this worker: none

## Executive result

I did **not** recover same-run artifacts/logs for GitHub runs `28618650515` or `28621344506`.

I **did** recover a sharper exact diagnosis:

- both exact runs are still the truthful review surface;
- both exact runs still have **no app-visible local artifact bundle**;
- the current runtime has **no working authenticated GitHub Actions access surface** for those exact runs;
- the only exposed credential surface here is `GH_TOKEN`, and authenticated GitHub API calls for the run, artifact, and log endpoints return **`401 Bad credentials` for both runs**;
- because authentication fails before run/artifact inspection, the current truthful diagnosis is **access-blocked**, not proven retention expiry.

So the smallest truthful next move is **one exact secops-fips GitHub auth/artifact recovery handoff** for runs `28618650515` and `28621344506`, or an in-place refresh of the existing wait with this exact access diagnosis. An unchanged rerun is still not justified.

## Existing live carrier remains the right family holder

Supported live read of:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree show wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708
```

showed the current live blocked holder already has the correct family scope:

- task id: `wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708`
- state: `blocked`
- governed specs/runs:
  - `spec.secops-fips.extension-blocked` / `28618650515`
  - `spec.secops-fips.windows` / `28621344506`
- current goal: preserve one exact two-run authenticated artifact-recovery/escalation lineage
- current resume condition already forbids unchanged reruns before recovered artifacts/logs or an explicit reviewed access/retention diagnosis exists

So this worker session does **not** recommend reopening reruns or widening scope. The right shape is still one exact two-run carrier; what changed is the exact diagnosis attached to it.

## Direct evidence gathered this session

### 1) The current runtime has no working GitHub CLI helper

```bash
cd /app/projects/aks-rp-e2e && echo "gh_path=$(command -v gh || echo missing)"
```

Result:

- `gh_path=missing`

So this runtime cannot use the previously suggested `gh run view` / `gh run download` recovery path directly.

### 2) The only exposed GitHub credential surface here is `GH_TOKEN`

```bash
cd /app/projects/aks-rp-e2e && env | grep -E '^(GH_|GITHUB_)' | sed 's/=.*$/=<redacted>/'
```

Result:

- `GH_TOKEN=<redacted>`

No additional `GITHUB_*` helper surface was visible in the environment during this session.

### 3) Authenticated GitHub API access fails with `401 Bad credentials` for both exact runs

Direct checks from this session:

```bash
cd /app/projects/aks-rp-e2e
for id in 28618650515 28621344506; do
  for suffix in '' '/artifacts' '/logs'; do
    url="https://api.github.com/repos/azure-management-and-platforms/aks-rp-e2e/actions/runs/${id}${suffix}"
    code=$(curl -sS -o /tmp/gh-body.$$ -w '%{http_code}' \
      -H "Authorization: Bearer $GH_TOKEN" \
      -H "Accept: application/vnd.github+json" \
      "$url")
    body=$(tr -d '\n' </tmp/gh-body.$$ | cut -c1-120)
    printf 'run=%s endpoint=%s http=%s body=%s\n' "$id" "${suffix:-/}" "$code" "$body"
  done
  rm -f /tmp/gh-body.$$
done
```

Observed results:

- run `28618650515`
  - endpoint `/` → `401` / `Bad credentials`
  - endpoint `/artifacts` → `401` / `Bad credentials`
  - endpoint `/logs` → `401` / `Bad credentials`
- run `28621344506`
  - endpoint `/` → `401` / `Bad credentials`
  - endpoint `/artifacts` → `401` / `Bad credentials`
  - endpoint `/logs` → `401` / `Bad credentials`

This is the strongest new fact from the session. The current runtime is not merely missing local artifacts; it lacks a valid authenticated GitHub Actions recovery surface for these exact run ids.

### 4) Both exact runs still lack app-visible local artifact directories

Checked under `/app/projects/aks-rp-e2e.app/.state/spec-loop/artifacts`:

```bash
cd /app/projects/aks-rp-e2e.app
for id in 28618650515 28621344506; do
  if [ -d ".state/spec-loop/artifacts/$id" ]; then
    echo "$id present"
  else
    echo "$id missing"
  fi
done
```

Result:

- `28618650515 missing`
- `28621344506 missing`

So there is still no controller-visible same-run artifact bundle for either run.

### 5) Spec-loop rows still point at the shared wait and still have no recovered result path

Read directly from `/app/projects/aks-rp-e2e.app/.state/spec-loop/state.json`:

- `spec.secops-fips.extension-blocked`
  - `taskId = wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708`
  - `lastRunId = 28618650515`
  - `review.pendingReviewTaskId = wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708`
  - `review.pendingReviewRunId = 28618650515`
  - `successorResultPath = null`

- `spec.secops-fips.windows`
  - `taskId = wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708`
  - `lastRunId = 28621344506`
  - `review.pendingReviewTaskId = wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708`
  - `review.pendingReviewRunId = 28621344506`
  - `successorResultPath = null`

So both specs still depend on the same exact blocked family wait, and neither has a recovered same-run result file.

### 6) Historic cached metadata still proves both runs existed and reached terminal failure

Local cached workflow-run JSON still preserves exact run metadata for both runs.

#### Run `28618650515`

From:

- `/app/projects/aks-rp-e2e/workspace/rerun-spec-secops-fips-shared-staging-create-timeout-family-repaired-carrier-20260702/2026-07-02T20-15-19Z/runs-api.json`

Preserved facts:

- spec: `spec.secops-fips.extension-blocked`
- `status = completed`
- `conclusion = failure`
- `html_url = https://github.com/azure-management-and-platforms/aks-rp-e2e/actions/runs/28618650515`
- `logs_url = https://api.github.com/repos/azure-management-and-platforms/aks-rp-e2e/actions/runs/28618650515/logs`
- `artifacts_url = https://api.github.com/repos/azure-management-and-platforms/aks-rp-e2e/actions/runs/28618650515/artifacts`
- `head_branch = dev`
- `head_sha = d46f4b2c0a816861a5874c808d6f727bf45c3f1f`
- `created_at = 2026-07-02T20:13:02Z`
- `updated_at = 2026-07-02T20:13:47Z`

#### Run `28621344506`

From:

- `/app/projects/aks-rp-e2e/workspace/rerun-review-spec-cluster-autoscaler-row53-long-unregistered-nodes-20260703/workflow-runs.json`

Preserved facts:

- spec: `spec.secops-fips.windows`
- `status = completed`
- `conclusion = failure`
- `html_url = https://github.com/azure-management-and-platforms/aks-rp-e2e/actions/runs/28621344506`
- `logs_url = https://api.github.com/repos/azure-management-and-platforms/aks-rp-e2e/actions/runs/28621344506/logs`
- `artifacts_url = https://api.github.com/repos/azure-management-and-platforms/aks-rp-e2e/actions/runs/28621344506/artifacts`
- `head_branch = dev`
- `head_sha = c45b7f7434139b080361323364021f6222b51a3b`
- `created_at = 2026-07-02T21:02:00Z`
- `updated_at = 2026-07-02T21:02:49Z`

These cached records prove the runs and their GitHub run/artifact/log URLs existed. The current blocker is **access to those surfaces now**, not uncertainty about whether the runs existed.

## Exact reviewed diagnosis for each run

### `spec.secops-fips.extension-blocked` / run `28618650515`

Current exact diagnosis:

> Terminal GitHub run is known and historically recorded, but the current runtime cannot authenticate to the exact run/artifact/log endpoints (`401 Bad credentials` on the only exposed `GH_TOKEN` surface), and no local same-run artifact/result bundle exists. Therefore the run is **access-blocked** from this surface. Retention expiry is **not yet proven**.

### `spec.secops-fips.windows` / run `28621344506`

Current exact diagnosis:

> Terminal GitHub run is known and historically recorded, but the current runtime cannot authenticate to the exact run/artifact/log endpoints (`401 Bad credentials` on the only exposed `GH_TOKEN` surface), and no local same-run artifact/result bundle exists. Therefore the run is **access-blocked** from this surface. Retention expiry is **not yet proven**.

## Why the existing shared auth/runtime escalation packet does not already close this family

The broader combined packet at:

- `/app/projects/aks-rp-e2e/evidence/archive/ops-escalate-shared-auth-runtime-and-github-artifact-owner-return-family-20260712.md`

still governs other exact artifact-recovery surfaces, but its requested run scope names only:

- Azure DevOps run `171798563`
- GitHub run `28672036322`
- GitHub runs `28840446579` and `28671841561`

It does **not** name secops-fips runs `28618650515` or `28621344506`.

So, while that shared packet proves the project already recognizes a broader authenticated artifact-recovery bottleneck, it does **not** yet serve as the exact owner-return lineage for this secops-fips two-run family.

## Exact owner ask / handoff needed now

The next truthful owner action is one exact GitHub-authenticated recovery handoff for these two runs only.

### Suggested target

- `human:operator` or another runtime/credential surface with authenticated GitHub repository access to `azure-management-and-platforms/aks-rp-e2e`

### Suggested exact ask

> Review the secops-fips terminal GitHub artifact-recovery family for runs `28618650515` and `28621344506`. Preserve the existing exact family holder `wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708`. Current reviewed facts: both runs are historically confirmed terminal failures with preserved run/log/artifact URLs in local cached metadata; neither run has an app-visible local artifact bundle; this runtime has no `gh` helper and the only exposed credential surface (`GH_TOKEN`) returns `401 Bad credentials` for the exact run, artifact, and log endpoints of both runs. Return exactly one of: (1) authoritative same-run artifacts/logs/result bundles for run `28618650515` and/or `28621344506`, made app-visible for review; (2) durable proof of one GitHub-auth-capable runtime/credential surface that can recover artifacts for those exact run ids and either perform that recovery or hand back the exact recovery surface; or (3) an exact decline/reroute naming the owner or runtime surface that controls GitHub artifact access for this repo, plus a reviewed workflow-surface diagnosis if same-run recovery is not available. Do not reopen unchanged reruns before one of those signals exists.

### Minimum proof that would satisfy the handoff

#### Option A — same-run bundle returned

Provide one or both of:

- recovered logs/artifacts/result bundle for run `28618650515`
- recovered logs/artifacts/result bundle for run `28621344506`

with durable local path or attached reference.

#### Option B — auth-capable helper/runtime returned

Provide one reviewed authenticated GitHub surface that can successfully inspect or download the exact run artifacts/logs for these run ids.

#### Option C — exact decline/reroute

If neither this runtime nor the current human/operator lane controls GitHub artifact access for this repo, return the exact authority split/reroute naming who does.

## Planner / app-ops apply note

Per Task Worker Mode, I did **not** mutate the live task tree.

The smallest truthful planner/app-ops follow-through is:

1. **keep** `wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708` as the single live carrier for the family;
2. **refresh** that wait's evidence/output surface to include this memo as the current reviewed diagnosis; and
3. **send or queue one exact owner/runtime handoff** using the ask above, without reopening unchanged reruns.

If planner wants a bounded metadata-only apply, the right change is an in-place refresh of the existing wait, not a new broad family shape.

## Bottom line

- run `28618650515`: exact diagnosis is **access-blocked from current surface** (`401 Bad credentials`), not proven retention expiry
- run `28621344506`: exact diagnosis is **access-blocked from current surface** (`401 Bad credentials`), not proven retention expiry
- both runs still lack app-visible local bundles
- the exact secops-fips family wait remains the truthful live carrier
- the next truthful move is one exact GitHub auth/artifact recovery handoff for these two run ids, or an in-place wait refresh that records this diagnosis and keeps reruns closed
