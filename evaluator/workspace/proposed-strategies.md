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
