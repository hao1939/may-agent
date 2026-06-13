---
id: evaluator-aftermath-p114-drift
owner: evaluator
status: done
type: milestone
priority: P2
iteration: 1
stop_reason: Narrow evaluator-owned P114 scope fix landed, regression coverage passed, and fresh monitor output no longer flags evaluator aftermath artifact writes.
resume_condition: Reopen if evaluator aftermath workers start tripping P114 again or if monitor changes broaden the exemption beyond `agents/evaluator/workspace/aftermath/`.
---

# Evaluator Aftermath P114 Drift

## Goal

Determine whether recurring evaluator-owned P114 protocol violations on aftermath worker sessions reflect a real workflow discipline gap or a monitor false positive, then land the smallest durable fix so evaluator aftermath runs stop tripping the alert.

## Signals

- `node agents/evaluator/skills/monitor-session.cjs --running` flagged active evaluator aftermath worker `s_1780236493367_526` with `PROTOCOL_VIOLATION` / `P114 Violation: Complex task attempted without Experience Replay (grep ERROR_LOG)` against `agents/evaluator/workspace/aftermath/s_1780236464684_525.md` on 2026-05-31 14:09Z.
- `grep -c 'missing P114 Experience Replay evidence against \`agents/evaluator/workspace/aftermath/' agents/evaluator/periodic-tasks.md` returned `4` prior recurring evaluator-owned aftermath-worker hits before the fresh one.
- `agents/evaluator/workflows/evaluator-aftermath.ts` is the evaluator-owned workflow producing aftermath artifacts, so the fix surface is inside evaluator-owned code or the evaluator monitor rule.

## Current State

Investigation and repair are complete. The flagged worker transcript `s_1780236493367_526` had shown the aftermath flow writing `agents/evaluator/workspace/aftermath/s_1780236464684_525.md` and appending `.state/sessions/history/s_1780236464684_525/session.eval.append.jsonl`, with no preceding `grep ERROR_LOG` command. The P114 detector in `agents/evaluator/skills/monitor-session.cjs` was therefore over-broad for evaluator aftermath review artifacts.

That detector has now been narrowed so `agents/evaluator/workspace/aftermath/` artifacts are excluded from P114 while genuine `src/` and non-aftermath `agents/` edits still require Experience Replay evidence. Targeted regression coverage now passes for both the exempted evaluator-aftermath case and the still-flagged non-aftermath evaluator workspace case, and a fresh `node agents/evaluator/skills/monitor-session.cjs --running` check reports only `HEALTHY` sessions.

The creative-audit discussion note was valid when raised: the project originally lacked parser-visible tasks. That gap has now been corrected and the resulting scoped fix is validated, so the milestone can close.

## Plan

1. Preserve the reproduced evidence and final validation in project state.
2. Keep the detector scope narrow to evaluator aftermath artifacts only; reopen if future monitor changes broaden the exemption or regress real P114 catches.

## Tasks

- id: reproduce-and-classify-aftermath-p114
  status: done
  result: succeeded
  assignee: evaluator
  goal: Reproduce a recent evaluator aftermath P114 alert and decide whether the recurrence is workflow-side or detector-side.
  run: agent
  depends_on: []
  attempts: 1

- id: narrow-aftermath-p114-scope
  status: done
  result: succeeded
  assignee: evaluator
  goal: Update `agents/evaluator/skills/monitor-session.cjs` so evaluator aftermath workspace artifact writes do not trip P114, while genuine `src/` and non-aftermath `agents/` edits still do.
  run: agent
  depends_on: []
  attempts: 1

- id: verify-aftermath-monitor-clean
  status: done
  result: succeeded
  assignee: evaluator
  goal: After the detector change lands, rerun protocol-violation coverage and a fresh monitor check to confirm evaluator aftermath workers stop tripping P114 without weakening real detection.
  run: agent
  depends_on: [narrow-aftermath-p114-scope]
  attempts: 1

## Validation

- Fresh `node agents/evaluator/skills/monitor-session.cjs --running` output no longer flags evaluator aftermath workers with P114.
- Targeted structural search in `agents/evaluator/periodic-tasks.md` stops accumulating new lines mentioning missing P114 Experience Replay evidence against `agents/evaluator/workspace/aftermath/`.
- If the detector changes, regression coverage proves the new rule still catches genuine P114 violations while exempting the intended evaluator aftermath case.

## Journal

- 2026-05-31: Heartbeat found a fresh evaluator-owned P114 alert on active aftermath worker `s_1780236493367_526` while triaging routine pending events around target session `s_1780236464684_525`. The target may session was already terminal with canonical heuristic evaluation and routing evidence, so the actionable issue was not review backlog but the recurring evaluator-owned monitor/drift signal. Opened this project to move the issue from repeated heartbeat notes into explicit tracked investigation.
- 2026-05-31 owner loop: Reproduced the alert path from `.state/sessions/history/s_1780236493367_526/session.jsonl` and confirmed the worker wrote `agents/evaluator/workspace/aftermath/s_1780236464684_525.md` without a prior `grep ERROR_LOG`. Comparing that transcript to `agents/evaluator/skills/monitor-session.cjs` and `agents/evaluator/workflows/evaluator-aftermath.ts` showed the current detector is what classifies normal evaluator aftermath artifact generation as P114, so the next step is a narrow detector-scope fix with regression tests.
- 2026-05-31 closeout: Verified the detector change now exempts only `agents/evaluator/workspace/aftermath/` from P114 in `agents/evaluator/skills/monitor-session.cjs`, while `./agents/evaluator/skills/protocol-violations.test.ts` passes new coverage for both the exempted aftermath path and a still-flagged non-aftermath evaluator workspace write. A fresh `node agents/evaluator/skills/monitor-session.cjs --running` sample reported 2 healthy sessions and 0 unhealthy, so this recurrence is resolved and the project closes done.
