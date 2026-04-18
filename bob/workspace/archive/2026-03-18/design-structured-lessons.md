# Design: Structured Lessons Memory

**Problem:** `LESSONS.md` files are often disorganized lists of anecdotes or facts. This makes retrieval inefficient and application difficult. "I learned X" is passive; "Use Y to solve X" is active.
**Research:** Trajectory-Informed Memory (69b2d692) shows +14-28% performance by structuring memory into three active categories.

## Proposed Schema
Replace free-text lists with three explicit sections:

### 1. Strategy (High-Level Approach)
- **When**: Start of a task.
- **Content**: Validated patterns for tackling entire classes of problems.
- **Example**: "For refactoring large files, always extract interfaces first, then implement."

### 2. Recovery (Error Fixes)
- **When**: An error occurs.
- **Content**: Specific error messages mapped to specific fixes.
- **Example**: "If `sed` fails with 'unterminated substitution', escape the slashes."

### 3. Optimization (Efficiency)
- **When**: Refining a working solution.
- **Content**: How to do the same thing faster or with fewer tokens.
- **Example**: "Use `grep -q` to check existence instead of `cat | grep` to save tokens."

## Implementation Plan
1. **Pilot**: Convert `agents/bob/knowledge/lessons.md` (or create if missing) to this format.
2. **Template**: Update `agents/shared/knowledge/templates/LESSONS.md` (if exists) or create it.
3. **Rollout**: Brief other agents (via `bulletin.md` or direct message) to adopt this structure for their next consolidation cycle.

## Success Criteria
- Retrieval becomes targeted: "Find a recovery for error X" vs "Read all lessons".
- Application becomes direct: Copy-paste the strategy.
