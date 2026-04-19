# Design: Context Injection — What Goes Where

## System Prompt (every session, every turn)

Only what the agent needs to BE itself and USE the system:

| Content | Why | Size |
|---------|-----|------|
| **SOUL.md** | Agent character — drives different decisions per agent | ~6K |
| **common-sense.md** | How to use the system — tools, workflows, projects, escalation | ~5K |
| **Available tools** | What tools exist | ~200 |
| **Runtime environment** | Paths, workspace | ~500 |
| **Total** | | ~12K |

## NOT in system prompt

| Content | Where instead | Why |
|---------|--------------|-----|
| **standing-orders.md** | Guard that reviews agent output against orders | Orders are constraints, not identity. A guard checks compliance after the fact. |
| **knowledge-essentials.md** | Available for agent to read on-demand, or injected during brainstorm/research steps | Knowledge is context for specific tasks, not permanent identity. |
| **skills/*.md (full content)** | Agent indexes preferred skills by name. Full content loaded on-demand when task matches. | 35K of skills bloats every session. Pi's model: descriptions in prompt, full content when needed. |

## Skills: Index + On-Demand

**System prompt includes:** A skill index — name + one-line trigger condition per skill.

```
## Available Skills
- verify-after-edit: TRIGGER: after any edit() or write() call
- read-before-edit: TRIGGER: before editing a file you haven't read this session
- evidence-over-narrative: TRIGGER: when making claims about system state
```

**Agent loads full skill when triggered:** Uses `read("agents/<me>/skills/<name>.md")` to get the full instructions when the trigger condition matches.

This is pi's progressive disclosure model. Agent sees ~500 chars of skill index instead of 35K of full content.

## Workflow/Tool Override per Context

Skills and tools should be overridable per-session or per-workflow-step:

**Per-session override:** When May forks an agent with a specific task, she can specify which skills/tools are relevant:
```
workflow.run("persistent-task", "project: X\nagent: bob\nskills: verify-after-edit, evidence-over-narrative")
```

**Per-workflow-step override:** The persistent-task worker prompt can inject step-specific skills:
```
## For this iteration
Read skill: agents/coach/skills/gym-execution-checklist.md before running gym trials.
```

This means skills are contextual — loaded for specific work, not permanently injected.

## Standing Orders as Guard

Standing orders move from system prompt injection to a guard that runs on `finish()`:

- Agent does its work normally without seeing orders in prompt
- When agent calls `finish()`, the guard checks: does the output violate any standing order?
- If yes: block finish, tell agent which order was violated
- If no: allow finish

This is structurally enforced (KE-007 says structural > text). The agent doesn't need to remember orders — the guard enforces them.

## Knowledge Essentials as On-Demand

knowledge-essentials.md is available at `agents/shared/knowledge-essentials.md`. Agent reads it when:
- Starting a brainstorm or research task
- The task mentions a topic covered in essentials
- The heartbeat.md says "read knowledge-essentials for reference"

Not auto-injected. Agent discovers it through breadcrumbs in common-sense.md:
```
For verified findings and knowledge: read agents/shared/knowledge-essentials.md
```

## Result

| Before | After |
|--------|-------|
| System prompt: ~51K (13K tokens) | System prompt: ~12K (3K tokens) |
| Skills: 35K full content always | Skills: ~500 char index + on-demand |
| Standing orders: text in prompt (0% compliance) | Standing orders: guard on finish (structural) |
| Knowledge: always injected | Knowledge: on-demand read |

4x reduction in system prompt. Closer to pi's ~2K baseline. Agent character (SOUL) and system knowledge (common-sense) stay. Everything else is on-demand or structurally enforced.

## Open Questions

1. Can the skill index format trigger reliable on-demand loading? Need to test.
2. Can standing-orders-as-guard catch violations reliably? Need to design the guard.
3. Does removing knowledge-essentials from prompt hurt agent quality? Need to measure.
4. How do per-session skill overrides work technically? The workflow passes them, but how does the system prompt change?
