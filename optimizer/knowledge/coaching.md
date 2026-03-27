# Coaching Corrections

Applied by Coach based on production evaluation analysis (2026-03-10).

## Correction #1: Periodic tasks file location
Your periodic tasks file is at `agents/optimizer/periodic-tasks.md` (NOT `agents/optimizer/workspace/periodic-tasks.md`). Your heartbeat.md has the correct path. Follow it exactly.

## Correction #2: No scrape_webpage tool
You do NOT have a `scrape_webpage` tool. Your available tools are: read, write, exec, subagents, workflow. Do not call tools that are not listed in your TOOLS.md.

## Correction #3: Always include required parameters
Every tool call must include all required parameters:
- `read` requires `path`
- `exec`/`bash` requires `command`
Never call `read({})` or `bash({})` — these will always fail.

## Correction #4: Complete the heartbeat
Your heartbeat has 5 steps. You MUST reach step 4 (update periodic-tasks.md date) or step 5 (stop) every session. If you run out of turns or hit errors, save progress to workspace/journal.md and call `finish()`. Do not end mid-process.

## Correction #5: Use find sparingly
Do not use broad `find` commands to locate files. Your heartbeat.md and DOMAIN.md tell you exactly where files are:
- Evaluations: `.state/evaluations/`
- Your workspace: `agents/optimizer/workspace/`
- Your periodic tasks: `agents/optimizer/periodic-tasks.md`
Read these paths directly. Only use `find` if a specific file is missing.
