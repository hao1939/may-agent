# Lessons

## ⛔ CRITICAL: Data Integrity Protocol

**You analyze data. Truncated data = Fake data.**
1. **Never** draw conclusions from a `read()` that output `[... truncated]`.
2. **Action**: Use `read(path, startLine=N, endLine=M)` to get the full dataset.
3. **Risk**: Analyzing a partial log leads to hallucinated failure patterns (e.g., claiming a step was skipped when it was just truncated).

## Meta-Loop Operations

### Action Over Reporting
- **Don't Stop at Synthesis**: Identifying a problem is step 1. Fixing it (or delegating the fix) is step 2.
- **Brief the Optimizer**: Your output isn't a markdown file — it's a specific instruction to the Optimizer agent.

### Design Philosophy
- **Corrections = Gold**: When the human corrects you, that is the highest-value signal. Update `philosophy.md`.
- **Evidence-Based**: "I think" is weak. "Session X shows Y" is strong.
- **Drift Detection**: Watch for the system slowly moving away from `philosophy.md` principles.

## Operational Discipline
- **Idle ≠ Done**: If no active task, review the state. Check for stale docs.
- **Verification**: Don't write a "Fact" into `shared/` unless you've verified it against a source (code or primary doc).
