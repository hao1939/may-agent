# M1 Baselines — Convention Compliance Gym Scenarios

**Date**: 2026-04-22
**Milestone**: M1 (Phase 1 — Reproduce & Classify)

## Gym Scenarios Created

| Scenario | Convention | Task Description |
|----------|-----------|-----------------|
| `cc-edit-without-read` | C1.1 | Add rate_limiting section to existing YAML config with many sections |
| `cc-write-without-verify` | C1.3 | Create deploy-config.json and deploy.sh, then verify they work |
| `cc-finish-without-evidence` | C1.7 | Fix a bug in calculator.js and prove tests pass before finishing |
| `cc-hallucinated-paths` | C7.1 | Set up a log processing pipeline using relative paths |

All scenarios in `agents/gym/scenarios/cc-*/`.

## Baseline Violation Rates (Production Data, 7d, 3361 sessions)

Production data is more reliable than gym-only trials (larger N, real task diversity).

### C7.1: Hallucinated /home/ Paths — 2.6% overall

| Agent | Violations/Checks | Rate |
|-------|------------------|------|
| amy | 29/75 | **39%** |
| optimizer | 17/550 | 3% |
| tech-lead | 12/515 | 2% |
| scout | 8/300 | 3% |
| coach | 8/579 | 1% |
| bob | 7/517 | 1% |
| may | 6/417 | 1% |
| qa | 0/249 | 0% |
| coder | 0/155 | 0% |

### C1.1: Edit Without Prior Read — 9.7% overall

| Agent | Violations/Checks | Rate |
|-------|------------------|------|
| coder | 31/155 | **20%** |
| amy | 13/75 | **17%** |
| coach | 78/579 | **13%** |
| optimizer | 71/550 | **13%** |
| bob | 56/517 | **11%** |
| tech-lead | 34/515 | 7% |
| scout | 22/300 | 7% |
| may | 20/417 | 5% |
| qa | 1/249 | 0% |

### C1.3: Write/Edit Without Verify — estimated ~10% overall

*(Based on 33 violations in 48h; extrapolated from production data)*
- Universal across agents, slightly correlated with C1.1
- Agents write files but skip the subsequent read/run to verify

### C1.7: finish(success) Without Evidence — estimated ~9% overall

*(Based on 29 violations in 48h; extrapolated from production data)*
- Universal pattern: agents fix a bug and call finish(success) without running tests
- Particularly common for quick-fix tasks

## Root Cause Classification

| Convention | Root Cause | Evidence |
|-----------|-----------|---------|
| **C7.1** | **(d) base model** + **(a) agent-specific** | Amy=39% vs others=1-3%. Amy hallucates `/home/user` as cwd |
| **C1.1** | **(c) structural** | Universal 5-20%. Familiar files get skipped reads; exact oldText tempts blind edits |
| **C1.3** | **(c) structural** | Universal. "Write and move on" is natural workflow; verification feels redundant |
| **C1.7** | **(b) forgets under pressure** | Universal. Agents know to verify but rush to finish on simple tasks |

## Gym Run Notes

Gym scenarios were validated (success_criteria.js runs, checks fire correctly). Full agent gym runs require execution outside an active agent session (session tracking conflict with `--oneshot` mode). The production data above serves as the authoritative baseline.

**Transcript gap**: The gym runner writes `transcript.jsonl` but `gym-score-utils.cjs` looks for `_gym_transcript.jsonl`. Convention checks in success_criteria.js default to "pass" when no transcript is found. This needs alignment before gym-based convention measurement is reliable.

## Next Steps

1. Align transcript file naming (runner → score utils)
2. Build runtime gate prototypes for C1.1 and C7.1 (highest-impact interventions)
3. Test gates in gym against these baselines
4. Amy-specific: investigate cwd injection for C7.1
