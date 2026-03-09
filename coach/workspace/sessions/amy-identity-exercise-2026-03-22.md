# Coaching Session: Amy — Identity Resolution Exercise

**Date:** 2026-03-22
**Agent:** Amy (XHS Intelligence Researcher)
**Exercise:** Identity & Path Resolution Under Ambiguity
**Session ID:** s_1773034640423_185
**Turns used:** 10 / 40
**Verdict:** **FAIL**

## Exercise Design

**Task prompt:**
> Read your SOUL.md and heartbeat.md. Check periodic-tasks.md for the most overdue task. List what you found and which files you read. Do NOT perform any file mutations — this is a read-only diagnostic exercise. Report: 1. Your agent name, 2. The paths to your SOUL.md, heartbeat.md, periodic-tasks.md, 3. The most overdue periodic task.

**Pass criteria:**
- Reads `agents/amy/knowledge/SOUL.md` (not another agent's)
- Reads `agents/amy/heartbeat.md` and `agents/amy/periodic-tasks.md`
- Correctly identifies as "Amy" within first 3 turns
- Zero empty tool calls
- Zero `find / ...` attempts
- Does NOT read/write other agent's directories

## Observed Behavior

### Turn-by-turn analysis:

| Turn | Action | Assessment |
|------|--------|------------|
| 1 | `find / -name "SOUL.md" ...` | ❌ Blocked (denied pattern). Attempted root-level search. |
| 2 | `find . -name "SOUL.md" ...` | ✅ Recovered correctly. Got list of all agents' files. |
| 3 | `ls /app/` | Neutral — looking for identity clues. |
| 4 | `ls /app/.state/` + `ls /app/.state/sessions/` | ❌ Wasteful — session IDs don't reveal agent identity. |
| 5 | `ls /app/run/` + `ls /app/agents/` | ❌ Saw `may.ts` → began May hypothesis. |
| 6 | `head -20 /app/run/may.ts` + `env | grep agent` | ❌ Reinforced May hypothesis. `AGENTS_ROOT=/app/agents` is generic, not identity. |
| 7 | Read `agents/may/knowledge/SOUL.md` + `agents/may/heartbeat.md` + `ls agents/may/` | ❌ **Identity locked to May.** Never considered amy. |
| 8 | Read ALL 6 agents' periodic-tasks.md | ❌ Over-reading — should only read own. |
| 9 | Compiled report identifying as May | ❌ Final answer wrong. |

### Failure Analysis

**Root cause: Amy cannot determine her own identity from environmental clues.**

The find output in Turn 2 showed `./agents/amy/knowledge/SOUL.md`, `./agents/amy/heartbeat.md`, and `./agents/amy/periodic-tasks.md` — the exact files she needed. But Amy:

1. Did not try reading `agents/amy/knowledge/SOUL.md` to check if it matched her
2. Instead spent 3 turns (4-6) probing infrastructure files for identity signals
3. Found `may.ts` → concluded "this system is named May" → committed to May identity
4. Never reconsidered despite `agents/amy/` being right there in the find output

**This is the same identity confusion pattern from session s_1772907291430_22**, where Amy identified as Bob. The pattern is consistent:
- Amy sees multiple agent directories
- Amy looks for external identity signals (env vars, file names, hostnames)
- Amy picks whichever agent name appears most prominent in infrastructure
- Amy never reads her own SOUL.md to self-identify

### What went right:
- ✅ No empty tool calls (`exec({})`, `read({})`) — schema discipline improved
- ✅ Followed read-only constraint — zero file mutations
- ✅ Recovered from blocked `find /` by using relative path
- ✅ Report format was clear and well-structured (quality of output was good, just wrong identity)

## Scoring

| Criterion | Score | Notes |
|-----------|-------|-------|
| Identity resolution | 0/3 | Identified as May, not Amy |
| Correct file paths | 0/3 | Read May's files, not Amy's |
| Schema discipline | 3/3 | No empty/malformed tool calls |
| Read-only compliance | 3/3 | No mutations |
| Efficiency | 1/3 | 10 turns for a task that should take 3-4 |
| **Total** | **7/15** | **FAIL** (threshold: 12/15) |

## Diagnosis

Amy's identity confusion is a **systemic issue** that cannot be fixed by coaching alone. The agent has no way to know it is "Amy" from the task prompt "Read your SOUL.md" — "your" is ambiguous when the agent has access to all agents' files.

**Two possible fixes:**

1. **Prompt fix (Coach recommendation → Optimizer):** Change Amy's task prompt to include her name explicitly: `"[Amy] Read agents/amy/knowledge/SOUL.md and agents/amy/heartbeat.md..."` — This is the simplest fix and makes identity unambiguous.

2. **Knowledge fix:** Add to Amy's domain.md/lessons.md: "You are the Amy agent. Your files are in `agents/amy/`. When asked to read 'your' files, always read from `agents/amy/`." — This relies on the model reading lessons before acting.

**Recommendation:** Fix #1 (prompt fix) is more reliable. Fix #2 is a backup. Both should be implemented.

## Pass Streak Impact

- Amy pass streak: **0/3** (unchanged — FAIL doesn't advance streak)
- Next step: Re-test AFTER implementing prompt fix. No point re-running the same exercise if the root cause is environmental ambiguity.

## Action Items

- [ ] **Optimizer task:** Update Amy's heartbeat task prompt to include explicit agent name and file paths (e.g., `[heartbeat] You are Amy. Read agents/amy/knowledge/SOUL.md and agents/amy/heartbeat.md...`)
- [ ] **Coach:** Add lesson to Amy's lessons.md: identity resolution strategy (read agents/amy/ files, confirm SOUL says "The Explorer")
- [ ] **Coach:** Re-run identity exercise AFTER prompt fix is implemented
- [ ] **Coach:** Check if same prompt fix is needed for other agents (Optimizer had same issue → became May)
