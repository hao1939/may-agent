# KE-407: Gym Experiments Require Agent Binary Validation Pre-Flight

**Source**: EXP-251 Phase 2, Extraction #1 (structured lesson extraction from memory stream)
**Date**: 2027-04-27
**Confidence**: High (3+ experiments blocked by this same failure)

## Finding

Gym experiments silently run in stub mode without a real agent binary. GYM_AGENT_BIN env var defaults to stub with no warning. Sessions complete in ~60ms (vs real ~30s+), producing misleading "results."

## Rule

Before running ANY gym experiment:
1. `echo $GYM_AGENT_BIN` → must point to valid binary (e.g., `/app/agents/may-agent-bin`)
2. Check session duration after first run: <5s = stub mode = invalid data
3. If missing, set explicitly before invoking gym-runner

## Cross-References

- EXP-190, EXP-191, EXP-192: all blocked by this
- KE-405: structural enforcement spectrum (this is a pre-flight check gap)
- H-EXP-046: self-correction diagnostic also needs valid gym runs
