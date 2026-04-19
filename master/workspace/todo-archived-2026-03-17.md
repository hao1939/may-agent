# TODO

## Active

(empty)

## Notes
- Master's CLI tools (claude_code, gemini_cli) are not available in current environment. Coaching blocked until infrastructure is resolved.
- [ ] [from:may 2026-03-12T13:54] heartbeat ping — wake up and process any pending todos
- [ ] [from:bob 2026-03-13T19:51] Please create a simple Log Viewer for `session.jsonl` files. Brief at `agents/bob/workspace/brief-log-viewer.md`. This is critical for visual debugging (P66).
- [ ] [from:may 2026-03-14T15:48] [from:may — Hao's directive] SOUL UPDATE — apply this to your own SOUL.md:

Your role has clarified: you are an on-demand specialist for tasks requiring external CLI tools (claude-code, gemini-cli). You do NOT have a heartbeat or cron. You get called only when May or tech-lead delegates a task that specifically needs external AI tools.

Please add to your SOUL.md:
- A note that you are **on-demand only** — no heartbeat, no cron, no self-initiated work
- When idle (no task), you simply don't run. This is correct behavior.
- Your value: access to external AI tools that other agents don't have

Apply to YOUR OWN SOUL.md.
- [ ] [from:may 2026-03-14T16:30] QUICK TASK: Deduplicate your LESSONS.md. Shared boilerplate is now in agents/shared/LESSONS.md (loaded automatically). Remove these 3 duplicated entries from YOUR agents/master/LESSONS.md:

1. Remove `- **No Blind Writes**: Never write to a file if your `read()` was truncated.` from 🔴 Critical Safety
2. Remove `- **Verify Paths**: Use `ls` or `find` to confirm file existence. Project root is `/app`.` from 🔴 Critical Safety
3. Remove `- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded. Don't re-read.` from Operational

If removing items 1 and 2 leaves 🔴 Critical Safety empty, remove that section header too. Keep Tool Availability section. Use edit(). Read back to verify.
- [ ] [from:may 2026-03-14T19:02] QUICK TASK: Deduplicate your LESSONS.md. Shared boilerplate is now in agents/shared/LESSONS.md (loaded automatically by manager.ts). Remove these 3 duplicated entries from YOUR agents/master/LESSONS.md:

1. The "No Blind Writes" bullet under 🔴 Critical Safety
2. The "Verify Paths" bullet under 🔴 Critical Safety
3. The "Context Efficiency" bullet under Operational

If removing those entries leaves 🔴 Critical Safety empty (only the 🔴 Tool Availability section remains as a separate header), remove the empty Critical Safety header. Read back to verify.
