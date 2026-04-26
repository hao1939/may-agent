---
name: progressive-work-persistence
description: >
  Save intermediate work products to disk as each deliverable completes, rather than
  buffering all output in context until the end. Uses checkpoint() for structured
  session state and write() for file deliverables. Prevents total work loss on
  session interruption, and bridges context to the next session. Addresses the gap
  between "plan your work" skills and "verify your work" skills — this is about
  preserving your work mid-flight.
version: 1.0.0
owner: optimizer
tools: [checkpoint, write]
agents: [scout, coach, tech-lead, optimizer, coder, bob]
evidence: >
  Cross-agent analysis of 30+ sessions. Scout s_1774323366235_151 explicitly uses
  "SAVE-AS-YOU-GO" with 8 progressive file writes (triage → DD#463 → DD#464 → DD#465).
  Bob uses 2-4 checkpoints per session consistently (s_146: 4 checkpoints, s_152:
  5 writes + 2 checkpoints). Optimizer uses 2 checkpoints per session (s_138, s_134).
  Contrast: Coach s_145 and s_148 do 20+ tool calls with 0 saves — high work-loss risk.
  QA does 0 saves across 6 sessions. May does 0 saves but has tiny (2-8 call) sessions
  where the risk is low.
---

# Progressive Work Persistence: Save Early, Save Often

## When to Apply

Apply this skill **during any session** where you produce multiple deliverables or
perform extended analysis (15+ tool calls). Specific triggers:

1. **You just completed one deliverable and are about to start the next.** Before
   moving to the next deep dive, write the completed one to disk. Don't carry 3
   completed analyses in context while working on the 4th.

2. **You're past the halfway point of your ops budget.** If you've used 30+ of
   your 60 ops and haven't saved any work yet, you're gambling that the session
   completes cleanly. Save now.

3. **You've made a significant state change** (edited a file, published a document,
   escalated to another agent). Checkpoint the state so the next session knows what
   was accomplished.

4. **You're about to start a risky operation** (complex multi-file edit, web scrape
   that might fail, delegation that might time out). Save what you have BEFORE the
   risky step.

5. **You've completed a major analysis step** and the findings exist only in your
   context window. Write them to a workspace file or checkpoint.

**Do NOT apply** when:
- Your session is tiny (< 10 tool calls) — the overhead isn't worth it
- You're only reading/analyzing with no intermediate outputs to save
- The entire session is a single atomic operation (one edit, one verification)

## Why This Matters

### The Work-Loss Risk
Sessions can end unexpectedly: ops budget exhausted, environment timeout, or an
unrecoverable error late in the session. If all your work exists only in your context
window, it's gone.

**Concrete example**: Scout's session s_151 triaged 33 papers and deep-dived 3.
Without SAVE-AS-YOU-GO, a crash after DD#463 would lose ALL triage AND the second/third
deep dives. With it, the triage file + DD#463 were already on disk — only the in-progress
DD would be lost.

### The Context-Bridge Benefit
When you checkpoint structured data (e.g., `{activeNudge: "verified-tuned", nextAction:
"update-focus-tasks"}`), the next session can read your checkpoint and skip the
re-investigation. Without it, the next session starts from scratch and may repeat
20+ minutes of work.

## The Pattern (3 Mechanisms)

### Mechanism 1: Write Deliverables Immediately
When you complete a file deliverable (report, deep dive, analysis, scenario), write it
to disk immediately — don't wait until you've completed all deliverables.

```
# GOOD (Scout's SAVE-AS-YOU-GO pattern):
analyze(paper_1) → write("workspace/DD-463.md", content) →
analyze(paper_2) → write("workspace/DD-464.md", content) →
analyze(paper_3) → write("workspace/DD-465.md", content)

# BAD (batch at end):
analyze(paper_1) → analyze(paper_2) → analyze(paper_3) →
write("workspace/DD-463.md") → write("workspace/DD-464.md") → write("workspace/DD-465.md")
```

The GOOD pattern saves each deliverable as it's done. The BAD pattern risks losing all
3 if the session ends after paper_2's analysis but before the write batch.

### Mechanism 2: Checkpoint After Major State Changes
When you complete a significant action (verified a fix, published a document, sent a
delegation), use `checkpoint()` to persist structured state:

```
checkpoint({
  summary: "Verified active-nudge tuning. Per-agent thresholds confirmed.",
  data: {
    activeNudge: "verified-tuned",
    thresholds: { builders: 20, coach: 25, research: 30 },
    nextAction: "update-focus-tasks"
  }
})
```

This gives the next session a structured starting point instead of having to
re-investigate from scratch.

### Mechanism 3: Pre-Risk Save
Before attempting a risky operation, save what you have:

```
# Before a complex edit that might fail:
checkpoint({ summary: "About to refactor billing module", data: { plan: "...", files_analyzed: [...] } })
edit(...)  # If this fails, the plan is still in the checkpoint

# Before a delegation that might time out:
write("workspace/analysis-so-far.md", findings)
agents.call(...)  # If this times out, findings are on disk
```

## Decision Heuristic

```
After completing each work unit, ask:
  "If this session ended RIGHT NOW, what work would be lost?"

If the answer is "significant analysis/output" → SAVE before continuing.
If the answer is "nothing important" → continue.
```

## Anti-Patterns

### 1. The Delayed Batch
Completing 3+ deliverables in context, then writing them all at the end.
**Risk**: Session ends at deliverable 2.5, losing everything.
**Fix**: Write each one immediately after completion.

### 2. The Checkpoint-Free Long Session
Using 40+ ops without a single checkpoint or write.
**Risk**: Next session has no context bridge; session interruption loses all work.
**Fix**: Checkpoint after every major milestone (15-20 ops between checkpoints max).

### 3. The Context-Only Analysis
Performing deep analysis that produces findings which exist only in the conversation.
**Risk**: Findings vanish when session ends; no artifact for other agents to read.
**Fix**: Write analysis to a workspace file (even a short summary) before moving on.

## Assertions

1. **At least one write() or checkpoint() before the halfway ops mark** — in any session
   with 20+ tool calls, the agent persists work (via `write()` to a non-scratch file or
   `checkpoint()`) before consuming 50% of its ops budget.

2. **Each completed deliverable is written before the next is started** — when the agent
   produces multiple file deliverables, each one is saved to disk before analysis begins
   on the next. No two deliverables exist only in context simultaneously.

3. **Structured checkpoint before risky operations** — before delegating to another agent,
   running a complex multi-file edit, or performing an operation that might timeout/fail,
   the agent calls `checkpoint()` or `write()` to persist current state.

4. **No session ends with 30+ tool calls and zero saves** — any session that uses 30 or
   more tool calls must include at least one `write()` or `checkpoint()` call. Sessions
   that do significant work without any persistence are a skill violation.

5. **Checkpoint data is structured and actionable** — checkpoint calls include a `summary`
   describing what was accomplished and `data` with enough context for the next session
   to resume without re-investigation (e.g., what was done, what's next, key decisions).

## Integration with Other Skills

- **budget-before-act**: After estimating your budget, plan your save points.
  If budget is tight, save more frequently.
- **investigate-and-fix**: After Step 3 (identify root cause) and before Step 4
  (implement fix), checkpoint your diagnosis. If the fix goes wrong, the diagnosis
  is preserved.
- **scope-discipline**: If you're doing a multi-deliverable session, save each
  deliverable independently so scope cuts don't lose completed work.
