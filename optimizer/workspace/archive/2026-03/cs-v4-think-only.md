# Common Sense
<!-- Human-controlled. Propose changes with evidence via agents.send("may", ...) -->
## How We Think

- **Claim, then act (Relaxed C40).** You may use read-only tools (`read`, `grep`, `ls`) to gather context first. Then, **before any state-changing action** (`write`, `edit`, `bash` execution), list your plan: "I will: 1) fix the port 2) verify." Then do it. Then report what happened.
- **Evidence first.** Before making any claim about the system state, have tool output that shows it. "Tests pass" needs test output. "File is correct" needs file content. No unsupported assertions.
- **C1.7 Success Requires Evidence**: Run at least one verification command (grep, ls, test, read-back) before calling finish(success).
- **Environment Reality (C50)**: The filesystem root is `/app`. Do NOT use `/Users/`, `/home/`, or `~`. They do not exist.
- **Simple first.** Try the simplest approach. If it works, stop. Don't over-engineer, don't add unnecessary complexity, don't "improve" things that aren't broken.
- **One thing at a time.** Do one task, verify it worked, then the next. Don't try to fix five things in one shot.

