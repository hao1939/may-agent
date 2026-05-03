# EXP-580: Verify-After-Edit Production Re-Measurement

**Date**: 2028-08-27
**Status**: DESIGNED
**Type**: Production measurement (observational)
**Builds on**: EXP-565 (deployed 2028-08-13), EXP-575 (escalated for structural fix)

## Problem

EXP-565 (threat-framed verify-after-edit gate) was deployed to master-worker.ts on 2028-08-13. Initial measurement showed 0pp improvement over 9.7% baseline. However:
1. Sample may have been too early (agents hadn't run enough sessions)
2. The measurement methodology needs validation
3. If still 0pp after sufficient data, this confirms EXP-575 (structural auto-read) is the only path

## Hypothesis

**H-580**: After 2+ weeks of EXP-565 deployment, verify-after-edit rate remains ≤15% (confirming text interventions are fully exhausted and EXP-575 structural enforcement is required).

## Method

### Measurement Script
Scan recent session JSONL files for edit/write tool calls followed (within next 2 tool calls) by a read() on the same file path.

```bash
#!/bin/bash
# Count edit/write calls and subsequent read() verification
# in sessions after EXP-565 deployment (2028-08-13)

SESSIONS_DIR=".state/sessions"
DEPLOY_DATE="1777772000000"  # approximate epoch ms for Aug 13

total_edits=0
verified_edits=0

for f in $(find "$SESSIONS_DIR" -name "*.jsonl" -newer /tmp/cutoff 2>/dev/null | head -100); do
  # Count edit/write calls
  edits=$(grep -c '"tool_name":"edit"\|"tool_name":"write"' "$f" 2>/dev/null || echo 0)
  # Count read() calls following edit on same path (simplified)
  verified=$(grep -oP '"tool_name":"(edit|write)".*?"path":"([^"]+)"' "$f" | while read line; do
    path=$(echo "$line" | grep -oP '"path":"([^"]+)"' | head -1)
    # check if read of same path follows
    grep -q "read.*$path" "$f" && echo 1
  done | wc -l)
  total_edits=$((total_edits + edits))
  verified_edits=$((verified_edits + verified))
done

echo "Total edits: $total_edits"
echo "Verified edits: $verified_edits"
echo "Rate: $(echo "scale=1; $verified_edits * 100 / $total_edits" | bc)%"
```

### Success Criteria

| Outcome | Conclusion | Next Action |
|---------|-----------|-------------|
| Rate ≤15% | Text gate confirmed dead in production | Fast-track EXP-575 implementation |
| Rate 16-50% | Partial effect, text may be helping some agents | Investigate which agents respond |
| Rate >50% | Text gate working (delayed effect) | Hold EXP-575, monitor trend |

## Timeline
- Measurement: This session (audit available session data)
- Decision: If ≤15%, EXP-575 escalation stands as P0
- If >15%, de-prioritize EXP-575 and investigate further

## Relationship to EXP-575
This measurement determines urgency of EXP-575. If confirm ≤15%, structural enforcement is definitively the only path forward. EXP-575 escalation already sent to tech-lead as P0.
