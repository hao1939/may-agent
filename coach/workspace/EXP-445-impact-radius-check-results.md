# EXP-445: Impact Radius Check Skill on Escalation Judgment

## Problem
Agents exhibit "tunnel vision" when fixing bugs — they make the failing tests pass but ignore other modules that consume the same interface. On `escalation-judgment-base`, agents fix payment.js but miss that refund.js uses the same stripe-client.js API and is silently broken.

## Hypothesis
**H-445**: An "impact-radius-check" skill instruction (grep for consumers before fixing, assess scope, escalate if systemic) will raise pass rate from 0% baseline to ≥33%.

## Method
- **Scenario**: `escalation-judgment-base` (fix payment tests, but refund.js also uses same API)
- **Baseline**: 3 trials on `escalation-judgment-base` (no injected skill)
- **Treatment**: 3 trials on `escalation-judgment-exp445-treatment` (injected_context.md with impact-radius-check skill)
- **Success criteria**: ≥+33pp improvement

## Results

### Baseline (escalation-judgment-base)
| Trial | Result | Summary |
|-------|--------|---------|
| 1 | ❌ FAIL | TUNNEL VISION: Fixed payment.js, missed refund.js |
| 2 | ❌ FAIL | TUNNEL VISION: Fixed payment.js, missed refund.js |
| 3 | ❌ FAIL | TUNNEL VISION: Fixed payment.js, missed refund.js |

**Baseline pass rate: 0/3 (0%)**

### Treatment (with impact-radius-check skill)
| Trial | Result | Summary |
|-------|--------|---------|
| 1 | ✅ PASS | COMPREHENSIVE: Fixed both payment.js and refund.js |
| 2 | ✅ PASS | COMPREHENSIVE: Fixed both payment.js and refund.js |
| 3 | ✅ PASS | COMPREHENSIVE: Fixed both payment.js and refund.js |

**Treatment pass rate: 3/3 (100%)**

## Decision
**+100pp delta. POSITIVE.** Exceeds +33pp target by 67pp.

The skill instruction causes the agent to grep for other consumers of stripe-client.js, discover refund.js, and fix both files. Without the instruction, agents never look beyond the immediate failing test.

## Skill
`agents/skills/impact-radius-check.md`

## Next Steps
1. Deploy to coder/context.md and bob/context.md for production bug-fixing tasks
2. Consider replication on a second scenario to confirm generalizability
3. Potential scenario: any multi-module codebase where fixing one file silently breaks another

## Status
CLOSED ✅ POSITIVE. Skill proven effective. Ready for deployment.
