# Skill Compliance Audit — 2026-06-30 (Phase 2)

## Method
Scanned all `.state/evaluations/*.json` (9 eval sessions, 9 agent-sessions scored).
Checked for VERIFICATION_FAILURE and READ_BEFORE violations in evaluator issue tags.

## Results

| Agent | Sessions | Avg Quality | Verify Failures | Read Failures |
|-------|----------|-------------|-----------------|---------------|
| coach | 3 | 0.53 | 2/3 (67%) | 0/3 |
| coder | 1 | 0.35 | 1/1 (100%) | 0/1 |
| optimizer | 4 | 0.53 | 4/4 (100%) | 0/1 |
| qa | 1 | 0.65 | 0/1 (0%) | 0/1 |

## Key Findings

1. **Verification failure is the #1 skill gap** — 7/9 sessions (78%) have verification-related issues
2. **verify-before-finish skill is deployed but not working** — agents with it still fail verification
3. **Sample is small** (9 sessions) — but 78% failure rate is signal, not noise
4. This confirms EXP-244 finding: "Verification failures are #1 cross-agent issue (20% of all eval findings)"

## Implication for Skill Quality

The `verify-before-finish` skill is deployed to 4+ agents but **compliance is near-zero in production**.
This means either:
- (a) The skill text doesn't change behavior (consistent with KE-002: text rules don't work)
- (b) The skill isn't actually in agent context when they run
- (c) The skill needs structural enforcement (a workflow gate, not just instructions)

## Recommendation
- EXP-248 gym test will determine if the skill works in isolation
- If it fails in gym too → skill needs redesign as a workflow/guard, not instructions
- If it passes in gym but fails in production → deployment/context issue
