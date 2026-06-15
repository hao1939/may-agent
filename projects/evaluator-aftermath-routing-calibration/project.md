---
id: evaluator-aftermath-routing-calibration
owner: evaluator
status: waiting
type: milestone
priority: P2
iteration: 2
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
- 2026-06-15 heartbeat sampling sharpened the dominant cluster: in the last 24h, live event counts are now `evaluation.false_good=82`, `evaluation.success_candidate≈418+`, and `evaluation.reviewed≈927+`; `aks-explorer` alone accounts for `63` of the `82` false-good rows.
- Sampled aftermaths show the current heuristic gap is not fake output detection anymore; it is missing an intermediate "acceptable / marginal value" state. The overturned `good` sessions usually did produce real artifacts and verification, but reviews downgraded them for duplicate already-complete work, constraint misses inside referenced artifacts, stale evidence pointers, wrong output paths, cross-artifact inconsistency, broad formatting churn, or overclaiming broader health than the evidence supports.
- Fresh samples `s_task_ccp-security-patch-azurelinux-source-spec-frontier-20260615-30`, `s_task_ccp-security-patch-ubuntu2404-source-spec-frontier-20260615-32`, and `s_task_aad-rbac-rbac-disabled-to-aadv2-staging-frontier-retry-20260615` make the dominant live pattern concrete: the router marked them `good` + `success_candidate` because they had `file write/edit` and `verification command` signals, but aftermath review downgraded them to `acceptable` for task-contract misses, path/output mistakes, inconsistent artifact classification, or completion overclaim.
- The live code path still only emits heuristic verdicts `good` or `needs_improvement`; `transcriptOutputSignals()` plus `classifyEvaluationLane()` treat any good session with file writes/commits as a `success_candidate`, while `normalizeEvaluationState()` only downgrades unresolved `repair_execution` to `acceptable`. That leaves no pre-review lane for “real but marginal” success cases, so many such sessions enter review already over-scored.
- Fresh scout heartbeat review `s_1781521991708_173` confirms the same gap outside the main `aks-explorer` cluster: the session produced a real KE artifact and digest update, but aftermath evidence still lands at `acceptable` because the artifact overclaims causality, carries future-dated metadata, and the transcript burns many calls on repeated `query_db` comment-format failures. This is a useful counterexample because the value was real, yet binary heuristic routing still over-promoted it from material-output signals alone.
- 2026-06-15 follow-up heartbeat converted that diagnosis into a narrow code proposal: keep `success_candidate` reserved for stronger output signals (`git commit`, `project artifact`, `knowledge update`, or multiple differentiated write paths) and add a pre-review `acceptable`/marginal normalization for “verify-and-refresh existing artifacts” sessions whose only positive signals are `file write/edit` + `verification command` + project/workflow linkage. The live downgrade samples (`azurelinux-30`, `ubuntu2404-32`) both match that weak-signal pattern, while the scout counterexample shows why the proposal must still allow real artifact value without promoting it to heuristic `good`.

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

- id: package-marginal-success-calibration
  status: done
  result: succeeded
  assignee: evaluator
  goal: Draft an owner-visible calibration proposal for `workflows/evaluator-aftermath.ts` that preserves strong audit/validation sessions but routes marginal material-output sessions away from heuristic `good`, using the current `aks-explorer` false-good cluster plus cross-agent counterexamples.
  run: agent
  depends_on: [sample-false-good-clusters]
  attempts: 1

## Validation
- Fewer reviewed `success_candidate` sessions overturned to `acceptable` solely for low-artifact/text-only workflow shapes.
- New evaluator aftermath reviews stop repeatedly citing the same planner/event-review routing mismatch.
- `evaluator.false-good-rate-sample` trends downward over subsequent review windows without reducing meaningful-review coverage.

## Journal
- 2026-06-15: Heartbeat created this project after reviewing pending evaluator events, the current false-good metric, and repeated aftermath artifacts pointing to planner/text-only routing mismatch.
- 2026-06-15: Heartbeat sampled fresh `evaluation.false_good` events and aftermath artifacts. The dominant live problem is now narrower than the original hypothesis: most false-good reversals are `good -> acceptable`, concentrated in `aks-rp-e2e`, and caused by binary heuristic over-scoring of marginal-but-real sessions (duplicate already-complete work, stale evidence links, constraint misses in referenced artifacts, formatting churn, or overclaiming). Next step is a code-level calibration proposal around the missing intermediate state in `evaluator-aftermath.ts`.
- 2026-06-15: Follow-up heartbeat refreshed the live counts (`false_good=76`, `success_candidate=415`, `reviewed=928`; `aks-explorer=60` false-goods), confirmed three concrete `aks-explorer` downgrade patterns (forbidden replay defaults, wrong output tree, and cross-artifact inconsistency / overclaim), and re-read `transcriptOutputSignals()`, `classifyEvaluationLane()`, and `normalizeEvaluationState()`. Judgment: the main gap is no pre-review route/verdict for “real but marginal” sessions; planner text-only mismatch remains real but secondary.
- 2026-06-15: Heartbeat re-sampled live events after a fresh worker review. Counts moved to `false_good=79`, `success_candidate=418`, `reviewed=927`, with `aks-explorer=61` false-goods. New counterexample `s_task_ccp-security-patch-azurelinux-source-spec-frontier-20260615-32` was routed `success_candidate` and stayed `good`, while nearby `ubuntu2404` and `secops-identity-kubelet` samples were downgraded to `acceptable` for explicit contract/consistency misses. Judgment: the calibration should stay narrow—do not penalize all preexisting-artifact audit sessions. Focus on separating high-quality audit+validation work from marginal sessions that miss forbidden-condition checks, stale derived artifacts, or cross-artifact consistency.
- 2026-06-15: Follow-up heartbeat verified the code-side proposal against live evidence: 24h counts were `evaluation.false_good=82`, `evaluation.success_candidate=424`, `evaluation.reviewed=925`, and `aks-explorer` accounted for `63` false-good events. Re-read `transcriptOutputSignals()`, `classifyEvaluationLane()`, and `normalizeEvaluationState()` confirmed the specific gap: any `good` session with only `file write/edit` material signals is promoted into `success_candidate`, and only unresolved `repair_execution` can later force `acceptable`. Proposed narrow fix: reserve `success_candidate` for stronger/differentiated material signals (`git commit`, `project artifact`, `knowledge update`, or multiple write paths) and normalize weak verify-and-refresh sessions to a marginal/acceptable pre-review state instead of heuristic `good`.
