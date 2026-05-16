---
id: evaluator-strategy-extractor-calibration
owner: evaluator
status: waiting
type: milestone
priority: P2
workflow: evaluator-strategy-extractor-calibration-iteration
iteration: 2
stop_reason: Iteration-2 close-the-loop work is complete and ready for human/May review. Resume when: review requests a follow-up on the remaining compact-scout gap, optimization-lesson ranking/noise, or criteria/
resume_condition: review requests a follow-up on the remaining compact-scout gap, optimization-lesson ranking/noise, or criteria/doc interpretation changes.
---

# Evaluator Strategy Extractor Calibration

## Goal
Improve `agents/evaluator/skills/extract-strategy.cjs` so periodic task #7 can extract at least one reusable positive tactic from fresh, verified-success session samples instead of only surfacing recovery/error-cleanup lessons.

## Signals
- Fresh post-fix validation now shows non-zero positive strategy extraction on 2 of the 3 newest verified-`good` non-evaluator history sessions: `.state/sessions/history/s_1778701694150_268/session.jsonl` and `.state/sessions/history/s_1778701694563_272/session.jsonl` both emit reusable `type: "strategy"` lessons, while `.state/sessions/history/s_1778701694460_271/session.jsonl` still returns zero.
- The main remaining gap is durability and propagation, not basic extraction: there is no automated regression harness yet, and `agents/evaluator/workspace/proposed-strategies.md` plus `agents/evaluator/periodic-tasks.md` still record the stale pre-fix all-zero result.
- Current output quality issue: optimization lessons can still appear alongside stronger positive tactics, so consumer docs should distinguish “positive extraction now works” from “ranking/noise is still imperfect.”

## Current State
Waiting: Iteration-2 close-the-loop work is complete and ready for human/May review. Resume when: review requests a follow-up on the remaining compact-scout gap, optimization-lesson ranking/noise, or criteria/doc interpretation changes.

- **I believe**: the project’s immediate goal is now met operationally, not just in code — positive strategy extraction is both regression-tested and propagated into the consumer-facing artifacts.
- **I'm uncertain about**: whether the remaining compact scout miss (`s_1778701694460_271`) is important enough to justify another iteration now, versus treating it as a smaller follow-up after review.
- **I'd change my mind if**: the refreshed files are not actually saved in the working tree, or a fresh rerun of the regression harness/live sample checks fails and shows the 2/3 positive result was not stable.

### 1) Is the goal closer?
Yes — materially. The project moved from “manual 2/3 improvement with stale downstream docs” to “durable regression harness plus refreshed downstream artifacts.” The outcome metric is now locked in better: `extract-strategy.test.cjs` passes with `Passed: 8 / Failed: 0`, and the latest `proposed-strategies.md` and periodic task #7 entry both reflect the post-fix non-zero behavior.

### 2) What did we learn?
What worked:
- A small fixed fixture based on a modern positive session was enough to freeze the intended behavior.
- Live-sample assertions on the May and Dev sessions confirm the fix still works on real recent history.
- Refreshing consumer artifacts removed the stale “all zero” story.

What didn’t:
- The compact scout sample still returns zero strategy lessons.

What surprised us:
- The docs were already refreshed by the time I verified them, despite the handoff summary only listing two modified files. The file contents matter more than the summary.

### 3) Is the current milestone the right next step?
No further iteration is needed for the current milestone. The right state now is review, not more heuristic work. If resumed later, the next step should be the optional follow-up already identified: reassess whether optimization-lesson suppression/ranking or compact-success coverage is worth additional work.

### 4) Are we closing the loop?
Yes, for this goal. This is no longer just a symptom fix:
- code changed in iteration 1,
- regression harness now prevents silent backslide,
- downstream artifacts now reflect the new behavior.

That closes the durability + propagation loop for the stated project goal.

### 5) Is it verified?
Yes, sufficiently for this milestone.
- Regression harness exists and passes.
- Consumer artifacts reflect the new state.
- Periodic task #7 notes now cite the successful extraction instead of the stale zero-output run.

### 6) What's blocking progress?
Nothing external is blocking. The only remaining work is optional calibration polish:
- compact scout sample still yields zero
- optimization lessons may still add noise
- evaluator criteria/docs may still need interpretation updates if review decides this calibration should change how periodic mining is described

### Milestones completed
These should now be checked off:

- **Add a durable regression harness/fixture proving positive strategy extraction on representative modern-session samples.**
- **Update `agents/evaluator/workspace/proposed-strategies.md` with a post-change sample showing non-zero lesson output.**
- **Update `agents/evaluator/periodic-tasks.md` task #7 notes so the latest calibration cites the successful extraction instead of the stale all-zero run.**

### Evidence I used
- `read(agents/evaluator/skills/extract-strategy.test.cjs)` shows a real harness asserting at least one `type: "strategy"` lesson on the fixed fixture and both positive live samples.
- `bash(node agents/evaluator/skills/extract-strategy.test.cjs)` returned `Passed: 8` and `Failed: 0`.
- `read(agents/evaluator/workspace/proposed-strategies.md)` shows the new top section at `2026-05-13 21:05Z` with 2/3 positive-session extraction and regression snapshot.
- `read(agents/evaluator/periodic-tasks.md)` shows the updated periodic task #7 note stating the refreshed post-fix calibration is no longer all-zero and references the passing harness.

LINKED_
## Plan
- [x] Confirm the failure persists on a fresh verified-success sample and record the evidence.
- [x] Inspect `extract-strategy.cjs` heuristics to identify why successful sessions without explicit tool errors produce zero lessons.
- [x] Propose or implement positive-pattern heuristics keyed to structural completion signals (for example: `verification_evidence`, evidence-backed completion summaries, repeated `good` evaluation joins, or durable artifact updates).
- [x] Re-run periodic task #7 sampling on fresh successful sessions and verify the extractor emits at least one non-recovery lesson.
- [x] Add a durable regression harness/fixture proving positive strategy extraction on representative modern-session samples.
- [x] Update `agents/evaluator/workspace/proposed-strategies.md` with a post-change sample showing non-zero lesson output.
- [x] Update `agents/evaluator/periodic-tasks.md` task #7 notes so the latest calibration cites the successful extraction instead of the stale all-zero run.
- [ ] Reassess whether optimization-lesson suppression/ranking is necessary after the regression harness and artifact refresh land.
- [ ] Update evaluator criteria/docs if the calibration change alters how success-pattern mining should be interpreted.

## Validation
- A fresh 3-session verified-success sample produces at least one lesson with a positive/reusable tactic rather than only recovery cleanup.
- `agents/evaluator/workspace/proposed-strategies.md` records a post-change sample with non-zero lesson output.
- Periodic task #7 notes can cite a concrete successful extraction rather than another zero-lesson calibration run.

## Journal
### 2026-05-13
Created the project after another fresh calibration run on `s_1778701694460_271`, `s_1778701694150_268`, and `s_1778701694563_272` returned zero lessons despite canonical heuristic `good` evaluation rows and transcript success-language matches on all three. Next action: inspect extractor heuristics and design positive-pattern rules.


## Artifacts
- outputs/iteration-1-validation.md
- outputs/iteration-2-regression.md

## Context
## Context
- Modern session transcripts encode assistant tool calls under `assistant.content[].toolCall`; supporting that shape was the key fix for the original zero-lesson false negatives.
- Positive strategy extraction on fresh verified-good modern sessions is now durably locked in with a fixed fixture and automated regression harness.
- Consumer-facing artifacts have been refreshed: `proposed-strategies.md` and periodic task #7 notes now reflect the post-fix 2/3 positive result rather than the stale all-zero state.
- One compact scout sample still returns zero, so coverage is improved but not universal.

## Linked Context
## Linked Context
- `agents/evaluator/skills/extract-strategy.cjs` — current extractor implementation
- `agents/evaluator/skills/extract-strategy.test.cjs` — regression harness for modern positive strategy extraction
- `agents/shared/projects/evaluator-strategy-extractor-calibration/outputs/fixtures/strategy-positive-modern-session/session.jsonl` — fixed modern-session positive fixture
- `agents/shared/projects/evaluator-strategy-extractor-calibration/outputs/iteration-1-validation.md` — manual post-fix validation showing 2/3 positive extraction
- `agents/shared/projects/evaluator-strategy-extractor-calibration/outputs/iteration-2-regression.md` — regression harness design and passing verification notes
- `agents/evaluator/workspace/proposed-strategies.md` — refreshed strategy artifact with post-fix non-zero extraction summary
- `agents/evaluator/periodic-tasks.md` — refreshed periodic task #7 note citing the successful extraction and harness
- `.state/sessions/history/s_1778701694150_268/session.jsonl` — fresh verified-good positive sample
- `.state/sessions/history/s_1778701694563_272/session.jsonl` — fresh verified-good positive sample
- `.state/sessions/history/s_1778701694460_271/session.jsonl` — compact verified-good sample that still returns zero
