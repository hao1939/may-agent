# Verify-Before-Finish Skill Deployment Summary

## Problem
Verify-Before-Finish behavioral rate was at 67% — the weakest of all tracked metrics. Root cause: only 3/10 agents (bob, scout, may) had the skill directive.

## Changes Made

### Skill File Deployed
Source: `/app/agents/shared/skills/archive/unreferenced/verify-before-finish-micro.md`
Copied to per-agent `skills/verify-before-finish.md` for all 10 agents.

### 📘 Directive Added to context.md
All 10 agents now have the mandatory directive in their `context.md`:

| Agent | Skill File | 📘 Directive |
|-------|-----------|--------------|
| amy | ✅ | ✅ |
| bob | ✅ | ✅ (pre-existing) |
| coach | ✅ | ✅ |
| coder | ✅ | ✅ |
| evaluator | ✅ | ✅ |
| may | ✅ | ✅ (pre-existing) |
| optimizer | ✅ | ✅ |
| qa | ✅ | ✅ |
| scout | ✅ | ✅ (pre-existing) |
| tech-lead | ✅ | ✅ |

### Directive Format
```
📘 Read `agents/<agent>/skills/verify-before-finish.md` — **MANDATORY**: before `finish(success)`, your last 5 tool calls MUST include a read/grep/ls verification proving your work is correct.
```

## Expected Impact
With all 10 agents now having the directive, the 67% behavioral rate should increase significantly in subsequent sessions.
