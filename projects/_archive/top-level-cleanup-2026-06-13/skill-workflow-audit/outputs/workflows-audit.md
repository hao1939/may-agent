# Workflows Audit Report

**Date**: 2026-05-28
**Auditor**: coach
**Scope**: All shared workflows (10) + per-agent workflows (19)

## Summary

- **Total workflow files**: 29 (10 shared + 19 per-agent)
- **All parse**: ✅ 29/29 pass `node --check`
- **Referenced in cron.json**: 12/29 (41%)
- **Unreferenced but used in code**: 17/29 (referenced from other workflows, TOOLS.md, etc.)
- **Truly orphaned**: 0 — all have at least documentation references

## Key Findings

1. **All workflows parse.** Zero syntax errors across all 29 files.
2. **Cron references 12 workflows** — all resolve to existing files. No dangling references.
3. **17 workflows are not in cron** but serve as importable utilities (master-worker, implement-and-verify, etc.) or agent-specific tools (safe-edit, vet-skill, etc.).
4. **No dead workflows.** Every workflow has at least code or documentation references.

## Shared Workflows (10 files)

| # | Workflow | Lines | In Cron | Used By | Quality | Verdict |
|---|----------|-------|---------|---------|---------|---------|
| 1 | coaching-feedback | 256 | ✅ | cron | good | keep |
| 2 | error-scan | 446 | ✅ | cron | good | keep |
| 3 | fewshot-inject-helpers | 162 | — | implement-and-verify imports it | good | keep — utility |
| 4 | freestyle-wrap | 66 | — | standing-orders references it | mediocre | review — small, unclear usage |
| 5 | heartbeat-data | 202 | — | imported by heartbeat workflows | good | keep — core utility |
| 6 | implement-and-verify | 203 | — | tech-lead/optimizer use | good | keep |
| 7 | master-worker | 404 | — | bob, project workflows | good | keep — core pattern |
| 8 | project | 929 | — | project management system | good | keep — largest, core |
| 9 | verify-wrap | 233 | ✅ | cron | good | keep |
| 10 | worker-reviewer | 296 | — | bob gym projects | good | keep |

## Per-Agent Heartbeat Workflows (8 files)

All are ~59 lines, follow the same template, referenced in cron.json. All **good, keep**.

| Agent | File | In Cron |
|-------|------|---------|
| amy-kimi | amy-kimi-heartbeat.ts | ✅ |
| bob | bob-heartbeat.ts | ✅ |
| coach | coach-heartbeat.ts | ✅ |
| may | may-heartbeat.ts | ✅ |
| optimizer | optimizer-heartbeat.ts | ✅ |
| qa | qa-heartbeat.ts | ✅ |
| scout | scout-heartbeat.ts | ✅ |
| tech-lead | tech-lead-heartbeat.ts | ✅ |

## Per-Agent Specialty Workflows (11 files)

| # | Agent | Workflow | Lines | In Cron | References | Quality | Verdict |
|---|-------|----------|-------|---------|------------|---------|---------|
| 1 | coach | growth-cycle | 386 | — | optimizer docs | good | keep — training tool |
| 2 | coach | gym-helpers | 421 | — | optimizer docs | good | keep — gym infrastructure |
| 3 | coach | training-sprint | 301 | ✅ | cron | good | keep |
| 4 | may | project-monitor | 97 | — | optimizer docs | mediocre | review — small, may be unused |
| 5 | optimizer | design-review | 119 | — | TOOLS.md | good | keep |
| 6 | optimizer | enhance-cron | 351 | — | TOOLS.md | good | keep |
| 7 | optimizer | investigate-and-fix | 338 | — | optimizer docs | good | keep |
| 8 | optimizer | safe-edit | 291 | — | TOOLS.md | good | keep |
| 9 | qa | vet-skill | 266 | — | bob/optimizer docs | good | keep |
| 10 | tech-lead | lens-analysis | 285 | — | optimizer docs | good | keep |
| 11 | tech-lead | verified-coder | 178 | — | optimizer docs | good | keep |

## Recommendations

1. **No workflows need archiving.** Unlike skills (77% orphaned), workflows are well-maintained.
2. **Review freestyle-wrap** (66 lines) — minimal utility, unclear if still used actively.
3. **Review project-monitor** (97 lines) — may's specialty workflow with unclear active usage.
4. **Contrast with skills audit**: Workflows are in much better shape (0% orphaned vs 77% for skills). This suggests the workflow registration system works better than the skill delivery system.
