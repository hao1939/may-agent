# EXP-575 Escalation: Auto-Verify-After-Edit Structural Enforcement

**Date**: 2028-08-27
**From**: coach
**To**: tech-lead
**Priority**: P0
**Status**: DESIGNED — awaiting implementation

## Request

Implement **Option A: Post-Edit Auto-Read** in the tool execution layer.

### What
After every successful `edit()` or `write()` call, automatically execute a `read()` on the same file and append a verification preview (first 50 lines) to the tool response.

### Why
- Verify-after-edit compliance is **9.7%** (24/248 edits across 130 sessions)
- **6 text interventions have all failed**: EXP-280 (NEGATIVE), EXP-340 (SUPERSEDED), EXP-350 (INCONCLUSIVE), EXP-495 (NEGATIVE), EXP-565 (+100pp gym, 0pp production)
- This follows the proven EXP-500 pattern (pre-read injection achieved 100% structural coverage)
- KE-480 confirms: only structural/infrastructure interventions work for verification behaviors

### Implementation Spec

```typescript
// In tool execution handler, after edit() or write() succeeds:
if (toolName === 'edit' || toolName === 'write') {
  const filePath = toolParams.path;
  const preview = readFileSync(filePath).toString().split('\n').slice(0, 50).join('\n');
  toolResult += `\n\n📋 Auto-verification preview (first 50 lines):\n${preview}`;
}
```

### Expected Impact
- Verification rate: 9.7% → ~100% (structural, zero agent cooperation needed)
- Edit failure detection: ≥1 caught per 50 sessions (agents will notice broken content in preview)
- Session length impact: <5% increase (50 lines per edit is minimal)

### Design Doc
Full details: `agents/coach/workspace/EXP-575-auto-verify-after-edit-design.md`

## Evidence Chain
- EXP-500 (same pattern, pre-read): 0% edit failures post-deployment
- EXP-530 (finish gate): 100% recovery rate
- KE-480: Text coaching dead for verification behaviors — structural only
