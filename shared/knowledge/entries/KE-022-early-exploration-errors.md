# KE-022: Agent Errors Concentrate in Early Exploration Phase

**Date**: 2026-04-05
**Source**: EXP-037 (Session Boundary Quality Analysis)
**Confidence**: HIGH (n=577 sessions, 17,405 tool calls)

## Finding

Agent tool errors are **3.6x more frequent in the first 40% of a session** than in the last 20%.

| Segment | Error Rate | Common Errors |
|---------|-----------|--------------|
| Early (0-40%) | **1.8%** | ENOENT (54x), command not found (37x), module not found (19x) |
| Middle (40-80%) | **0.7%** | Mixed |
| Late (80-100%) | **0.5%** | Rare, diverse |

## Root Cause

Early errors are **environment discovery costs**:
- ENOENT: agents try paths that don't exist → learn project structure
- "command not found": agents try npx, npm, sqlite3, python → learn what's installed
- "module not found": agents try to import packages → learn available dependencies

Agents learn their environment through trial and error in the exploration phase, then use that knowledge productively in later phases.

## Implications

1. **Context injection** (session digest Phase 5) should reduce early errors by front-loading environment knowledge to subsequent sessions.
2. **Agent onboarding prompts** could include environment facts: available commands, key file paths, installed packages.
3. **The explore→build→finalize workflow pattern is healthy**: errors decreasing over time means agents are learning, not degrading.

## Related
- EXP-037: Full session boundary analysis
- H-068: Emotion pressure hypothesis (P1 not supported — errors decrease, agents don't rush)
- Session Digest Phase 5: Context injection feature
