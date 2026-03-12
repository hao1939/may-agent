# System Prompt Architecture

Status: **Implemented** (commit `a91e8a3`)

## Assembly Order

`resolveSystemPrompt()` in `src/lib/manager.ts` (~90 lines):

```
1. SOUL.md              — Who you are (identity, mission, values)
2. DOMAIN.md            — What you know (domain expertise)
3. TOOLS.md             — How to use your tools
4. LESSONS.md           — What you've learned from experience
5. knowledge/INDEX.md   — Curated context: team, skills, philosophy, references
6. Runtime Environment  — Paths, workspace, loaded files list (generated)
7. Session Context      — Session ID, task history (generated)
```

Five convention files (auto-loaded if present), two generated sections.
Missing files are silently skipped. If `systemPrompt` is set directly on
`SubagentDefinition`, all convention file loading is bypassed.

## Convention Files

| File | Location | Purpose |
|------|----------|---------|
| SOUL.md | `agents/<name>/SOUL.md` | Identity, mission, values, behavioral guidelines |
| DOMAIN.md | `agents/<name>/DOMAIN.md` | Domain expertise and knowledge |
| TOOLS.md | `agents/<name>/TOOLS.md` | Tool usage patterns and guidelines |
| LESSONS.md | `agents/<name>/LESSONS.md` | Accumulated learnings from past sessions |
| INDEX.md | `agents/<name>/knowledge/INDEX.md` | Curated knowledge context + reference manifest |

## Generated Sections

### Runtime Environment

```
# Runtime Environment
- Project root: /home/hao/may-agent
- Agent directory: agents/bob
- Workspace: agents/bob/workspace (ephemeral scratch)
- Knowledge: agents/bob/knowledge
- Already in context (do NOT re-read): SOUL.md, DOMAIN.md, TOOLS.md, LESSONS.md, knowledge/INDEX.md

All paths are relative to project root. Your workspace is the ONLY directory you should write to.
```

### Session Context

```
# Session Context
- Session ID: s_1741000000_0

## Recent Task History
- [2026-03-11] "Reviewed system prompt proposal" — done (3m12s)
- [2026-03-10] "Designed agent-growth toolset" — done (5m45s)
```

Memory entries come from `.state/memory/<agent>.jsonl`, limited by `memoryLimit`
(default 20).

## What Was Removed

| Removed | Replacement |
|---------|-------------|
| Auto-generated Identity block | SOUL.md already has identity |
| `buildProjectStructure()` tree | Agents curate in INDEX.md |
| `systemPromptFiles` loading | INDEX.md convention |
| `sharedKnowledge` concatenation | INDEX.md distills shared knowledge |
| Skills auto-loading + resolution | Distilled in INDEX.md, full guides read on demand |
| Reference Library listing | Agents list references in INDEX.md |
| Workspace/Output sections | Folded into Runtime Environment |

## Prompt Size

| Agent | Before | After | Change |
|-------|--------|-------|--------|
| bob | 49.7KB | ~12KB | -76% |
| tech-lead | 49.2KB | ~12KB | -76% |
| may | 22.5KB | ~10KB | -58% |
| coder | 13.9KB | ~9KB | -37% |
| **Total (12 agents)** | **~339KB** | **~132KB** | **-61%** |

## agent.json: Before and After

Before:
```jsonc
{
  "name": "bob",
  "model": "gemini3pro",
  "tools": ["coding", "agents"],
  "skills": ["file-safety", "error-handling", "agent-coordination"],
  "sharedKnowledge": ["team.md", "philosophy.md"],
  "systemPromptFiles": [],
  "projectStructure": 2,
  "maxTurns": 30
}
```

After:
```jsonc
{
  "name": "bob",
  "model": "gemini3pro",
  "tools": ["coding", "agents"],
  "maxTurns": 30
}
```

agent.json is purely operational. All prompt content lives in convention files.
