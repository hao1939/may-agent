# Common Sense
<!-- Human-controlled. Propose changes with evidence via agents.message("may", ...) -->
## How We Think

- **Claim, then act (Relaxed C40).** You may use read-only tools (`read`, `grep`, `ls`) to gather context first. Then, **before any state-changing action** (`write`, `edit`, `bash` execution), list your plan: "I will: 1) fix the port 2) verify." Then do it. Then report what happened.
- **Evidence first.** Before making any claim about the system state, have tool output that shows it. "Tests pass" needs test output. "File is correct" needs file content. No unsupported assertions.
- **C1.3 Verify every write.** After every `edit()` or `write()`, read the file back (or use the diff preview) to confirm it's correct. Never assume a write succeeded — verify it. This is the #1 convention violation system-wide.
- **C1.7 Success Requires Evidence**: Run at least one verification command (grep, ls, test, read-back) before calling finish(success).
- **C1.8 Match finish() status to reality**: If you identified blockers, unresolved errors, or missing inputs during the session, call `finish(status: "blocked")` or `finish(status: "partial")` — NOT `finish(status: "success")`. Success means *all* objectives were met and verified. Discovering a blocker and reporting it is good work, but the status must reflect that the task is blocked, not that it succeeded.
- **Environment Reality (C50)**: The filesystem root is `/app`. Do NOT use `/Users/`, `/home/`, or `~`. They do not exist.
- **Two git repos**: The main project (`/app`) tracks `src/`, `scripts/`, `test/`. The agents sub-repo (`/app/agents/`, its own `.git`) tracks all agent files. Do NOT `git add agents/` from the main repo (it's gitignored). Instead, commit agent files from within `/app/agents/`.
- **Commit your own work before finish()**: When you create or significantly change files in `agents/`, commit them with a descriptive message before calling `finish()`. Run: `cd /app/agents && git add -A <your-files> && git commit -m "<agent>: <what you did>"`. Good messages: `bob: H-045 Decision Topology hypothesis`, `coach: new skill for evidence-first debugging`, `tech-lead: EXP-013 session digest implementation`. Bad messages: `update files`, `changes`. An auto-commit safety net runs every 2h — but if it's committing your work, you forgot to.
- **Measure product, not process (KE-181).** When evaluating whether an intervention worked, measure "did the output solve the problem correctly?" — not "did the agent follow the prescribed steps?" A scorer that checks for ARTIFACT.md existence when the experiment requires ARTIFACT.md is tautological. Design metrics that measure output quality independent of the process used to produce it.
- **Simple first.** Try the simplest approach. If it works, stop. Don't over-engineer, don't add unnecessary complexity, don't "improve" things that aren't broken.
- **One thing at a time.** Do one task, verify it worked, then the next. Don't try to fix five things in one shot.
- **Cross-agent help.** When stuck on a problem, send it to the right agent: `agents.message("scout", "research question")` for external knowledge, `agents.message("coach", "skill request")` for behavioral training, `agents.message("tech-lead", "implementation request")` for code changes. Don't struggle alone.


