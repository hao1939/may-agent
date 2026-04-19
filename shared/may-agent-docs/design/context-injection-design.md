# Design: Context Injection — What Goes Where

## Principle

**System prompt = who you are + how the system works (stable)**
**User message = what you're doing now (changes per session)**

Agent decides what to do based on context. We provide the right context at the right layer.

---

## System Prompt (auto-injected every session)

| Content | Why | Size |
|---------|-----|------|
| **SOUL.md** | Agent character — identity, role, preferences. Drives different decisions per agent. Includes agent's preferred workflows for their typical work types. | ~6K |
| **common-sense.md** | How to use the system — projects, heartbeats, metrics, tools, escalation. Includes general workflow guidance (when to use persistent-task vs implement-and-verify vs inline). | ~5K |
| **Available tools** | What tools the agent can call | ~200 |
| **Runtime environment** | Paths, workspace, what's already in context | ~500 |
| **Total** | | ~12K (~3K tokens) |

That's it. Nothing else auto-injected into system prompt.

---

## User Message (the task — varies per session)

The first user message is ONLY what the caller sends. Examples:

**Heartbeat:** The heartbeat.md content + any injected metrics/pending tasks.
**Persistent-task worker:** Goal + milestones + current state + owner guidance (from buildWorkerPrompt).
**Fork from May:** The specific task description.

No session history, no digests, no recalls, no context.md. Just the task.

---

## Workflows (process enforcement — not injected, invoked)

Workflows are tools, not context. The agent decides which workflow to use.

**Three layers of workflow selection:**

1. **Task instruction (highest priority):** The task says "Run persistent-task workflow for this project" → agent uses it.
2. **Agent preference (SOUL.md):** Each agent's SOUL.md includes preferred workflows for their work types. E.g., Coach: "For experiments use persistent-task, for training use growth-cycle."  
3. **Common-sense default (fallback):** common-sense.md describes when to use which workflow generally. "Multi-session work → persistent-task. Code changes → implement-and-verify."

**Override chain:** task instruction > agent preference > common-sense default

**Reviewer override:** In a persistent-task loop, the reviewer can say "CONTINUE — use implement-and-verify for the next iteration." This overrides the agent's default for that specific step. The override appears in the next worker prompt as owner guidance.

---

## Skills (behavioral patches — indexed, loaded on demand)

**NOT fully injected.** System prompt includes a skill index only:

```
## Available Skills (read full content when triggered)
- verify-after-edit: after any edit()/write(), verify the result
- read-before-edit: before editing, read the file first
- evidence-over-narrative: back claims with tool output
For full instructions: read("agents/<you>/skills/<name>.md")
```

**On-demand loading:** Agent reads full skill content when the trigger matches their current action.

**Per-task override:** Caller or reviewer can inject specific skills:
- Task: "For this task, read skill: agents/coach/skills/gym-execution-checklist.md first"
- Reviewer: "CONTINUE — before next iteration, load the verify-after-edit skill"

---

## Standing Orders (constraints — enforced by guard, not prompt)

**NOT in system prompt.** Moved to a guard that checks on finish():

- Agent works without seeing orders in prompt
- Guard checks: does the output violate any standing order?
- If yes → block finish, tell agent which order was violated
- If no → allow

Structural enforcement (KE-007) > text in prompt (KE-002).

---

## Knowledge (on-demand discovery)

**NOT in system prompt.** Agent discovers knowledge through:

- Breadcrumbs in common-sense.md: "For verified findings: read agents/shared/knowledge-essentials.md"
- Task-specific pointers: "Reference: KE-123 says don't stack interventions"
- Own exploration during heartbeats

---

## Summary: What's Auto-Injected

| Layer | Content | Auto-injected? |
|-------|---------|---------------|
| **System prompt** | SOUL.md | ✅ Yes — agent identity |
| **System prompt** | common-sense.md | ✅ Yes — system usage + workflow guidance |
| **System prompt** | Available tools | ✅ Yes — tool list |
| **System prompt** | Runtime environment | ✅ Yes — paths |
| **System prompt** | Skill index (names + triggers) | ✅ Yes — ~500 chars |
| **User message** | The task | ✅ Yes — what the caller sent |
| **User message** | Session history / digests | ❌ No — removed |
| **User message** | Active recall / FM warnings | ❌ No — removed |
| **User message** | context.md | ❌ No — agent reads if needed |
| **System prompt** | Standing orders | ❌ No — guard enforces |
| **System prompt** | Knowledge essentials | ❌ No — on-demand |
| **System prompt** | Full skill content | ❌ No — index only, load on-demand |

## Size Comparison

| | Before | After |
|-|--------|-------|
| System prompt | ~51K (13K tokens) | ~12K (3K tokens) |
| First user message | ~55K (context) + task | Task only |
| Total per first call | ~106K | ~12K + task |

---

## Open Questions

1. Skill index — does the trigger format reliably cause agents to load skills on demand? Test in gym.
2. Standing-orders guard — design needed. How does the guard check free-form text against orders?
3. Workflow preference in SOUL.md — what format? Table? Prose?
4. Per-task skill override — does the persistent-task workflow need a `skills` parameter?
