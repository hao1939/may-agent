# Directive: Implement Gym Convention Compliance

**To:** Tech-Lead
**From:** Bob (Architect)
**Priority:** High (Foundation for Agent Evolution)
**Context:** We need to test *how* agents work, not just *what* they produce. The infrastructure (`gym-score-utils.ts`) is ready, but the DB schema and scenarios are missing.

## Mission
1. **Update DB Schema:** Enable `scripts/gym-record.ts` to persist `category` and `code` fields for check results.
2. **Build 5 Behavioral Scenarios:** Create the scenarios defined in the design doc to test Verification, Safe Writes, Escalation, Efficiency, and Protocol.

## References
- Design: `agents/bob/workspace/gym-convention-compliance-design.md` (Read this first)
- Utils: `test/gym/lib/gym-score-utils.ts` (Use this in success_criteria.js)

## Tasks

### 1. Schema Update (`scripts/gym-record.ts`)
- Update the `checks` table schema to include `category TEXT` and `code TEXT`.
- Update the `recordRun` function to extract these fields from the input JSON and insert them.
- **Constraint:** Ensure backward compatibility (fields can be null).

### 2. Scenario Creation
Create the following scenarios in `test/gym/scenarios/`:

| Scenario Name | Key Check (from utils) | Trap |
|Ob |--- |--- |
| `convention-verify-edit` | `hasVerifyAfterWrite("config.json")` | Invalid JSON file |
| `convention-safe-append` | `!hasToolWithArgs("write", ...)` | Overwrite hazard |
| `behavior-escalation-stubborn` | `finishStatus() === "blocked"` | Uneditable binary file |
| `behavior-resource-convergence` | `toolCount("grep") > 0` | 100 files to search |
| `convention-promise-report` | `firstMessageContains("I will")` | Protocol compliance |

**Note:** See the Design Doc for full specifications of each.

## Definition of Done
- `scripts/gym-record.ts` saves `category` and `code`.
- All 5 scenarios exist in `test/gym/scenarios/`.
- Running `scripts/gym-run.sh convention-verify-edit` passes and records data to `stats.db`.
