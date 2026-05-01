# Context.md Hygiene — Trimming Report

## Summary
Trimmed the 4 most bloated context.md files to reduce average token load across all agents.

## Changes Made

| Agent | Before (bytes) | After (bytes) | Reduction |
|-------|---------------|---------------|-----------|
| may | 10,592 | 2,676 | -75% |
| coach | 10,000 | 2,428 | -76% |
| bob | 9,800 | 2,571 | -74% |
| tech-lead | 9,200 | 2,862 | -69% |

## What Was Removed
- **Verbose procedure blocks** already covered by referenced skills (C1.1, C1.3, C1.7 detailed steps)
- **Duplicate Hao's preferences** (expanded list → one-line summary + pointer to full doc)
- **Stale reflexion lessons** (optimizer workspace stats, gym bimodal observation)
- **Redundant operational facts** (repeated across sections)
- **Expanded anti-shallow rules** (condensed to one line)
- **Historical context** ("What this replaces", "learned 2026-04-07")

## What Was Preserved
- All environment facts (paths, tools, bun location)
- All mandatory protocol references (C1.1, C1.3, C1.7, C12.1)
- All skill file pointers
- Role-specific knowledge (may=supervisor, coach=experiments, bob=research, tech-lead=code)
- Key research findings (KE-123, KE-133, KE-008, KE-180, KE-182)
- Hao's preferences (condensed)

## New System Average
- **16 active agents**: avg 2,609 bytes (~650 tokens) per context.md
- Target was <600 tokens average — we're very close. The remaining large files (qa: 5.6KB, coder: 4.5KB, amy: 4.3KB) weren't in scope.

## Impact
Each prompt for may/coach/bob/tech-lead is now ~7-8KB lighter, saving ~1,800 tokens per invocation. Over hundreds of daily sessions, this compounds significantly.
