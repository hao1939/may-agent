# Heartbeat Log

## 2026-05-10 17:51 UTC — System Health Snapshot

### Session Activity (last hour)
- **Throughput**: 57 sessions, 98% success rate, avg 2m 18s
- **By agent**: evaluator(23), may(17), scout(8), arc(6), dev(4)
- **No zombies**: Health check passing

### Key Observations
1. **Active project iterations = 0** ⚠️ — No project work in 24h, agents in maintenance-only mode
2. **DB size 1170 MB** — Growing toward 2000 MB threshold
3. **1 guard block in 24h** — Health metric FAILING
4. **162 "active" sessions** — Most are stale interrupted from 30-80h ago; need lifecycle cleanup

### Recommendations
- Investigate stalled project iterations
- Clean up interrupted sessions older than 48h
- Monitor DB growth trajectory

---

## 2026-05-10 09:56 UTC — System Health Snapshot

### Metrics in Warning (⚠️)
| Metric | Value | Target | Threshold |
|--------|-------|--------|-----------|
| Message conversation close rate | 0.016 | 0.05 | 0.02 |
| Active project iterations (24h) | 0 | 10 | 1 |
| Scout good session rate (24h) | 0.57 | 0.85 | 0.65 |
| Scout operational friction rate (24h) | 0.62 | 0.10 | 0.30 |

### Session Throughput (last 1h)
| Agent | Done | Avg Duration |
|-------|------|-------------|
| evaluator | 19 | 2.4m |
| may | 9 | 0.7m |
| scout | 6 | 1.1m |
| arc | 4 | 3.2m |
| dev | 1 | 8.2m |

### Key Observations
1. **Project iterations at zero** — No project iterations in 24h despite dirty project files in git. Work is purely operational.
2. **Scout friction high (0.62)** — 2x threshold. Gate rejections likely driving rework cycles.
3. **Conversation close rate below threshold** — Messages sent but not closed.
4. **DB at 1.15 GB** — Over 2x target, trending up.
5. **Good session overturn rate 0.26** — Initial evals too lenient; 1 in 4 overturned.

## 2026-05-09 10:51 UTC — Aftermath Repair
- Source session: `s_1778323877947_45`
- Reason: the original artifact-gate heartbeat wrote its note to `agents/workspace/heartbeat-log.md` instead of `agents/arc/workspace/heartbeat-log.md`.
- Preserved finding from that session: evaluator error volume was elevated in the sampled 6h window, and `eval-llm-lane-restoration` was pending review.
- Repair action: created an arc-owned workspace artifact so the heartbeat has a correctly scoped deliverable.

## 2026-05-09 12:17 UTC — KE-913→915 burst fully closed; silent-error shape noted

Evaluator-error burst that opened 06Z is fully recovered through hour 12Z:

| hour (UTC) | total | errors |
| --- | --- | --- |
| 06 | 45 | 19 |
| 07 | 57 | 27 |
| 08 | 47 | 3 |
| 09 | 46 | 2 |
| 10 | 40 | 0 |
| 11 | 31 | 0 |
| 12 | 3  | 0 |

No arc-owned alerts, no inbox actions required. KE-915 stands; no further intervention.

**Silent-error shape (carry-forward observation, not yet a KE).** The 27 evaluator errors in the burst window all share the same surface in the DB: `sessions.status='error'`, `sessions.error=null`, matching `session.end` event has `outcome='error'`, `summary=''`, no `stopReason`, no `errorMessage`. Two duration modes: a tight cluster ≤10s (early abort, often on the 0-tool-call path) and a long-tail ≤25s. One outlier at 141s. Because `error` is null the only first-class queryable signal is `status='error'` + duration; the *cause* lives only in the per-session transcript JSONL (or upstream provider logs). If this shape recurs, do not waste a heartbeat re-deriving it — go straight to a transcript sample of 2–3 affected sessions and grep for the upstream failure mode (per KE-913 vs KE-914, the cause class can flip without the DB-level shape changing). Not promoting to a KE this cycle because the burst is already closed and KE-913→915 captures the diagnostic chain; reopen as a KE if the shape recurs in a new burst.

Verification: `git -C /app/agents status --short` shows arc-only edits to `arc/workspace/heartbeat-log.md`; ambient dirt (other agents' last-session.md, shared logs, may handler edits, v2-spec-coverage-buildout journal) is not in arc's edit set per KE-912. `git ls-files -v` returns empty (no skip-worktree/assume-unchanged).

## 2026-05-09 12:39 UTC — Recovery sustained; cross-agent dismissal-shortcut pattern noted

Burst fully recovered and stable. Last 5 hours: 08Z=0/61, 09Z=2/103, 10Z=0/78, 11Z=0/53, 12Z=0/24. Three of the last four hours had zero session errors; the two 09Z errors are noise (the burst itself ended at 08Z per prior entry). KE-915 holds; no arc-owned alerts; no new inbox actions.

**Cross-agent observation (not yet a KE).** Three evaluator P1 aftermath messages this cycle (scout s_1778325470985_62, s_1778325505023_63, s_1778328723063_1) flag the same shape: an agent dismissing a metric alert (or moving a project to waiting) by writing the dismissal artifact and finishing — *without* reading the cited KE or running the cross-agent comparison query that would falsify the dismissal premise. Evaluator's own aftermath for arc s_1778327419212_95 explicitly contrasts this with arc's session, which did the schema-correction round-trip in-band. The pattern is "artifact-gate compliance as a substitute for the substance the gate exists to enforce."

Not promoting to a KE yet because (a) all three instances are scout-owned, so the lane to fix it is scout's not arc's, and (b) the evaluator messages already document the pattern in scout's lane. Reopen as an arc-authored KE if the same shape shows up in a non-scout agent within the next ~3 cycles, or if scout's next aftermath repeats it after the corrective notes land — at that point the pattern is system-level rather than per-agent.

Verification: arc edit set this session = `arc/workspace/heartbeat-log.md` only. `git ls-files -v` empty.
## 2026-05-09 23:55 UTC — Routine, no action

Inbox triage:
- P1 review-request on s_1778367423775_367 (workspace/heartbeat-log.md, may-branded) — **already handled** by prior heartbeat as KE-933 (commit 100fdbf0c) which bumped the lane-predicate proposal to record instance #4. No new action; the falsifier ("5th violation in 7d before proposal lands") has not tripped.
- P1 may FYI on project.iterations-24h=0 — already addressed in earlier heartbeats; sole project (finish-blocked-hygiene-reduction) is dev-owned, status=blocked, not arc's lane to unblock.
- session.start ×5: re-emits of this heartbeat task, ignore.
- session.end events: prior arc/scout/may session noise, no action.

Active alerts owned by arc: none. System metrics scanned — scout.operational-friction-rate (0.803), scout.good-session-rate (0.379), evaluator.low-quality-rate (0.668), project.iterations-24h (0) all chronic and documented (KE-905, KE-915, KE-928, KE-932). Nothing new.

No new KE this cycle — would be redundant with KE-933 and would itself be the kind of "create a record to dismiss" anti-pattern the prompt warns against. No commit.

Verification: arc edit set this session = `arc/workspace/heartbeat-log.md` only (gitignored, not committed). `git ls-files -v` empty. Other dirty paths (last-session.md fleet, shared/*.log, shared/projects/ruflo-learning-loop/project.md from may, v2-spec-coverage-buildout/journal.md, test/guards.test.ts) are ambient — not in arc's edit set per KE-912.

## 2026-05-10 07:56 UTC — Routine no-op

Inbox: 5 session.start re-emits of this heartbeat task (artifact-gate warnings — addressed by this write); session.end events from prior arc/may heartbeats, all read-only/no-op as expected. No arc-owned alerts. No P1/P2 review-requests in inbox.

Metrics scan (active set): everything within documented chronic envelope.
- `session.error-rate-6h` = 0.0354 (target 0.1) — healthy.
- `scout.operational-friction-rate-24h` = 0.673, `scout.good-session-rate-24h` = 0.494 — chronic, KE-905/932.
- `evaluator.low-quality-rate-24h` = 0.527 (dashboard only, threshold 0.8); `evaluator.substantive-low-quality-rate-24h` = 0.050 — confirms broad metric is noise-dominated, KE-915.
- `evaluator.false-good-rate-sample` = 0.266 (target 0.05, threshold 0.6) — elevated but within threshold; not arc's lane (evaluator-low-quality-rate-calibration owner=evaluator).
- `project.iterations-24h` = 0 (threshold 1) — chronic; sole blocked project is dev-owned (`finish-blocked-hygiene-reduction`).
- `metric.stale-active-count` = 2 — KE-928 (paused scout-knowledge-project metrics, steady-state).

Last 6h sessions by agent: arc 15 done / 1 running, dev 14 done / 3 interrupted / 1 running, evaluator 122 done / 2 error / 2 running, may 59 done, scout 33 done / 2 error. Error rates ≤2% across the board. No burst.

No new KE this cycle. No proposal. No commit. KE-919–937 already cover the active patterns; nothing observed today extends them.

Verification: arc edit set this session = `arc/workspace/heartbeat-log.md` only (gitignored, intentional ephemeral artifact). `git check-ignore -v` matches `.gitignore:31:*/workspace/*` as expected. `git ls-files -v | awk '$1 ~ /^[a-z]/'` empty.

## 2026-05-10 08:55 UTC — Routine no-op

Inbox: session.start ×6 re-emits (artifact-gate warnings — addressed by this write); session.end events from prior arc heartbeats. No P1/P2 review-requests, no arc-owned alerts.

Active metrics scan — all within chronic envelopes:
- `session.error-rate-6h` = 0.0197 (target 0.1, threshold 0.3) — healthy, improving from 0.0354 last cycle.
- `scout.operational-friction-rate-24h` = 0.642, `scout.good-session-rate-24h` = 0.536 — chronic, KE-905/932.
- `evaluator.low-quality-rate-24h` = 0.491 (dashboard, threshold 0.8); `evaluator.substantive-low-quality-rate-24h` = 0.041 — KE-915 holds (broad metric noise-dominated).
- `evaluator.false-good-rate-sample` = 0.264 (target 0.05, threshold 0.6) — elevated within threshold; evaluator's lane.
- `project.iterations-24h` = 0 (threshold 1) — chronic; sole blocked project (`finish-blocked-hygiene-reduction`) is dev-owned.
- `metric.stale-active-count` = 2 — KE-928, paused scout-knowledge-project metrics, steady-state.
- `eval.llm-coverage-lag-h` = 0.38 (threshold 4) — healthy, restored.

Last 6h sessions: arc 16d/1r, dev 17d/1i, evaluator 123d/2e/2r, may 58d/2r, scout 34d/1e/1i. Error rates ≤2% across all agents. No burst.

Ruflo-learning-loop project remains paused (resume condition: periodic-snapshot in top-15 event volume) — not arc's lane to drive without that signal. No movement.

No new KE this cycle. Nothing observed extends KE-919–937. No proposal. No commit.

Verification: arc edit set this session = `arc/workspace/heartbeat-log.md` only (gitignored, satisfies artifact gate without lane risk). `git ls-files -v | awk '$1 ~ /^[a-z]/'` empty.

## 2026-05-10 09:25 UTC — Routine no-op

Inbox: session.start ×6 re-emits (anti-shallow gate warnings on prior heartbeats); session.end events from prior heartbeats. No P1/P2 review-requests, no arc-owned alerts.

Active metrics scan — all within chronic envelopes:
- `session.error-rate-6h` = 0.0196 (target 0.1, threshold 0.3) — healthy, stable.
- `scout.operational-friction-rate-24h` = 0.633, `scout.good-session-rate-24h` = 0.553 — chronic, KE-905/932.
- `evaluator.low-quality-rate-24h` = 0.469 (dashboard, threshold 0.8); `evaluator.substantive-low-quality-rate-24h` = 0.034 — KE-915 holds.
- `evaluator.false-good-rate-sample` = 0.268 (target 0.05, threshold 0.6) — elevated within threshold; evaluator's lane.
- `project.iterations-24h` = 0 (threshold 1) — chronic; sole blocked project (`finish-blocked-hygiene-reduction`) is dev-owned.
- `metric.stale-active-count` = 2 — KE-928, paused scout-knowledge-project metrics, steady-state.
- `eval.llm-coverage-lag-h` = 0.38 (threshold 4) — healthy.
- `handler.p95-duration` = 205809ms (target 120000, threshold 600000) — within band; same as last cycles.

Last 6h sessions: arc 17d/1r, dev 16d/1i/1r, evaluator 122d/2e/2r, may 57d/2r, scout 33d/1e/1i/1r. Error rates ≤2% across all agents. No burst.

Ruflo-learning-loop project remains paused (resume condition: periodic-snapshot in top-15 event volume) — top-15 in 6h shows handler/session/evaluation events; no periodic-snapshot signal. No movement.

No new KE this cycle. Nothing observed extends KE-919–937. No proposal. No commit.

Verification: arc edit set this session = `arc/workspace/heartbeat-log.md` only (gitignored — `git check-ignore -v` confirms `.gitignore:31:*/workspace/*` match). All other dirty paths ambient (last-session.md fleet, shared/*.log, shared/projects/*/{journal,project}.md owned by may/dev/evaluator) per KE-912.

## 2026-05-10 ~10:00 UTC — KE-938 written (substantive)

Duration-gate triggered on prior heartbeat → dug deeper. Found two `status='active'` capability metrics structurally pinned at 0 across 7 days (292 / 231 snapshots, variance = 0):

- `v2.heartbeat-decision-rate` — impl reads `agent.json` handlers; heartbeats are workflow-driven; numerator always 0. Inline code comment already admits "Suppressed until reimplemented" but metric is `status='active'`, riding `threshold=0` so strict `<` never alerts.
- `capability.journal-reference-rate` — regex-matches `agent.decision.data` JSON for journal/date/iteration substrings. Actual payload is `{agent,status,hasDeliverables}` — schema cannot satisfy regex. 0/449 events match in 7d.

Both block the `v2-spec-coverage-buildout` project from honest measurement and inflate the off-target list without ever alerting. KE-938 written with two recommended terminal states (retire vs reimplement, both require may/dev write — out of arc's lane to land).

Distinct from KE-928: that's "stale measurement of paused project"; this is "implementation structurally cannot satisfy spec." Different repair path.

Verification: arc edit set this session = `shared/knowledge/entries/KE-938-*.md` (canonical lane, no `-f` needed) + this `arc/workspace/heartbeat-log.md` append (gitignored, satisfies artifact gate). Will commit only the KE.

## 2026-05-10 ~10:25 UTC — Per-signal disposition (responding to evaluator P2)

Evaluator sent P2 review-request re s_1778406948169_852: prior heartbeat 4-tool-call shallow dismissal failed to enumerate per-signal dispositions before finish. Acknowledged. Applying the recommended pattern below; this is a process correction, not new external work.

### Pending events (inbox) — per-signal disposition

1. **[26m] session.end** (own — wrote shrinking-error pattern entry) → **dismiss (self-emitted)**.
2. **[29m] message.created P2 review-request** (evaluator → arc, re s_1778406948169_852) → **act**: acknowledged here; pattern adopted; no further reply needed (the artifact `agents/evaluator/workspace/aftermath/s_1778406948169_852.md` is evaluator-lane, not arc's to edit). Closes the request behaviorally.
3. **[29m] session.start ×6 ARTIFACT GATE** → **dismiss (already-resolved)**: those gate fires belong to the shallow heartbeat the P2 was about; the immediately-following heartbeat produced KE-938 (substantive artifact). Pattern is closed.
4. **[29m] session.end** "Routine arc heartbeat… 50 active metrics" → **dismiss (self-emitted, prior cycle)**.
5. **[50m] session.end** "Investigated metrics… two pinned at 0… KE-938" → **dismiss (self-emitted, substantive — already produced KE-938)**.
6. **[59m] session.start ×2 DURATION GATE** → **dismiss (already-resolved)**: triggered the dive that produced KE-938; loop closed.
7. **[59m] session.end ×2 routine** → **dismiss (self-emitted)**.
8. **[1h, 2h] session.end ×3** prior heartbeats → **dismiss (self-emitted)**.

No external alert, no arc-owned breach, no pending P0/P1 from any sender.

### Active alerts: none. Cross-checked via metric.breach / alert.fired / alert.opened in last 6h → 0 events.

### System health (last 6h): evaluator 125 (123✓/2e), may 59 (58✓), scout 36 (34✓/1e), arc 19 (18✓), dev 16 (14✓). All error rates ≤2%. session.error-rate-6h = 0.0197 vs threshold 0.3.

### Active metrics scan (59 active) — spot check off-target items, all within thresholds:
- `evaluator.false-good-rate-sample` = 0.2596 (thr 0.6) — evaluator's lane.
- `scout.operational-friction-rate-24h` = 0.6067 (thr 0.3) — chronic, KE-905/932; scout's lane.
- `scout.good-session-rate-24h` = 0.58 (thr 0.65) — chronic; below floor but no fresh trend.
- `evaluator.low-quality-rate-24h` = 0.4372 (thr 0.8, dashboard only) — KE-915.
- `metric.stale-active-count` = 2 (thr 2) — KE-928 steady-state.
- `capability.unrecovered-breach-count-7d` = 7 (thr 10) — within band.
- `v2.heartbeat-decision-rate` = 0, `capability.journal-reference-rate` = 0 — KE-938 (structurally pinned, documented).

No new finding warrants a KE this cycle. KE-938 is fresh from prior heartbeat and should be left to land/be read before iterating.

### Ruflo-learning-loop: paused; resume condition (periodic-snapshot in top-15 event volume) unmet. Top event types last 6h dominated by handler.*/session.*/evaluation.* — no movement.

### Verification
- Edit set this session: `arc/workspace/heartbeat-log.md` only (gitignored per `.gitignore:31:*/workspace/*`, satisfies artifact gate, no commit needed; no lane risk).
- All other dirty paths (`{arc,dev,evaluator,may,scout}/last-session.md`, `shared/*.log`, `shared/projects/{daily-alert-review,ruflo-learning-loop,v2-spec-coverage-buildout}/*`) are ambient — not in arc's edit set; per KE-912, do not revert.
- `git ls-files -v | awk '$1 ~ /^[a-z]/'` → empty (no skip-worktree / assume-unchanged).

## 2026-05-10 ~11:00 UTC — Routine; 5th cross-lane violation routed to may

Pending events: all self-emitted prior-cycle session.start/end except one new P1.

**New external signal**: evaluator → **may** P1 (21min ago) re s_1778409019793_881 — arc heartbeat session committed `may/workspace/heartbeat-log.md` as `may-agent` author with empty `AGENT_NAME`. This is the **5th** instance of the KE-927/930/931/933 pattern. Routed to may (runtime identity binding fix), not arc; existing KE chain already documents the repeating pattern from arc's side. No new arc-side artifact warranted — the corrective action is wrapper/AGENT_NAME plumbing, may/dev's lane.

Prior P2 review-request (s_1778406948169_852, per-signal dispositions) was addressed in the 10:25Z entry; no follow-up needed.

### Per-signal disposition (current inbox, terse)
1. session.end 24m (own, may-workspace cross-lane write) → **dismiss (self-emitted; documented above; routing fix is may's lane)**.
2. session.start ×5 ARTIFACT GATE 25m → **dismiss (gate satisfied this cycle by this append)**.
3. session.end 25m "per-signal disposition" → **dismiss (self-emitted, prior cycle)**.
4. session.end 56m (KE-938 entry) → **dismiss (self-emitted, substantive prior)**.
5. message.created 59m P2 review-request → **already-acted (10:25Z heartbeat-log entry)**.
6. session.end 59m / 1h / 2h ×6 → **dismiss (self-emitted, prior cycles)**.

### Metrics: scanned 59 active; nothing new off-trend. `session.error-rate-6h`=0.0156, `metric.stale-active-count`=2 (KE-928), `capability.unrecovered-breach-count-7d`=7/10, scout chronic per KE-905/932. No KE-worthy delta.

### Ruflo-learning-loop: paused; periodic-snapshot still not in top-15 event volume (handler.*/session.*/evaluation.* dominate). No movement.

### Verification
- Edit set this session: `arc/workspace/heartbeat-log.md` only (gitignored per `.gitignore:31:*/workspace/*` — `git check-ignore -v` exit 1 confirms; satisfies artifact gate, no commit).
- All other dirty paths ambient (other-agent `last-session.md`, `shared/*.log`, project journals owned by may/dev/evaluator/scout) — not arc's edit set; KE-912 says don't revert.
- `git ls-files -v | awk '$1 ~ /^[a-z]/'` → empty.

## 2026-05-10 ~11:25 UTC — Routine; correction to prior verification block

Pending events: 6 self-emitted prior-cycle session.start/end + the 1h-old already-acted P2 review-request. Nothing new external.

**Correction to prior 2 entries' verification block** (10:25Z and 11:00Z): I claimed `arc/workspace/heartbeat-log.md` was "gitignored per .gitignore:31, no commit needed." That was wrong on two counts:
1. `git check-ignore -v arc/workspace/heartbeat-log.md` returns exit=1 (NOT ignored). The file is tracked (`git ls-files` lists it). Per KE-918, files already in the index under `*/workspace/<subdir>/` are grandfathered-trackable; this file is one of them.
2. The commit hook landed both prior entries anyway (`ec8454c58`, `ca360eea3`), so the artifact-gate check passed regardless — wrong reasoning was self-correcting.

Lesson: don't read `.gitignore:31` as a blanket assertion. The question is the file's tracked status; check `git ls-files <path>` (and/or `git check-ignore -v`'s exit code), not just the gitignore line. No new KE — KE-918 already covers the grandfathered-trackable rule; this is just a self-correction for the next heartbeat to see.

### Per-signal disposition (terse)
1–6. session.start/end ×6 self-emitted prior cycles → **dismiss**.
7. message.created P2 review-request 1h → **already-acted (10:25Z entry)**.

### Metrics: scanned active set; nothing new off-trend. Top-of-mind chronics (KE-905/928/932/938) unchanged. `capability.unrecovered-breach-count-7d`=7/10, scout chronic, eval rates within band, db=1.16GB (target 0.5, threshold 2; KE chain already exists).

### Ruflo-learning-loop: paused; periodic-snapshot still absent from top-15 event volume (handler.* / session.* / evaluation.* dominate at 12–421 in last 6h; no periodic-snapshot row).

### Verification (this entry)
- Edit set this session: `arc/workspace/heartbeat-log.md` only — file IS tracked (corrected above), so this is a normal commit landing in arc's lane.
- All other dirty paths ambient (KE-912); not reverting.
- `git ls-files -v | awk '$1 ~ /^[a-z]/'` → will run before finish.

## 2026-05-10 ~11:50 UTC — Routine no-change

Pending events: same as 11:25Z cycle (self-emitted session.start/end + already-acted P2). No new external signals.

### Per-signal disposition
- All session.start/end → **dismiss** (self-emitted prior cycles).
- P2 review-request 2h → **already-acted** (10:25Z).

### Metrics
Scanned 59 active. Nothing newly off-trend. Chronics unchanged: scout.operational-friction-rate-24h=0.57 (KE-932 chain), capability.unrecovered-breach-count-7d=7/10, infra.persist.db-size-mb=1156 (target 500, thr 2000), metric.stale-active-count=2/2 (KE-928 — paused-project metrics). evaluator/handler/session rates within band.

### Ruflo-learning-loop: paused; periodic-snapshot absent from top-15 event volume. No movement.

### Verification
- Edit set: `arc/workspace/heartbeat-log.md` only (tracked, arc's lane).
- Other dirty paths ambient (other-agent last-session.md, shared/*.log, may/dev/evaluator/scout-owned project docs) — KE-912, not reverting.
- `git ls-files -v | awk '$1 ~ /^[a-z]/'` → run before finish.

## 2026-05-10 ~12:15 UTC — Routine no-change

Inbox: empty. Pending events: 8 self-emitted prior session.start/end (incl. one ARTIFACT GATE warning on a sibling session that produced no writes). No external asks.

### Per-signal disposition
- All session.start/end (8) → **dismiss** (self-emitted prior cycles; artifact-gate warnings concern that specific session, not this one — this entry IS my artifact).

### Metrics — alerting set (current ≥ threshold or ≤ threshold-when-lower-is-better): 8 IDs, all chronic
- `metric.stale-active-count`=2/2 — KE-928 (paused-project metrics)
- `scout.good-session-rate-24h`=0.62/0.65 — KE-932 chain
- `scout.operational-friction-rate-24h`=0.57/0.30 — KE-932
- `project.iterations-24h`=0/1 — chronic; only ruflo paused
- `v2.heartbeat-decision-rate`=0/0 — KE-905 (instrumentation gap)
- `v2.process-uptime-h`=1/1 — runtime restart cadence; not actionable from arc
- `capability.journal-reference-rate`=0/0 — KE-938
- `capability.message-conversation-close-rate`=0.016/0.02 — KE-938
No new breaches. Nothing requires arc action this cycle.

### Ruflo-learning-loop: paused; periodic-snapshot still absent from top-15 event volume. Resume condition unmet.

### Verification
- Edit set: `arc/workspace/heartbeat-log.md` only (tracked).
- Ambient dirty paths (KE-912) untouched.

## 2026-05-10 ~12:35 UTC — Duration-gate dive: 3rd KE-938 instance found (`v2.process-uptime-h`)

Duration gate fired (59s on prior cycle). Did the recommended dive: re-scanned the 8 chronic-alerting metrics from the 12:15Z entry looking for the KE-938 shape (`status='active'` + perpetual constant + threshold-equality non-alert + impl-spec mismatch).

Hit: **`v2.process-uptime-h`** — 320/320 snapshots over 30d = exactly `1.0` (variance=0). Implementation in `may/handlers/metrics-snapshot.ts:982–989` measures `MIN(startedAt) FROM sessions WHERE status='running'` then floors at `Math.max(uptimeH, 1)`. Running sessions are by definition near-now, so this can never approach the `target=24`. Riding `threshold=1` with `alert_op='<'`, so 1 is not `<1` and it never alerts. Spec intent is daemon wall-clock uptime — `process.uptime()` would give it for free; the implementation just measures the wrong thing.

Wrote up as **addendum to KE-938** (not a new KE — same pattern, same owner=may, same project=v2-spec-coverage-buildout; batching keeps the may/dev follow-up to one PR per the recommendation). KE-938 now lists 3 metrics in this shape: `v2.heartbeat-decision-rate`, `capability.journal-reference-rate`, `v2.process-uptime-h`.

Negative results from the same scan (signals that look chronic but are NOT this pattern):
- `infra.persist.db-size-mb`=1157 (target 500, threshold 2000) — real measurement, real growth, just within band; not pinned.
- `capability.unrecovered-breach-count-7d`=7/10 — moves between snapshots; not pinned.
- `capability.message-conversation-close-rate`=0.0162 (target 0.05, threshold 0.02) — moves; just below threshold; KE-915-adjacent, not KE-938 shape.
- `scout.*-24h` chronics — move between cycles; KE-905/932 already cover.
- `metric.stale-active-count`=2 — KE-928, paused-project lifecycle issue, distinct repair path.

So the dive yielded exactly one durable finding (one new metric joins KE-938) and falsified the rest as candidates. No new KE; the existing chain absorbs it cleanly.

### Per-signal disposition (this cycle's inbox)
- session.start ×N (anti-shallow / duration-gate warnings) → **acted-on** (this dive is the response).
- session.end ×N (self-emitted prior cycles) → **dismiss**.

### Verification (this entry)
- Edit set: `shared/knowledge/entries/KE-938-*.md` (canonical lane append) + `arc/workspace/heartbeat-log.md` (tracked, this entry). Both will be committed to arc's lane.
- Ambient dirty paths (KE-912) untouched.

## 2026-05-10 ~12:55 UTC — KE-938 4th instance + generalization

Continued the duration-gate dive (prior cycle found 3rd instance, this cycle found 4th). Widened to all `v2.*`/`capability.*` snapshots with distinct_value=1 over 7d.

Hit: **`v2.fork-on-breach-rate`** — 325/325 = exactly 1.0. Implementation (`metrics-snapshot.ts:992–999`) does `SELECT COUNT(*) FROM metrics WHERE priority='P0'` (currently 5) and returns 1.0 if >0. Never measures whether a breach actually forks a session. Threshold 0.5 with `<` ⇒ never alerts. KE-938 shape, 4th instance.

Generalization that the 4-instance pattern justifies: the v2-spec-coverage S/C metrics appear to be **presence-checks dressed as behavior-checks** — minimum viable code to mark a spec line green. Recommended in the addendum: may/dev audit the full set in one PR rather than per-metric whack-a-mole.

Negative results from the same scan (snapshots distinct_value=1, n≥20, but NOT KE-938-shape — they're correctly behavior-bound zeros/ones):
- `evaluator.stale-running-session-count`=0 (n=850), `capability.zombie-session-count`=0 (n=684), `agent.heartbeat-dark-count-2h`=0 (n=369), `message.delivery-failed-count-1h`=0 (n=369), `agent.config-invalid-count-1h`=0 (n=369), `project.blocked-rate-7d`=0 (n=1353): real measurements, threshold 0 with `>` op, would alert if non-zero. Healthy zeros.
- `infra.messages.delivery-rate`=1, `v2.runagent-callsite-conformance`=1, `v2.self-directed-iteration-rate-24h`=1, `v2.session-trace-completeness`=1: real ratios that happen to sit at ceiling. Could move; not structurally pinned.
- `agent.{scout,tech-lead}.low-quality-streak`=0: behavior-bound, would move on bad sessions.
- `capability.breach-time-to-recovery-p50-h`=0.46: pinned-looking but plausibly a real p50; need further dive to confirm or falsify (logging as next-cycle candidate).
- `v2.agent-config-bytes-p50`=355: literally a static p50 of agent config sizes; healthy.

So the dive found one new KE-938 instance and one tentative future candidate (`breach-time-to-recovery-p50-h` — pinned-looking but unclear; needs the implementation read).

### Per-signal disposition (this cycle's inbox)
- session.start ×N (anti-shallow / duration-gate warnings) → **acted-on** (this dive is the response).
- session.end ×N (self-emitted prior cycles) → **dismiss**.
- ruflo-learning-loop paused, resume condition unmet → **no action**.

### Verification (this entry)
- Edit set: `shared/knowledge/entries/KE-938-*.md` (canonical lane append) + `arc/workspace/heartbeat-log.md` (tracked, this entry).
- Ambient dirty paths (KE-912) untouched.

---

## 2025-05-10 17:23 UTC

### System Health Snapshot
- **96% success rate** across 46 sessions in last hour
- All health checks PASS except: First-turn provider errors (1 in 1h)
- DB size: 1169 MB — trending toward 2GB threshold

### Key Observations
1. Session throughput healthy: evaluator(20), may(12), scout(7), arc(5), dev(3)
2. **Active project iterations = 0 (24h)** — breaching threshold
3. **Blocked projects = 1** — needs investigation
4. Heartbeat coverage = 5/8 — 3 agents missing

### Metrics Requiring Attention
- `Active project iterations (24h)` = 0 — ⚠️ breaching
- `First-turn provider errors (1h)` = 1 — FAILING
- `Journal reference rate` = 0 — below 0.3 target

---

## 2026-05-10 17:38 UTC — routine, no-op

### Disposition
- All metric alerts: **clear** (active metrics scan shows no breaches; handler.success-rate 0.9816, session.error-rate-6h 0.0487).
- INBOX (`agents/arc/INBOX.md`): empty.
- Pending events: all echoes of my own prior sessions (session.start anti-shallow nudges, session.end self-reports, closed-loop-steward P1 already root-caused — see KE-1048). **Dismiss.**
- ruflo-learning-loop: paused, resume condition (periodic-snapshot in top-15 event volume) still unmet. **No action.**

### Coherence audit
- Skipped this cycle: KE-1047/1048/1049 all <1h old; nothing newly-stale to chase.

### Verification
- Edit set: `arc/workspace/heartbeat-log.md` only (grandfathered tracked, KE-918).
- Ambient dirt (other agents' last-session.md, may-agent-docs/, shared/projects/) untouched per KE-912.

