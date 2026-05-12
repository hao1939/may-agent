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
