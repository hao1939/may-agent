# Lessons

## 🔴 Critical Safety
- **No Blind Writes**: Never write to a file if your `read()` was truncated. Use `sed` or read in chunks.
- **Verify Paths**: Project root is `/app`. Use relative paths or `/app/...`.
- **Tool Precision**: `read({path})`, `bash({command})`. No `exec`. Tool names are lowercase — `bash` not `Bash`. Always provide required args — never call `bash({})` without a `command`.
- **No Phantom Tools (3x recurrence)**: Your available tools are: `read`, `write`, `edit`, `bash`, `agents`, `workflow`. There is NO `scrape_webpage`, `scrape`, `exec`, or `discard_agent` tool. Do NOT call tools that aren't listed in your TOOLS.md. If you need web content, use `bash` with `curl`. This has caused FM-2.4 failures three times (s_495, s_497, s_528).
- **Deliver, Don't Just Analyze**: Read at most 5 files for reconnaissance, then start implementing. If you reach turn 10 without an `edit()` or `write()` call, you are stuck in analysis paralysis — stop reading and start writing code.
- **Always Verify**: Before concluding, run `npx vitest --run` and `npx tsc --noEmit`. No session is complete without verification output.
- **P53 Means Stop**: If `edit` or `write` is blocked on a protected file (SOUL.md, DOMAIN.md, TOOLS.md, LESSONS.md), that is a security boundary — do NOT circumvent via `bash` (python, node, sed, redirect, etc.). A block means you lack authorization. Report the constraint and request a different approach.
- **Protected Files — Plan Delegation First**: `agents/shared/philosophy.md` and other agents' SOUL/DOMAIN/TOOLS/LESSONS files are protected — you cannot edit them. When a task requires modifying a protected file, **plan to delegate to May from the start** instead of attempting the edit yourself and discovering the block mid-session. Use `read()` to inspect the file, draft your changes in your workspace, then send the draft to May via `agents.send`. Do not use `bash` (sed, grep piped to file, etc.) on protected files even for "read-only" operations — use the `read()` tool instead.

## Evidence Discipline
- **Verify Before Claiming — No Evidence Overreach (FM-2.6)**: Never claim you have a "full picture" or assert specific file contents (titles, taglines, line counts) unless you have **actually read and located** the relevant section in the current session. If your `read()` was truncated or you read an offset that didn't include the target section, say so — don't extrapolate from memory or prior sessions. When producing Old vs New comparison tables, you MUST show the actual old text you read, not reconstruct it from memory.
- **Grep Before Diff**: When updating a specific section in a large file, use `bash` with `grep -n` or `sed -n` to locate the exact current text before drafting a FIND/REPLACE. This ensures your FIND block matches reality, not your assumptions.
- **Complete Delegation Artifacts**: When drafting a delegation file for May (or any agent), verify the file is complete after writing it. Read it back. A truncated or broken FIND/REPLACE block means May cannot safely apply it — your task is incomplete.

## Optimization Strategy
- **One Fix Per Run**: Change one thing, measure, iterate.
- **Structural > Behavioral**: Fix tool code (structural) before adding lessons (behavioral).
- **Verify**: Fixes must compile and pass tests. A broken optimizer breaks the meta-loop.

## Operational
- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded. Don't re-read.
- **Complete Heartbeat**: Must reach step 4 (update periodic-tasks) or step 5 (stop). Don't end mid-process.
- **No Idle Claims Without Evidence (4x recurrence)**: Before concluding "nothing to do" or "system idle," you MUST run at least one state check command (e.g., `git log --oneline -3`, `ls .state/evaluations/ | wc -l`, or `ls .state/sessions/history/ | tail -5`). If you didn't run a command to verify, say "I didn't check" — don't assert idleness. This has caused FM-2.6 and FM-3.1 failures four times (s_1651, s_28, s_228, s_440).
