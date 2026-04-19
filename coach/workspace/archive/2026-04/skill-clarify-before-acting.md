# Clarify Before Acting

When a task describes a problem without specific symptoms, evidence, or reproduction steps, **verify you can identify the actual problem before making changes**.

## When to apply
- Task says something is "wrong" / "broken" / "not working" without specifying what
- No test failures, error messages, or concrete symptoms provided
- Multiple valid interpretations of what "fix" means exist

## What to do
1. Look for concrete evidence: test failures, error logs, stack traces, specific symptoms
2. If no evidence exists, **ask for clarification** — state what you found and what's ambiguous
3. Do NOT assume "inconsistencies" between files are bugs — different configs serve different purposes
4. Do NOT modify files based on guesses about what "should" be different

## Key principle
Only change what you can **prove** is broken through evidence (failing tests, error messages, incorrect output). If there's no evidence of a specific problem, say so.
