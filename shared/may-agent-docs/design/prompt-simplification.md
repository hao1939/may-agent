# System Prompt Simplification

## Current state: 10 files, 36-52KB per agent

```
System prompt (loaded for EVERY session):
  1. SOUL.md          — 7-15KB (80% rules, 20% identity)
  2. DOMAIN.md         — 2-8KB (mix of rules + reference)
  3. TOOLS.md          — 1-4KB (redundant with tool schema)
  4. shared/LESSONS.md — 4KB (team rules)
  5. LESSONS.md        — 1-8KB (agent rules)
  6. knowledge/INDEX.md — 2-10KB (references + skill pointers)
  7. shared/INDEX.md   — 3KB (team knowledge)
  8. common-sense.md   — 9KB (behavioral rules)
  9. [generated] Runtime env — 0.3KB
  10. [generated] Available tools — 0.1KB
```

Problems:
- Same rule appears in 3+ files (e.g., "no cd" in SOUL.md + common-sense.md + TOOLS.md)
- Agents wrote most of this content for themselves — coach adds rules, optimizer adds constraints, nobody removes anything
- 9-13K tokens of system prompt per session, 200+ sessions/day
- No visibility into what's actually in the prompt or whether rules matter
- Coaching is hard: "which of 10 files do I put this rule in?"
- Optimization is hard: "which rules are dead weight?"

## What pi and openclaw do differently

**pi**: 1 hardcoded template (~2KB) + project context files (AGENTS.md). Guidelines derived from available tools. Total: ~3-5KB.

**openclaw**: 1 template with conditional sections + context files. Identity is one sentence. `promptMode` flag for full/minimal/none. Prompt size reporting. Total: ~5-15KB.

Both share the same pattern: **small fixed template + injectable project context**. The template defines behavior. The context defines the task environment.

## Proposal

### Two layers, clear boundary

**Layer 1: Agent Template** (hardcoded in the binary, not editable by agents)

The base behavioral rules that apply to all agents. Written once by humans, not accumulated by agents. Equivalent to pi's hardcoded template or openclaw's system-prompt.ts.

```
agents/shared/agent-template.md (~3-5KB)
```

Contains:
- Tool usage rules (derived from which tools are available — not hardcoded)
- Safety and integrity rules
- Session lifecycle (how to start, work, finish)
- Collaboration rules (delegation, escalation)
- Environment facts (paths, workspace)

Does NOT contain:
- Agent identity (that's per-agent)
- Domain expertise (that's per-agent)
- Lessons (agents don't write to the template)
- Knowledge references (agents read those on-demand)

**Layer 2: Agent Identity** (per-agent, editable)

A short file that says who this agent is and what it specifically does. Not rules — identity.

```
agents/<name>/AGENT.md (~0.5-2KB)
```

Contains:
- Who you are (1-3 sentences)
- What you do (your specific responsibilities)
- How you differ from other agents
- Any agent-specific constraints (e.g., "coder does not commit")

Does NOT contain:
- Generic behavioral rules (those are in the template)
- Tool descriptions (derived from tool schema)
- Knowledge references (read on-demand)
- Lessons (deprecated — see below)

### What's in the system prompt

```
System prompt = agent-template.md + AGENT.md + [generated sections]
```

Generated sections (same as today, but smaller):
- Available tools (list of names — tool descriptions come from schema)
- Runtime environment (paths)
- Session context (memory, checkpoint) — stays in first user message per P147

**Target: 5-10KB system prompt**, down from 36-52KB.

### What gets removed

| File | Disposition |
|------|------------|
| SOUL.md | **Replaced** by AGENT.md (identity only) + agent-template.md (rules) |
| DOMAIN.md | **Merged** into AGENT.md (2-3 sentences of domain), rest becomes knowledge/ files the agent reads on-demand |
| TOOLS.md | **Deleted**. Tool descriptions already exist in tool schema (description + parameter descriptions). The LLM sees these automatically. Handwritten TOOLS.md is redundant and often stale. |
| shared/LESSONS.md | **Deleted**. Proven lessons get promoted into agent-template.md rules. Unproven lessons are noise. |
| LESSONS.md (per-agent) | **Deleted**. Same as above. Agent-specific proven patterns go into AGENT.md. |
| knowledge/INDEX.md | **Not loaded into system prompt**. Stays on disk. Agent reads it with `read()` when it needs references. Mentioned in AGENT.md: "Your knowledge index is at knowledge/INDEX.md". |
| shared/INDEX.md | **Not loaded into system prompt**. Same treatment. |
| common-sense.md | **Merged** into agent-template.md. The good rules stay (deduplicated). The redundant ones are removed. |

### What happens to coaching

Today coach writes rules to SOUL.md and LESSONS.md. With the new structure:

- **Universal behavioral rule** → Propose change to agent-template.md (requires human review)
- **Agent-specific identity/responsibility change** → Edit AGENT.md
- **Knowledge the agent should be able to look up** → Write to knowledge/ (not loaded into prompt)

Coach can no longer bloat the system prompt by appending rules. The template is human-controlled. The agent identity is short and focused. Knowledge is on-demand.

### What happens to optimization

Today optimizer measures session quality but can't tell which prompt rules matter. With the new structure:

- agent-template.md is one file — optimizer can propose removing specific rules and measuring the effect
- AGENT.md is tiny — easy to audit
- Prompt size is measurable: `agent-template.md + AGENT.md + generated = X KB`

### What happens to knowledge

Knowledge doesn't disappear — it moves from "always in the prompt" to "available on demand":

```
agents/<name>/knowledge/INDEX.md  — Reference pointers (read when needed)
agents/<name>/knowledge/*.md      — Domain knowledge files
agents/shared/skills/             — Skill guides
agents/shared/knowledge/          — Shared reference material
```

The AGENT.md file tells the agent where to look:
```markdown
## Your Knowledge
- Your knowledge index: knowledge/INDEX.md
- Shared skills: agents/shared/skills/
- Read these when you need domain context. Don't memorize — look up.
```

### Migration path

1. **Write agent-template.md** — Extract the universal rules from common-sense.md, deduplicate with SOUL.md rules. Human-curated, ~3-5KB.
2. **Write AGENT.md for each agent** — Extract identity from SOUL.md (first 20%), merge 2-3 sentences from DOMAIN.md. ~0.5-2KB each.
3. **Update resolveSystemPrompt()** — Load agent-template.md + AGENT.md instead of 8 convention files.
4. **Verify** — Run each agent for a few sessions, check quality doesn't drop.
5. **Delete old files** — Remove SOUL.md, DOMAIN.md, TOOLS.md, LESSONS.md, common-sense.md, shared/INDEX.md from the system prompt loading path. Keep on disk as archive.
6. **Update coaching workflows** — Coach proposes template changes instead of appending to SOUL.md.
7. **Add prompt size reporting** — Log the system prompt size per session so we can track bloat.

### Risks

- **Quality regression** — Some rules in the current prompt might matter more than we think. Mitigation: run gym scenarios before/after, compare scores.
- **Agents lose context** — Without INDEX.md in the prompt, agents might not know where to find information. Mitigation: AGENT.md tells them where to look, and memory entries reference past work.
- **Coach resistance** — Coach is trained to write to SOUL.md and LESSONS.md. Need to update coach's operating instructions. Mitigation: clear new workflow documented in coach's AGENT.md.

### Success criteria

- System prompt < 10KB for all agents (currently 36-52KB)
- Gym scenario pass rates unchanged or improved
- No increase in "agent doesn't know where to find X" failures
- Coach and optimizer have clear, documented process for prompt changes
