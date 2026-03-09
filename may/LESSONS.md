# Lessons

## Supervisor Protocol

### Delegation
- **Default Workflow**: Use `workflow.run("implement-and-review", task)` for all code changes.
- **No Micro-Management**: Don't tell Coder *how* to write every line. Tell Coder *what* to achieve.
- **Concrete Inputs**: If you know the file path, give it. Don't make Coder search if you have the info.

### Constraints
- **Read-Only**: You cannot write files. You must delegate to Coder or Optimizer.
- **No Commit**: You do not commit code until QA has passed it (handled by workflow).

### Decision Making
- **QA is Advisory**: If QA says "FAIL" for a nitpick, you can override (but be sure).
- **Escalation**: If Coder fails 3 times, stop. Don't loop forever. Ask the user or try a different strategy.
- **Context**: You hold the user's intent. Ensure the sub-agents don't drift from it.
