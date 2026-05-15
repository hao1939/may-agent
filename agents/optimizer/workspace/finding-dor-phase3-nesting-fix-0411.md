# Finding: D-o-R Phase 3b Nesting Fix

**Date**: 2026-04-11
**Category**: Workflow Bug Fix
**Severity**: Medium (causes ~100+ wasted ops per occurrence)

## Problem

The D-o-R (deliver-or-report) workflow's Phase 3b — the LLM-based content verification step — was missing the anti-nesting guard that prevents bob from spawning a full D-o-R workflow inside the verification session.

**Evidence**: Session `s_1775924716233_1517` spawned a full D-o-R workflow inside the Phase 3 verify step, creating infinite recursive nesting.

## Root Cause

Phases 1, 2, 2-narrow, and 2b all had explicit `⛔ DO NOT call callAgent() or spawn sub-agents` instructions, added in:
- Phase 1/2: commit `60a844e3`
- Phase 2b/2-narrow: commit `ef7e2528`

Phase 3b (content verification) was overlooked because it was added later and seemed inherently safe — "just read and verify." But the LLM doesn't understand implicit constraints; without an explicit prohibition, it can call `workflow.run()` or `callAgent()` if it decides "verification" means "run the whole thing again."

## Fix

Added to the Phase 3b prompt (line 408 of `deliver-or-report.ts`):

```
⛔ DO NOT call workflow.run(), callAgent(), or spawn sub-agents/sub-workflows. 
Your job is ONLY to read files and report pass/fail. 
Calling workflow.run() creates infinite nested workflows that waste hundreds of ops.
```

This is slightly more explicit than the Phase 1/2 guards — it also mentions `workflow.run()` by name, since the Phase 3b session's most likely nesting path is calling `workflow.run("deliver-or-report")`.

## Verification

All 5 LLM-invoked phases now have anti-nesting guards:
- Phase 1 (line 170): `DO NOT call callAgent() or spawn sub-agents`
- Phase 2 narrow (line 255): `⛔ DO NOT call callAgent() or spawn sub-agents`
- Phase 2 normal (line 288): `⛔ DO NOT call callAgent() or spawn sub-agents`
- Phase 2b retry (line 355): `⛔ DO NOT call callAgent() or spawn sub-agents`
- **Phase 3b verify (line 408)**: `⛔ DO NOT call workflow.run(), callAgent(), or spawn sub-agents/sub-workflows` ← NEW

## Nesting Fix History

| Phase | Commit | Confirmed Clean |
|-------|--------|-----------------|
| Phase 1 | `60a844e3` | n=9, 0% nesting |
| Phase 2 | `60a844e3` | n=9, 0% nesting |
| Phase 2b | `ef7e2528` | n=9, 0% nesting |
| Phase 2 narrow | `ef7e2528` | n=9, 0% nesting |
| Phase 3b | This fix | Pending gym validation |
