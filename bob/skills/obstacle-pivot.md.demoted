---
name: obstacle-pivot
description: >
  Structured fallback strategy when an approach fails. Instead of retrying the same
  thing or giving up, agents classify the obstacle, select an alternative from a
  pre-planned fallback ladder, and execute it — all within one turn. Targets FM-2.2
  (dead-end non-recovery) and the gap between error-handling's "don't retry blindly"
  principle and actually knowing what to do instead.
version: 1.0.0
owner: optimizer
---

# Obstacle Pivot: When Plan A Fails, Execute Plan B

## When to Apply

Apply this skill **whenever a tool call fails or produces an unusable result**.
Specific triggers:

- **Command not found** (`exit 127`, `npx: command not found`, `tsc: not found`) —
  the tool or binary you tried doesn't exist in this environment.
- **File/directory not found** (`ENOENT`, `No such file or directory`) — the path
  you assumed doesn't exist.
- **Edit match failure** (`Found 0 occurrences`, `Found N occurrences`) — your
  `edit()` oldText didn't match or matched ambiguously.
- **Output truncation** (`[truncated]`, `> 50KB`) — the result was too large to
  be useful, so you have incomplete data.
- **Permission/environment errors** (`EACCES`, `permission denied`, wrong cwd) —
  the environment doesn't allow what you tried.
- **Tool validation errors** (`missing required property`, `wrong type`) — the
  tool call was malformed.
- **Blocked operations** (`WRITE BLOCKED`, `P53 violation`, safety check) —
  a guardrail prevented the action.

**Do NOT apply** when the error is transient and a simple retry is appropriate
(e.g., a network timeout on a fetch). The distinction: if running the exact same
command again would produce the exact same error, you need a pivot. If it might
succeed (flaky network, race condition), a retry is fine.

## Why This Matters

Dead-end non-recovery (FM-2.2) is one of the most costly failure modes. When an
agent hits an obstacle and doesn't pivot, the entire remaining session is wasted —
the agent either retries the same failing approach, gives up and reports nothing,
or silently skips the blocked step and produces incomplete work.

The data from 50+ sessions shows a clear split:
- **High-performing agents** (tech-lead, qa) have implicit fallback ladders: when
  `tsc` isn't available, they try `node -e`; when that fails, they read the file
  back manually. They pivot within 1 turn.
- **Low-performing agents** spend 2-4 turns on the same failing approach before
  eventually pivoting or abandoning the task entirely.

The difference isn't intelligence — it's having a pre-planned alternative ready.
This skill makes the fallback ladder explicit so every agent has one.

## Steps

### Step 1: CLASSIFY the obstacle (same turn as the failure)

When a tool call fails, immediately classify the obstacle into one of these
categories. Don't spend a turn analyzing — classify in the same response where
you see the error:

| Category | Signal | Example |
|----------|--------|---------|
| **Missing tool** | exit 127, "not found" | `npx tsc` → `npx: not found` |
| **Missing path** | ENOENT, "No such file" | `read("agents/bob/todo.md")` → ENOENT |
| **Edit mismatch** | "Found 0 occurrences" | `edit()` oldText doesn't match file content |
| **Edit ambiguity** | "Found N occurrences" | `edit()` oldText matches multiple locations |
| **Output overflow** | truncated, >50KB | `find . -name "*.ts"` → truncated output |
| **Permission/env** | EACCES, wrong cwd | `cd /home/user && ...` → no such directory |
| **Guardrail block** | WRITE BLOCKED, P53 | `write()` blocked as truncated rewrite |
| **Malformed call** | validation error | `bash({})` → missing required property |

**Why classify first**: Different obstacle categories have different fallback
ladders. A missing-tool error needs a tool alternative; a missing-path error
needs path discovery. Classifying lets you jump directly to the right fallback
instead of guessing.

### Step 2: SELECT a fallback from the ladder

Each obstacle category has a pre-defined fallback ladder. Execute the **first
available alternative** — don't deliberate, just go down the list:

#### Missing tool fallbacks
1. **Try the base command** without the wrapper: `tsc` instead of `npx tsc`,
   `vitest` instead of `npx vitest`
2. **Try node direct**: `node -e "require('typescript').transpileModule(...)"` or
   `node --check <file>` for syntax checking
3. **Try a simpler check**: `grep` for syntax patterns, `read()` back the file
   and manually verify structure
4. **Report limitation**: Note what couldn't be verified and why, continue with
   what you can do

#### Missing path fallbacks
1. **Discover the correct path**: `find . -name "<filename>" -type f` or
   `ls <parent_directory>/`
2. **Check alternative locations**: `ls agents/<agent>/workspace/` if
   `agents/<agent>/<file>` failed
3. **Create if appropriate**: If the task requires the file to exist and you're
   supposed to create it, create it
4. **Report**: If the file genuinely doesn't exist and you can't create it,
   state this and move on

#### Edit mismatch fallbacks (0 occurrences)
1. **Read the file** at the target location: `read(path, offset=N, limit=M)` to
   see the actual current content
2. **Copy exact text**: Use the actual file content as your new `oldText`
3. **Use sed**: `bash("sed -i 'Ns/old/new/' <file>")` for line-targeted edits
4. **Use write()**: For small files, read the whole thing, modify in-memory,
   write back

#### Edit ambiguity fallbacks (N occurrences)
1. **Expand context**: Add 2-3 surrounding lines to `oldText` to make it unique
2. **Use line-targeted sed**: `bash("sed -i 'Ns/old/new/' <file>")` targeting
   the specific line number
3. **Use read+write**: Read the file, find the specific instance, write the
   whole file back

#### Output overflow fallbacks
1. **Add filters**: Pipe through `| head -50`, `| tail -20`, or `| grep "pattern"`
2. **Narrow the search**: Add more specific arguments (`-maxdepth 2`, `-name "*.ts"`)
3. **Count first**: `wc -l` to understand scale before trying to read everything
4. **Paginate**: Use `offset`/`limit` on `read()`, or `sed -n 'N,Mp'` in bash

#### Permission/environment fallbacks
1. **Drop the cd**: Run from the default working directory (usually `/app`)
2. **Verify with pwd**: Run `pwd` to confirm where you are
3. **Use absolute paths**: If relative paths fail, try absolute from the repo root

#### Guardrail block fallbacks
1. **For WRITE BLOCKED**: Read the full file first, then write complete content
   (the block means your content was too small — you probably have truncated data)
2. **For P53 violations**: Redesign your approach to avoid the restricted action
3. **Switch to edit()**: Use surgical `edit()` instead of full `write()` rewrites

#### Malformed call fallbacks
1. **Read the error**: It tells you exactly what's wrong (missing field, wrong type)
2. **Fix and retry**: This is the one case where retrying is correct — because
   you're changing the input

### Step 3: EXECUTE the fallback immediately

Execute the selected fallback in the **same turn** you classified the error.
Do not spend a turn discussing what you'll try — just do it. The ideal pattern
in your response is:

```
[See error] → [One sentence classifying it] → [Execute fallback]
```

Not:
```
[See error] → [Paragraph analyzing what went wrong] → [Paragraph planning alternatives] → [Execute fallback next turn]
```

**Why immediate execution matters**: Every turn spent analyzing an obstacle that
you already know how to handle is a wasted turn. The fallback ladders above
pre-solve the analysis — you just pick from the list and go. Spending extra
turns on obstacle analysis is the primary cause of session-length bloat after
errors.

### Step 4: CHAIN fallbacks if needed (max 3 attempts)

If the first fallback also fails, move to the next one in the ladder. But
impose a hard limit:

- **Attempt 1**: Original approach (failed)
- **Attempt 2**: First fallback from the ladder
- **Attempt 3**: Second fallback from the ladder
- **After attempt 3**: Stop. Report the obstacle, what you tried, and move on
  to the next task item. Do not spend more turns on a single blocked step.

**Why the limit**: Without a cap, agents can spend an entire session trying
variations of the same blocked operation. Three attempts is enough to exhaust
the common alternatives. If none work, the obstacle is structural and needs
human intervention or a fundamentally different approach.

## Assertions

1. When a tool call fails, the agent classifies the error type and attempts a
   different approach within the same response (not in a subsequent turn) —
   the error and the fallback attempt appear in the same assistant message.
2. The agent never retries a failed command with identical arguments — every
   retry changes at least one meaningful parameter (different tool, different
   path, different flags, expanded context).
3. After 3 failed attempts at the same goal, the agent stops trying and either
   reports the blocker or moves to the next task — it does not spend a 4th+
   turn on the same obstacle.
4. The agent does not silently skip a failed step — every obstacle is either
   resolved via fallback, or explicitly reported as a limitation/blocker in
   the session output.
5. When the agent encounters `exit 127` (command not found), it tries at least
   one alternative tool/command before giving up on that verification step.

## Anti-Patterns

### AP-1: Blind Retry (same command, same error)
The agent hits an error and retries the exact same command hoping for a
different result. `npx tsc` fails with "not found" → agent runs `npx tsc`
again → same error. This wastes turns and never succeeds.

**Why it happens**: The agent treats environmental errors like transient
failures. But `exit 127` and `ENOENT` are deterministic — the same input
will always produce the same output.

**Fix**: Classify the error (Step 1) and select a fallback (Step 2). Never
re-run the same command after a deterministic failure.

### AP-2: Analysis Paralysis (discuss instead of act)
The agent hits an error and spends 1-2 full turns analyzing what went wrong,
discussing options, and planning — before finally trying an alternative.
The analysis adds tokens but no value because the fallback ladders already
encode the correct response.

**Why it happens**: The agent doesn't have a pre-planned fallback, so it
reasons from first principles each time. This skill provides the pre-planned
fallbacks to eliminate that reasoning overhead.

**Fix**: Classify in one sentence, then execute the fallback immediately in
the same turn (Step 3). Save the multi-paragraph analysis for genuinely
novel obstacles not covered by the fallback ladders.

### AP-3: Silent Abandon (skip and pretend it didn't happen)
The agent hits an error, decides the blocked step isn't important, and
silently moves on. The step is never completed and never reported as
incomplete. Downstream work may depend on the skipped step.

**Why it happens**: The agent wants to make progress and rationalizes that
the blocked step was optional. Or the agent reports "SUCCESS" at the end
without mentioning that one step was skipped.

**Fix**: Every obstacle must be either resolved (via fallback) or reported
(in the session output as a limitation or blocker). There is no third
option. Use `finish(status: "partial")` if a meaningful step was blocked.
