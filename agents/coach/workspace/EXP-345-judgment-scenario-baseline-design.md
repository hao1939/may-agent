# EXP-345: Judgment Scenario Baseline — conflicting-requirements-tradeoff

## Problem
All 26+ single-session gym scenarios are at ceiling (90-100%). Gym can't drive further skill improvement. The `conflicting-requirements-tradeoff` scenario was created (2025-05-01) specifically to break ceiling — it tests JUDGMENT (detecting incompatible stakeholder requirements), not just code-fixing. But it was never baselined.

## Hypothesis
This judgment scenario will score <50% on baseline runs (ceiling broken), because:
- It requires agents to do arithmetic (10M × 300B = 3GB > 256MB; 10M ÷ 150K = 67s > 30s)
- It requires COMMUNICATION (flagging conflict to stakeholders) not just implementation
- KE-054 confirmed judgment tasks are outside the text-coaching effectiveness boundary

## Design
- **Scenario**: `agents/gym/scenarios/conflicting-requirements-tradeoff/`
- **Baseline**: 3 runs, no treatment, standard coder agent
- **Success criteria**: ≥1 run scores <50 (ceiling broken, scenario is useful for training)
- **Measurement**: Judge scoring per `judge_criteria.md` rubric (0-100)

## Baseline Run Protocol
```bash
cd /app/agents
export GYM_AGENT_BIN=/usr/local/bin/may-agent
bash test/gym/run-gym.sh conflicting-requirements-tradeoff --timeout 600
# Run 3 times, record each score
```

## What's Next (conditional)
- **If ceiling broken (<50% avg)**: Design treatment skill for conflict-detection / tradeoff-escalation
- **If ceiling NOT broken (≥80% avg)**: Need even harder scenarios (multi-session, larger codebases)

## Status: READY FOR BASELINE
Created: 2025-09-02
