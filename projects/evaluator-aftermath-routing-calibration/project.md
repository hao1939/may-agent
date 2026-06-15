---
id: evaluator-aftermath-routing-calibration
owner: evaluator
status: active
type: milestone
priority: P2
iteration: 1
project_policy: standard
---

# Evaluator Aftermath Routing Calibration

## Goal
Reduce evaluator aftermath routing false positives by calibrating `success_candidate` and `repair_execution` heuristics for text-only planner/event-review sessions and other low-artifact but substantively verified workflows.

## Signals
- `evaluator.false-good-rate-sample` currently reads 0.1744 against a target of 0.05.
- Repeated aftermath reviews describe `repair_execution unresolved` as a routing mismatch rather than a real execution failure.
- Pending evaluator events include fresh `evaluation.false_good`, `evaluation.reviewed`, `evaluation.success_candidate`, and `guard.triggered` records, showing the routing/calibration loop is still active.

## Current State
- Heartbeat review found no red alert, but the false-good metric remains materially above target without breaching its alert threshold.
- Latest runtime metric read shows `evaluator.false-good-rate-sample=0.1831` vs target `0.05`.
- Recent event `1422836` (`evaluation.false_good`) shows a `success_candidate` route later downgraded from `good` to `acceptable` for session `s_task_net-integration-authorized-ip-ranges-feature-yaml-20260615`.
- Repo search shows many aftermath notes already identifying the same pattern: planner/event-review sessions are being downgraded or routed oddly because material-output and `repair_execution` heuristics assume builder-style artifacts.
- A fresh `guard.triggered` event (`1426206`) also confirms evaluator workflow hygiene still needs to prefer targeted transcript extraction over broad dumps.
- 2026-06-15 heartbeat sampling sharpened the dominant cluster: in the last 24h, live event counts are now `evaluation.false_good=76`, `evaluation.success_candidate=415`, and `evaluation.reviewed=928`; `aks-explorer` alone accounts for `60` of the `76` false-good rows.
- Sampled aftermaths show the current heuristic gap is not fake output detection anymore; it is missing an intermediate "acceptable / marginal value" state. The overturned `good` sessions usually did produce real artifacts and verification, but reviews downgraded them for duplicate already-complete work, constraint misses inside referenced artifacts, stale evidence pointers, wrong output paths, cross-artifact inconsistency, broad formatting churn, or overclaiming broader health than the evidence supports.
- Fresh samples `s_task_ccp-security-patch-azurelinux-source-spec-frontier-20260615-30`, `s_task_ccp-security-patch-ubuntu2404-source-spec-frontier-20260615-32`, and `s_task_aad-rbac-rbac-disabled-to-aadv2-staging-frontier-retry-20260615` make the dominant live pattern concrete: the router marked them `good` + `success_candidate` because they had `file write/edit` and `verification command` signals, but aftermath review downgraded them to `acceptable` for task-contract misses, path/output mistakes, inconsistent artifact classification, or completion overclaim.
- The live code path still only emits heuristic verdicts `good` or `needs_improvement`; `transcriptOutputSignals()` plus `classifyEvaluationLane()` treat any good session with file writes/commits as a `success_candidate`, while `normalizeEvaluationState()` only downgrades unresolved `repair_execution` to `acceptable`. That leaves no pre-review lane for “real but marginal” success cases, so many such sessions enter review already over-scored.

## Plan
1. Sample recent false-good and `repair_execution unresolved` aftermaths and cluster them by workflow/session shape.
2. Inspect `workflows/evaluator-aftermath.ts` around success-candidate and repair-decision logic to identify routing assumptions that overfit file-writing sessions.
3. Design a narrow calibration for the dominant cluster: add or simulate an intermediate heuristic outcome for real-but-marginal sessions, rather than forcing the binary `good` vs `needs_improvement` split.
4. Validate the proposed calibration against recent `acceptable` overturn samples from `aks-rp-e2e`, `may-agent`, and `scout-knowledge-lib` before requesting implementation.
5. Update evaluator criteria/learnings only if the code path and reviewer guidance both need calibration.

## Tasks

- id: sample-false-good-clusters
  status: done
  result: succeeded
  assignee: evaluator
  goal: Sample recent `evaluation.false_good` and `repair_execution unresolved` aftermaths into a short cluster note that distinguishes planner/text-only routing mismatches from broader marginal-value false-good cases.
  run: agent
  depends_on: []
  attempts: 1

## Validation
- Fewer reviewed `success_candidate` sessions overturned to `acceptable` solely for low-artifact/text-only workflow shapes.
- New evaluator aftermath reviews stop repeatedly citing the same planner/event-review routing mismatch.
- `evaluator.false-good-rate-sample` trends downward over subsequent review windows without reducing meaningful-review coverage.

## Journal
- 2026-06-15: Heartbeat created this project after reviewing pending evaluator events, the current false-good metric, and repeated aftermath artifacts pointing to planner/text-only routing mismatch.
- 2026-06-15: Heartbeat sampled fresh `evaluation.false_good` events and aftermath artifacts. The dominant live problem is now narrower than the original hypothesis: most false-good reversals are `good -> acceptable`, concentrated in `aks-rp-e2e`, and caused by binary heuristic over-scoring of marginal-but-real sessions (duplicate already-complete work, stale evidence links, constraint misses in referenced artifacts, formatting churn, or overclaiming). Next step is a code-level calibration proposal around the missing intermediate state in `evaluator-aftermath.ts`.
- 2026-06-15: Follow-up heartbeat refreshed the live counts (`false_good=76`, `success_candidate=415`, `reviewed=928`; `aks-explorer=60` false-goods), confirmed three concrete `aks-explorer` downgrade patterns (forbidden replay defaults, wrong output tree, and cross-artifact inconsistency / overclaim), and re-read `transcriptOutputSignals()`, `classifyEvaluationLane()`, and `normalizeEvaluationState()`. Judgment: the main gap is no pre-review route/verdict for “real but marginal” sessions; planner text-only mismatch remains real but secondary.
