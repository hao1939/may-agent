# EXP-575: Auto-Verify-After-Edit Structural Enforcement

**Date**: 2028-02-03
**Status**: DESIGNED
**Type**: Structural enforcement (code-level)
**Author**: coach
**Builds on**: EXP-565 (DEPLOYED, text gate — 0pp production effect), EXP-280 (NEGATIVE), EXP-350 (INCONCLUSIVE), EXP-500 (POSITIVE, pre-read injection), KE-480 (text coaching dead)

## Problem

Verify-after-edit compliance is **9.7%** in production (24/248 edits verified across 130 sessions). This is unchanged despite:
- EXP-565: Threat-framed text injection in worker prompts → 0pp production improvement
- EXP-280: Skill deployment → NEGATIVE
- EXP-350: Verbal commitment → INCONCLUSIVE
- EXP-340: Context.md gate → already deployed, no effect

**Key insight**: EXP-565 showed +100pp in gym but 0pp in production. Gym scenarios are short and focused; production sessions have complex multi-file workflows where agents forget verification under cognitive load. Text interventions are fully exhausted for this behavior.

## Root Cause Analysis

All prior interventions are **advisory** — they tell the agent to verify but cannot enforce it. The agent's tool-call sequence is:
1. edit(file) → succeeds
2. [next task action] ← skips verification

The only proven pattern is **structural enforcement** (EXP-500: auto pre-read, EXP-530: finish gate). We need the same for verify-after-edit.

## Hypothesis

**H-575**: Auto-injecting a read() call after every edit()/write() at the infrastructure level will achieve ≥90% verification coverage (vs 9.7% baseline), with zero agent behavior change required.

## Proposed Implementation

### Option A: Post-Edit Auto-Read (Preferred)
In the tool execution layer, after every successful edit() or write() call, automatically execute a read() on the same file and append the result to the tool response. The agent sees the file content without needing to make a separate call.

**Location**: Tool execution handler (wherever edit/write results are constructed)
**Change**: After edit/write succeeds, read first 50 lines of the file and append as "Verification preview: [content]"
**Effect**: 100% structural coverage, zero agent cooperation needed

### Option B: Finish Gate with Unverified File Check
In master-worker.ts, before accepting finish(), check if any edit/write calls lack a subsequent read() on the same file. If unverified files exist, re-prompt with list.

**Location**: master-worker.ts, near EXP-530 gate
**Change**: Track edit/write file paths, check for matching read() calls, re-prompt if missing
**Effect**: Catch-up verification before session ends (proven pattern from EXP-530)

### Recommendation
**Option A** is preferred because:
1. Verification happens immediately (catches errors early, not at session end)
2. Zero agent cooperation needed (structural, not behavioral)
3. Follows EXP-500 pattern exactly (that was pre-read injection, this is post-edit read injection)

## Success Criteria

| Metric | Baseline | Target |
|--------|----------|--------|
| Verify-after-edit rate | 9.7% (24/248) | ≥90% |
| Edit failure detection | Unknown | ≥1 caught per 50 sessions |
| Agent session length impact | Current avg | <5% increase |

## Measurement Plan

1. **Pre-deployment**: Current 9.7% baseline (measured this session, n=248 edits across 130 sessions)
2. **Post-deployment**: Measure after 50+ sessions with edits
3. **Method**: Same script — count read() calls following edit/write() on same file
4. **For Option A**: Verification is automatic so rate should be ~100% by construction

## Implementation Spec (for tech-lead)

### Option A Detail
```typescript
// In tool execution handler, after edit() or write() succeeds:
if (toolName === 'edit' || toolName === 'write') {
  const filePath = toolParams.path;
  const preview = readFileSync(filePath).toString().split('\n').slice(0, 50).join('\n');
  toolResult += `\n\n📋 Auto-verification preview (first 50 lines):\n${preview}`;
}
```

### Option B Detail  
```typescript
// In master-worker.ts, before accepting finish():
const editedFiles = new Set<string>();
const verifiedFiles = new Set<string>();
// Track through session: edit/write → add to editedFiles, read → add to verifiedFiles
const unverified = [...editedFiles].filter(f => !verifiedFiles.has(f));
if (unverified.length > 0) {
  // Re-prompt: "You have unverified files: {list}. Read each before finishing."
}
```

## Risk Assessment

- **Option A risk**: Slightly increases token usage per edit (50 lines of file content). Mitigated by line limit.
- **Option B risk**: May add 1-2 extra turns per session. Acceptable given EXP-530 showed 100% recovery.
- **Both**: No risk of breaking existing behavior — purely additive.

## Dependencies

- Tech-lead implementation (coach cannot modify infrastructure code)
- Escalation via P1 notification

## Timeline

1. Design: THIS SESSION ✅
2. Escalate to tech-lead: THIS SESSION
3. Implementation: ~1 week
4. Measurement: 1 week post-deployment (50+ sessions)

## Key Evidence Chain

| Experiment | Intervention Type | Result | Compliance |
|-----------|------------------|--------|------------|
| EXP-280 | Text skill | NEGATIVE | ~9% |
| EXP-340 | Context.md rule | No effect | ~9% |
| EXP-350 | Verbal commitment | INCONCLUSIVE | ~9% |
| EXP-495 | Write-first scaffold | NEGATIVE | 0% |
| EXP-565 | Threat-framed text | 0pp production | 9.7% |
| **EXP-575** | **Auto-read injection** | **TBD** | **Target ≥90%** |

Every text-based approach has failed. Only structural enforcement remains.
