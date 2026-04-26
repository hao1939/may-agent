---
name: extract-directives
description: Extract correction-directives from human sessions and route them to agent knowledge files. Also extracts conversation state (Mechanism C) into agents/may/conversation-state.md.
version: 1.1.0
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

## Conversation State Extraction (Mechanism C)

**Scope**: May only. Other agents receive context via delegation briefs.
**Output**: `agents/may/conversation-state.md`
**Trigger**: Same as directive extraction — after sessions with `parentAgent: null` and `user_turns > 2`.

### What to Extract

From the human conversation, extract these 5 fields and write them to `agents/may/conversation-state.md`:

| Field | Source | Update Policy |
|---|---|---|
| **Current Focus (The Stack)** | What Hao is currently working on. Look for: task descriptions, "let's work on X", "fix Y" | Overwrite on every update |
| **Pending Human Input** | Questions or blockers awaiting Hao. Look for: agent questions Hao hasn't answered, explicit "waiting on you" | Overwrite on every update; clear if Focus changes |
| **Interaction Mode** | Hao's communication style in this session. Look for: "be brief", "just do it", tone cues | Overwrite on every update |
| **Recent Decisions (Last 5)** | Explicit choices Hao made. Look for: "use X not Y", "let's go with Z", approvals/rejections | Rolling window — keep last 5, drop oldest |
| **Session Memory (Last 3)** | 1-line summary of what happened in this session | Rolling window — keep last 3 |

### Extraction Procedure

#### Step 1: Read current state
```bash
cat agents/may/conversation-state.md
```
Parse existing Recent Decisions and Session Memory lists for rolling-window merge.

#### Step 2: Scan the session transcript
```bash
# Extract user messages for focus/mode/decisions
grep '"role":"user"' "$jsonl" | jq -r '.content'
```

Look for:
- **Focus signals**: "let's", "I want", "work on", "fix", "build", task descriptions
- **Decision signals**: "use X", "go with Y", "approved", "rejected", "don't use", "switch to"
- **Mode signals**: "be brief", "concise", "stop suggesting", "just do it", tone indicators
- **Pending signals**: unanswered questions from the agent, "I'll get back to you", explicit blockers

#### Step 3: Compose the updated state
```markdown
# Conversation State
*Auto-updated. Do not edit manually unless correcting errors.*

## 🎯 Current Focus (The Stack)
- **Primary**: [High-level goal from session]
- **Immediate**: [Current step being worked on]
- **Context**: [Why — business reason or chain of reasoning]

## ⏳ Pending Human Input
- [Specific question or blocker]
- *Status*: [Blocked / Asynchronous]

## 🌡️ Interaction Mode
- **Tone**: [e.g., Concise, Technical, Exploratory]
- **Constraint**: [e.g., "No new features, focus on bug"]

## 📝 Recent Decisions (Last 5)
- [YYYY-MM-DD]: [Decision]
... (merge with existing, keep newest 5)

## 📚 Session Memory (Last 3)
- **[YYYY-MM-DD HH:MM]**: [1-line summary]
... (merge with existing, keep newest 3)
```

#### Step 4: Write the file
```bash
write agents/may/conversation-state.md "[composed content]"
```

### Anti-Patterns
- **Do NOT duplicate task tracking**: Tasks are tracked in the request DB. If Hao says "add a task to do X", use `agents.message()` — not this file.
- **Do NOT invent state**: If the session doesn't clearly indicate a focus change, keep the existing focus. Only update fields where the session provides clear signal.
- **Do NOT include all agents**: This file is for May only (P111 Context Pollution). Other agents get context via delegation briefs.

### Relationship to Other Files
- **`directives.md`** = ROM (Permanent Constitution) — "Always use TypeScript"
- **`conversation-state.md`** = RAM (Transient Context) — "Fix the P82 bug right now"
- **Request DB** = Disk (Work Queue) — tasks tracked via `agents.message()`

## Integration with Post-Session Hook (Future)

When tech-lead implements the post-session hook:
1. Hook fires after sessions with `parentAgent: null` and `user_turns > 2`
2. Hook calls Coach with: `"Extract directives from session [session_id]"`
3. Coach runs this skill and produces the directive extraction report
4. High-confidence new directives trigger a Growth Cycle automatically
5. Conversation state is updated in `agents/may/conversation-state.md` (Mechanism C)

## Constraints
- **Conservative**: Better to miss a correction than fabricate one. When in doubt, classify as "low-confidence" and log for human review.
- **No self-generation**: Directives come from human corrections only. Coach does not invent directives from agent failures alone (that's the evaluator's job).
- **Dedup strictly**: If a lesson already exists, don't add a duplicate. Instead, note the recurrence in the existing lesson.
