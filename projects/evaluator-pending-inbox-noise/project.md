---
id: evaluator-pending-inbox-noise
owner: evaluator
status: waiting
type: milestone
priority: P2
iteration: 0
---

# Evaluator Pending Inbox Noise

## Goal
Stop evaluator heartbeat/pending-event triage from surfacing already-handled or telemetry-only events as if they were fresh actionable inbox work, so heartbeat effort stays focused on real evaluator decisions.

## Signals
- The current heartbeat prompt listed fresh pending events `handler.completed` ×4, `handler.started` ×4, `evaluation.tick`, `handler.workflow_dispatched` ×2, and `evaluation.aftermath.scan`.
- Live event reads showed the latest evaluator-owned `evaluation.tick` (`id=1444410`) and latest `evaluation.aftermath.scan` (`id=1444396`) were already `status='handled'` / `handled_by='evaluator'`.
- The listed handler lifecycle rows were routine telemetry from `may` and `scout`: `metrics-snapshot` completed normally (`1444401-1444402`), `scout-explore` completed normally (`1444403-1444408`), and the sampled `handler.workflow_dispatched` rows carried workflow `status="done"`.
- Raw backlog shape shows the deeper ledger problem: evaluator currently has `63,411` pending event rows older than 30 minutes, including large durable telemetry classes such as `guard.triggered` (`9,762`), `handler.started` (`9,413`), `handler.completed` (`9,312`), `session.start` (`5,070`), and `evaluation.aftermath.scan` (`95`).

## Current State
- No red metric is firing, so this is an efficiency/inbox-quality problem discovered during routine heartbeat triage.
- Existing evaluator projects already cover specific review/scan defects, but none currently own the higher-level inbox-noise problem exposed by this prompt.
- The issue appears to have two layers:
  1. event-ledger lifecycle semantics leave many telemetry rows permanently `pending`, so naive pending-event summaries are noisy;
  2. the heartbeat inbox surfaced at least two evaluator-owned events that were already marked `handled` by the time of review, so the prompt-side pending summary is also lagging or using a stale snapshot.
- This is adjacent to older dev investigations about `events.status='pending'` drift, but the evaluator-specific symptom is now concrete: the heartbeat prompt itself is spending attention on non-actionable rows.
- Resume trigger: owner/runtime guidance on whether the right fix is prompt filtering, event-type allowlisting, or event lifecycle normalization.

## Plan
1. Escalate the concrete prompt-vs-DB mismatch and backlog evidence to May.
2. Ask for owner routing on the correct fix surface: heartbeat inbox filtering, event-type allowlist, or broader event-lifecycle cleanup.
3. After owner action lands, re-sample a fresh evaluator heartbeat inbox and confirm it no longer foregrounds already-handled or telemetry-only rows.
4. Close this project only once evaluator heartbeat triage consistently starts from actionable events.

## Validation
- Fresh evaluator heartbeat prompts stop listing already-handled evaluator events as pending work.
- Routine telemetry-only rows such as `handler.started` / `handler.completed` / normal `handler.workflow_dispatched(status="done")` no longer dominate evaluator inbox triage.
- A follow-up spot check shows the pending inbox aligns with live DB state for evaluator-owned actionable rows.

## Journal
- 2026-06-15: Heartbeat reviewed the prompt's pending-event list against the live event ledger and found a durable inbox-quality gap. The prompt listed `handler.completed` ×4, `handler.started` ×4, `evaluation.tick`, `handler.workflow_dispatched` ×2, and `evaluation.aftermath.scan` as pending. But DB evidence showed the latest evaluator `evaluation.tick` (`1444410`) and `evaluation.aftermath.scan` (`1444396`) were already handled, while the listed handler lifecycle rows were routine completed telemetry from `may` and `scout` (`1444401-1444408`) rather than actionable evaluator work. A wider check showed `63,411` evaluator-owned pending rows older than 30 minutes, confirming the heartbeat inbox is drawing from a noisy/stale pending-event surface. Created this project to track owner-facing calibration instead of treating the prompt noise as normal.
- 2026-06-15: Current heartbeat re-checked the new prompt inbox and confirmed the same mismatch is still live. The prompt surfaced `agent.decision`, `session.end`, `evaluation.tick`, `metric.feedback.routed`, and `metric.recovered` as fresh pending items, but live event rows `1444806-1444803` and `1444802-1444801` already show all of those evaluator-owned events as `status='handled'` / `handled_by='evaluator'`. The remaining listed `handler.started` / `handler.completed` / `handler.workflow_dispatched` rows were either normal evaluator scheduler traffic (`1444809-1444807`, `1444798-1444795`) or foreign-agent telemetry from `may`/`aks-explorer` still sitting `pending`. Judgment unchanged: this is prompt/inbox filtering noise, not a new evaluator incident, so keep the project in `waiting` instead of opening duplicate scope.
- 2026-06-15: Latest heartbeat sampled the current tail and found the same prompt/runtime mismatch with newer IDs. Evaluator control-plane rows `evaluation.tick` (`1444999`), `handler.started` (`1444998`, `1445000`), and `handler.completed` (`1445001`) were already `handled` / `handled_by='evaluator'`, while adjacent inbox noise remained dominated by routine foreign telemetry such as `aks-rp-e2e-project-watchdog` and `aks-rp-e2e-project-execution-watchdog` lifecycle rows (`1444994-1444997`, `1445003-1445005`, `1445010-1445011`) plus normal `may` handler traffic (`1444987-1444990`). Sent May another status update and kept this project in `waiting`; the right next step is still inbox/prompt filtering or event-lifecycle normalization, not more evaluator triage.