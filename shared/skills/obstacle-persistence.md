# Obstacle Persistence

## When to Apply
When any tool call (bash, read, edit, etc.) fails or returns unexpected results.

## Rule
1. **Try at least 2 alternative approaches** before pivoting away from your current goal
2. If the path is truly blocked, **state explicitly** what you tried and why each approach failed
3. **Never silently abandon** the original goal — if you must pivot, acknowledge it

## Examples of Alternatives
- `bash` fails with permission error → try a different path, check if file exists first, use a different command
- `edit` fails (text not found) → `read` the file to get exact current text, then retry
- `read` fails (file not found) → `bash find` or `ls` to locate the correct path
- Test fails → read the error, check the specific line, try a different fix approach

## Anti-Pattern (what NOT to do)
❌ Tool fails once → immediately switch to a completely different task
❌ Get an error → skip that step and call finish() without addressing it
❌ Encounter a blocker → say "blocked" without trying alternatives

## Limit
Cap at 2-3 alternatives. If 3 genuine attempts all fail with clear reasons, it's appropriate to escalate or pivot — but document what was tried.
