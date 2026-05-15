# Investigation Brief: May C7.1 Regression Analysis

**Date**: 2026-04-12  
**Investigator**: Coach  
**Source**: Convention regression alert — C7.1 root-is-app  
**Question**: Is May's C7.1 regression related to C1.5 timing bug?  

## Summary

**No** — May's C7.1 regression is a **model-level path hallucination problem**, not related to the C1.5 timing bug. The convention checker correctly identifies that the model *attempts* commands with wrong paths. The path hallucination guard (deployed Apr 11) blocks execution but doesn't prevent the attempt from being recorded.

## Data

### May C7.1 Daily Trend

| Period | Rate | Sessions | Failures |
|---|---|---|---|
| Mar 18–27 | 93.2% | 183 | 13 |
| Mar 28 | **100%** | 23 | 0 |
| Mar 29–30 | 80.0% | 55 | 11 |
| Mar 31 | **100%** | 26 | 0 |
| Apr 1–4 | 68.7% | 99 | 31 |
| **Apr 5–8** | **100%** | **124** | **0** |
| Apr 9 | 66.7% | 48 | 16 |
| Apr 10 | 83.7% | 49 | 8 |
| Apr 11 | 88.2% | 34 | 4 |

### Cross-Agent (Post-Guard, Apr 11+)

| Agent | Rate | N |
|---|---|---|
| may | 88.2% | 34 |
| coach | 94.1% | 51 |
| bob | 98.5% | 67 |
| optimizer+ | 100% | — |

## Root Cause Analysis

### 1. Dominant Pattern: Bun Path Hallucination

**90%+ of May's C7.1 violations** are the model hallucinating the bun binary's path:

- `/home/hao/.bun/bin/bun` (most common)  
- `/home/hao/may-agent/.state/bin/bun` (second most common)
- `/root/.bun/bin/bun`
- `~/.bun/bin/bun`

Instead of the correct: `.state/.bun/bin/bun` (or `export PATH=".state/.bun/bin:$PATH"`)

### 2. Context Is Present But Ignored

May's `context.md` already contains:
- `bun is at .state/.bun/bin/bun — add to PATH: export PATH=".state/.bun/bin:$PATH"`
- `Project root is /app — do not use /home/*, /Users/*, /root/*, or ~/ paths`

The model has the right information but falls back to training data patterns when constructing bash commands, especially in long heartbeat sessions.

### 3. Heartbeat-Only Problem

**100% of C7.1 failures** occur in heartbeat sessions, not work sessions. This is because:
- Heartbeats have long, varied command sequences
- After compaction, the key facts about paths can get diluted
- The model defaults to training-data patterns (e.g., `/home/hao/...`)

### 4. Not Related to C1.5 Timing Bug

The C1.5 timing bug affected *evaluation correctness* (checking disk state post-hoc instead of transcript state). C7.1 uses a transcript-based checker (`convention-check.ts:checkC7_1_rootIsApp`) that directly inspects tool call inputs. The C1.5 fix does not affect C7.1 at all.

### 5. Perfect Period (Apr 5-8) Is Random

The 124-session 100% streak from Apr 5-8 doesn't correlate with any code change, context update, or model change. It's likely a fortunate run of sessions that didn't trigger the bun-path pattern. The preceding periods show similar volatility (100% on Mar 28, 31, then dropping again).

## Guard Effectiveness

The path hallucination guard (deployed Apr 11 06:02 UTC):
- **Prevents execution** of commands with wrong paths ✅
- **Does NOT prevent violation recording** — the convention checker sees the *attempted* command ❌
- Before guard: 77.8% (Apr 9-11)
- After guard: 82.6% (Apr 11+)
- Marginal improvement: +4.8pp

The guard successfully prevents harmful effects (wrong commands don't execute) but cannot prevent the model from *attempting* the wrong path. This is the expected behavior — the guard is a safety net, not a cure.

## Recommendations

### Tier 1: Strengthen Compaction Key Facts (Low effort, Medium impact)

Ensure the compaction system preserves the bun PATH fact as a high-priority key fact. Currently it may get lost during context truncation in long sessions.

### Tier 2: Guard Error Message Enhancement (Low effort, Low impact)

The guard's error message already says "use /app". Consider adding the specific bun PATH hint:
```
Example: export PATH=".state/.bun/bin:$PATH"
```
This would help the model self-correct after the first blocked attempt. Currently 15/28 sessions have only 1 violation, suggesting the model often learns from the block.

### Tier 3: Few-Shot Correction (Medium effort, High impact)

Add a few-shot example specifically for bun PATH usage to May's context. This is the most effective approach per KE-002/KE-007 findings — behavioral patterns resist text rules but respond to concrete examples.

### Tier 4: Pre-filled Environment (High effort, Highest impact)

If the bash tool were initialized with `export PATH=".state/.bun/bin:$PATH"` in every session, the model wouldn't need to set the path at all. This is a structural fix that eliminates the problem entirely.

## Cross-Reference

- **EXP-132**: Path hallucination guard deployment (Apr 11)
- **Scout C7.1 brief**: `brief-scout-c13-c71-regression.md` (Apr 10) — same root cause, different agent
- **C1.5 timing fix**: `7d54e506` (Apr 12 05:30) — NOT related
