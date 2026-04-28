# Gym Leverage — Journal

## 2026-04-25 — Project Reset (clean separation)
Worker no longer sees project.md. Only reviewer manages milestones.
Worker receives focused task guidance, produces deliverables.

## 2026-04-26 — Gym Infrastructure Bugs Fixed + context-learning PASSING

### Bugs Found & Fixed
1. **Transcript pickup from history/**: Gym runner only checked `.state/sessions/` for session transcripts, but completed sessions move to `.state/sessions/history/`. Fixed to check both locations, with filter for `s_\d+` naming pattern (excludes test entries like `s_test_survive_1`).

2. **Agent ignores --work-dir**: `may-agent` always runs from `/app` regardless of cwd or --work-dir. Fixed by prepending absolute workDir path to task content so agent knows where gym files are.

3. **task.md references nonexistent `environment/` dir**: The gym runner copies scenario files flat to workDir (no `environment/` subdir) when criteria don't reference it. Fixed task.md to say "current working directory".

4. **success_criteria.js too strict on read() tool**: Only accepted `read()` tool calls but agent uses `bash cat`. Expanded to also accept bash commands targeting project files.

### Result
- context-learning: **5/5 checks passing** ✅
- Baseline went from 0/3 → 1/3 (with this one scenario)
- These infrastructure fixes likely help ALL gym scenarios (transcript + workDir)

### Next
- Run context-learning-correction and context-learning-restraint
- Run full gym suite to measure infrastructure fix impact
