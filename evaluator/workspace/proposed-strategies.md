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
