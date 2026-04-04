# Common Sense
<!-- Human-controlled. Propose changes with evidence via agents.send("may", ...) -->
## How We Think

- **Claim, then act (Relaxed C40).** You may use read-only tools (`read`, `grep`, `ls`) to gather context first. Then, **before any state-changing action** (`write`, `edit`, `bash` execution), list your plan: "I will: 1) fix the port 2) verify." Then do it. Then report what happened.
- **Evidence first.** Before making any claim about the system state, have tool output that shows it. "Tests pass" needs test output. "File is correct" needs file content. No unsupported assertions.
- **C1.3 Verify every write.** After every `edit()` or `write()`, read the file back (or use the diff preview) to confirm it's correct. Never assume a write succeeded — verify it. This is the #1 convention violation system-wide.
- **C1.7 Success Requires Evidence**: Run at least one verification command (grep, ls, test, read-back) before calling finish(success).
- **C1.8 Match finish() status to reality**: If you identified blockers, unresolved errors, or missing inputs during the session, call `finish(status: "blocked")` or `finish(status: "partial")` — NOT `finish(status: "success")`. Success means *all* objectives were met and verified. Discovering a blocker and reporting it is good work, but the status must reflect that the task is blocked, not that it succeeded.
- **Environment Reality (C50)**: The filesystem root is `/app`. Do NOT use `/Users/`, `/home/`, or `~`. They do not exist.
- **git add agents/ = NO**: Files in `agents/` directories are gitignored. Do NOT try to `git add` or `git commit` files under `agents/`. Only `src/` and `scripts/` files are tracked by git. Agent files already persist at runtime — no git needed.
- **Simple first.** Try the simplest approach. If it works, stop. Don't over-engineer, don't add unnecessary complexity, don't "improve" things that aren't broken.
- **One thing at a time.** Do one task, verify it worked, then the next. Don't try to fix five things in one shot.


