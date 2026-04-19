# team.md Audit Report

**Date:** 2025-01-24
**Scope:** Verified every agent row in `agents/shared/team.md` against its `agents/{name}/agent.json` config. Compared model and tools for all 12 agents.

## Results

### Matches (11/12 agents)

| Agent | Model | Tools | Verdict |
|-------|-------|-------|---------|
| Tech Lead | opus ✅ | read-write, exec, workflow, subagents ✅ | Match |
| May | opus ✅ | read-write, exec, subagents, workflow, cron ✅ | Match |
| Coder | opus ✅ | read-write, exec ✅ | Match |
| QA | gpt52 (displayed as gpt-5.2) ✅ | read-write, exec ✅ | Match |
| Master | opus ✅ | claude-code, gemini-cli ✅ | Match |
| Amy | opus ✅ | read-write, exec ✅ | Match |
| Amy-Kimi | kimi ✅ | read-write, exec ✅ | Match |
| Evaluator | gpt52 (displayed as gpt-5.2) ✅ | read-write, exec ✅ | Match |
| Optimizer | opus ✅ | read-write, exec, subagents, workflow ✅ | Match |
| Bob | gemini3pro (displayed as gemini-3-pro) ✅ | read-write, exec, subagents ✅ | Match |
| Coach | opus ✅ | read-write, exec-readonly, socket-watch, subagents, workflow, validate-workflow ✅ | Match |

### Mismatches Found (1)

| Agent | Field | team.md (before) | agent.json (truth) | Action |
|-------|-------|-------------------|---------------------|--------|
| **Scout** | model | `gemini-3-pro` | `opus` | Fixed → `opus` |

## Fixes Applied

1. **Scout model**: Changed from `gemini-3-pro` to `opus` in the Feature Team table (line 16).
2. **Model Assignment paragraph**: Updated to reflect Scout running on opus, not Gemini 3 Pro. Also added Tech Lead and Amy (both opus) which were missing from the parenthetical list. Added Kimi as a fourth model family for Amy-Kimi. Changed "Three model families" → "Four model families".

## Notes

- Tool names use `read-write` in agent.json but display as `read, write` in team.md — this is a cosmetic convention, not a mismatch.
- Similarly `gpt52` → `gpt-5.2` and `gemini3pro` → `gemini-3-pro` are display aliases.
- Coach's `exec-readonly` maps to the team.md notation `exec (read-only)` — consistent.
