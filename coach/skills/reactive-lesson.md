---
name: reactive-lesson
description: Process human correction signals and create lessons in near-real-time via SIGNALS.md.
version: 1.0.0
tools: [read, bash, edit, write, fork_agent, verify_agent, promote_agent]
---

# Skill: Reactive Lesson Creation from Human Corrections

**Status**: Tested (2026-03-15, 3/3 simulated signals — see agents/coach/workspace/mechanism-b-test-report.md)
**Owner**: Coach
**Brief**: agents/coach/workspace/brief-mechanism-b-reactive-coach-trigger.md

## Purpose

When Hao corrects an agent mid-session, Coach should create a lesson from that correction within one heartbeat cycle — not hours later via eval triage. This skill defines how Coach processes correction signals delivered via SIGNALS.md.

## Signal Format

A correction signal is posted to `agents/shared/SIGNALS.md` (by the session hook or manually by May):

```markdown
## Correction Signal: [timestamp]
- **From**: system (or may)
- **To**: coach
- **Session**: [session_id]
- **Agent**: [agent_name]
- **Correction**: "[human's exact words]"
- **Context**: "[what the agent did that triggered the correction]"
- **Status**: PENDING_ACK
- **read_by**: []
```

## Processing Workflow

### Step 1: ACK the signal
Update status to ACKED in SIGNALS.md.

### Step 2: Verify the correction
Read the session transcript to confirm:
- The correction actually happened (not a false positive from pattern matching)
- The agent's behavior was genuinely wrong (not a misunderstanding)
- The correction is specific enough to extract a rule

```bash
# Read the correction context
grep -A5 -B5 "[correction keywords]" .state/sessions/history/[session_id]/session.jsonl
```

If the correction is invalid or ambiguous, update the signal status to `REJECTED` with a note explaining why. Log to Coach's workspace.

### Step 3: Check for existing coverage
```bash
# Does a lesson already cover this?
grep -ri "[key concept]" agents/[agent]/LESSONS.md agents/[agent]/knowledge/ 2>/dev/null
# Also check graduated locations:
grep -ri "[key concept]" agents/[agent]/heartbeat.md agents/[agent]/SOUL.md agents/[agent]/TOOLS.md agents/[agent]/DOMAIN.md 2>/dev/null
```

**If covered**: This is a recurrence. Update the existing lesson with a recurrence count and the new session ID. Consider structural escalation (if 3+ recurrences, the lesson format isn't working — try a different enforcement mechanism like a heartbeat gate or self-check).

**If new**: Proceed to Step 4.

### Step 4: Create the lesson via Growth Cycle

```
1. Fork the agent:     fork_agent("[agent]", "[agent]-correction-fix")
2. Add the lesson:     Write to agents/.lab/[agent]-correction-fix/LESSONS.md
3. Verify:             verify_agent("[agent]-correction-fix", "[task that would trigger the old behavior]")
4. Promote:            promote_agent("[agent]-correction-fix", "[agent]")
```

#### Lesson format
```markdown
## [Short Name] — Reactive Lesson [date]
**Source**: Human correction in session [session_id]
**Pattern**: When [situation], I was doing [wrong thing].
**Rule**: [What to do instead]. 
**Recurrence**: 1 (first instance)
**Verification**: [session_id of verify_agent run]
```

### Step 5: Close the signal
Update the signal in SIGNALS.md:
```markdown
- **Status**: RESOLVED
- **Resolution**: Lesson "[Short Name]" added to agents/[agent]/LESSONS.md via Growth Cycle. Verified in session [verify_session_id].
```

### Step 6: Log
Append to Coach's journal:
```markdown
## Reactive Lesson — [date]
- **Signal**: [correction summary]
- **Agent**: [name]
- **Lesson**: [short name]
- **Cycle time**: [minutes from signal to promotion]
- **Outcome**: [APPLIED / DUPLICATE / REJECTED]
```

## Handling Edge Cases

| Situation | Action |
|---|---|
| Correction is ambiguous | Log as low-confidence, don't create lesson. Set signal to DEFERRED. |
| Agent already has the lesson but keeps violating | Escalate: add recurrence count. If 3+, try structural fix (heartbeat gate, self-check, pre-action validation). |
| Correction conflicts with existing lesson | Flag for human review. Don't auto-resolve conflicts. |
| Multiple corrections in one session | Process each independently. One signal per correction. |
| Correction is about infrastructure, not behavior | Route to tech-lead, not Coach. Set signal to REDIRECTED. |
| Structural enforcement already applied but behavior still recurs | Flag as INFRASTRUCTURE_ISSUE. The lesson and structure exist but aren't preventing the behavior. Escalate beyond lesson/structure: consider model-level prompting, architectural change, or accept as known limitation. |

## Latency Target

- **Signal to ACK**: Same heartbeat cycle (< 5 min)
- **ACK to lesson promoted**: Same heartbeat cycle if simple (< 10 min), next heartbeat if complex
- **Total correction-to-lesson**: < 15 min for high-confidence corrections

## Constraints

- **Conservative detection**: False positives are worse than missed corrections. Only act on clear, specific corrections.
- **One lesson per correction**: Don't bundle. Each correction gets its own lesson for traceability.
- **Growth Cycle mandatory**: No editing live agents directly. Always fork → verify → promote.
- **Human review for conflicts**: If a new correction contradicts an existing lesson, don't auto-resolve. Flag it.
