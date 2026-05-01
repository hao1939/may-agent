# EXP-300 Phase 1 Results: Verify-After-Write Compliance Audit

**Date**: 2028-07-01
**Measured by**: bob
**Status**: PHASE 1 COMPLETE

## Methodology

Sampled 16 recent sessions from `.state/sessions/history/` that contained write/edit calls. For each session, extracted tool call sequences and checked whether each `edit()` or `write()` was **immediately followed** by a `read()` of the same file path.

**Parser**: regex extraction of `(tool_name, file_path)` tuples from session.jsonl, then sequential pair checking.

## Results

| Metric | Value |
|--------|-------|
| Sessions sampled | 16 |
| Total write/edit calls | 44 |
| Immediately followed by read() | 9 |
| **Compliance rate** | **20.5%** |

### Comparison to Baseline

| Period | Compliance | Notes |
|--------|-----------|-------|
| 2026-07 (skill-workflow-audit) | 9% | Pre-intervention baseline |
| 2028-07 (this measurement) | 20.5% | After context.md rules + task prompts |

**Improvement**: +11.5 percentage points (absolute), ~2.3x relative improvement.

## Interpretation

Per EXP-300 decision criteria:
- ≥60%: Text coaching working → SUCCESS
- 30-60%: Partial → design stronger framing
- **<30%: Text coaching insufficient → escalate structural guard as P0**

**Result: 20.5% < 30%. Text coaching is insufficient.**

This confirms KE finding: "Text-only skills achieve 10-35% compliance; structural enforcement achieves 99%." The verify-after-write rule sits squarely in the text-only band despite being prominently placed in context.md.

## Recommendation

**Escalate structural guard to P0.** Specifically:
1. The `edit()` and `write()` tool implementations should automatically trigger a read-back or include file content in their response
2. Alternative: workflow-level middleware that injects a read() after every write/edit
3. The diff preview from edit() may give agents a false sense of verification — they see the diff and skip the read

## Caveats

- Parser is approximate (regex on JSONL, not full tool-call graph parsing)
- "Immediately followed" is strict — some agents may read 2-3 calls later
- 16 sessions is a modest sample but consistent with prior findings
- Mixed agent population (didn't filter by agent type)

## Next Steps

- [ ] Brief tech-lead on structural guard recommendation
- [ ] Design the structural enforcement mechanism (auto-readback or tool-level change)
- [ ] If implemented, re-measure to confirm 99%+ compliance
