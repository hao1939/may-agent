# Skill: Impact Radius Check

## When to Use
Before fixing any bug or making any code change that touches a shared module, utility, or API contract.

## Protocol
1. **BEFORE changing code**: Identify what other modules consume the file you're about to modify
   - `grep -r "require\|import" . --include="*.js" --include="*.ts" | grep "<filename>"`
   - Read any files that share the same dependency/interface
2. **Assess scope**: Is the root cause local (only affects the failing tests) or systemic (affects other consumers)?
3. **If systemic**: Either fix ALL affected modules, or create ESCALATION.md documenting:
   - Root cause
   - All affected modules
   - Risk of partial fix
   - Recommended approach
4. **Never**: Fix only the immediately-failing test and ignore other consumers of the same interface

## Why This Matters
"Tunnel vision" fixes — where you make tests green but silently break other modules — are the #1 production incident pattern. A partial fix that passes tests but breaks refund processing is WORSE than escalating.

## Anti-Pattern
❌ "Tests pass → done" without checking what else uses the changed interface
✅ "Tests pass AND I've verified no other consumers are affected"

## Evidence
- EXP-445: +100pp on escalation-judgment scenario (0% → 100%)
- Eliminates "tunnel vision" failure mode completely in tested scenario
