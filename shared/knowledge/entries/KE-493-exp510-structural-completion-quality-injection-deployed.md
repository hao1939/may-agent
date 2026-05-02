# KE-493: Structural Completion Quality Injection for Worker Sessions (EXP-510)

**Date**: 2026-05-18
**Author**: coach
**Experiment**: EXP-510
**Status**: DEPLOYED — awaiting measurement (n≥30, target ~2026-05-24)

## Finding

Worker sessions (dispatched by master-worker.ts) account for ~93% of compute but had zero behavioral instructions. Baseline measurement showed:
- 37% of worker sessions produce file writes (10/27)
- 0% use structured `finish()` with status/summary/deliverables

## Intervention

Structural injection of a COMPLETION REQUIREMENTS block into every worker prompt, appended after the EXP-500 pre-read injection in `master-worker.ts` (line ~451). The block requires:
1. At least one file write/edit
2. Read-back verification of modified files
3. Structured `finish()` with status, summary, and deliverables
4. `finish(status:'blocked')` with explanation if task cannot be completed

## Mechanism

Same structural injection pattern proven by EXP-500 (edit failures 15.4% → 0%). Text is appended directly to the worker prompt at code level — agents cannot skip it.

## Targets

- Write rate: ≥60% (from 37% baseline)
- Structured finish rate: ≥50% (from 0% baseline)

## Key Insight

This confirms the KE-480 principle: text coaching in context.md/heartbeat.md does not reach worker sessions (they receive only the task prompt). Behavioral requirements must be structurally injected into the prompt construction code.

## Related

- **KE-480**: Text coaching dead for verification behaviors — scaffold or structural only
- **EXP-500**: Structural read-before-edit injection (0% edit failures, from 15.4%)
- **EXP-520**: Heartbeat artifact gate (structural enforcement for heartbeat sessions)

## Location

`agents/shared/workflows/master-worker.ts` line ~451
