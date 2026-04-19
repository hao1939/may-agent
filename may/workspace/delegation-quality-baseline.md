# Delegation Quality Baseline Report
**Date**: 2026-03-30
**Requested by**: Hao
**Measured by**: May

## Executive Summary

**52.1% of delegate ops are wasted on context rediscovery.** Delegates spend more than half their operations reading files, exploring directory structures, and discovering context that the delegator already knew — before writing a single line of code.

## Methodology

Analyzed 30 recent coder/tech-lead work sessions from `.state/sessions/history/`. For each session, counted tool calls before the first edit/write/workflow operation ("discovery ops") vs total ops. Also analyzed the requests table for delegation metadata quality.

## Key Findings

### 1. Context Discovery Waste

| Metric | Value |
|--------|-------|
| Sessions analyzed | 30 (coder + tech-lead, >3 ops) |
| Total ops | 731 |
| Discovery ops (before first edit) | 381 |
| **Overall discovery ratio** | **52.1%** |
| Sessions with context_files passed | **0 / 30** |
| Worst case: s_*622022134_638 (tech-lead) | 44/51 ops = **86% discovery** |

### 2. Per-Agent Breakdown

**Tech-lead** (orchestrator): avg ~59% discovery ratio
- Reads briefs, explores current file state, checks tests, reads source files
- Then delegates to coder with a workflow
- The **coder** then re-reads the same files tech-lead already analyzed

**Coder** (implementer): avg ~45% discovery ratio
- Receives task from workflow but needs to re-discover file structure
- Reads source files, checks test patterns, explores imports

### 3. Delegation Metadata Quality (30 recent delegations)

| Field | Present | Rate |
|-------|---------|------|
| Task description (avg) | 487 chars | 100% |
| Context field | 25/30 | 83% — but these are **file path strings only**, not actual file contents |
| Expectations field | 26/30 | 87% |
| context_files passed to DB | 0/30 | **0%** |

### 4. finish() Quality (187 calls across last 200 sessions)

| Agent | Deliverables | Verification | Lessons |
|-------|-------------|--------------|---------|
| coder | 4/4 (100%) | 0/4 (0%) | 4/4 (100%) |
| tech-lead | 2/3 (67%) | 0/3 (0%) | 2/3 (67%) |
| may | 3/33 (9%) | 28/33 (85%) | 3/33 (9%) |
| bob | 33/34 (97%) | 29/34 (85%) | 33/34 (97%) |
| optimizer | 28/28 (100%) | 25/28 (89%) | 23/28 (82%) |

**Key gap**: Coder and tech-lead never provide verification_evidence. May rarely provides deliverables or lessons.

### 5. Double-Rediscovery Pattern

Example: Gate 3v2 implementation chain:
1. **May** reads Hao's request, knows what needs building
2. **May→tech-lead** (send): 500 chars, mentions brief path, no file contents
3. **Tech-lead** reads brief (Op 4), reads finish-guard.ts (Op 5), explores test files (Ops 6-8) = 8 discovery ops
4. **Tech-lead→coder** (workflow): passes task description
5. **Coder** reads finish-guard.ts again (Op 2), reads test patterns (Ops 3-6) = 6 discovery ops

Total: **14 ops wasted** rediscovering what the chain already knew. The brief had the implementation code, the file paths, and the approach — but each agent re-read everything from scratch.

## Root Causes

1. **Context doesn't flow through the chain**: May knows files and errors → sends 500 chars to tech-lead → tech-lead spends 8 ops reading → sends description to coder → coder spends 6 ops reading
2. **context_files is used but only stores paths**: The field exists in the schema but only records file paths as strings, not actual content
3. **No "here's what I already read" mechanism**: Delegates always start from zero
4. **finish() results don't flow back usefully**: Summary exists but deliverables/verification are absent from coder/tech-lead

## Recommendations

### Immediate (for May's next 5 delegations):
1. **Include file contents in task description**: When delegating to tech-lead, paste the relevant 20-50 lines of code the delegate will need to understand. Don't just say "read file X" — include the relevant section.
2. **Include the error/symptom**: Copy-paste the actual error message, not just "fix the build."
3. **Name the approach**: "Start by reading X, then change Y, then verify with Z."

### Measurable target:
- Reduce overall discovery ratio from 52.1% to <30% over next 5 delegations
- All finish() calls should include deliverables and verification_evidence

## Baseline Metrics (for comparison after improvement)

```
BEFORE (baseline):
- Discovery ratio: 52.1% (381/731 ops)
- context_files usage: 0%
- Coder verification_evidence: 0%
- Tech-lead verification_evidence: 0%
- Avg task length: 487 chars
- Avg context length: 63 chars (just file paths)
```
