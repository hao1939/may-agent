# Experiment Dashboard — 2026-05-17

## Active Experiments

| ID | Name | Status | Signal | Next Action |
|----|------|--------|--------|-------------|
| EXP-500 | Structural Read-Before-Edit | **CLOSED ✅ POSITIVE** | 0% failure vs 15.4% baseline | Done — keep deployed |
| EXP-510 | Worker Task Completion Quality | DEPLOYED | Awaiting data | Measure at n≥30 (~2026-05-24) |
| EXP-475 | Read-Only Heartbeat Prevention | PARTIAL POSITIVE | 55% vs 100% baseline (target: ≤10%) | Needs structural gate (EXP-520) |
| EXP-520 | Heartbeat Artifact Gate | DESIGN | — | Locate dispatch code, write impl spec |

## Recently Closed

| ID | Name | Result | Key Finding |
|----|------|--------|-------------|
| EXP-500 | Structural Read-Before-Edit | ✅ POSITIVE | 15.4% → 0% edit failures. Structural injection works perfectly. |
| EXP-495 | Write-First Scaffold | ❌ NEGATIVE | 0% compliance. Text can't override tool-call habits. |
| EXP-490 | Bob Skill Compliance Scan | ✅ CLOSED | 2 skills demoted, 1 kept. Evidence-based pruning. |
| EXP-480 | Constraint-Extraction Skill | CEILING | 100% baseline. Real violations are cross-context. |

## Deployment Pipeline

| Experiment | What to Deploy | Where | Blocker |
|-----------|----------------|-------|---------|
| EXP-510 | Completion quality injection | master-worker.ts | ✅ ALREADY DEPLOYED |
| EXP-520 | Artifact gate for heartbeats | heartbeat dispatch code | Need to locate code + deploy |

## Key Metrics (from session-outcomes.jsonl)

- **Tech-lead read-only rate**: 55% (6/11) — improved from 100% but above 10% target
- **Edit failure rate (post EXP-500)**: 0% (0/49 calls) — perfect
- **Worker structured finish rate**: 0% baseline, awaiting post-EXP-510 measurement

## Proven Interventions (Knowledge Base)

1. **Structural injection** (EXP-500): 100% effective for information-gap behaviors
2. **Text coaching** (KE-480): Dead for verification/behavioral constraints
3. **Anti-shallow rule** (EXP-290/465): Binary gate, prevents empty sessions
4. **Impact-radius-check skill** (EXP-445): +100pp in gym, deployed to bob/coder
5. **Output format instruction** (EXP-335): +100pp compliance when present

## Next Priorities

1. **EXP-510 measurement** (2026-05-24): Are workers now producing structured finish()?
2. **EXP-520 implementation**: Structural gate for read-only heartbeats
3. **EXP-475 formal closure**: Close as PARTIAL POSITIVE, superseded by EXP-520
