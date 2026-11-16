# Standalone snapshot execution trial — November 16, 2026

## Outcome

Alex selected candidate execution integrity as the next bottleneck and supported
local adoption of reviewed commit `aa25bb035f940269d9f6292edbed681ac8a63861`, against
base `5b3694e862831978130e4e2caf1b2902e468d89e`. This change integrates that verified
candidate into Apps source. No Host App reload, natural-work benefit or measured
reduction in human correction/operating cost is claimed.

The standalone assignment `standalone/gym-snapshot-20261116` kept one outcome
through two normal development/review rounds. It used the existing
`alex/develop-change` procedure and retained the first candidate, its rejection
and the revised candidate separately. No Host Task was started or cancelled.

## Problem and change

The original Gym loop retained a candidate snapshot, but each trial resolved
the live `.lab` fork. An independent deterministic replay executed `version-1`
and `version-2` while the manifest fingerprint and retained snapshot still named
`version-1`; the run was marked complete.

The implementation reuses existing snapshot storage. Trial execution transports
the retained candidate path through the default subprocess runner into the
production overlay adapter. Gym validates that snapshot before and after every
trial and before completion. Missing or corrupt snapshots fail without a live
fallback. Candidate snapshots containing symbolic links are rejected; callers
must materialize linked files before comparison.

This establishes a deterministic experiment-integrity improvement. It does not
establish better agent judgment or approve benchmark truth.

## Why a repair round was needed

The first candidate `f41d235387a87c5578e7abc5c80ec77adaa45879` passed the assigned
Gym checks and Bob's review. Ordinary live mutation and deletion were isolated,
but two additional controls exposed gaps:

- A snapshot changed during the final trial could still finish with a stale
  fingerprint because validation happened only before execution.
- An absolute symbolic link could read changing live files while its recorded
  link fingerprint stayed unchanged.

The operator returned both findings to the same assignment. The revised source
added post-execution/final checks and rejected linked snapshots. Bob's revised
exact-candidate review passed with no findings; Alex then judged local adoption
supported. The first review remains evidence of its inspected scope, not proof
that its candidate satisfied the subsequently exposed controls.

| Independent control | Original or first candidate | Revised candidate |
| --- | --- | --- |
| Change live fork between trials | Original executed `version-1`, then `version-2` | Both execute `version-1`; retained fingerprint matches |
| Delete live fork between trials | First patch already isolated deletion | Both execute `version-1`; retained fingerprint matches |
| Corrupt snapshot in final trial | First patch marked complete with a changed fingerprint | Explicit error; `completed_at` remains null |
| Symbolic link to live files | First patch executed changing bytes under one fingerprint | Rejected before the first executor call |

These replays use the default loop subprocess executor and production overlay
adapter with a deterministic CLI fixture. They are mechanics evidence, not
model trials or behavioral truth. An earlier AGENTS.md link fixture interacted
with base overlay copying and was superseded by a version.txt link control;
both remain in the evidence folder, with only the latter supporting this finding.

## Verification and remaining tuning

The exact revised candidate passed `bun run gym:check`: typecheck, 210 Bun tests,
Node scorer tests, scenario validation with zero errors in the isolated
worktree, and all 1,488 benchmark review checks. Existing baseline, custom agent
root, App-local overlay and workflow regressions passed. Independent replay
receipts and their hashes support all four controls above. Integrated checkout
verification is recorded separately in the retained session index.

Two development invocations took approximately 4.7 and 5.2 minutes. Model usage
and reported direct-call cost estimates are in the retained usage summary;
billing and the helper's additional external CLI review cost remain unknown.
No numerical cost reduction is inferred from this repair.

Keep these process observations for later scoped tuning:

- Extra controls found defects after a passing review, so owner judgment still
  needs evidence that can falsify the intended mechanism.
- The implementation helper performed an additional CLI review despite the
  intended workflow-owned review route, including a malformed first invocation.
- Repository-independent guidance requested `check:ci`, which is unavailable
  here; the actual assigned Gym verification remained the acceptance check.
- Context references must reach the specialist in its actual prompt. Goal
  context paths alone were not propagated by this development procedure.

These observations do not expand this candidate into another workflow engine.
The next plan milestone is to exercise interruption/reuse and supported
no-change/inconclusive dispositions in the standalone procedure before relying
on Host scheduling and recovery.

## Evidence

The [retained session index](/root/workspace-worktrees/alex-standalone-20261116/.state/standalone-improvement/20261116-session-2/README.md)
links the declared hypothesis, exact Task inputs, both development results and
reviews, first-patch failures, repaired controls, verification and Alex's
disposition. Source and ignored state remain in the external worktree for
further manual tuning.
