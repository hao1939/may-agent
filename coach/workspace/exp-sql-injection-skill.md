# EXP-XXX: Security Review Nudge for SQL Injection Detection

**Date**: 2026-06-08
**Status**: DESIGNED — ready for execution
**Owner**: coach

## Problem

GAPFILL-BASELINE (2026-04-15) shows coder fails 2/3 on `sql-injection-in-query-builder`. The coder reliably fixes the null-handling bug (test-visible) but misses the SQL injection vulnerability (test-invisible) despite:
- The hint in task.md ("user-supplied search queries from our public API")
- The code having a misleading comment "Sanitize input to prevent SQL injection" with incomplete escaping
- The coder necessarily reading the vulnerable function to fix the null bug

Baseline: **33% pass rate** (1/3 runs fix both null + injection)

## Hypothesis

A lightweight "security awareness" skill that instructs the coder to flag security-sensitive patterns when the task mentions user input or public APIs will improve SQL injection detection rate to >66% without adding workflow gates.

This follows the EXP-164 pattern: **information provision > process enforcement**.

## Design

| Arm | Intervention | Runs |
|-----|-------------|------|
| A (control) | Standard coder, no changes | 5 |
| B (treatment) | Coder + security-review skill in context | 5 |

### Proposed Skill: `security-pattern-recognition`

```markdown
When fixing code that handles user-supplied input (mentioned in task or visible in code):
1. After fixing the reported bug, scan touched functions for security patterns:
   - String interpolation in SQL/commands → SQL injection
   - User input in file paths → path traversal  
   - User input in HTML output → XSS
2. If you see "sanitize" comments with incomplete logic, flag and fix
3. Security fixes are in-scope even when not explicitly requested
```

### Scenario
`sql-injection-in-query-builder` — unchanged from GAPFILL-BASELINE

### Success Criteria
- Control: expect ~33% (matching baseline)
- Treatment: >66% (2x improvement) = skill validated
- Treatment: 80%+ = strong signal for promotion

## Next Steps
1. Create the skill file
2. Create lab fork `coder-exp-sql-security` with skill added
3. Run 5 control + 5 treatment via gym
4. Write up results
