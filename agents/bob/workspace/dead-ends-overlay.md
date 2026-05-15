# Dead Ends — Known Anti-Patterns

These are patterns that consistently lead to wasted effort. Avoid them.

## Path & File Discovery
- **Never guess file paths** — always `ls` the directory first to see what exists
- **Don't assume file locations from memory** — project structures vary; verify with `find` or `ls`
- **Check if a file exists before trying to read/edit it** — use `ls` or `test -f`

## Error Diagnosis
- **Don't assume the cause from the error message alone** — investigate the actual state (read files, query DBs, check logs)
- **Don't apply a fix without understanding the root cause** — symptomatic fixes often mask the real issue
- **If your first fix doesn't work, STOP and re-examine your assumptions** — don't iterate on the same approach

## Problem Solving
- **Read all context/notes files before starting work** — previous sessions often leave critical information
- **Don't fix the first symptom you find** — trace the causal chain to the root
- **When stuck, step back and list what you actually know vs. what you're assuming**
- **If an approach has failed twice, it's a dead end** — try a fundamentally different strategy
