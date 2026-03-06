# Evaluation: MAST Failure Classification for May-Agent Coaching

**Date**: 2026-03-22
**Task**: Review OpenClaw's structured failure taxonomy (MAST failure codes FM-1.x through FM-2.x) and evaluate adopting it for coaching sessions.
**Source**: `todo.md` item #1 under "OpenClaw Learnings — Coaching Patterns"
**Input**: `/home/hao/openclaw-config/knowledge/failure-analysis-2026-02-25.md`

---

## What MAST Failure Classification Does

OpenClaw's failure analysis uses a structured catalog of failure mode codes:

| Code | Meaning (inferred from usage) |
|------|-------------------------------|
| FM-1.3 | Partial completion without checkpoint / not following own spec |
| FM-1.4 | Persisting despite repeated failure |
| FM-1.5 | No escalation on persistent failure / unresolved blocker |
| FM-2.3 | Incorrect assumption about available tools |
| FM-2.4 | Stale state leading to incorrect action |
| FM-2.6 | Reasoning-action mismatch (knows what to do, doesn't do it) |
| FM-3.3 | Incorrect verification (declared broken without proper checking) |

Each failure gets:
1. **Code assignment** — maps failure to a taxonomy
2. **Root cause classification** — agent problem vs design problem vs infrastructure
3. **Fix-applied status** — what was changed and where
4. **Recurrence check** — did the fix actually work? ✅/⚠️/❌

## What We Currently Do

Our coaching reports use:
- **Narrative descriptions** of failures (e.g., "QA used write() after truncated read — the blind-overwrite pattern")
- **PASS/PARTIAL/FAIL scoring** per exercise
- **Recommendations** in prose (e.g., "Extend QA domain.md to cover writes after truncated reads")
- **Tracking section** in todo.md with ✅/⚠️/❌ status icons

We do NOT:
- Assign coded failure identifiers
- Systematically classify root cause type (agent/design/infra)
- Track recurrence with structured checks
- Cross-reference failures across agents using a shared taxonomy

## Evaluation

### What's valuable in MAST (adopt)

**1. Root cause classification (agent / design / infrastructure)**
This is the strongest element. Our current reports sometimes blur the line between "the agent behaved badly" and "the agent's instructions were incomplete." The QA truncated-read session is a perfect example: the report correctly identifies it as both an agent behavior gap AND a domain.md gap, but this distinction is buried in prose. A structured classification forces the coach to answer: "Is this the agent's fault, a design gap, or an infra problem?" — which directly determines whether the fix is coaching, optimization, or ops work.

**Recommendation: Adopt.** Add a "Root Cause" field to coaching reports: `Agent | Design | Infrastructure | Both(Agent+Design)`.

**2. Recurrence checking**
MAST explicitly asks "did the fix work?" with a ✅/⚠️/❌ marker and evidence. We track this informally (e.g., the coder blind-overwrite coaching was itself a recurrence check of the lessons.md training), but we don't systematically revisit. This maps well to our existing "Priority 5 — Regression Testing" in domain.md, but we rarely actually use it.

**Recommendation: Adopt.** After each coaching session with findings, add a recurrence-check item to todo.md with a target date. Format: `- [ ] **Recurrence check: <agent> <pattern>** — Re-run <exercise> to verify fix holds. Target: <date>.`

**3. Fix-applied tracking**
MAST tracks exactly which file was changed to address each failure. We do this in our Tracking section but inconsistently — sometimes just "handled via domain.md update" without specifying which file or what was added.

**Recommendation: Adopt.** Tracking entries should include the file changed: `✅ Task — result. Fix: <file> updated with <what>.`

### What's NOT valuable (skip)

**4. Failure code taxonomy (FM-1.x, FM-2.x, FM-3.x)**
This is the headline feature of MAST, and I recommend **not** adopting it. Here's why:

- **Scale mismatch.** OpenClaw had 4 agents with 40+ heartbeat runs producing dozens of failures — enough volume to justify a taxonomy. We have 5 coaching sessions total. A taxonomy needs volume to earn its overhead.
- **Code opacity.** "FM-2.6" means nothing without looking up the table. "Reasoning-action mismatch" is immediately clear. In our current reports, plain English descriptions are more useful than codes.
- **Premature abstraction.** We don't yet know what our recurring failure patterns are (we've only coached coder and QA). Creating a taxonomy before the patterns emerge means we'll either (a) adopt OC's codes which may not fit our failures, or (b) create our own taxonomy that's too early to be stable.
- **Coach overhead.** Adding code assignment to each finding adds cognitive load without clear benefit at our scale. The coach's job is to observe, intervene, and report — not maintain a classification system.

**If** our failure catalog grows to 15+ distinct patterns across 5+ agents, revisit this. At that point, natural clusters will be evident and a taxonomy will organize itself.

**5. Summary tables by root cause type**
The summary table in the OC analysis (agent/design/fixed?) is elegant but is a byproduct of having a large enough failure set. With 2-3 findings per session, a table adds formatting overhead without insight. Skip for now.

## Decision Summary

| MAST Element | Adopt? | Why |
|-------------|--------|-----|
| Failure code taxonomy (FM-x.x) | ❌ No | Scale mismatch; premature abstraction; codes are opaque |
| Root cause classification | ✅ Yes | Forces clarity on who owns the fix (coach vs optimizer vs ops) |
| Fix-applied tracking | ✅ Yes | Makes tracking entries actionable — what file, what change |
| Recurrence checking | ✅ Yes | Formalizes regression testing we should already be doing |
| Summary tables | ❌ No | Premature at current failure volume |

## Concrete Changes

### 1. Coaching report template addition
Add to each exercise finding:
```
**Root Cause**: Agent / Design / Infrastructure / Both
**Fix Owner**: Coach (coaching.md) / Optimizer (domain.md, lessons.md) / Ops (infrastructure)
```

### 2. Tracking entry format
Current: `- [date] ✅ Task — result summary`
New: `- [date] ✅ Task — result summary. Root cause: X. Fix: <file> + <change>.`

### 3. Recurrence check items
After coaching sessions with failed/partial exercises, add:
```
- [ ] **Recurrence check: <agent> <pattern>** — Re-run <exercise>. Target: +2 weeks.
```

### 4. Revisit trigger
If the coaching journal accumulates 15+ distinct failure patterns, revisit the taxonomy question. At that point, natural failure clusters should be evident.

---

## What This Does NOT Require

- No changes to agent domain.md files (this is coach methodology, not agent behavior)
- No new files or tracking systems (enrich existing reports and todo.md)
- No changes to CONVENTIONS.md (these are coach-internal practices)
- No coaching sessions needed (this is a process improvement, not agent training)
