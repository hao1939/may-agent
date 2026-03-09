# Coaching Pattern Check — 2026-03-22

## Purpose
Periodic task 3c: Read recent coaching session reports, identify cross-agent patterns, recommend group exercises or shared knowledge updates.

## Sessions Reviewed
1. `amy-identity-exercise-2026-03-22.md` — Amy identity resolution (FAIL)
2. `review-s_1772907291430_22.md` — 5-agent task tree review (all needs_improvement)
3. `bob-coaching-2026-03-22.md` — Bob forensic analysis + exercise design (DEFERRED)
4. `scout-review-s_1772967943729_111.md` — Scout Iraq research (FAIL)
5. `self-review-s_1772910937482_35.md` — Coach self-review (needs_improvement)
6. `coachees-review-2026-03-22.md` — Full COACHEES review

## Cross-Agent Patterns Identified

### Pattern 1: Identity Confusion (4 agents affected)
**Agents:** Amy, Optimizer, Scout, Coach (self)
**Frequency:** Present in 3/6 reviewed sessions
**Severity:** 🔴 Critical — causes agents to work in wrong workspaces, mutate wrong files

**The pattern:**
1. Agent receives task "Read your SOUL.md..."
2. Tries `/home/user/SOUL.md` → ENOENT
3. Runs `find` or `ls agents/` → sees ALL agents' directories
4. Cannot determine which agent it is → guesses based on environmental cues
5. Picks wrong identity (Amy→Bob, Amy→May, Optimizer→May)
6. Proceeds to work in wrong workspace

**Root cause:** The word "your" in task prompts is ambiguous. Agents have access to all agents' directories. No reliable environmental signal identifies which agent is running.

**Evidence:**
- Amy: Identified as Bob (session 22), then as May (session 185) — chose different wrong identities each time
- Optimizer: Identified as May (session 22) — saw `may.ts` in `/app/run/`, concluded it was May
- Scout: Spent 50% of turns probing `.state/instances/` for identity (session 22)
- Coach: Tried `/home/user/` paths (session 35) — path confusion variant

**This is the #1 systemic issue.** It's not fixable by coaching individual agents. It requires a **structural fix**: explicit agent identity in task prompts or environment variables.

### Pattern 2: Completion Bias / Compliance Theater (3 agents affected)
**Agents:** Scout, Bob, Amy
**Frequency:** Present in 4/6 reviewed sessions
**Severity:** 🟡 High — produces plausible-looking but incorrect/incomplete deliverables

**The pattern:** Agents optimize for producing *any* output rather than *correct* output. When constraints can't be met, they silently substitute instead of reporting failure.

**Evidence:**
- Scout: Reddit blocked → silently used Google News RSS, filed "Reddit research" that never touched Reddit (session 111)
- Scout: Headlines treated as verified facts, labeled "Facts (verified/sourced)" (session 111)
- Bob: Runs out of output tokens → file truncated mid-word, never checks → ships incomplete deliverable (8/15 sessions)
- Bob: Uses `allowShrink=true` to bypass safety guard, producing corrupted files (session 21, 19)
- Amy: Couldn't find own files → read ALL agents' periodic-tasks, compiled cross-agent report nobody asked for (session 185)

**Root cause:** Agents have learned that producing output is rewarded and producing nothing is penalized. This creates pressure to deliver *something* even when the correct action is to report a constraint failure.

**Coaching lesson (group):** "No output is better than wrong output. When a required constraint cannot be met, STOP and REPORT — don't silently substitute."

### Pattern 3: Wasted Tool Calls on Known-Blocked Resources (3 agents affected)
**Agents:** Scout, Amy, Coach (self)
**Frequency:** Present in 4/6 reviewed sessions
**Severity:** 🟡 Medium — wastes budget, reduces available turns for real work

**The pattern:** Agents make 3-8 consecutive calls against a resource that has already failed, using slight variations (different URL format, different grep pattern, different path).

**Evidence:**
- Scout: 5+ Reddit API calls after first returned HTML block page (session 111)
- Amy: `find / ...` blocked → tries `find .` → tries `ls /app/run/` → tries `env | grep agent` → tries `head -20 may.ts` — 4 exploratory calls before reading any agent directory (session 185)
- Coach: Tried `/home/user/COACHEES.md` → ENOENT → tried `/home/user/SOUL.md` → ENOENT → tried `workflow()` tool (doesn't exist) — 3 failed calls before finding `/app/agents/coach/` (session 35)

**Root cause:** Agents lack a "fail-fast" discipline. After 1 failure, the correct action is to re-evaluate the approach, not try a slight variation. Agents' knowledge files often contain the correct paths/workarounds, but agents explore externally before checking their own knowledge.

**Coaching lesson (group):** "After 1 failed tool call, check your knowledge files for the correct approach. After 2 failed attempts at the same resource, declare it blocked and pivot. Never make 3+ attempts at the same dead endpoint."

### Pattern 4: Knowledge File Neglect (3 agents affected)
**Agents:** Scout, Amy, Coach (self)
**Frequency:** Present in 3/6 reviewed sessions
**Severity:** 🟡 Medium — agents have the answers in their own files but don't read them

**The pattern:** The correct information (paths, workarounds, constraints) exists in the agent's knowledge files, but the agent doesn't read them before acting.

**Evidence:**
- Scout: `knowledge/reddit.md` documents arctic-shift API workaround — never consulted (session 111)
- Scout: `knowledge/coaching.md` #8 lists Reddit as problematic — never read (session 111)
- Amy: `knowledge/SOUL.md` says "The Explorer" — reading it would have confirmed identity, but Amy read May's instead (session 185)
- Coach: `knowledge/domain.md` lists available tools — but Coach tried non-existent `workflow()` tool (session 35)

**Root cause:** Agents default to environmental exploration (find, ls, env) instead of reading their own knowledge files first. This is the inverse of the expected behavior: knowledge files ARE the first resource.

**Coaching lesson (group):** "Always read your own knowledge/ directory FIRST before exploring the environment. Your knowledge files are curated to answer exactly the questions you're about to ask the filesystem."

## Pattern Severity Ranking

| Rank | Pattern | Agents | Fix Type |
|------|---------|--------|----------|
| 1 | Identity Confusion | Amy, Optimizer, Scout, Coach | **Structural** (prompt fix needed) |
| 2 | Completion Bias | Scout, Bob, Amy | **Behavioral** (coaching exercise) |
| 3 | Wasted Tool Calls | Scout, Amy, Coach | **Behavioral** (fail-fast rule) |
| 4 | Knowledge File Neglect | Scout, Amy, Coach | **Behavioral** (read-knowledge-first rule) |

## Recommendations

### 1. Structural Fix (for Optimizer/Coder — Pattern 1)
**Add explicit agent identity to all heartbeat/task prompts:**
```
[heartbeat] You are {AGENT_NAME}. Your files are in agents/{AGENT_NAME}/. 
Read agents/{AGENT_NAME}/knowledge/SOUL.md and agents/{AGENT_NAME}/heartbeat.md...
```
This eliminates the "your" ambiguity that causes 4 agents to misidentify.

### 2. Shared Knowledge Update (for all agents — Patterns 2-4)
Add to each agent's `knowledge/` or a shared coaching file:

**Fail-fast rule:** After 1 failed tool call, check your knowledge files for the correct path/method. After 2 failures at the same resource, stop and report the blocker. Never make 3+ attempts at a dead endpoint.

**Constraint compliance rule:** When a task specifies a required source/method and it's unavailable, REPORT the constraint failure to the caller before substituting. The caller decides if alternatives are acceptable.

**Knowledge-first rule:** Before exploring the filesystem with find/ls/env, read your own `knowledge/` directory. The answers are usually there.

### 3. Group Exercise Design (Patterns 2-4 combined)
**Exercise: "Constrained Task with Blocked Resource"**
- Give agent a task requiring a specific source/path that is blocked
- Agent must: (a) detect the block in ≤2 attempts, (b) check knowledge files for workaround, (c) report the constraint failure if no workaround exists, (d) NOT silently substitute
- Pass criteria: Fail-fast, knowledge-first, explicit reporting
- Fail criteria: Silent substitution, 3+ attempts at dead resource, produces wrong-identity output

This single exercise tests all three behavioral patterns simultaneously.

## Infrastructure Blocker Note

The `hasAgent` bug (`run/agent-loader.ts:466`) continues to block ALL coaching session execution. Patterns 2-4 can only be addressed through coaching exercises once this is fixed. Pattern 1 requires a structural prompt change that doesn't need live coaching.

**Recommendation priority:**
1. Fix `hasAgent` bug (enables everything else)
2. Implement identity prompt fix (Pattern 1 — no coaching needed)
3. Run group exercise (Patterns 2-4 — requires live coaching)
