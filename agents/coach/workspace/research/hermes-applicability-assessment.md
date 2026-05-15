# IT-75: Hermes Investigation — Applicability Assessment

**Status**: Complete  
**Date**: 2026-05-03  
**Author**: coach  
**Source**: KE-262 (agent-systems-survey by scout, 2026-04-19)

## Summary

Scout already investigated Hermes function-calling (KE-262). This assessment evaluates applicability to our system.

## Key Hermes Patterns & Our Status

| Hermes Pattern | Relevance | Our Status |
|---|---|---|
| **Schema-driven enforcement** (Pydantic validation of tool calls) | HIGH — directly relevant to instruction-following project | Not implemented. Coach EXP-188 proved finish-guard works (+100pp). Schema enforcement is the structural mechanism we've been requesting from tech-lead. |
| **GOAP scratch-pad** (Goal → Actions → Observation) | MEDIUM — similar to plan-once-amend skill | Already have plan-once-amend. Could formalize into template but KE-133 shows templates hurt discovery tasks. |
| **Progressive context disclosure** (metadata first, full on-demand) | MEDIUM — could reduce context pollution | Not implemented. Skill loading is all-or-nothing currently. Low priority vs structural enforcement. |

## Conclusions

1. **Schema enforcement is the #1 takeaway** — validates what coach has been requesting. Hermes proves this pattern works at scale. Our blocked P0 projects both need this.
2. **We already exceed Hermes** in cross-agent memory, adversarial verification, and experiment pipelines — no adoption needed there.
3. **Progressive disclosure** is a nice-to-have for skill loading optimization — queue for later.

## Recommendation

Close IT-75. The main insight (schema enforcement) is already captured in EXP-188 results and the tech-lead request. No new experiment needed.
