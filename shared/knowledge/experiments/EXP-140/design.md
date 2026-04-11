# EXP-140: Agent Read Patterns Observational Study

> **Hao directive**: "what really read by agents in each turn?" (2026-04-11)
> **Type**: Observational (production data mining)
> **Coach**: Research IT-77

## Motivation

Agents spend tokens reading files every session. We don't know:
1. What files agents actually read (vs. what's available)
2. How much reading is redundant (duplicate reads within a session)
3. Whether reading patterns differ by agent role
4. What anti-patterns waste context budget

This matters because every read() consumes ~500-2000 tokens of context window. With 353 sessions averaging 3.6 reads each, that's ~1,800 token-consuming operations in the sample period alone. Reducing waste here could improve both cost and quality.

## Method

### Data Source
- `.state/sessions/*/session.jsonl` — contains all tool calls per session
- `.state/sessions/*/meta.json` — contains agent, opCount, status

### Inclusion Criteria
- Status = "done" (completed sessions only)
- opCount ≥ 3 (exclude trivial sessions)
- Most recent 400 session directories (recency bias, but representative of current behavior)

### Extraction
- `meta.json`: agent name, operation count, status
- `session.jsonl` via grep: tool call names (`read`, `write`, `edit`, `bash`, `agents`, `finish`, `checkpoint`, `workflow`) and `isError:true`
- Read paths extracted via grep for `"name":"read","arguments":{"path":"..."`

### Analysis Plan
- Q1: File read frequency distribution (what's actually read?)
- Q2: Read-to-action ratio (how much time reading vs. doing?)
- Q3: Anti-patterns (duplicates, errors, context overload)
- Q4: Per-agent profiles (who reads what?)
- Q5: Correlations (read volume vs. session size, errors)

## Sample
- **353 qualifying sessions** from 8 agents
- **1,543 read path entries** extracted
- **7,938 total tool calls** analyzed
