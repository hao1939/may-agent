# Lessons Extraction Report — Agent Memory & Learning

**Date**: 2026-06-26
**Task**: Grow lessons.jsonl from 20 seeded → 50+ target

## Result

**Before**: 20 lessons (all seeded from context.md bootstrap)
**After**: 59 lessons (20 seeded + 39 newly extracted)
**Target**: 50+ ✅ MET

## Sources

Extracted lessons from 8 agent context.md files:
- **coder** (7 lessons): Destructive ops judgment, honest test reporting, security checks, pipeline re-runs, trace-before-fix, impossible task escalation, review calibration
- **may** (7 lessons): Supervisor discipline, persistent awareness, delegation quality, metric alerting, human request tracking, honest reporting, busywork detection
- **bob** (2 lessons): Multi-deliverable checklists, skills adoption hierarchy
- **coach** (4 lessons): Regime change detection in data, growth cycle pattern, baseline reliability, batch query efficiency
- **optimizer** (3 lessons): Session.jsonl schema, grep-then-read patterns, deployment != adoption
- **tech-lead** (4 lessons): Review gate workflow, code-vs-data decisions, verified-coder for bug fixes, tsc verification
- **scout** (5 lessons): Budget discipline, few-shot evidence, bash chaining safety, 404 handling, dedup checks
- **system** (7 lessons): session.completed gap, verify-writes, session-start protocol, git repo structure, tool availability, runtime architecture

## What This Advances

- **memory.lessons-total**: 20 → 59 (target was 50+) ✅
- Pipeline is still not firing organically (poller never ran), but the knowledge base is now rich enough to be useful
- Next step: verify the poller actually fires and produces organic lessons

## Lesson Quality

All lessons are:
- Extracted from battle-tested context.md files (written by agents after real failures)
- Tagged with source agent and category (pattern/insight/fix)
- Confidence 0.85 (high — these are established practices, not hypotheses)
- Deduplicated against existing 20 lessons
