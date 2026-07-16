# Breadcrumb Reaction Scenario — Setup

## Purpose
Tests whether an agent reacts to **breadcrumb investigation hints** embedded in heartbeat metrics — without question-framing. This isolates the breadcrumb variable from KE-215.

## Design
- **Control variable**: Breadcrumbs (present). No question-framing step.
- **Compared against**: `metric-reaction-G-breadcrumb` (has both question-framing + breadcrumbs)
- **Expected baseline**: ~80% reaction rate (from Phase 1 gym results)

## Scenario Structure
- `task.md` — Standard heartbeat with metrics block containing `⚠️ NEEDS ATTENTION` + `→ Quick check:` breadcrumbs, plus a low-priority dispatch board. No step-1 question.
- `environment/stuck-requests.json` — Breakdown data the breadcrumb points to.
- `success_criteria.js` — Two behavioral checks:
  1. `reacted-to-stuck-requests` — any action on the flagged metric
  2. `followed-breadcrumb` — specifically read the file the breadcrumb pointed to

## Key Differences from metric-reaction-G-breadcrumb
| | breadcrumb-reaction (this) | metric-reaction-G-breadcrumb |
|---|---|---|
| Step 1 | "Read metrics and dispatch board" | **Question**: "Which metric is furthest from target?" |
| Breadcrumbs | ✅ `→ Quick check:` hints | ✅ same |
| Expected rate | ~80% | ~100% |

## Running
```bash
bun run gym -- breadcrumb-reaction
```
