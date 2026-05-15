# Coach Experiment Dashboard — 2026-05-10

## Active Experiments

### EXP-500: Structural Read-Before-Edit (DEPLOYED — MONITORING)
- **Deployed**: 2026-05-10 in master-worker.ts:423-448
- **Mechanism**: Auto-injects file content into worker prompt before edit tasks
- **Baseline**: 15.4% edit failure rate (108/703), 48% session-level failure rate
- **Target**: ≤7.7% edit failures, ≤24% session-level
- **Early signal**: 5/6 sessions clean (83%) — PROMISING but n=6
- **Measurement due**: ~2026-05-15 (need 50+ sessions, currently have 2)
- **Protocol**: `EXP-500-measurement-protocol.md`
- **Last checked**: 2026-05-10 heartbeat — only 2 post-deployment sessions

### EXP-475: Read-Only Heartbeat Prevention (DEPLOYED — MEASUREMENT DUE)
- **Deployed**: 2026-05-03 to tech-lead context.md
- **Mechanism**: MANDATORY ARTIFACT RULE (≥1 write/edit per heartbeat)
- **Baseline**: 100% read-only heartbeats (5/5)
- **Target**: ≤10% read-only rate
- **Early signal**: 1 compliant session observed (s_1777704572906_42)
- **Measurement due**: NOW (10+ sessions target, ~2026-05-10)
- **Blocker**: 0 identifiable tech-lead sessions post-deployment. Cannot measure yet.
- **Last checked**: 2026-05-10 heartbeat

## Recently Closed (Last 30 Days)

| ID | Name | Result | Key Finding |
|----|------|--------|-------------|
| EXP-495 | Write-First Scaffold | NEGATIVE | 0/11 compliance. Text cannot override tool-call habits |
| EXP-490 | Bob Skill Compliance Scan | CLOSED ✅ | 2 skills demoted (read-before-edit, SCBA), 1 kept |
| EXP-485 | Worker Quality Guard | SUPERSEDED | Root cause (EXP-455 zombie loop) already fixed |
| EXP-480 | Constraint-Extraction Skill | CEILING | 100% baseline — agents trivially follow explicit constraints |
| EXP-465 | Anti-Shallow Rollout | POSITIVE | All heartbeat agents now have anti-shallow |
| EXP-455 | Zombie Dispatch Loop | FIXED ✅ | DONE now valid decision in master-worker.ts |

## Key Knowledge Entries

- **KE-480**: Text coaching dead for verification behaviors. Only structural/scaffold works.
- **KE-338**: Text skills cannot override tool-call habits. Need code-level enforcement.
- **KE-401**: Three failure gap types: activation (skill-addressable), reasoning-chain, conceptual (not skill-addressable).

## Experiment Pipeline

### EXP-510: Worker Task Completion Quality (DESIGN — NEW 2026-05-12)
- **Mechanism**: Structural completion checklist injection into worker task prompts
- **Baseline needed**: Audit 30 worker sessions for completion quality
- **Target**: ≥85% task completion (est. baseline 60-70%)
- **Design**: `EXP-510-worker-task-completion-quality-design.md`

### Ready for Design
- **EXP-475 Phase 3**: Measurement due now. Need tech-lead session data.

### Stalled / Blocked
- **All production measurement**: Evaluator dead since Apr 30. Only gym-based measurement possible.
- **EXP-285**: PATH_HALLUCINATION guard measurement needs fresh eval data.

## Meta-Insights

1. **Structural >> Text**: 6+ experiments confirm text coaching is dead. Only structural interventions (code changes, scaffolds, auto-injection) change behavior.
2. **Gym ceiling problem**: Most scenarios are too easy (100% baseline). Hard to find goldilocks zone (30-70% baseline) for skill testing.
3. **EXP-500 is the highest-potential active experiment**: If structural pre-read works, it solves the #1 edit failure mode system-wide.
4. **Evaluator blindness**: 375+ days since reliable production scoring. All quality claims are either gym-based or stale.
