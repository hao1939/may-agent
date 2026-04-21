# Context Injection Review: agents/bob/context.md

**Date**: 2025-06-20  
**Reviewer**: Bob  

## Summary
~50 facts across environment setup, behavioral rules, research guidance, and operational knowledge. Well-organized with section headers.

## What's Useful (keep)
- **Environment basics** (bun path, no npx, no sqlite3 CLI, project root /app) — essential every session
- **C1.1 read-before-edit** — high-value guard against top error pattern
- **Turn discipline** (turn 20/25/30 checkpoints) — prevents runaway sessions
- **Lean heartbeat pattern** — good structural guidance
- **KB tool shortcuts** (kb-find.sh, commit-and-merge.sh, scaffold scripts) — saves ops every session
- **Gym execution checklist + timeout guidance** — prevents recurring failures
- **KE-008 heartbeat stability rule** — prevents regressions

## What's Potentially Stale
- **opBudget removal notice** (dated 2026-03-30) — if well-established, the warning may be unnecessary weight
- **SOUL.md coach 0/18 result** — useful lesson but could be compressed to one line
- **"Priority: skills with matching gym scenarios"** — is this still the active priority?

## What Could Be Trimmed
- **Duplicate operational knowledge section** at bottom repeats KE-123 and KE-133 already mentioned inline. Remove to save ~4 lines.
- Several defensive/reactive entries could graduate to skills/ files and leave context.md

## What's Missing
- **No summary of active work/research focus** — new sessions start cold
- **No pointer to active tracker** (PRIORITY-TRACKER.md location) for task continuity
- **No mention of other agents** — who to collaborate with, what they own
- **No cost/model context** — which model, approximate session cost

## Overall Assessment
**B+** — Well-maintained, battle-tested. Main risks: growing long (~50 items), some redundancy, missing "where am I" orientation. Recommend a trim pass to remove duplicates and compress older lessons.
