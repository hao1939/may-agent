# Handler-Contract / Owner-Linkage Repair Evidence

Task: `repair-evaluation-handler-contract-owner-linkage-20260722`
Sampled: 2026-07-25T03:40Z

## Fresh Evidence

- Current `.state/tasks/tree.json` read shows `repair-evaluation-handler-contract-owner-linkage-20260722` at generation 3, resource_version 14, owner `evaluator`, mode `achieve`, with no children and an active running attempt. Its input links May escalation message event `4162039` and prohibits evaluator mutation of `runtime/*` task ids.
- Current `.state/tasks/tree.json` read shows stale affected runtime attention leaves still present, including `runtime/session-aftermath/s_1784531643766_14`, `runtime/session-aftermath/s_1784532540589_6`, `runtime/session-aftermath/s_1784535074141_120`, `runtime/session-aftermath/s_1784535211133_130`, `runtime/session-aftermath/s_1784558243934_0`, `runtime/session-aftermath/s_1784563895923_154`, `runtime/session-aftermath/s_1784563959059_156`, and `runtime/session-aftermath/s_focus_plan_strategy_20260720165428_47n5i7`, each with summary `Handler result was rejected: needs-owner cannot include actions or Conditions`.
- Runtime DB event read after `PRAGMA table_info(events)` shows event `4162039` is a `message.created` from `agent:evaluator` to `agent:may`, `delivery_status=accepted`, `accepted_by=owner-inbox:agent:may`, with no `result` and no `task_id`/`escalation_id`; a follow-up query found no later May-owned/source response containing the handler-contract/owner-linkage phrase.
- Latest project-health report `reports/project-health/evaluation.app/20260725T033325422Z.md` downgraded the previous concern to `watch`, but still reports created/open escalations as 0 and recommends running the repair to converge or convert it into one precise linked escalation.

## Repair Path

The evaluator owner cannot safely re-drive, absorb, preserve, close, update, or unblock `runtime/session-aftermath/*` task leaves from this owner result. The correct bounded path is to converge this failed carrier and create one non-runtime structured successor task under `evaluator-reliability`, linked to event `4162039`, for May/runtime to provide the controller-mediated decision: re-drive, absorb, or preserve the stale runtime/session-aftermath leaves, with exact resume/fallback evidence.

## Non-Mutation Verification

This note is an evidence artifact only. No `.state/tasks/*` runtime storage was edited, and the proposed task-tree mutation will create only a non-runtime successor task; it will not close, update, or unblock any task id beginning with `runtime/`.
