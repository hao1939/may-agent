---
name: finish-before-cleanup
version: 1.0.0
description: >
  Call finish() before optional cleanup tasks (updating todo.md, final
  verification reads, last bash checks). Sessions can be terminated at any
  time — finish() is the only way to record your work. Everything else
  can wait for the next session.
owner: coach
evidence: >
  10 C1.4 failures in 24h (15.6% fail rate). All 10 show the same pattern
  in session digests: agent completes substantive work, plans "now let me
  update todo.md and finish", then gets terminated before finish() executes.
  Failing sessions have avg 7.7 ops vs 13.3 for passing — they're not
  bloated, they're spending wall-clock time thinking and running out of
  time before the final call.
---

# Finish Before Cleanup

## When to Apply

Apply this skill **in every session**, but especially:

- Heartbeats where you've completed Step 3 (ACT) and are entering Step 4 (EXIT)
- Work sessions where your main deliverable is done
- Any time you think "let me just do one more thing before finishing"

## Why This Matters

Sessions can be terminated at any moment — wall-clock timeout, infrastructure
restart, resource limits. The ONLY way to record what you accomplished is
`finish()`. If the session ends without `finish()`:

- Your work summary is lost
- Convention check C1.4 fails
- No outcome is recorded in the database
- Dispatched work isn't tracked

**The #1 cause of C1.4 failure**: doing cleanup tasks (update todo.md, final
verification, one more bash check) BEFORE calling finish(). The cleanup
succeeds but the session terminates before finish() can execute.

## Steps

### Step 1: Recognize the "finish zone"

You're in the finish zone when:
- Your main work is done (investigation complete, fork dispatched, code written)
- You're about to do a non-essential task before finishing
- You think "now let me just..." or "one more thing before I finish"

### Step 2: Call finish() IMMEDIATELY

When you enter the finish zone, your very next tool call must be `finish()`.

**Do NOT do any of these before finish():**

| ❌ Tempting cleanup | ✅ What to do instead |
|---|---|
| Update todo.md | Mention it in finish() summary; do it next session |
| Final verification read | You already verified during work; skip |
| One more bash check | Include what you know in summary |
| Commit to git | Note "needs commit" in next_steps |
| Write a summary file | finish() IS your summary |

### Step 3: Put cleanup info IN the finish() call

Everything you wanted to do "before finishing" goes into the finish() fields:

```javascript
finish({
  status: "success",
  summary: "Analyzed X, forked Y for investigation.",
  // Stuff you would have written to todo.md:
  next_steps: "Update todo.md with this cycle. Check Y results.",
  // Files you planned to verify:
  verification_evidence: ["Step 3: read(file.md) showed expected content"]
})
```

## Assertions

1. **finish() is the last tool call** — no bash, read, write, or edit calls
   appear after the agent decides its main work is complete.

2. **No "one more thing" pattern** — the agent does not execute optional
   cleanup tasks (todo.md updates, final reads, git commits) between
   completing main work and calling finish().

3. **Cleanup intent is captured in finish() fields** — things the agent
   would have done (update todo, verify files) are mentioned in summary
   or next_steps instead of being executed.

## Anti-Pattern: "Just One More Thing"

**Pattern**: Agent's main work is done. Instead of calling finish(), it runs
`bash("git add ...")`, `write("todo.md", ...)`, or `read("deliverable.md")`
for a final check. Session terminates during or after this cleanup call.

**Why it happens**: The agent wants a clean exit — updated tracking, verified
work, committed changes. These are good instincts, but they conflict with
the hard constraint that sessions can terminate at any time.

**Cost**: C1.4 failure (15.6% of tech-lead sessions). Zero record of the
session's work in the database.

**Fix**: finish() first, cleanup second. If the session has budget remaining
after finish(), cleanup can happen. But finish() must not be deferred.
