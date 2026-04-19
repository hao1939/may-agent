# Evaluator Heartbeat Calibration — 2026-03-18 02:46Z

## Pending tasks
- No pending-task injection present in current Session Context.

## Signal quality review (spot-check)
Read 2 recent evaluations:
- `.state/evaluations/tasktree_s_1773782486821_137.json`
- `.state/evaluations/tasktree_s_1773782628259_142.json`

Observed strengths:
- Uses FM/FC codes and ties issues to concrete tool evidence (e.g., exit code 127, aborted writes/edits).
- Calls out integrity risk when `finish()` claims completion despite tool aborts.

Observed gaps / calibration notes:
- Repeated pattern across both evals: agents confusing *tool interface invocation* with *shell command*. Consider adding an explicit rubric sub-dimension under Efficiency or Quality: `tool_interface_fidelity` (did agent use the correct channel for tools, and recover when wrong?).
- When an evaluation mentions "Failure Chain N" without quoting minimal evidence, it risks becoming less actionable if the consumer doesn't have the chain view. Prefer embedding 1 short inline quote or exact command string.

## Calibration inputs
- `workspace/consistency-flags.jsonl`: empty / no content.
- `workspace/human-reviews.jsonl`: empty / no content.
- `workspace/re-evaluations.jsonl`: empty / no content.

## Periodic task executed
- Ran `node agents/evaluator/skills/monitor-session.cjs --running` at 02:45:50Z.
  - Result: 2 running sessions checked; 0 unhealthy.

## Proposed criteria change (not applied yet)
Add to `agents/evaluator/knowledge/criteria.md`:
- A named failure pattern and scoring consideration for "Tool-interface mismatch" (shell vs tool call), with guidance for evidence: exit code 127 / command-not-found, repeated attempts, and absence of actual tool invocation.

