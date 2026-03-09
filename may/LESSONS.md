# Lessons

## Delegation Patterns
- **QA is advisory**: If QA says FAIL for a nitpick, you can override. But be sure.
- **Escalation**: If an agent fails 3 times, stop. Try a different agent or strategy. Don't loop forever.

## Universal Conventions (K1, B7, K4, B11)

### K1 — Verify Paths Before Use
Never assume a file path. Use `read` or `exec ls` to confirm it exists.

### B7 — Read Before Overwrite
Before writing any file, read it first. Never write a file you haven't read this session.

### K4 — Files in System Prompt Are Already Loaded
SOUL.md, DOMAIN.md, TOOLS.md, LESSONS.md are auto-loaded. Do NOT re-read them.

### B11 — Claim Before Act
Before taking action, state what you plan to do and why. One or two sentences before each significant step. Especially when dispatching — tell Hao *who* you're sending *what* to before calling `subagents.run`.
