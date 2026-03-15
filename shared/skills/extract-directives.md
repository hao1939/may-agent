---
name: extract-directives
description: Extract correction-directives from human sessions and route them to agent knowledge files.
version: 1.0.0
tools: [read, bash, edit, write]
---

# Skill: Extract Directives from Human Sessions

**Status**: Tested (2026-03-15, 1/3 sessions — see agents/coach/workspace/mechanism-a-test-report.md)
**Owner**: Coach
**Brief**: agents/coach/workspace/brief-mechanism-a-directive-extraction.md

## Purpose

When a human (Hao) corrects an agent mid-conversation, that correction is a **directive** — a learning signal that should persist beyond the session. This skill extracts those directives and routes them to the appropriate agent's knowledge files.

## What Is a Directive?

A directive is a correction pattern with three parts:
1. **What the agent did** (the wrong behavior)
2. **What the human wanted** (the correction)
3. **The general rule** (the extractable lesson)

### Examples
| Agent Action | Human Correction | Extracted Directive |
|---|---|---|
| May forwarded tasks blindly | "Review first, don't just pass it along" | **Review-Before-Forward**: Inspect delegated tasks for validity before forwarding to target agent. |
| Coach ran verbose analysis | "Brief, not verbose" | **Brevity**: Keep analysis concise. Lead with conclusion, supporting detail below. |
| Amy edited another agent's file | "Don't touch other agents' files" | **Scope Boundary**: Never edit files outside your own `agents/<name>/` directory. |
| Evaluator claimed work wasn't done | "Check the tool calls before concluding" | **Evidence-First**: Count tool calls (grep for tool names) before claiming work was/wasn't performed. |

## Detection Heuristics

Scan the transcript for these **correction patterns** (ordered by reliability):

### High-confidence patterns (weight: 3)
- Human says **"no"**, **"wrong"**, **"don't"**, **"stop"** followed by an instruction
- Human provides **explicit alternative** after agent action: "Instead, do X" / "Actually, X" / "The right way is X"
- Human uses **negation + redirect**: "Not like that, like this"

### Medium-confidence patterns (weight: 2)
- Human **repeats an instruction** the agent already received (agent missed it first time)
- Human says **"I said"** or **"I already told you"** (re-correction)
- Human provides **context the agent should have known**: "Remember, we agreed X"

### Low-confidence patterns (weight: 1)
- Human **answers a question** the agent should have been able to answer itself
- Human provides **clarification** that changes agent's approach
- Human **interrupts** agent mid-execution to redirect

### NOT corrections (false positive filters)
- Human providing **new information** the agent couldn't have known
- Human **confirming** what the agent did ("yes", "good", "correct")
- Human **asking questions** (not correcting)
- Human providing **preferences** for the first time (not a correction if first mention)
- **Heartbeat prompts** or system-generated messages

## Extraction Procedure

### Step 1: Identify the session
```bash
# Find sessions with human participation (parentAgent: null) and multiple user turns
for dir in $(ls -t .state/sessions/history/); do
  meta=".state/sessions/history/$dir/meta.json"
  parent=$(jq -r '.parentAgent // "null"' "$meta" 2>/dev/null)
  if [ "$parent" = "null" ]; then
    jsonl=".state/sessions/history/$dir/session.jsonl"
    user_turns=$(grep -c '"role":"user"' "$jsonl" 2>/dev/null)
    if [ "$user_turns" -gt 2 ]; then
      echo "$dir (user_turns=$user_turns)"
    fi
  fi
done
```

### Step 2: Scan for correction patterns
```bash
# Extract user messages and grep for correction signals
grep '"role":"user"' "$jsonl" | jq -r '.content' | \
  grep -iE '(no,|wrong|don.t|stop|instead|actually|not like|I said|I already)' 
```

### Step 3: Extract the directive
For each correction found, extract:
```markdown
## Directive: [Short Name]
- **Session**: [session_id]
- **Agent**: [agent_name]
- **What happened**: [Agent did X]
- **Correction**: [Human said Y]
- **Rule**: [General principle Z]
- **Confidence**: [high/medium/low based on pattern weight]
```

### Step 4: Dedup check
Before adding, check if the directive already exists:
```bash
# Check agent's existing knowledge
grep -ri "[key phrase from rule]" agents/<agent>/LESSONS.md agents/<agent>/knowledge/ 2>/dev/null
```

### Step 5: Route the directive
- **Behavioral** (how the agent acts) → `agents/<agent>/LESSONS.md`
- **Procedural** (how to do a task) → `agents/<agent>/knowledge/directives.md`
- **Cross-agent** (applies to everyone) → `agents/shared/knowledge/directives.md`

If the directive is **new and high-confidence**, apply it via the Growth Cycle (fork → add lesson → verify → promote). If it's low-confidence, log it to Coach's workspace for review.

## Output Format

After extraction, produce a report:
```markdown
# Directive Extraction Report — [session_id]
- **Agent**: [name]
- **Directives found**: [N]
- **New (to apply)**: [list]
- **Duplicate (already known)**: [list]
- **False positives (filtered)**: [list with reason]
- **False positive rate**: [filtered / (filtered + real)] 
```

## Integration with Post-Session Hook (Future)

When tech-lead implements the post-session hook:
1. Hook fires after sessions with `parentAgent: null` and `user_turns > 2`
2. Hook calls Coach with: `"Extract directives from session [session_id]"`
3. Coach runs this skill and produces the report
4. High-confidence new directives trigger a Growth Cycle automatically

## Constraints
- **Conservative**: Better to miss a correction than fabricate one. When in doubt, classify as "low-confidence" and log for human review.
- **No self-generation**: Directives come from human corrections only. Coach does not invent directives from agent failures alone (that's the evaluator's job).
- **Dedup strictly**: If a lesson already exists, don't add a duplicate. Instead, note the recurrence in the existing lesson.
