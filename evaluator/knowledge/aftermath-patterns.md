# Aftermath Review Patterns

## Orchestrator premature DONE / no verification
**Symptom**: session ends with `outcome: done` and `opCount: 0` (no tool-based verification), plus no concrete next operation for worker.

**Why it matters**: closed-loop reliability depends on evidence and a validation path; “healthy” claims must be verified. Orchestrator must either schedule a next check or explicitly move project to waiting/blocked with a clear resume trigger.

**Checklist**
- Verify claimed deliverables exist (`read`/`bash ls`) before checking plan items.
- If project remains `active`, produce a next-iteration operation (even if “observe next snapshot”).
- Use DONE only when (a) no unchecked plan items and (b) the run contract truly has no next action.
