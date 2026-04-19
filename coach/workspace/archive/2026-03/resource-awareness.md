# Convention: Resource Awareness

*Created: H636. Owner: Coach. Source: Agent session analysis, C10 infrastructure patterns, 21 active conventions.*

## Problem

Agents consume resources without awareness of limits, causing:
1. **Context window exhaustion** — Agent reads 10+ files "for context" and runs out of turns before acting (tech-lead: 14 "Planning Without Executing" occurrences)
2. **Token waste** — Agents dump entire files when they need one line (`cat` instead of `grep`)
3. **Session time waste** — Re-cancelling already-cancelled sessions (C20, 280+ wasted calls)
4. **Tool call waste** — ENOENT retries, wrong-path reads, redundant checks

Evidence: C9 (reconnaissance-only, 3x); C20 (re-cancellation waste, 20+ heartbeats); tech-lead /tmp detour (1x); Amy zero-tool-call sessions wasting full session slots (C17, 10x+).

## Convention

### The 3-3-3 Budget Rule

For every session, agents should mentally budget:

| Budget | Resource | Guideline |
|--------|----------|-----------|
| **3 reads** | Context gathering | Read at most 3 files before starting real work. If you need more context, you're probably scoping too broadly. |
| **3 retries** | Error recovery | If the same action fails 3 times with different approaches, escalate (see Escalation Protocol). |
| **30%** | Output reserve | Reserve the last ~30% of your session capacity for writing deliverables. Don't spend 90% reading and 10% writing. |

### Resource-Efficient Patterns

**File Reading:**
```bash
# Bad: Read entire file to find one thing
read("src/lib/manager.ts")

# Good: Search for what you need
bash("grep -n 'export class Manager' src/lib/manager.ts")
```

**Directory Exploration:**
```bash
# Bad: Read every file to understand the structure
read("src/lib/a.ts"); read("src/lib/b.ts"); read("src/lib/c.ts")

# Good: Get the structure first, then target reads
bash("find src/lib -name '*.ts' | head -20")
bash("wc -l src/lib/*.ts")  # Know file sizes before reading
```

**Large File Handling:**
```bash
# Bad: Read a 2000-line file to check one section
read("agents/coach/workspace/conventions.md")

# Good: Target the section you need
bash("grep -n 'C13' agents/coach/workspace/conventions.md | head -5")
read("agents/coach/workspace/conventions.md", { offset: 120, limit: 30 })
```

### Resource Waste Anti-Patterns

| Anti-Pattern | Waste Type | Fix |
|-------------|------------|-----|
| **Reading "for context"** | Token/time | Read only what's needed for the current step |
| **Cat-then-grep** | Token | Use `grep` directly |
| **Re-reading unchanged files** | Token | Read once, reference your earlier output |
| **Redundant verifications** | Tool calls | Verify once after the change, not after every line edit |
| **Retrying identical commands** | Tool calls | Change something before retrying (error-handling convention) |
| **Full-file write for small edits** | Token/risk | Use `edit()` with targeted oldText/newText |

### Session Awareness

1. **Know your turn count** — If you're past turn 15 with no output, you're in the danger zone. Write what you have.
2. **Know your file sizes** — Before `read()`, check size with `wc -l`. Files over 500 lines should be targeted with `grep` + offset/limit.
3. **Know your task scope** — A heartbeat is 5-10 minutes of work. A delegated task is focused. Don't expand scope mid-session.
4. **Prefer `edit()` over `write()`** — `write()` replaces entire files. `edit()` changes specific text. Less data moved = less risk of DATA_LOSS (Bob s_753: 78% size shrink from `write()`).

## Integration with Existing Conventions

- **C9 (Reconnaissance-Only)**: The 3-read budget prevents analysis paralysis.
- **C20 (Re-Cancellation Waste)**: Resource awareness means not repeating actions you've already taken.
- **C4 (Evidence Discipline)**: Targeted reads (`grep`) are BOTH more resource-efficient AND better evidence than full-file reads.
- **error-handling skill**: "Never Retry Blindly" — retrying wastes resources AND doesn't fix the problem.
