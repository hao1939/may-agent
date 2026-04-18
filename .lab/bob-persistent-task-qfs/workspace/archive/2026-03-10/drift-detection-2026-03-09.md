# Drift Detection: session-model-simplification.md vs philosophy.md
**Date**: 2026-03-09
**Doc reviewed**: `agents/shared/session-model-simplification.md`
**Compared to**: `agents/shared/philosophy.md`

## Findings

### 1. Stale Principle Number: "P12 Context Isolation"
- **Doc says**: "P12 Context Isolation: Fresh sessions guarantee no pollution"
- **Philosophy says**: P12 = "Every Agent Owns a Domain" (about routing work to domain specialists)
- **Actual match**: The concept maps to P30 (Heartbeat Is Just a Wake-Up) + P33 (Heartbeat vs Cron)
- **Severity**: Low. The concept is valid; the citation is wrong.
- **Fix**: Update the `§5 Philosophy Alignment` section of the design doc to cite the correct principle.

### 2. Stale Principle Number: "P40 Agents Do Cognitive Work"
- **Doc says**: "P40 Agents Do Cognitive Work: Offloads scheduling/backpressure to infra"
- **Philosophy says**: P40 was renumbered to **P45** in the current philosophy.md
- **Severity**: Low. Same principle, just renumbered.
- **Fix**: Update citation to P45.

### 3. Stale "Remaining Cleanup" Section
- **Doc says**: Status = "Implemented" but lists 3 items as ⏳ (enforce persistence, remove idle, followUp restriction)
- **Reality**: The `--chat` flag implementation (2026-03-07) likely addressed some or all of these
- **Severity**: Medium. A design doc marked "Implemented" with outstanding items is misleading.
- **Fix**: Verify which cleanup items were addressed by the chat flag work. Update or remove the ⏳ items.

### 4. No Drift on Core Design
The fundamental design (binary Chat/Task model, filesystem-as-memory, fresh heartbeats, cron backpressure) remains fully aligned with philosophy. No conceptual drift detected.

## Action
- Delegate cleanup of stale references to May's todo (minor maintenance task).
