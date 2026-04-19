# Brief: Scout C1.1 Heartbeat Workflow Gate

**Date**: 2026-04-06
**Target**: Scout C1.1 (read-before-edit)
**Status**: P0 message sent to May for implementation

## Problem

Scout C1.1 compliance crashed from 90% (Apr 2) to 23.8% (last 48h, n=21).

### Failed Interventions (in order)
1. **read-before-edit skill file** (deployed Apr 4) — No improvement
2. **context.md C1.1 CRITICAL nudge** (deployed Apr 4) — No improvement
3. **verify-after-edit escape hatch fix** (deployed Apr 6) — Addresses C1.3, not C1.1

### Why Text Failed
Per KE-007, KE-011, KE-023:
- Knowledge files are passive — agents skip them in oneshot mode
- Skills as text injection have 0% effect on behavioral habits like "always read before edit"
- Production C1.1 has been DECLINING despite multiple skill deployments

## Analysis

### Violation Pattern
Top files edited without reading (scout, last 30 violations):
- `papers.md` — 7x
- `repos.md` — 7x
- `deep-dives/INDEX.md` — 5x
- `journal.md` — 5x

All are scout's core library append targets.

### Gym Evidence
`scout-library-update` scenario: 11/11 PASS at baseline (coder agent). 
The agent CAN read before edit when the task explicitly says to. The problem is scout's heartbeat doesn't embed this as a structural requirement.

### Root Cause
Scout heartbeat section 3 says: "Write to the library — papers → papers.md..."
This instruction goes directly from "evaluate" to "write" without a read step. The "Pattern: Read → Read → Read → WRITE" at the bottom refers to the research discovery workflow (read external sources), NOT read-the-file-before-editing.

## Intervention

Restructure heartbeat step 3 to embed a 2-step gated process:
- **Step A — READ**: Read the target library file (check format + duplicates)
- **Step B — EDIT**: Edit using the exact text just read

This converts passive advice into workflow structure — the same pattern that works for every proven intervention (KE-007).

## Expected Impact
- Scout C1.1 should recover toward 80%+ within 24-48h after deployment
- No expected regressions — this only adds a read step, doesn't change the task

## Measurement
- Monitor `SELECT ... FROM convention_checks WHERE convention='C1.1' AND agent='scout'` daily
- Success: ≥70% within 48h, ≥80% within 96h
- Failure: If still <50% after 48h, escalate to full workflow enforcement (separate scout library-update workflow with gated phases)
