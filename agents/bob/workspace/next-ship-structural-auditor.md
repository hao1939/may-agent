# Next Ship: Structural Auditor (from EXP-242)

**Priority**: P1 — proven improvement sitting unshipped since 2025-01-28
**Evidence**: EXP-242, p=0.015, N=26, 0%→44% fix rate on ordering bugs
**Limitation**: Only proven for structural/ordering bugs, NOT general (EXP-245 confirmed no generalization)

## Status

- [x] Experiment confirmed (EXP-242)
- [x] Proposal written (agents/bob/workspace/proposals/ship-structural-auditor-EXP242.md)
- [ ] Implementation designed
- [ ] Code written
- [ ] Tested in gym
- [ ] Shipped to production

## Next Session Plan

1. Read `agents/shared/workflows/implement-and-verify.ts` to understand current flow
2. Design auditor hook point — trigger on test failures with ordering/structural patterns
3. Implement as a workflow hook or optional step
4. Test with cascading-fix-trap-v2 gym scenario

## Key Decision

Should this be:
- A hook in implement-and-verify (lower risk, limited scope)
- A separate workflow step that any workflow can opt into
- A standalone workflow agents can call

Leaning toward: hook in implement-and-verify, triggered only when test output matches structural failure patterns.
