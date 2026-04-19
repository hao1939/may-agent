# Scout Heartbeat Patch: Add Cross-Agent Delegation

## Context
Coach investigated Scout's zero-delegation problem. Full investigation at `agents/coach/workspace/scout-delegation-investigation.md`.

Key stats:
- Scout: 1,146 sessions, **1** child session spawned (total, ever)
- Bob: 595 children, Coach: 371, Optimizer: 226, Tech-lead: 191
- Scout's archetype correctly lists `agents` and `workflow` tools — this is behavioral, not config
- Scout has **~20 "Flag for Bob" items** in todo.md that were never actually sent

## Root Cause
Scout's heartbeat only teaches self-forking (scout→scout work sessions). There are zero examples of cross-agent delegation via `agents.message()`. Scout also developed a "fork broken" belief from early tool unavailability issues.

## Patch: Add to agents/scout/heartbeat.md

### Location: After the "Phase Structure" tables, before "### Scout Work Session Examples"

Insert this section:

```markdown
### 📤 Cross-Agent Recommendations (Phase 4 — PUSH, don't just note)

Your research only creates value when specialists act on it. **Don't just write "Flag for Bob" in todo.md** — actually send the message. Use `agents.message()` to push high-signal findings to the right agent:

**When to send** (during Phase 4 of any work session, or inline if it's a quick note):
- You wrote a DD that directly validates or challenges an active experiment → message the experimenter
- You found a paper with concrete implementation patterns → message the implementer
- You identified a risk or regression signal → message the relevant owner

**How to send:**
\```javascript
// After writing DD#XXX that's relevant to Bob's experiment
agents.message({
  agent: 'bob',
  message: 'Scout DD#XXX (paper title) directly validates/challenges your EXP-YYY. Key finding: <1 sentence>. Action: <specific recommendation>. File: agents/shared/knowledge/library/deep-dives/DD-XXX.md',
  context_files: ['agents/shared/knowledge/library/deep-dives/DD-XXX.md']
})

// After finding implementation patterns relevant to tech-lead
agents.message({
  agent: 'tech-lead',
  message: 'Scout found <pattern> in DD#XXX that maps to <system component>. Concrete recommendation: <what to do>. File: agents/shared/knowledge/library/deep-dives/DD-XXX.md',
  context_files: ['agents/shared/knowledge/library/deep-dives/DD-XXX.md']
})

// After synthesis reveals training implications
agents.message({
  agent: 'coach',
  message: 'CR#XXX synthesis suggests <training insight>. Relevant experiments: <list>. File: agents/shared/knowledge/library/deep-dives/CR-XXX.md',
  context_files: ['agents/shared/knowledge/library/deep-dives/CR-XXX.md']
})
\```

**Routing guide:**
| Finding type | Send to | Example |
|-------------|---------|---------|
| Validates/challenges active experiment | **bob** | "DD#698 AEGIS independently validates EXP-103" |
| Implementation pattern for our system | **tech-lead** | "Tri-state semantics from DD#699 maps to guard system" |
| Training insight or skill gap signal | **coach** | "CR#322 suggests verification-as-evidence-architecture skill" |
| Performance/efficiency pattern | **optimizer** | "DD#XXX shows 3x throughput with batched evaluation" |
| Risk or regression signal | **tech-lead** + relevant agent | "Paper shows failure mode matching our KE-XXX" |

**Rule: Every "Flag for X" in todo.md must become an `agents.message()` call.** If you write "Flag for Bob (HIGH)" but don't send a message, the flag is invisible. Bob reads the shared library — but a direct message ensures timely action.
```

### Also: Fix the "fork broken" note in todo.md

Scout's todo.md line 30 says:
> **Fork mechanism**: Confirmed non-functional.

And line ~832 says:
> DEFERRED (fork broken, heartbeat prohibits inline research)

These need updating. Fork is now working — session s_1776147698528_19 successfully spawned child s_1776147744848_24 on 2026-04-14. The "fork broken" belief is stale.

### Also: Add to Phase 4 description

The Phase 4 row currently says:
> **4. Propagate** | Update INDEX.md, papers.md/repos.md, write RECOMMEND lines | ≤5 ops | Library updated, actionable items dispatched

Add to gate: "...actionable items dispatched **via agents.message()**"
