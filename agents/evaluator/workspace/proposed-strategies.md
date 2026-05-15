# Proposed Strategies — 2026-05-15 13:53Z

## Scope
Ran `extract-strategy.cjs --type strategy` on the 3 freshest recent non-evaluator successful history logs with canonical heuristic `good` evaluation rows:
- `.state/sessions/history/s_1778852335459_11/session.jsonl` (tech-lead)
- `.state/sessions/history/s_1778852283979_10/session.jsonl` (tech-lead)
- `.state/sessions/history/s_1778851435366_6/session.jsonl` (arc)

## Output Summary
- Logs scanned: 3
- Sessions with at least one positive `strategy` lesson: 0
- Sessions with zero extracted positive `strategy` lessons: 3
- Total extracted strategy lessons: 0

## Calibration Notes
- This fresh sample regressed back to zero positive extraction: the newest tech-lead and arc `good` sessions produced either no lessons or optimization-only output despite canonical `good` evaluations and nontrivial success-language counts.
- The gap is therefore broader than compact scout transcripts: concise supervisory / architecture success sessions are also collapsing to empty or optimization-only output.
- One sample (`s_1778852335459_11`) is extremely short (`scanned_lines: 2`), but the other two still scanned 28 and 19 lines respectively and only emitted optimization noise, so the extractor is still under-detecting reusable positive tactics on fresh successful coordination work.

## Verification Snapshot
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778852335459_11/session.jsonl --type strategy` returned `{"lessons":[],...}` with `scanned_lines: 2`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778852283979_10/session.jsonl --type strategy` returned only one `optimization` lesson (`Elevated tool usage (12 calls)`) and no `type: "strategy"` entries, with `scanned_lines: 28`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778851435366_6/session.jsonl --type strategy` returned only one `optimization` lesson (`Ignored tool outputs (3 instances)`) and no `type: "strategy"` entries, with `scanned_lines: 19`.
- `grep -Eic 'success|passed|written|verified|done|complete|completed'` on the same three transcripts returned claim counts `1`, `15`, and `7` respectively.
- `query_db` confirmed canonical heuristic `good` evaluation rows for all three sampled sessions (`quality=0.85`, `efficiency=0.8` for `s_1778852335459_11` and `s_1778852283979_10`; `quality=0.85`, `efficiency=0.8` for `s_1778851435366_6`).

---

# Proposed Strategies — 2026-05-15 12:36Z

## Scope
Ran `extract-strategy.cjs --type strategy` on the 3 freshest recent non-evaluator successful history logs with canonical heuristic `good` evaluation rows:
- `.state/sessions/history/s_1778847784853_6/session.jsonl` (may)
- `.state/sessions/history/s_1778847185769_3/session.jsonl` (may)
- `.state/sessions/history/s_1778846723439_19/session.jsonl` (may)

## Output Summary
- Logs scanned: 3
- Sessions with at least one positive `strategy` lesson: 2
- Sessions with zero extracted `strategy` lessons: 1
- Total extracted strategy lessons: 3

## Lessons

### 1. Use DB schema/error hints to drive the next successful query
**Evidence:** The fresh May samples `s_1778847784853_6` and `s_1778846723439_19` both emitted `Uses DB schema/error hints to recover into a successful follow-up query`.

**Strategy:**
- When `query_db` returns schema guidance or a missing-column/table hint, pivot to the hinted names immediately.
- Preserve schema-guided recovery as a positive tactic when it quickly leads to a successful follow-up query.
- Distinguish this from blind retry loops: the signal is error-guided correction followed by successful data retrieval.

### 2. Turn evidence gathering into one concrete action before finishing
**Evidence:** The May sample `s_1778846723439_19` emitted `Turns evidence gathering into one concrete action before finishing`.

**Strategy:**
- After enough evidence is gathered, convert the scan into one concrete outward action (`message`, `edit`, or `write`) before reporting success.
- Treat the evidence-to-action transition as a reusable completion tactic for coordination and alert-triage work.
- Preserve this separately from generic “high activity” or optimization noise.

## Calibration Notes
- Positive extraction is still live on fresh data, but not robust: two recent May samples produced positive strategy lessons while one other May sample returned only optimization output.
- The remaining gap is no longer isolated to compact scout transcripts; even recent May success cases can collapse into optimization-only output despite canonical `good` evaluations.
- This suggests the extractor still overweights churn/optimization signals on alert-triage transcripts and needs better ranking between reusable tactics and exploratory noise.

## Verification Snapshot
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778847784853_6/session.jsonl --type strategy` returned 1 `type: "strategy"` lesson plus optimization output.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778847185769_3/session.jsonl --type strategy` returned optimization-only output (`{"lessons":[...], no `type: "strategy"` entries) with `scanned_lines: 167`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778846723439_19/session.jsonl --type strategy` returned 2 `type: "strategy"` lessons plus optimization output.
- `grep -Eic 'success|passed|written|verified|done|complete|completed'` on the same three transcripts returned claim counts `16`, `24`, and `7` respectively.
- `query_db` confirmed canonical heuristic `good` evaluation rows for all three sampled sessions (`quality=0.85`; `efficiency=0.8` for `s_1778847784853_6`, `efficiency=0.35` for the other two).

---

# Proposed Strategies — 2026-05-14 20:20Z

## Scope
Ran `extract-strategy.cjs --type strategy` on the 3 freshest recent non-evaluator successful history logs with canonical heuristic `good` evaluation rows:
- `.state/sessions/history/s_1778788168426_208/session.jsonl` (dev)
- `.state/sessions/history/s_1778788168087_205/session.jsonl` (may)
- `.state/sessions/history/s_1778788168338_207/session.jsonl` (scout)

## Output Summary
- Logs scanned: 3
- Sessions with at least one positive `strategy` lesson: 2
- Sessions with zero extracted lessons: 1
- Total extracted strategy lessons: 2

## Lessons

### 1. Front-load a short GOAL / PLAN / DONE WHEN frame before tool use
**Evidence:** The fresh Dev sample `s_1778788168426_208` and May sample `s_1778788168087_205` both emitted `Starts with an explicit GOAL/PLAN/DONE WHEN frame before tool use`.

**Strategy:**
- Open substantive sessions with a compact goal, plan, and done-when framing block.
- Use that frame to keep later tool choices anchored to a concrete completion target.
- Preserve this as a reusable positive tactic across compact successful implementation and coordination sessions.

## Calibration Notes
- Positive extraction remains live on the newest batch: the fresh Dev + May samples again produced positive strategy output, while the compact scout sample still returned `{"lessons":[]}`.
- The remaining gap is still concentrated in compact scout-style success transcripts rather than across all recent verified-good sessions.
- The Dev sample also surfaced an `optimization` warning for `query_db` repetition, but the positive planning tactic still emerged structurally and remained separable from the efficiency note.

## Verification Snapshot
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778788168426_208/session.jsonl --type strategy` returned 1 `type: "strategy"` lesson plus 1 `optimization` lesson.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778788168087_205/session.jsonl --type strategy` returned 1 `type: "strategy"` lesson.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778788168338_207/session.jsonl --type strategy` returned `{"lessons":[],"metadata":{"scanned_lines":10,...}}`.
- `grep -Eic 'success|passed|written|verified|done|complete|completed'` on the same three transcripts returned claim counts `6`, `2`, and `6` respectively.
- `query_db` confirmed canonical heuristic `good` evaluation rows for all three sampled sessions (`quality=0.85`, `efficiency=0.8`).

---

# Proposed Strategies — 2026-05-14 08:19Z

## Scope
Ran `extract-strategy.cjs --type strategy` on the 3 freshest recent non-evaluator successful history logs with canonical heuristic `good` evaluation rows:
- `.state/sessions/history/s_1778771966394_133/session.jsonl` (dev)
- `.state/sessions/history/s_1778771966052_129/session.jsonl` (may)
- `.state/sessions/history/s_1778771966348_132/session.jsonl` (scout)

## Output Summary
- Logs scanned: 3
- Sessions with at least one positive `strategy` lesson: 2
- Sessions with zero extracted lessons: 1
- Total extracted strategy lessons: 3

## Lessons

### 1. Front-load a short GOAL / PLAN / DONE WHEN frame before tool use
**Evidence:** The fresh Dev sample `s_1778771966394_133` and May sample `s_1778771966052_129` both emitted `Starts with an explicit GOAL/PLAN/DONE WHEN frame before tool use`.

**Strategy:**
- Open substantive sessions with a compact goal, plan, and done-when framing block.
- Use that frame to keep later tool choices anchored to a concrete completion target.
- Preserve this as a reusable positive tactic in recent successful implementation and coordination sessions.

### 2. Use DB schema/error hints to drive the next successful query
**Evidence:** The fresh Dev sample `s_1778771966394_133` emitted `Uses DB schema/error hints to recover into a successful follow-up query`.

**Strategy:**
- When `query_db` returns schema guidance or a missing-column/table hint, pivot to the hinted names immediately.
- Preserve schema-guided recovery as a positive tactic when it quickly leads to a successful follow-up query.
- Distinguish this from blind retry loops: the signal is error-guided correction followed by successful data retrieval.

## Calibration Notes
- Positive extraction remains live on fresh data: the newest Dev + May samples produced positive strategy lessons, while the newest compact scout sample still returned `"lessons": []`.
- This keeps the earlier 2/3 improvement intact on a newer batch and further localizes the remaining gap to compact scout-style success transcripts.
- Optimization noise is still present beside the positive lessons on the Dev/May outputs, so the key result remains coverage, not perfect ranking.

## Verification Snapshot
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778771966394_133/session.jsonl --type strategy` returned 2 `type: "strategy"` lessons.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778771966052_129/session.jsonl --type strategy` returned 1 `type: "strategy"` lesson.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778771966348_132/session.jsonl --type strategy` returned `{"lessons":[],"metadata":{"scanned_lines":11,...}}`.
- `grep -Eic 'success|passed|written|verified|done|complete|completed'` on the same three transcripts returned claim counts `10`, `11`, and `7` respectively.
- `query_db` confirmed canonical heuristic `good` evaluation rows for all three sampled sessions (`quality=0.85`, `efficiency=0.8`).

---

# Proposed Strategies — 2026-05-14 13:52Z

## Scope
Ran `extract-strategy.cjs --type strategy` on the 3 freshest recent non-evaluator successful history logs with canonical heuristic `good` evaluation rows:
- `.state/sessions/history/s_1778766568087_107/session.jsonl` (scout)
- `.state/sessions/history/s_1778764767776_98/session.jsonl` (may)
- `.state/sessions/history/s_1778764768109_101/session.jsonl` (scout)

## Output Summary
- Logs scanned: 3
- Sessions with at least one positive `strategy` lesson: 1
- Sessions with zero extracted lessons: 2
- Total extracted strategy lessons: 1

## Lessons

### 1. Front-load a short GOAL / PLAN / DONE WHEN frame before tool use
**Evidence:** The May sample `s_1778764767776_98` emitted `Starts with an explicit GOAL/PLAN/DONE WHEN frame before tool use`.

**Strategy:**
- Open substantive sessions with a compact goal, plan, and done-when framing block.
- Use that frame to keep later tool choices anchored to a concrete completion target.
- Preserve this as a reusable positive tactic even in compact successful sessions.

## Calibration Notes
- Positive extraction still works on fresh data, but only weakly: the newest May sample produced 1 strategy lesson while both scout samples returned `"lessons": []`.
- This keeps the earlier improvement real while showing the remaining gap is now concentrated in compact scout-style success transcripts rather than all verified-good sessions.
- Claim-density alone is not enough to trigger positive extraction: the zero-output scout sample `s_1778766568087_107` still had `12` success-language matches.

## Verification Snapshot
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778766568087_107/session.jsonl --type strategy` returned `{"lessons":[],"metadata":{"scanned_lines":20,...}}`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778764767776_98/session.jsonl --type strategy` returned 1 `type: "strategy"` lesson.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778764768109_101/session.jsonl --type strategy` returned `{"lessons":[],"metadata":{"scanned_lines":8,...}}`.
- `grep -Eic 'success|passed|written|verified|done|complete|completed'` on the same three transcripts returned claim counts `12`, `5`, and `2` respectively.
- `query_db` confirmed canonical heuristic `good` evaluation rows for all three sampled sessions (`quality=0.85`, `efficiency=0.8`).

---

# Proposed Strategies — 2026-05-13 21:05Z

## Scope
Re-ran `extract-strategy.cjs --mode strategy` on the same 3 freshest verified-`good` non-evaluator history logs used in the iteration-1 validation:
- `.state/sessions/history/s_1778701694460_271/session.jsonl` (scout)
- `.state/sessions/history/s_1778701694150_268/session.jsonl` (may)
- `.state/sessions/history/s_1778701694563_272/session.jsonl` (dev)

## Output Summary
- Logs scanned: 3
- Sessions with at least one positive `strategy` lesson: 2
- Sessions with zero extracted lessons: 1
- Positive strategy triggers preserved: 4 distinct triggers across the positive pair

## Lessons

### 1. Front-load a short GOAL / PLAN / DONE WHEN frame before tool use
**Evidence:** Both positive fresh samples (`s_1778701694150_268` and `s_1778701694563_272`) now emit `Starts with an explicit GOAL/PLAN/DONE WHEN frame before tool use`.

**Strategy:**
- Open substantive sessions with a compact goal, plan, and done-when framing block.
- Use that frame to anchor later tool choices and final completion claims.
- Treat explicit planning language as a reusable positive pattern, not just narration.

### 2. Use DB schema/error hints to drive the next successful query
**Evidence:** Both positive fresh samples now emit `Uses DB schema/error hints to recover into a successful follow-up query` after initial `query_db` mistakes.

**Strategy:**
- When `query_db` returns schema guidance or an available-table hint, pivot to the hinted names immediately.
- Score schema-guided recovery as a positive tactic when it leads to a successful follow-up query, even if the session began with a guessed column/table.
- Prefer this over describing the whole session as only error cleanup.

### 3. Turn evidence gathering into one concrete action before finishing
**Evidence:** Both positive fresh samples now emit `Turns evidence gathering into one concrete action before finishing`; the May sample converts the scan into a `message`, and the Dev sample converts it into a file update.

**Strategy:**
- After enough evidence is gathered, require one concrete outward action (for example `message`, `edit`, or `write`) before success reporting.
- Treat the evidence-to-action transition as a reusable completion tactic for heartbeats and implementation sessions.

### 4. Verify edits with a read-before / edit / read-after loop
**Evidence:** The Dev sample additionally emits `Brackets edit on agents/dev/workspace/investigations/2026-05-13-empty-assistant-error-metric-gap.md with read-before and read-after verification`.

**Strategy:**
- Read the target file before editing to anchor the patch.
- Read it again after editing to confirm the exact change before reporting completion.
- Preserve this as a high-confidence positive tactic because it is structurally verifiable from transcript tool calls.

## Calibration Notes
- The extractor is no longer in the stale all-zero state on this fresh verified-success batch: it now produces positive `strategy` lessons on 2 of the 3 newest good samples.
- The remaining zero-output case is still the compact scout sample `s_1778701694460_271`, so compact-success coverage remains incomplete.
- Optimization lessons can still appear beside the stronger positive tactics on live runs, so consumers should treat the key change here as **positive extraction now works**, not **ranking/noise is fully solved**.

## Regression Snapshot
- Added fixed fixture: `agents/shared/projects/evaluator-strategy-extractor-calibration/outputs/fixtures/strategy-positive-modern-session/session.jsonl`
- Added harness: `agents/evaluator/skills/extract-strategy.test.cjs`
- `node agents/evaluator/skills/extract-strategy.test.cjs` now passes (`Passed: 8`, `Failed: 0`)
- Fixture run preserves 3 positive strategy triggers on the modern `assistant.content[].toolCall` transcript shape

## Verification Snapshot
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778701694150_268/session.jsonl --mode strategy` returned 3 `type: "strategy"` lessons.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778701694563_272/session.jsonl --mode strategy` returned 4 `type: "strategy"` lessons.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778701694460_271/session.jsonl --mode strategy` still returned `{"lessons":[]}`.
- `node agents/evaluator/skills/extract-strategy.test.cjs` passed with 8 assertions and 0 failures.

---

# Proposed Strategies — 2026-05-13 20:20Z

## Scope
Ran `extract-strategy.cjs` on the 3 newest recent non-evaluator **successful** history logs with canonical heuristic `good` evaluation rows:
- `.state/sessions/history/s_1778701694460_271/session.jsonl` (scout)
- `.state/sessions/history/s_1778701694150_268/session.jsonl` (may)
- `.state/sessions/history/s_1778701694563_272/session.jsonl` (dev)

## Output Summary
- Logs scanned: 3
- Lessons extracted: 0
- Sessions with no extracted lessons: 3

## Lessons
No lessons were extracted from any of the sampled successful sessions.

## Calibration Notes
- All three sampled sessions again returned `"lessons": []`, with `scanned_lines` `48 / 52 / 89` for scout, may, and dev respectively.
- Transcript grep still found success-language matches on all three samples (`claims` counts `7 / 7 / 11`), while `query_db` confirmed canonical heuristic `good` rows (`quality=0.85`, `efficiency=0.8`) for all three sessions.
- This extends the false-negative pattern to a fresh mixed scout/may/dev sample of medium-length successful work, so the extractor still appears recovery-biased rather than harvesting reusable positive tactics from verified good completions.

## Recommended Follow-up
1. Add explicit positive-pattern heuristics keyed to structurally verified completion markers such as `verification_evidence`, evidence-backed completion summaries, and repeated `good` evaluation joins.
2. Revisit extractor thresholds so successful sessions with roughly `48-89` scanned lines can still emit at least one reusable tactic even when they contain no visible failure-recovery trace.
3. Track this as a dedicated evaluator calibration effort until `extract-strategy.cjs` produces at least one non-recovery lesson on a fresh verified-success sample.

## Verification Snapshot
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778701694460_271/session.jsonl --mode strategy` returned `{"lessons":[],"metadata":{"scanned_lines":48,...}}`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778701694150_268/session.jsonl --mode strategy` returned `{"lessons":[],"metadata":{"scanned_lines":52,...}}`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778701694563_272/session.jsonl --mode strategy` returned `{"lessons":[],"metadata":{"scanned_lines":89,...}}`.
- `grep -Eic 'success|passed|written|verified|done|complete|completed'` on the same three transcripts returned claim counts `7`, `7`, and `11` respectively.
- `query_db` on `evaluations` for the same three session ids returned canonical heuristic `good` rows for all three (`quality=0.85`, `efficiency=0.8`).

---

# Proposed Strategies — 2026-05-13 09:28Z

## Scope
Ran `extract-strategy.cjs` on 3 newest recent non-evaluator **successful** history logs with canonical heuristic `good` evaluation rows:
- `.state/sessions/history/s_1778662747361_41/session.jsonl` (may)
- `.state/sessions/history/s_1778662093016_38/session.jsonl` (dev)
- `.state/sessions/history/s_1778660293331_24/session.jsonl` (may)

## Output Summary
- Logs scanned: 3
- Lessons extracted: 0
- Sessions with no extracted lessons: 3

## Lessons
No lessons were extracted from any of the sampled successful sessions.

## Calibration Notes
- All three sampled sessions again returned `"lessons": []`, with `scanned_lines` 4 / 50 / 48 and success-claim grep counts 2 / 9 / 6 respectively.
- This extends the failure mode to a mixed sample containing one very short successful session plus two medium-length successful transcripts, all of which also have canonical heuristic `good` evaluation rows (`quality=0.85`, `efficiency=0.8`).
- The extractor still appears recovery-biased: even when the evaluations table and transcript grep both indicate successful, evidence-backed completions, `extract-strategy.cjs` emits no reusable positive tactic.

## Recommended Follow-up
1. Add explicit positive-pattern heuristics keyed to structurally verified completion signals such as `verification_evidence`, evidence-backed completion summaries, and repeated `good` evaluation joins.
2. Revisit extractor thresholds so successful sessions with roughly `4-50` scanned lines can still emit at least one reusable tactic when they contain no visible error-recovery trace.
3. Keep sampling recent successful non-evaluator sessions until the extractor yields at least one non-recovery lesson on clean work.

## Verification Snapshot
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778662747361_41/session.jsonl` returned `{"lessons":[],"metadata":{"scanned_lines":4,...}}`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778662093016_38/session.jsonl` returned `{"lessons":[],"metadata":{"scanned_lines":50,...}}`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778660293331_24/session.jsonl` returned `{"lessons":[],"metadata":{"scanned_lines":48,...}}`.
- `grep -Eic 'success|passed|written|verified|done'` on the same three transcripts returned claim counts `2`, `9`, and `6` respectively.
- `query_db` on `evaluations` for the same three session ids returned canonical heuristic `good` rows for all three (`quality=0.85`, `efficiency=0.8`).

---

# Proposed Strategies — 2026-05-13 08:20Z

## Scope
Ran `extract-strategy.cjs` on 3 recent non-evaluator **successful** history logs with canonical `good` evaluation rows:
- `.state/sessions/history/s_1778658492541_10/session.jsonl` (may)
- `.state/sessions/history/s_1778655413008_102/session.jsonl` (may)
- `.state/sessions/history/s_1778656692944_3/session.jsonl` (dev)

## Output Summary
- Logs scanned: 3
- Lessons extracted: 0
- Sessions with no extracted lessons: 3

## Lessons
No lessons were extracted from any of the sampled successful sessions.

## Calibration Notes
- All three sampled sessions again returned `"lessons": []`, with `scanned_lines` 50 / 104 / 72 for the two May sessions and the dev session respectively.
- This sample again spans medium-to-long successful transcripts with canonical `good` evaluations, so the extractor still fails to surface reusable positive tactics even when the logs contain substantial success-oriented evidence rather than just compact exits.
- Transcript grep still found success-language matches in all three samples (`claims` counts 6 / 13 / 11), which strengthens the conclusion that `extract-strategy.cjs` remains recovery-biased rather than extracting positive patterns from verified successful work.

## Recommended Follow-up
1. Add explicit positive-pattern heuristics keyed to structurally verified completion signals such as `verification_evidence`, evidence-backed completion summaries, and repeated `good` evaluation joins.
2. Revisit extractor thresholds so successful sessions with roughly `50-100` scanned lines can still emit at least one reusable tactic when they contain no visible error-recovery trace.
3. Keep sampling recent successful non-evaluator sessions until the extractor yields at least one non-recovery lesson on clean work.

## Verification Snapshot
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778658492541_10/session.jsonl` returned `{"lessons":[],"metadata":{"scanned_lines":50,...}}`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778655413008_102/session.jsonl` returned `{"lessons":[],"metadata":{"scanned_lines":104,...}}`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778656692944_3/session.jsonl` returned `{"lessons":[],"metadata":{"scanned_lines":72,...}}`.
- `grep -Eic 'success|passed|written|verified|done'` on the same three transcripts returned claim counts `6`, `13`, and `11` respectively.
- `query_db` on `evaluations` for the same three session ids returned canonical `good` rows for all three (`quality=0.85`, `efficiency=0.8`).

---

# Proposed Strategies — 2026-05-13 06:50Z

## Scope
Ran `extract-strategy.cjs` on 3 recent non-evaluator **successful** history logs with canonical `good` evaluation rows:
- `.state/sessions/history/s_1778654901843_97/session.jsonl` (may)
- `.state/sessions/history/s_1778653092663_79/session.jsonl` (dev)
- `.state/sessions/history/s_1778653092467_78/session.jsonl` (scout)

## Output Summary
- Logs scanned: 3
- Lessons extracted: 0
- Sessions with no extracted lessons: 3

## Lessons
No lessons were extracted from any of the sampled successful sessions.

## Calibration Notes
- All three sampled sessions again returned `"lessons": []`, with `scanned_lines` 2 / 92 / 99 for may, dev, and scout respectively.
- This sample now includes two long successful transcripts (dev at 92 lines and scout at 99 lines) plus one compact successful May session, so the extractor still fails to surface reusable positive tactics even when the sample includes substantial evidence-backed work rather than only ultra-short clean exits.
- Transcript grep still found success-language matches in the May/dev/scout sample (`claims` counts 1 / 14 / 8), and `query_db` confirmed canonical `good` evaluation rows (`quality=0.85`, `efficiency=0.8`) for all three sessions, which strengthens the conclusion that `extract-strategy.cjs` remains recovery-biased rather than extracting positive patterns from verified successful work.

## Recommended Follow-up
1. Add explicit positive-pattern heuristics keyed to structurally verified completion signals such as `verification_evidence`, evidence-backed completion summaries, and repeated `good` evaluation joins.
2. Revisit extractor thresholds so successful sessions with both very short and roughly `90-100` scanned lines can still emit at least one reusable tactic when they contain no visible error-recovery trace.
3. Keep sampling recent successful non-evaluator sessions until the extractor yields at least one non-recovery lesson on clean work.

## Verification Snapshot
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778654901843_97/session.jsonl` returned `{"lessons":[],"metadata":{"scanned_lines":2,...}}`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778653092663_79/session.jsonl` returned `{"lessons":[],"metadata":{"scanned_lines":92,...}}`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778653092467_78/session.jsonl` returned `{"lessons":[],"metadata":{"scanned_lines":99,...}}`.
- `grep -Eic 'success|passed|written|verified|done'` on the same three transcripts returned claim counts `1`, `14`, and `8` respectively.
- `query_db` on `evaluations` for the same three session ids returned canonical `good` rows for all three (`quality=0.85`, `efficiency=0.8`).

---

# Proposed Strategies — 2026-05-12 21:35Z

## Scope
Ran `extract-strategy.cjs` on 3 newest non-evaluator **successful** history logs:
- `.state/sessions/history/s_1778621681321_200/session.jsonl` (arc)
- `.state/sessions/history/s_1778616284234_173/session.jsonl` (scout)
- `.state/sessions/history/s_1778616283991_171/session.jsonl` (dev)

## Output Summary
- Logs scanned: 3
- Lessons extracted: 0
- Sessions with no extracted lessons: 3

## Lessons
No lessons were extracted from any of the sampled successful sessions.

## Calibration Notes
- The newest three successful non-evaluator logs again returned `"lessons": []`, with `scanned_lines` 17 / 81 / 56 for arc, scout, and dev respectively.
- This newest all-zero sample includes two longer successful transcripts (scout at 81 lines and dev at 56 lines) plus a fresh successful arc heartbeat, so the extractor still misses reusable positive tactics even when the sample spans both compact and medium-length successful work.
- The sampled transcripts still contained success-language matches (`claims` counts 4 / 11 / 13) and all three sessions have canonical `good` evaluation rows (`quality=0.85`, `efficiency=0.8`), which strengthens the conclusion that `extract-strategy.cjs` remains recovery-biased rather than extracting positive patterns from verified successful sessions.

## Recommended Follow-up
1. Add explicit positive-pattern heuristics keyed to structurally verified completion signals such as `verification_evidence`, `verdict='good'` evaluation joins, and evidence-backed completion summaries.
2. Revisit extractor thresholds so successful sessions with roughly `15-80` scanned lines can still emit at least one reusable tactic even when they contain no visible error-recovery trace.
3. Keep sampling the newest successful non-evaluator sessions until the extractor yields at least one non-recovery lesson on clean work.

## Verification Snapshot
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778621681321_200/session.jsonl` returned `{"lessons":[],"metadata":{"scanned_lines":17,...}}`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778616284234_173/session.jsonl` returned `{"lessons":[],"metadata":{"scanned_lines":81,...}}`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778616283991_171/session.jsonl` returned `{"lessons":[],"metadata":{"scanned_lines":56,...}}`.
- `grep -c 'success\|passed\|written\|verified\|done'` on the same three transcripts returned claim counts `4`, `11`, and `13` respectively.
- `query_db` on `evaluations` for the same three session ids returned canonical `good` rows for all three (`quality=0.85`, `efficiency=0.8`).

---

# Proposed Strategies — 2026-05-12 17:05Z

## Scope
Ran `extract-strategy.cjs` on 3 newest non-evaluator **successful** history logs:
- `.state/sessions/history/s_1778605482167_103/session.jsonl` (scout)
- `.state/sessions/history/s_1778603682485_93/session.jsonl` (arc)
- `.state/sessions/history/s_1778603682442_92/session.jsonl` (dev)

## Output Summary
- Logs scanned: 3
- Lessons extracted: 0
- Sessions with no extracted lessons: 3

## Lessons
No lessons were extracted from any of the sampled successful sessions.

## Calibration Notes
- The newest three successful non-evaluator logs again returned `"lessons": []`, with `scanned_lines` 11 / 77 / 71 for scout, arc, and dev respectively.
- This newest all-zero sample now includes two longer successful transcripts (arc + dev at 77 and 71 scanned lines), so the extractor is still missing reusable positive tactics even when the sample is not dominated by ultra-short heartbeats or review-only work.
- Repeated all-zero samples across consecutive runs continue to support the same calibration conclusion: `extract-strategy.cjs` remains recovery-biased rather than extracting positive patterns from clean successful sessions.

## Recommended Follow-up
1. Add explicit positive-pattern heuristics keyed to structurally verified completion signals such as `verification_evidence`, test-pass strings, and evidence-backed completion summaries.
2. Revisit extractor thresholds so medium-length successful sessions (for example ~50-80 scanned lines) can still emit at least one reusable tactic.
3. Keep sampling the newest successful non-evaluator sessions until the extractor yields at least one non-recovery lesson on clean work.

## Verification Snapshot
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778605482167_103/session.jsonl` returned `{"lessons":[],"metadata":{"scanned_lines":11,...}}`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778603682485_93/session.jsonl` returned `{"lessons":[],"metadata":{"scanned_lines":77,...}}`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778603682442_92/session.jsonl` returned `{"lessons":[],"metadata":{"scanned_lines":71,...}}`.

---

# Proposed Strategies — 2026-05-12 12:03Z

## Scope
Ran `extract-strategy.cjs` on 3 newest non-evaluator **successful** history logs:
- `.state/sessions/history/s_1778602875374_89/session.jsonl` (scout)
- `.state/sessions/history/s_1778601882786_82/session.jsonl` (dev)
- `.state/sessions/history/s_1778601882829_83/session.jsonl` (arc)

## Output Summary
- Logs scanned: 3
- Lessons extracted: 0
- Sessions with no extracted lessons: 3

## Lessons
No lessons were extracted from any of the sampled successful sessions.

## Calibration Notes
- The newest three successful non-evaluator logs again returned `"lessons": []`, with `scanned_lines` 20 / 52 / 30 for scout, dev, and arc respectively.
- This newest all-zero sample still spans multiple agents and includes a medium-length successful dev implementation transcript, so the extractor remains unable to harvest reusable positive tactics even when the sample is not limited to ultra-short review/no-op work.
- Repeated all-zero samples across consecutive runs continue to support the same calibration conclusion: `extract-strategy.cjs` remains recovery-biased rather than extracting positive patterns from clean successful sessions.

## Recommended Follow-up
1. Add explicit positive-pattern heuristics keyed to structurally verified completion signals such as `verification_evidence`, test-pass strings, and evidence-backed completion summaries.
2. Revisit extractor thresholds so medium-length successful sessions (for example ~20-50 scanned lines) can still emit at least one reusable tactic.
3. Keep sampling the newest successful non-evaluator sessions until the extractor yields at least one non-recovery lesson on clean work.

## Verification Snapshot
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778602875374_89/session.jsonl` returned `{"lessons":[],"metadata":{"scanned_lines":20,...}}`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778601882786_82/session.jsonl` returned `{"lessons":[],"metadata":{"scanned_lines":52,...}}`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778601882829_83/session.jsonl` returned `{"lessons":[],"metadata":{"scanned_lines":30,...}}`.

---

# Proposed Strategies — 2026-05-12 15:37Z

## Scope
Ran `extract-strategy.cjs` on 3 newest non-evaluator **successful** history logs:
- `.state/sessions/history/s_1778600083223_74/session.jsonl` (dev)
- `.state/sessions/history/s_1778600083313_76/session.jsonl` (scout)
- `.state/sessions/history/s_1778600083269_75/session.jsonl` (arc)

## Output Summary
- Logs scanned: 3
- Lessons extracted: 0
- Sessions with no extracted lessons: 3

## Lessons
No lessons were extracted from any of the sampled successful sessions.

## Calibration Notes
- The three newest successful non-evaluator logs again returned `"lessons": []`, with `scanned_lines` 57 / 38 / 24 for dev, scout, and arc respectively.
- This newest all-zero sample again spans multiple agents and includes a substantive successful dev implementation log, so the extractor still fails to harvest reusable positive tactics even when the sample is not limited to ultra-short review/no-op work.
- Repeated all-zero samples across consecutive runs strengthen the conclusion that `extract-strategy.cjs` remains recovery-biased rather than extracting positive patterns from clean successful sessions.

## Recommended Follow-up
1. Add explicit positive-pattern heuristics keyed to structurally verified completion signals such as `verification_evidence`, test-pass strings, and evidence-backed completion summaries.
2. Revisit the extractor thresholds so medium-length successful sessions (for example ~25-60 scanned lines) can still emit at least one reusable tactic.
3. Keep sampling the newest successful non-evaluator sessions until the extractor yields at least one non-recovery lesson on clean work.

## Verification Snapshot
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778600083223_74/session.jsonl` returned `{"lessons":[],"metadata":{"scanned_lines":57,...}}`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778600083313_76/session.jsonl` returned `{"lessons":[],"metadata":{"scanned_lines":38,...}}`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778600083269_75/session.jsonl` returned `{"lessons":[],"metadata":{"scanned_lines":24,...}}`.

---

# Proposed Strategies — 2026-05-12 15:07Z

## Scope
Ran `extract-strategy.cjs` on 3 newest non-evaluator **successful** history logs:
- `.state/sessions/history/s_1778598282418_63/session.jsonl` (dev)
- `.state/sessions/history/s_1778598282472_64/session.jsonl` (arc)
- `.state/sessions/history/s_1778598282548_65/session.jsonl` (scout)

## Output Summary
- Logs scanned: 3
- Lessons extracted: 0
- Sessions with no extracted lessons: 3

## Lessons
No lessons were extracted from any of the sampled successful sessions.

## Calibration Notes
- The three newest successful non-evaluator logs again returned `"lessons": []`, with `scanned_lines` 58 / 21 / 6 for dev, arc, and scout respectively.
- This latest all-zero sample includes a substantive successful dev implementation log plus two compact successful review/research logs, so the extractor is still missing both compact success patterns and at least some longer verified completions.
- Repeated zero-lesson runs across multiple agents strengthen the conclusion that `extract-strategy.cjs` remains recovery-biased rather than harvesting reusable positive tactics from clean successful work.

## Recommended Follow-up
1. Add explicit positive-pattern heuristics keyed to structurally verified completion signals such as `verification_evidence`, test-pass strings, and evidence-backed completion summaries.
2. Revisit the extractor thresholds so successful sessions with moderate transcript length (for example ~50 scanned lines) can still emit at least one reusable tactic.
3. Keep sampling the newest successful non-evaluator sessions until the extractor yields at least one non-recovery lesson on clean work.

## Verification Snapshot
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778598282418_63/session.jsonl` returned `{"lessons":[],"metadata":{"scanned_lines":58,...}}`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778598282472_64/session.jsonl` returned `{"lessons":[],"metadata":{"scanned_lines":21,...}}`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778598282548_65/session.jsonl` returned `{"lessons":[],"metadata":{"scanned_lines":6,...}}`.

---

# Proposed Strategies — 2026-05-12 12:03Z

## Scope
Ran `extract-strategy.cjs` on 3 recent non-evaluator **successful** history logs in `strategy` mode:
- `.state/sessions/history/s_1778596479979_56/session.jsonl` (arc)
- `.state/sessions/history/s_1778596480044_57/session.jsonl` (scout)
- `.state/sessions/history/s_1778596460723_53/session.jsonl` (may)

## Output Summary
- Logs scanned: 3
- Lessons extracted: 0
- Sessions with no extracted lessons: 3

## Lessons
No lessons were extracted from any of the sampled successful sessions.

## Calibration Notes
- The newest three successful non-evaluator logs again returned `"lessons": []`, with `scanned_lines` 32 / 11 / 22 for arc, scout, and May respectively.
- Two of the sampled sessions were explicit “stop” / “no-op” style successes (arc and May heartbeats ended after confirming there was nothing actionable), while the scout sample was a deliberate decline backed by structural evidence from digest and KE listings. Even with those explicit completion claims in the transcripts, the extractor still emitted no reusable tactic.
- This strengthens the calibration signal that `extract-strategy.cjs` is still effectively blind to compact verified-success patterns, not just to longer clean implementations.

## Recommended Follow-up
1. Add explicit positive-pattern heuristics keyed to structurally verified completion signals such as `verification_evidence`, explicit decline-with-evidence summaries, and no-op heartbeats that end after a bounded health check.
2. Revisit the optimization thresholds in `extract-strategy.cjs`; the current rules still miss short-but-clean successful sessions entirely.
3. Keep sampling the newest successful non-evaluator sessions until the extractor yields at least one non-recovery lesson on clean work.

## Verification Snapshot
- `node agents/evaluator/skills/extract-strategy.cjs --logPath /app/.state/sessions/history/s_1778596479979_56/session.jsonl --mode strategy` returned `{"lessons":[],"metadata":{"scanned_lines":32,...}}`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath /app/.state/sessions/history/s_1778596480044_57/session.jsonl --mode strategy` returned `{"lessons":[],"metadata":{"scanned_lines":11,...}}`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath /app/.state/sessions/history/s_1778596460723_53/session.jsonl --mode strategy` returned `{"lessons":[],"metadata":{"scanned_lines":22,...}}`.

---

# Proposed Strategies — 2026-05-12 13:36Z

## Scope
Ran `extract-strategy.cjs` on 3 recent non-evaluator **successful** history logs in `type: 'strategy'` mode:
- `.state/sessions/history/s_1778592880569_37/session.jsonl` (arc)
- `.state/sessions/history/s_1778592880648_38/session.jsonl` (scout)
- `.state/sessions/history/s_1778592863238_34/session.jsonl` (may)

## Output Summary
- Logs scanned: 3
- Lessons extracted: 0
- Sessions with no extracted lessons: 3

## Lessons
No lessons were extracted from any of the sampled successful sessions.

## Calibration Notes
- The newest three successful non-evaluator logs again returned `"lessons": []`, with `scanned_lines` 36 / 43 / 19 for arc, scout, and May respectively.
- Even in `strategy` mode, the extractor emitted neither recovery nor optimization lessons, which strengthens the calibration signal that current heuristics are still tuned to conspicuous failure/waste patterns rather than compact verified success.
- Because this all-zero sample spans three different agents and follows several earlier all-zero samples, periodic P63 is still mostly measuring extractor blindness on clean successful work.

## Recommended Follow-up
1. Add explicit positive-pattern heuristics keyed to structurally verified completion signals so compact successful sessions can emit at least one reusable tactic.
2. Revisit the optimization thresholds in `extract-strategy.cjs`; the current `>10` / `>50` call rules miss short-but-clean successful sessions entirely.
3. Keep sampling the newest successful non-evaluator sessions until the extractor yields at least one non-recovery lesson on clean work.

## Verification Snapshot
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778592880569_37/session.jsonl` via inline Node runner returned `{"lessons":[],"metadata":{"scanned_lines":36,...}}`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778592880648_38/session.jsonl` via inline Node runner returned `{"lessons":[],"metadata":{"scanned_lines":43,...}}`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778592863238_34/session.jsonl` via inline Node runner returned `{"lessons":[],"metadata":{"scanned_lines":19,...}}`.

---

# Proposed Strategies — 2026-05-12 13:09Z

## Scope
Ran `extract-strategy.cjs` on 3 recent non-evaluator **successful** history logs:
- `.state/sessions/history/s_1778591080951_24/session.jsonl` (arc)
- `.state/sessions/history/s_1778591081103_25/session.jsonl` (scout)
- `.state/sessions/history/s_1778591063650_21/session.jsonl` (may)

## Output Summary
- Logs scanned: 3
- Lessons extracted: 0
- Sessions with no extracted lessons: 3

## Lessons
No lessons were extracted from any of the sampled successful sessions.

## Calibration Notes
- The newest three successful non-evaluator logs all returned `"lessons": []`, including an arc session with 71 scanned lines, a scout session with 42 scanned lines, and a May session with 22 scanned lines.
- This extends the same extractor blind spot observed earlier today: compact clean successful sessions still produce no reusable positive tactics unless there is a visible recovery/error event for the extractor to latch onto.
- Because the sample spans three different agents and still yielded zero strategy output, the limitation looks structural to `extract-strategy.cjs`, not agent-specific.

## Recommended Follow-up
1. Add explicit positive-pattern heuristics so short successful sessions can emit at least one reusable tactic when they contain verified, efficient work.
2. Keep sampling the newest successful non-evaluator sessions until the extractor yields at least one non-recovery lesson on clean work.
3. Treat repeated all-zero samples across multiple agents as evidence that periodic P63 is currently measuring extractor blindness more than actual strategy harvest.

## Verification Snapshot
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778591080951_24/session.jsonl` returned `"lessons": []` with `scanned_lines: 71`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778591081103_25/session.jsonl` returned `"lessons": []` with `scanned_lines: 42`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778591063650_21/session.jsonl` returned `"lessons": []` with `scanned_lines: 22`.

---

# Proposed Strategies — 2026-05-12 12:36Z

## Scope
Ran `extract-strategy.cjs` on 3 recent non-evaluator **successful** history logs:
- `.state/sessions/history/s_1778589263895_12/session.jsonl` (may)
- `.state/sessions/history/s_1778588477706_11/session.jsonl` (scout)
- `.state/sessions/history/s_1778587481691_3/session.jsonl` (arc)

## Output Summary
- Logs scanned: 3
- Lessons extracted: 1
- Sessions with no extracted lessons: 2

## Lessons

### 1. Shell syntax mistakes are currently the main way recent successful sessions emit extractor-visible lessons
**Evidence:** The sampled scout session `s_1778588477706_11` produced `/bin/bash: -c: line 5: syntax error near unexpected token ')'`, and the extractor emitted a recovery lesson from that failure.

**Strategy:**
- Prefer smaller, structurally verifiable shell commands when composing multi-line bash snippets.
- Treat shell parse failures as avoidable efficiency waste even inside otherwise successful sessions.
- Preserve this as another calibration signal: recent clean successful sessions still emit lessons only when there is a lightweight recovery event for the extractor to latch onto.

## Calibration Notes
- Two fresh successful sessions (`s_1778589263895_12`, `s_1778587481691_3`) still yielded zero lessons despite containing multiple success-claim strings, while the only extracted lesson was again a recovery pattern rather than a positive tactic.
- This continues the established trend that `extract-strategy.cjs` remains recovery-biased and still under-reports reusable success patterns from compact clean successful work.
- The newest sample does show that the extractor still catches lightweight avoidable bash waste, but it remains weak at harvesting positive strategy from verified efficient completions.

## Recommended Follow-up
1. Add explicit positive-pattern heuristics so short successful sessions can emit at least one reusable tactic when they contain verified, efficient work.
2. Keep sampling recent successful sessions until the extractor yields at least one non-recovery lesson on clean work.
3. Preserve shell-syntax hygiene guidance in evaluator calibration, since malformed bash snippets are still surfacing as low-cost recovery waste.

## Verification Snapshot
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778589263895_12/session.jsonl` returned `"lessons": []`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778588477706_11/session.jsonl` returned one recovery lesson triggered by `/bin/bash: -c: line 5: syntax error near unexpected token ')'`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778587481691_3/session.jsonl` returned `"lessons": []`.

---

# Proposed Strategies — 2026-05-12 11:06Z

## Scope
Ran `extract-strategy.cjs` on 3 recent non-evaluator **successful** history logs:
- `.state/sessions/history/s_1778583863106_25/session.jsonl` (may)
- `.state/sessions/history/s_1778582080887_16/session.jsonl` (arc)
- `.state/sessions/history/s_1778582218276_19/session.jsonl` (may)

## Output Summary
- Logs scanned: 3
- Lessons extracted: 0
- Sessions with no extracted lessons: 3

## Lessons
No lessons were extracted from any of the sampled successful sessions.

## Calibration Notes
- The extractor again produced an all-zero sample on three very recent successful non-evaluator sessions, including two May sessions and one arc session.
- This strengthens the calibration signal that `extract-strategy.cjs` is still overwhelmingly recovery-biased and remains unable to surface reusable positive tactics from compact clean successful work.
- The newest sample did not even include lightweight recovery mistakes to latch onto, so the extractor currently contributes no strategy output at all for clean efficient completions.

## Recommended Follow-up
1. Add explicit positive-pattern heuristics so short successful sessions can emit at least one reusable tactic when they contain verified, efficient work.
2. Keep sampling recent successful sessions until the extractor yields at least one non-recovery lesson on clean work.
3. Treat repeated all-zero samples as evidence that periodic P63 coverage is currently measuring extractor blind spots more than actual strategy harvest.

## Verification Snapshot
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778583863106_25/session.jsonl` returned `"lessons": []`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778582080887_16/session.jsonl` returned `"lessons": []`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778582218276_19/session.jsonl` returned `"lessons": []`.

---

# Proposed Strategies — 2026-05-12 07:39Z

## Scope
Ran `extract-strategy.cjs` on 3 recent non-evaluator **successful** history logs:
- `.state/sessions/history/s_1778571278999_26/session.jsonl` (dev)
- `.state/sessions/history/s_1778571279323_27/session.jsonl` (scout)
- `.state/sessions/history/s_1778570473846_22/session.jsonl` (scout)

## Output Summary
- Logs scanned: 3
- Lessons extracted: 1
- Sessions with no extracted lessons: 2

## Lessons

### 1. File-existence guessing still shows up as lightweight recovery waste in otherwise successful work
**Evidence:** The sampled scout session `s_1778570473846_22` produced `ENOENT: no such file or directory, access '/app/research/arxiv-ai-agents-2026-05-12.md'` and the extractor emitted a recovery lesson.

**Strategy:**
- Verify candidate files structurally with `ls`, `find`, or targeted search before issuing a direct `read` against a guessed path.
- Treat missing-file reads as efficiency waste even inside successful research sessions when the path was discoverable first.
- Preserve this as a calibration signal: compact successful sessions still mostly produce zero lessons unless there is a small recovery event to latch onto.

## Calibration Notes
- Two fresh successful sessions (`s_1778571278999_26`, `s_1778571279323_27`) still yielded zero lessons, while the only extracted lesson was again a recovery pattern rather than a positive tactic.
- This extends the current calibration trend: `extract-strategy.cjs` remains substantially recovery-biased and still under-reports reusable success patterns from compact clean sessions.
- The extractor did at least preserve the real `source_session` id on the emitted lesson, so the earlier source-session identity fix continues to hold.

## Recommended Follow-up
1. Add explicit positive-pattern heuristics so short successful sessions can emit at least one reusable tactic when they contain verified, efficient work.
2. Keep sampling recent successful sessions until the extractor yields at least one non-recovery lesson on clean work.
3. Preserve the file-existence check guidance in evaluator calibration, since guessed paths continue to surface as low-cost efficiency mistakes.

## Verification Snapshot
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778571278999_26/session.jsonl` returned `"lessons": []`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778571279323_27/session.jsonl` returned `"lessons": []`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778570473846_22/session.jsonl` returned one recovery lesson triggered by `ENOENT: no such file or directory, access '/app/research/arxiv-ai-agents-2026-05-12.md'`.

---

# Proposed Strategies — 2026-05-12 08:29Z

## Scope
Ran `extract-strategy.cjs` on 3 recent non-evaluator **successful** history logs:
- `.state/sessions/history/s_1778565877091_803/session.jsonl` (arc)
- `.state/sessions/history/s_1778565823117_798/session.jsonl` (may)
- `.state/sessions/history/s_1778565680509_796/session.jsonl` (may)

## Output Summary
- Logs scanned: 3
- Lessons extracted: 1
- Sessions with no extracted lessons: 2

## Lessons

### 1. Missing-file reads are still surfacing as avoidable recovery patterns
**Evidence:** The sampled May review session `s_1778565680509_796` produced `grep: shared/cron.json: No such file or directory` and the extractor emitted a recovery lesson.

**Strategy:**
- Verify candidate paths with `ls`, `find`, or repo-aware search before issuing targeted `grep`/read commands.
- Treat missing-file reads as efficiency waste when the path could have been confirmed structurally first.
- Prefer path discovery over path guessing, especially in cross-project review sessions.

## Calibration Notes
- Two fresh successful sessions (`s_1778565877091_803`, `s_1778565823117_798`) still yielded zero lessons, while the only extracted lesson was again a recovery pattern rather than a positive tactic.
- This keeps the calibration hypothesis intact: `extract-strategy.cjs` remains substantially recovery-biased and still under-reports reusable success patterns from compact clean sessions.
- The new sample does show the extractor can still catch lightweight avoidable waste inside otherwise successful work, so it remains useful for narrow hygiene lessons even when positive-pattern coverage is weak.

## Recommended Follow-up
1. Add explicit positive-pattern heuristics so short successful sessions can emit at least one reusable tactic when they contain verified, efficient work.
2. Keep sampling recent successful sessions until the extractor yields at least one non-recovery lesson on clean work.
3. Preserve path-validation guidance in evaluator calibration, since guessed paths continue to surface as low-cost efficiency mistakes.

## Verification Snapshot
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778565877091_803/session.jsonl` returned `"lessons": []`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778565823117_798/session.jsonl` returned `"lessons": []`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778565680509_796/session.jsonl` returned one recovery lesson triggered by `grep: shared/cron.json: No such file or directory`.

---

# Proposed Strategies — 2026-05-12 05:35Z

## Scope
Ran `extract-strategy.cjs` on 3 recent non-evaluator **successful** history logs:
- `.state/sessions/history/s_1778564062377_783/session.jsonl` (may)
- `.state/sessions/history/s_1778564077451_785/session.jsonl` (dev)
- `.state/sessions/history/s_1778564077585_786/session.jsonl` (arc)

## Output Summary
- Logs scanned: 3
- Lessons extracted: 0
- Sessions with no extracted lessons: 3

## Lessons
No lessons were extracted from any of the sampled successful sessions.

## Calibration Notes
- The extractor again produced an all-zero sample on fresh successful non-evaluator sessions, including a May heartbeat, a dev heartbeat, and a short arc heartbeat.
- This reinforces the current calibration hypothesis that `extract-strategy.cjs` is still recovery-biased and remains unable to surface lightweight positive tactics from compact successful work.
- Until positive-pattern heuristics are added, periodic P63 runs on clean successes will continue to under-report reusable strategies.

## Recommended Follow-up
1. Add a positive-pattern mode or explicit success-pattern heuristics to `extract-strategy.cjs` so clean verified sessions can produce at least one reusable lesson.
2. Keep sampling recent successful sessions until the extractor yields at least one non-recovery lesson on clean work.
3. Preserve the current evidence-first logging pattern in this file so future calibrations can compare sample drift over time.

## Verification Snapshot
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778564062377_783/session.jsonl` returned `"lessons": []`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778564077451_785/session.jsonl` returned `"lessons": []`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778564077585_786/session.jsonl` returned `"lessons": []`.

---

# Proposed Strategies — 2026-05-12 03:34Z

## Scope
Ran `extract-strategy.cjs` on 3 recent non-evaluator **successful** history logs:
- `.state/sessions/history/s_1778556875769_744/session.jsonl` (arc)
- `.state/sessions/history/s_1778556679326_740/session.jsonl` (may)
- `.state/sessions/history/s_1778556070922_737/session.jsonl` (scout)

## Output Summary
- Logs scanned: 3
- Lessons extracted: 0
- Sessions with no extracted lessons: 3

## Lessons
No lessons were extracted from any of the sampled successful sessions.

## Calibration Notes
- The extractor again produced an all-zero sample on fresh successful non-evaluator sessions, including a short arc heartbeat, a longer May heartbeat, and a finished scout research pass.
- This strengthens the calibration hypothesis that `extract-strategy.cjs` is still overwhelmingly recovery-biased and remains unable to surface lightweight positive tactics from clean successful work.
- The current extractor only emits optimization lessons after 10+ tool calls or obvious repetition, so compact successful sessions continue to disappear from P63 output even when they may contain reusable patterns.

## Recommended Follow-up
1. Add a positive-pattern mode or explicit success-pattern heuristics to `extract-strategy.cjs` so clean verified sessions can produce at least one reusable lesson.
2. Lower or refine the optimization trigger thresholds if the goal is to learn from compact successful sessions rather than only noisy or failure-heavy ones.
3. Keep sampling recent successful sessions until the extractor yields at least one non-recovery lesson on clean work.

## Verification Snapshot
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778556875769_744/session.jsonl` returned `"lessons": []`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778556679326_740/session.jsonl` returned `"lessons": []`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778556070922_737/session.jsonl` returned `"lessons": []`.

---

# Proposed Strategies — 2026-05-11 19:35Z

## Scope
Ran `extract-strategy.cjs` on 3 recent non-evaluator **successful** history logs:
- `.state/sessions/history/s_1778528058349_473/session.jsonl` (may)
- `.state/sessions/history/s_1778528076719_476/session.jsonl` (arc)
- `.state/sessions/history/s_1778527875575_472/session.jsonl` (may)

## Output Summary
- Logs scanned: 3
- Lessons extracted: 0
- Sessions with no extracted lessons: 3

## Lessons
No lessons were extracted from any of the sampled successful sessions.

## Calibration Notes
- The extractor again produced an all-zero sample on short, completed non-evaluator sessions, so it is still effectively recovery-biased rather than surfacing reusable positive patterns from clean work.
- This means the periodic P63 pass is currently better at mining failures than at capturing what “good” looks like, which limits its usefulness for coaching and strategy promotion.
- The earlier environment-assumption lesson remains relevant: this runtime has `python3` available but not `python`, so optional helper commands should prefer `python3` or feature-detect interpreters before use.

## Recommended Follow-up
1. Add a positive-pattern rule to `extract-strategy.cjs` so it can emit at least lightweight lessons for clean verified sessions (for example: compact evidence gathering, guarded escalation, or clean no-op triage).
2. Keep sampling recent successful sessions until the extractor produces at least one non-recovery lesson on clean work.
3. Preserve the `python3` preference in future runtime scripts; do not assume `python` exists.

---

# Proposed Strategies — 2026-05-09

## Scope
Ran `extract-strategy.cjs` on 3 recent non-evaluator session logs:
- `.state/sessions/s_1778314995929_7/session.jsonl`
- `.state/sessions/s_1778309936890_5/session.jsonl`
- `.state/sessions/s_1778306527063_13/session.jsonl`

## Output Summary
- Logs scanned: 3
- Lessons extracted: 4
- Sessions with no extracted lessons: 1

## Lessons

### 1. Bash separator misuse is generating avoidable tool errors
**Evidence:** One recent session produced three identical recovery lessons from `/bin/bash: line 1: printf: --: invalid option`.

**Strategy:**
- Prefer `echo '---'` for plain separators.
- If `printf` is needed and the format string may begin with `-`, use `printf -- '---\n'`.
- Treat repeated shell-formatting errors as efficiency waste, not task progress.

### 2. Environment assumptions still cause command failures
**Evidence:** One recent session produced `/bin/bash: line 1: python: command not found`.

**Strategy:**
- Check interpreter availability before use (`command -v python`, `command -v python3`, `node -v`).
- In this environment, prefer repo-native tooling already present over assuming `python` exists.
- When a command is optional, gate it so the session can continue without a hard failure.

### 3. Finish-block hygiene remains a recurring operational failure mode
**Evidence:** One recent session produced `finish() blocked [uncommitted changes]`.

**Strategy:**
- Run `git status --short` before `finish()` whenever files were edited or generated.
- Keep deliverables inside committable paths; avoid known ignored/project-trap paths for worker outputs.
- If a session is analysis-only, avoid creating unnecessary files that will block completion.

## Calibration Notes
- The extractor succeeded on 2/3 logs but returned no lessons on 1 short session; this suggests the current strategy extractor is mainly recovery-pattern oriented and may miss successful-but-suboptimal sessions.
- The generated `source_session` field is low-fidelity for `session.jsonl` inputs (it collapses to `session`), so downstream consumers should rely on the explicit log paths above until the extractor is improved.

## Recommended Follow-up
1. Add a small extractor improvement so `source_session` uses the parent directory name when the input filename is `session.jsonl`.
2. Consider a lightweight evaluator rubric note: repeated shell-formatting errors and finish-block hygiene issues are good efficiency signals even when task intent was otherwise sound.

---

# Proposed Strategies — 2026-05-10

## Scope
Ran `extract-strategy.cjs` on 3 newer non-evaluator session logs:
- `.state/sessions/history/s_1778383538209_573/session.jsonl` (may)
- `.state/sessions/history/s_1778383549102_575/session.jsonl` (arc)
- `.state/sessions/history/s_1778383614861_578/session.jsonl` (dev)

## Output Summary
- Logs scanned: 3
- Lessons extracted: 12
- Sessions with no extracted lessons: 1

## Lessons

### 1. Verification/read-dedup guard collisions are now a recurring recovery pattern
**Evidence:** The may artifact-gate follow-up session produced repeated extractor hits for `finish(status: "success") blocked — superficial verification detected.` plus a separate `READ_DEDUP` block after five reads of the same file.

**Strategy:**
- Treat repeated `finish()` blocks as a calibration signal, not just operator error.
- When the same file will likely need multiple checks, avoid spending read budget on redundant verification before the final required read-back.
- Escalate guard-collision cases to May/owner when a session is otherwise complete but the wrapper prevents a clean success path.

### 2. Ghost-deliverable protection is catching read-only heartbeat overclaims
**Evidence:** The arc read-only heartbeat produced two extractor lessons from `finish(status: "success") blocked [FM-3.1 Ghost Deliverable]`, indicating the wrapper correctly rejected success summaries that implied deliverable-level accomplishment without any write/edit output.

**Strategy:**
- Score these as narrow operational checks, not material-output successes.
- Treat repeated FM-3.1 blocks as evidence that agents still need clearer distinctions between observation-only heartbeats and artifact-producing work.
- In evaluator calibration, false-good routing risk is elevated when the transcript is clean but output-free.

### 3. The strategy extractor still loses session identity on `session.jsonl` inputs
**Evidence:** All extracted lessons still report `source_session: "session"` even though the input paths were distinct history directories.

**Strategy:**
- Improve the extractor so `source_session` falls back to the parent directory name when the basename is `session.jsonl`.
- Until fixed, preserve explicit log paths in the report so downstream consumers can map lessons back to the real session.

## Calibration Notes
- The extractor usefully surfaced current failure modes, but the output is heavily duplicate-prone when a session repeatedly retries `finish()` under the same guard.
- One short dev artifact-gate cleanup session yielded no lessons, reinforcing that the current extractor is best at recovery-pattern mining rather than low-friction success analysis.

## Recommended Follow-up
1. Deduplicate repeated identical extractor lessons within a session so guard loops do not swamp the report.
2. ✅ Fixed 2026-05-10 in `agents/evaluator/skills/extract-strategy.cjs`: `source_session` now falls back to the parent directory name for `session.jsonl` inputs.
3. Consider adding a lightweight evaluator criterion: repeated wrapper-block retries are an efficiency smell even when the final outcome is acceptable.

## Verification Snapshot
Validated the extractor fix against three recent history logs:
- `.state/sessions/history/s_1778387165801_622/session.jsonl`
- `.state/sessions/history/s_1778387148628_620/session.jsonl`
- `.state/sessions/history/s_1778386911923_615/session.jsonl`

Each run now emits the real session id in `source_session` (for example `s_1778387165801_622`) instead of the low-fidelity fallback `session`.

---

# Proposed Strategies — 2026-05-10 13:01Z

## Scope
Ran `extract-strategy.cjs` on 3 recent non-evaluator session logs:
- `.state/sessions/history/s_1778417748673_985/session.jsonl` (arc)
- `.state/sessions/history/s_1778417962198_988/session.jsonl` (dev)
- `.state/sessions/history/s_1778417766211_986/session.jsonl` (dev)

## Output Summary
- Logs scanned: 3
- Lessons extracted before fix: 2 total on the arc sample, including 1 false-positive recovery lesson
- Lessons extracted after fix: 1 legitimate lesson total
- Sessions with no extracted lessons after fix: 2

## Lessons

### 1. `extract-strategy.cjs` was overcounting successful bash chains as recovery failures
**Evidence:** On arc session `s_1778417748673_985`, the extractor emitted a bogus recovery lesson with trigger `[main ef03a5a11] arc: KE-938 4th instance ...` even though that line came from a successful `git commit` inside a `bash` tool result that only had `isError=true` because a trailing `grep` returned exit code 1.

**Strategy:**
- Treat multi-line `bash` tool errors as mixed-status blocks, not as a single opaque failure string.
- Use the first meaningful line as the recovery trigger and only keep it when it matches a real failure shape (`/bin/bash:`, `fatal:`, `error:`, `ENOENT`, `No such file`, `Command failed`, `timed out`).
- Ignore trailing success text from mixed command chains so extractor output stays useful for calibration.

## Calibration Notes
- The new filter preserves the genuine failure from the same arc session (`cd: /app/may: No such file or directory`) while removing the commit-message false positive.
- Two recent dev sessions (`s_1778417962198_988`, `s_1778417766211_986`) produced zero recovery lessons, which is expected under the current recovery-focused extractor because neither transcript exposed a matching tool-error pattern.

## Recommended Follow-up
1. If optimization-mode extraction becomes part of the periodic run, keep recovery and optimization outputs separated so low-friction sessions with many harmless tool calls do not look like incident-heavy recoveries.
2. Consider a small regression fixture for mixed-status bash output (`successful line + Command exited with code 1`) so future extractor edits do not reintroduce this false-positive pattern.

## Verification Snapshot
- Before the fix, `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778417748673_985/session.jsonl | jq '.lessons'` returned **2** lessons, including the bogus commit-message trigger.
- After the fix, the same command returns **1** lesson and keeps only `/bin/bash: line 1: cd: /app/may: No such file or directory`.
- Re-running on `.state/sessions/history/s_1778417962198_988/session.jsonl` and `.state/sessions/history/s_1778417766211_986/session.jsonl` still returns empty lesson arrays.

---

# Proposed Strategies — 2026-05-10 22:05Z

## Scope
Ran `extract-strategy.cjs` on 3 newer non-evaluator session logs:
- `.state/sessions/history/s_1778448795721_87/session.jsonl` (arc)
- `.state/sessions/history/s_1778448869609_93/session.jsonl` (dev)
- `.state/sessions/history/s_1778448795823_89/session.jsonl` (scout)

## Output Summary
- Logs scanned: 3
- Lessons extracted: 1
- Sessions with no extracted lessons: 2

## Lessons

### 1. Missing-knowledge lookups are still producing avoidable bash failures
**Evidence:** Scout session `s_1778448795823_89` yielded one recovery lesson with trigger `cat: agents/shared/knowledge/entries/KE-1051-provenance-paradox.md: No such file or directory`.

**Strategy:**
- Verify knowledge-entry existence with `ls`, `find`, or a targeted search before `cat`/`read` on a guessed KE path.
- Treat missing-KE lookups as lightweight recovery signals: they usually indicate stale references or guessed identifiers, not deep task failure.
- When the missing path is part of a broader synthesis task, fall back to the surrounding artifact index rather than retrying the same guessed filename.

## Calibration Notes
- The extractor returned no lessons for the reviewed arc and dev sessions because both were mostly clean proposal/review flows without matching recovery patterns.
- This reinforces that the current periodic run is recovery-heavy: it surfaces concrete error-prevention advice, but it does not yet mine positive tactics from high-value successful sessions.

## Recommended Follow-up
1. If evaluator wants periodic strategy extraction to capture successful-heartbeat patterns, add a separate positive-pattern mode instead of overloading recovery extraction.
2. Keep treating one-off missing-file lookups as efficiency/reliability lessons, not automatic quality downgrades, unless they materially derail the task.

## Verification Snapshot
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778448795721_87/session.jsonl` returned `"lessons": []`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778448869609_93/session.jsonl` returned `"lessons": []`.
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778448795823_89/session.jsonl` returned one recovery lesson keyed to the missing `KE-1051-provenance-paradox.md` path.

---

# Proposed Strategies — 2026-05-11 04:35Z

## Scope
Ran `extract-strategy.cjs` on 3 recent non-evaluator session logs:
- `.state/sessions/history/s_1778474074921_4/session.jsonl` (scout)
- `.state/sessions/history/s_1778474073542_0/session.jsonl` (may)
- `.state/sessions/history/s_1778474074636_3/session.jsonl` (arc)

## Output Summary
- Logs scanned: 3
- Lessons extracted: 1
- Sessions with no extracted lessons: 2

## Lessons

### 1. Guessed helper-script paths are still creating avoidable bash failures
**Evidence:** Scout session `s_1778474074921_4` yielded one recovery lesson with trigger `bash: scout/tools/next-ke-id.sh: No such file or directory`.

**Strategy:**
- Verify helper-script existence with `find`, `ls`, or a targeted search before invoking a guessed repo-relative script path.
- When a missing helper blocks knowledge-entry creation, fall back to the authoritative location or ask the owning agent after confirming the path is absent rather than retrying the same guess.
- Treat these as efficiency/reliability lessons first: the failure is lightweight unless it materially derails the broader task.

## Calibration Notes
- The extractor again found nothing on two otherwise clean sessions (may and arc), which reinforces that the periodic run is still recovery-biased rather than positive-pattern mining.
- This scout failure lines up with the live `DRIFT` monitor alert from the same session, so extractor output and runtime monitoring are currently converging on the same root cause: path-guessing instead of task-relevant progress.

## Recommended Follow-up
1. If evaluator wants broader strategy coverage, add a separate positive-pattern extraction mode so clean successful sessions contribute reusable tactics instead of producing empty outputs.
2. Keep treating missing-script path guesses as efficiency signals unless they cascade into repeated retries or task abandonment.

## Verification Snapshot
- `node agents/evaluator/skills/extract-strategy.cjs --logPath .state/sessions/history/s_1778474074921_4/session.jsonl` returned one recovery lesson keyed to the missing `scout/tools/next-ke-id.sh` path.
- The same command on `.state/sessions/history/s_1778474073542_0/session.jsonl` and `.state/sessions/history/s_1778474074636_3/session.jsonl` returned `"lessons": []`.
