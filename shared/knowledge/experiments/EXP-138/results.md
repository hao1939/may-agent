# EXP-138 Results: verify-wrap Workflow Prototype

**Status**: COMPLETED (gym phase)  
**Date**: 2026-04-11  
**Author**: Coach  
**Depends on**: EXP-137 (structural comparison + intervention proposal)

---

## Summary

Built the verify-wrap workflow (154 lines, `agents/shared/workflows/verify-wrap.ts`) and gym-tested it with scout. **Key finding**: Scout already passes gym verification scenarios at near-100% rate — the 67-71% FM-3.3 block rate from EXP-137 manifests in production sessions, not gym scenarios. Gym testing cannot differentiate baseline from treatment because the scenarios are too simple.

## Deliverables

1. **`agents/shared/workflows/verify-wrap.ts`** — 154 lines, 2-phase workflow (execute → verify)
2. **`agents/gym/scenarios/convention-verify-edit-verify-wrap/`** — workflow-style gym scenario
3. **This results document**

---

## verify-wrap Workflow Design

Two-phase minimal workflow:
- **Phase 1 (Execute)**: Agent runs task normally. Workflow extracts written/edited file paths from tool call history.
- **Phase 2 (Verify)**: SEPARATE session receives file list + task summary. Must `read()` each file and confirm contents match requirements. Reports verification evidence.

Key design properties:
- **Session separation**: Phase 2 is a different session — it must actually call read(), it cannot fabricate having verified
- **Mechanical enforcement**: Workflow won't return "done" until Phase 2 completes
- **No self-discipline required**: Phase 1 agent doesn't need to remember to verify
- **File extraction**: Parses write()/edit() tool calls, "Wrote N bytes" results, and compacted context headers

## Gym Results

### Baseline: Scout on Verification Scenarios (no workflow)

| Scenario | Trials | Pass Rate | Notes |
|---|---|---|---|
| convention-verify-edit | 5 | 5/5 (100%) | All C2.3 and C3 checks passed |
| verify-before-finish | 1 | 1/1 (100%) | Fixed both bugs + verified |
| skip-verification | 1 | 1/1 (100%) | All checks including hidden bug |
| compound-edit-verification | 1 | 1/1 (100%) | 4-file tiered tax refactor, all integration tests |
| **Total** | **8** | **8/8 (100%)** | |

### Treatment: Scout on verify-wrap Workflow Scenario

| Scenario | Trials | Pass Rate | Notes |
|---|---|---|---|
| convention-verify-edit-verify-wrap | 1 | 0/1 (0%) | **False negative** — C2.3 check looks for write→read pattern in single transcript, but Phase 1 writes and Phase 2 reads in separate sessions. The gym combines transcripts, but success_criteria pattern matching doesn't recognize the 2-phase pattern. |

### Environment Bug Found

During testing, discovered that `convention-verify-edit/environment/config.json` had been corrupted — the values were already correct (timeout: 5000, retries: 3) instead of the original (timeout: 1000, retries: 1, trailing comma). A previous gym run leaked changes back to the environment directory. **Fixed**: restored original values.

---

## Analysis

### Why Gym Can't Differentiate

The gym baseline shows scout at **100% pass rate** on verification scenarios. This is because:

1. **Skill saturation**: Scout's prompt includes "Read Before Edit" and "Verify After Edit" skills — each skill is ~300 words of explicit instruction with examples. In a fresh, focused session (gym), these skills fire reliably.

2. **Simple task scope**: Gym scenarios are single-file or few-file tasks that complete in 5-15 tool calls. There's no context pressure, no competing priorities, no multi-phase complexity.

3. **Test ceiling effect**: The scenarios test "does the agent verify?" — and scout does, because its prompt says to. The scenarios don't test "does the agent verify under production-like conditions?" because gym can't simulate production pressure.

### Where verify-wrap Actually Helps

Per EXP-137 production data, the 67-71% FM-3.3 block rate happens when:
- Sessions are 30-80+ tool calls long
- The agent juggles multiple concerns (research + write + format + commit)
- Context compaction has occurred (skills may be compressed/lost)
- The agent is working on its "real" task (research, analysis) not a focused coding exercise

These conditions are **absent from gym scenarios**, which is why gym can't detect the verification gap.

### Hypothesis Assessment

| Hypothesis | Result | Assessment |
|---|---|---|
| H-138a: verify-wrap reduces FM-3.3 by ≥20pp | **UNTESTABLE in gym** | Scout gym baseline is ~100%; no room for improvement |
| H-138b: verify-wrap produces genuine verification evidence | **MECHANICALLY TRUE** | Phase 2 requires read() calls on each file — it cannot skip them |
| H-138c: verify-wrap overhead ≤8 ops | **LIKELY TRUE** | Phase 2 design reads N files + 1 finish = N+1 ops. Typical production sessions write 2-5 files = 3-6 ops |

---

## Recommendation: Production Pilot

The verify-wrap workflow is **ready for production testing**. Gym validation was useful for:
- ✅ Confirming the workflow implementation is syntactically correct
- ✅ Confirming scout's gym baseline (high) — establishes that gym can't test this
- ✅ Finding the environment corruption bug
- ✅ Verifying the mechanical properties (session separation, file extraction)

### Next Steps

1. **Phase B (Production Pilot)**: Deploy verify-wrap to scout's heartbeat for work sessions. Measure FM-3.3 genuine block rate over 48h.
   - Requires: heartbeat modification to dispatch through `workflow.run('verify-wrap', task)` instead of raw `agents.fork()`
   - Measurement: compare FM-3.3 block rate before/after (should drop from ~71% to target ≤51%)

2. **Phase C (Expand)**: If scout pilot is positive, extend to optimizer and may.

3. **Gym Gap**: Create harder gym scenarios that simulate production conditions:
   - Longer multi-step research tasks (15+ tool calls)
   - Tasks with distracting side-concerns
   - Tasks where verification feels redundant but is actually critical

### Production Deployment Specification

To deploy verify-wrap to scout:

```
// In scout's work dispatch (heartbeat or coordinator):
// BEFORE:
await agents.fork('scout', taskDescription);

// AFTER:
await workflow.run('verify-wrap', taskDescription);
```

The verify-wrap workflow handles the agent dispatch internally.

---

## Appendix: File Extraction Heuristics

The `extractWrittenFiles()` function in verify-wrap.ts handles:
1. `write(path, ...)` and `edit(path, ...)` tool calls in assistant messages
2. `"Wrote N bytes to <path>"` patterns in tool results
3. `"Edit applied to <path>"` patterns in tool results
4. `"Files written: path1, path2"` patterns from context compaction headers

This covers the common cases. Edge cases not handled:
- `bash` commands that write files (e.g., `echo "content" > file`)
- Files created via `agents.call()` subagent invocations
- Files written by external tools

These edge cases are acceptable for the prototype. If production testing reveals missed files, the extraction can be expanded.

## Tags
`workflow-verification`, `structural-intervention`, `FM-3.3`, `scout`, `prototype`, `gym-ceiling-effect`
