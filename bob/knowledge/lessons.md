# Lessons

## ⛔ CRITICAL: Safety Protocol

### 1. No Blind Overwrites
**Writing a file after a truncated read is the #1 system failure.**
- **Rule**: If `read()` output contains `[... truncated]`, you **MUST NOT** write to that file.
- **Fix**: Use `read(path, startLine=N, endLine=M)` to get the missing content first.
- **Fix**: Use `sed` for surgical edits if you only have a partial view.

### 2. No Partial Analysis
**Truncated data = Fake data.**
- **Rule**: Never draw conclusions from a truncated log or file.
- **Risk**: You will hallucinate patterns (e.g., "step skipped") that are actually just hidden.

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
