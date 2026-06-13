# Iteration 1: Finish-Blocked Hygiene Source Attribution and Prompt Patches

## Baseline measurement

Validation query used:

```sql
SELECT COUNT(*) AS n
FROM evaluations e
JOIN sessions s ON s.sessionId = e.sessionId
WHERE e.createdAt > (unixepoch()*1000 - 86400000)
  AND e.issues LIKE '%finish%uncommitted%';
```

Current 24h count: **237** sessions with the finish/uncommitted signature.

Top current sources:

| Source | Agent | Count |
| --- | --- | ---: |
| workflow:scout-heartbeat | scout | 55 |
| closed-loop-steward | may | 41 |
| workflow:may-heartbeat | may | 32 |
| workflow:metric-alert-triage | may | 27 |
| workflow:dev-heartbeat | dev | 21 |
| workflow:project | may | 21 |
| workflow:orchestrator | may | 18 |
| workflow:arc-heartbeat | arc | 5 |
| workflow:goal-driver | scout | 4 |
| workflow:project | scout | 4 |
| workflow:metric-alert-triage | scout | 3 |

## Transcript sampling findings

Sampled current affected sessions from the top sources via `session_digests`, `evaluations`, and aftermath artifacts.

1. **Heartbeat gates amplify the problem.** Affected Scout/May heartbeat sessions are often second-pass artifact/duration-gate prompts. Those prompts previously told agents to produce more work and call `finish()` but did not restate exact git cleanup behavior.
2. **Many sessions self-repair after the first blocked finish.** Example `s_1778329781098_2` was routed as needs-triage because of an early blocked finish, but aftermath verified it later committed `7d4502826` and landed a useful Scout prompt fix. The evaluator still sees the blocked attempt as a low-quality signal.
3. **Dirty-state pressure causes unsafe opportunistic commits.** Example `s_1778329857941_10` hit finish guards on dirty files and committed an unrelated metric-threshold change after only minimal inspection, illustrating why prompts must say not to commit unrelated dirty paths just to satisfy the guard.
4. **Project and metric-alert workflows are also high-volume sources.** Their generated prompts included read-back requirements but lacked a full closeout sequence: inspect git status, stage explicit paths only, re-check clean status, and use partial/blocked when unrelated dirty files remain.

## Patches applied

### `agents/shared/workflows/heartbeat-data.ts`

Added a reusable `FINISH_HYGIENE_INSTRUCTIONS` prompt block and injected it into:

- the main heartbeat prompt used by Scout/May/Dev/Arc heartbeat workflows,
- artifact-gate re-prompts,
- anti-shallow-gate re-prompts,
- impact-gate re-prompts,
- duration-gate re-prompts.

The block requires read-back, `cd /app/agents && git status --short`, explicit-path staging only, no broad `git add .`, no committing unrelated runtime/agent work, partial/blocked finish for unsafe dirty paths, post-commit clean-status verification, and finish evidence citing commit id/read-back/clean status.

### `agents/shared/workflows/metric-alert-triage.ts`

Injected the same finish-hygiene sequence into metric-alert owner tasks. This targets the May and Scout `workflow:metric-alert-triage` bucket.

### `agents/shared/workflows/project.ts`

Extended persistent project worker rules with explicit git status classification, explicit-path staging, partial/blocked behavior for unrelated dirty paths, and post-commit clean-status evidence. This targets `workflow:project` sessions.

### `agents/may/handlers/closed-loop-steward.ts`

Added closeout hygiene rules to the generated closed-loop steward audit prompt. This targets the second-largest source bucket and specifically warns against opportunistic commits of unrelated dirty files.

## Expected impact

The patched paths cover the largest measured 24h buckets directly:

- `workflow:scout-heartbeat` (55)
- `closed-loop-steward` (41)
- `workflow:may-heartbeat` (32)
- `workflow:metric-alert-triage` for May/Scout (30 combined)
- `workflow:dev-heartbeat` (21)
- `workflow:project` for May/Scout/Arc (27 combined)
- `workflow:arc-heartbeat` (5)

That is **211/237** currently measured finish/uncommitted sessions, assuming source mix remains stable.

## Validation plan

After deployment/commit, re-run:

```sql
SELECT COUNT(*) AS n
FROM evaluations e
JOIN sessions s ON s.sessionId = e.sessionId
WHERE e.createdAt > (unixepoch()*1000 - 86400000)
  AND e.issues LIKE '%finish%uncommitted%';
```

and:

```sql
SELECT s.source, s.agent, COUNT(*) AS n
FROM evaluations e
JOIN sessions s ON s.sessionId = e.sessionId
WHERE e.createdAt > (unixepoch()*1000 - 86400000)
  AND e.issues LIKE '%finish%uncommitted%'
GROUP BY s.source, s.agent
ORDER BY n DESC
LIMIT 15;
```

Look specifically for declines in heartbeat gate reprompt sessions and closed-loop-steward sessions. If the count remains high, next iteration should patch the lower-volume `workflow:orchestrator`, `workflow:goal-driver`, and evaluator classification so self-repaired blocked finishes are routed separately from unresolved dirty exits.
