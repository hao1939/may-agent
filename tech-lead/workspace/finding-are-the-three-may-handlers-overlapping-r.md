# Finding: Are the three May handlers (metrics-snapshot / system-status / proof-of-life) overlapping or redundant?

**Lens:** A — System Architecture
**Scope:** `agents/may/handlers/metrics-snapshot.ts`, `agents/may/handlers/system-status.ts`, `agents/may/handlers/proof-of-life.ts`
**Severity:** Low (no duplication worth merging; minor cleanup opportunity)
**Recommendation:** **Keep separate.** Each handler owns a distinct sink and cadence. One minor consolidation opportunity noted.

---

## Summary
The three handlers are **not redundant**. They share the superficial theme of "system health," but they write to three disjoint sinks (SQLite `metric_*` tables / workspace markdown / Telegram), run on three different cadences (1h / 4h / 2h — `agents/may/cron.json:484`, `cron.json:57`, `cron.json:65`), and serve three different audiences (future queries, human-readable audit log, operator push notifications). There is one well-designed producer→consumer relationship: `proof-of-life` reads the `metric_snapshots`/`metric_alerts` tables that `metrics-snapshot` writes (`proof-of-life.ts:83-104`). The only genuine overlap is a small duplication of the "sessions in last N hours" query between `system-status` and `proof-of-life`, which is not worth merging given the different windows and purposes.

---

## What Each Handler Does

### metrics-snapshot.ts (490 lines, 1h cron)
- **Cron:** `intervalMs: 3600000`, `handler: "metrics-snapshot"` (`agents/may/cron.json:481-490`).
- **Reads:** `metrics` table rows where `status='active'` and `source='auto'` or `source='command'` (`metrics-snapshot.ts:320-322`, `metrics-snapshot.ts:369-371`); `metric_snapshots` for 7d moving average (`metrics-snapshot.ts:154-156`); previous snapshot for regression detection (`metrics-snapshot.ts:257-259`).
- **Writes:** inserts into `metric_snapshots` (`metrics-snapshot.ts:335-337`, `:380-382`); updates `metrics.current`/`updated_at` (`metrics-snapshot.ts:340`, `:385`); inserts into `metric_alerts` with dedup (`metrics-snapshot.ts:133-137`); resolves alerts (`metrics-snapshot.ts:230-232`); closes one-off metrics (`metrics-snapshot.ts:347-349`).
- **Side effects:** calls `ctx.trackRequest(...)` to DM the metric owner on regression (`metrics-snapshot.ts:299-304`); executes shell commands for `source='command'` metrics via `execSync` (`metrics-snapshot.ts:373-377`).
- **Unique ownership:** the Unified Metric System pipeline — auto-measurement, snapshot time-series, threshold/regression alerting, owner notification.

### system-status.ts (223 lines, 4h cron)
- **Cron:** `intervalMs: 14400000`, `handler: "system-status"` (`agents/may/cron.json:53-59`).
- **Reads:** all session metas via `ctx.loadAllSessionMetas()` (`system-status.ts:88`); evaluated session IDs from `evaluations` table (`system-status.ts:54-57`); lessons files under `agents/*/knowledge/lessons.md` (`system-status.ts:146-149`); `agents/bob/workspace/analysis.md` mtime (`system-status.ts:157-165`); runs `npx tsc --noEmit` (`system-status.ts:171`).
- **Writes:** appends a Markdown report block to `agents/may/workspace/health-log.md` (`system-status.ts:45`, `:62-66`). Health log currently exists and is ~177 KB (`ls` output this session).
- **Side effects:** on anomalies, emits `message_created` event to May and calls `ctx.triggerNow("heartbeat")` (`system-status.ts:71-79`).
- **Unique ownership:** periodic build/eval/activity audit trail in Markdown + reactive escalation to May's heartbeat when anomalies are detected (stale running sessions, tsc failure, unevaluated backlog, Bob analysis staleness).

### proof-of-life.ts (261 lines, 2h cron)
- **Cron:** `intervalMs: 7200000`, `handler: "proof-of-life"` (`agents/may/cron.json:61-67`).
- **Reads:** `sessions` table aggregated per-agent for last 2h (`proof-of-life.ts:151-159`); high-op sessions `>30 ops` (`proof-of-life.ts:165-172`); running "persistent" sessions (`proof-of-life.ts:177-184`); `metrics` + `metric_snapshots` + `metric_alerts` for the metrics summary block (`proof-of-life.ts:81-104`).
- **Writes:** nothing to DB or files. Calls `ctx.notify(message)` → Telegram (`proof-of-life.ts:230`, `:255`).
- **Unique ownership:** compact human-facing Telegram digest every 2h; aggregates data produced by `metrics-snapshot` but does not produce its own.

---

## Overlap Analysis

| Concern | metrics-snapshot | system-status | proof-of-life |
|---|---|---|---|
| Sink | SQLite metric_* tables + request DM | `health-log.md` + event → heartbeat | Telegram via `ctx.notify` |
| Cadence | 1h | 4h | 2h |
| Reads `sessions` | no | yes (24h + running) | yes (2h activity) |
| Reads `metrics`/`metric_snapshots` | yes (producer) | no | yes (consumer) |
| Writes metric tables | yes | no | no |
| Writes `health-log.md` | no | yes | no |
| Emits events / triggers heartbeat | no (uses trackRequest for owner DM) | yes (on anomalies) | no |
| Telegram notify | no | no | yes |
| tsc check | no | yes (`system-status.ts:171`) | no |

**Genuine overlaps found:**
1. `system-status` and `proof-of-life` both count sessions over a recent window. But the semantics differ: `system-status` uses a 24h window for backlog anomaly detection (`system-status.ts:90-93`) and flags **running** sessions stuck >30min (`system-status.ts:134-142`); `proof-of-life` uses a 2h window to build a per-agent activity digest (`proof-of-life.ts:25`, `:151-159`). Different windows, different purposes — not worth merging.
2. `proof-of-life` reads the exact tables that `metrics-snapshot` writes (`proof-of-life.ts:83-104`). This is **intentional producer→consumer composition**, not redundancy.

**No overlap found** in: metric measurement (only `metrics-snapshot`), tsc build check (only `system-status`), Telegram delivery (only `proof-of-life`), health-log.md append (only `system-status`), owner-regression DM (only `metrics-snapshot`), heartbeat auto-trigger (only `system-status`).

**Downstream consumer check:**
- `health-log.md`: No code consumer found. Grep over `agents/` and `src/` (excluding `.state/` session history and `archive/`) shows the file is only written by `system-status.ts:45,62-66` and referenced by name in documentation/archive files. Other agents may read it by convention, but there is no programmatic consumer. The log is ~177 KB, indicating ongoing append without retention — this is a follow-up observation, not part of the overlap question.
- `metric_snapshots` / `metric_alerts`: consumed by `proof-of-life.ts:83-104` (confirmed).
- `ctx.trackRequest` owner DMs from `metrics-snapshot.ts:299-304`: consumed by the agents named in `metrics.owner`.

---

## Recommendation: Keep Separate

The three handlers have disjoint responsibilities, sinks, and cadences, and one is already a proper consumer of another's output. Merging would conflate three different failure modes (metric pipeline / audit log / operator digest) into one larger handler with no gain.

**Minor follow-ups worth noting (do NOT fix in this session):**
1. **`health-log.md` has no code consumer and is ~177 KB and growing** (only written in `system-status.ts:62-66`, never truncated). Consider retention/rotation, or delete if no human/agent actually reads it. This is a cleanup item, not an overlap.
2. **`system-status` and `proof-of-life` each reimplement their own "sessions over last N hours" query** (`system-status.ts:88-93` vs `proof-of-life.ts:151-159`). A shared helper in `src/lib/persistence.ts` could de-duplicate ~5 lines — low value; leave as-is unless touched for other reasons.
3. **`metrics-snapshot.ts:171-175` uses `checkRegression` AND `notifyOwnerOnRegression` (`metrics-snapshot.ts:247-309`) on the same measurement** — internal duplication within one handler (alerts + DMs both fire on a regression). Out of scope for this lens (not a cross-handler overlap) but worth flagging.

## Evidence Summary (citations)
- Cron definitions: `agents/may/cron.json:53-59` (system-status), `:61-67` (proof-of-life), `:481-490` (metrics-snapshot).
- File sizes (from `wc -l`): metrics-snapshot 490, system-status 223, proof-of-life 261.
- Sinks: `system-status.ts:62-66` (health-log append), `proof-of-life.ts:230,255` (`ctx.notify`), `metrics-snapshot.ts:335-340,380-385` (DB writes).
- Producer/consumer: writer `metrics-snapshot.ts:335-337`; reader `proof-of-life.ts:83-104`.
- health-log.md consumer search: no programmatic reader found in `agents/` or `src/` (bash grep this session).
