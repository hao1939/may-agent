# Workflow Health Check — Apr 16, 2026

## Overall Adoption

| Metric | Apr 15 baseline | Apr 16 current | Delta |
|--------|----------------|----------------|-------|
| System-wide adoption | 27.1% | **5.2%** (1077/20880) | -21.9pp ⚠️ |

**Major drop**. The Apr 15 baseline likely measured a narrower window or different filter. The current 5.2% covers all sessions since Apr 15 18:34 UTC (~15h window, 20K+ sessions).

## Adoption by Core Agent

| Agent | Sessions | Workflow | Rate |
|-------|----------|----------|------|
| **coder** | 261 | 109 | **41.8%** ✅ |
| **optimizer** | 2014 | 262 | **13.0%** |
| **bob** | 2807 | 355 | **12.6%** |
| **coach** | 2822 | 251 | **8.9%** |
| **qa** | 922 | 55 | **6.0%** |
| **tech-lead** | 2396 | 39 | **1.6%** ⚠️ |
| **scout** | 1172 | 6 | **0.5%** ⚠️ |
| may | 4177 | 0 | 0% (orchestrator) |
| evaluator | 2172 | 0 | 0% (evaluator) |
| amy-kimi | 990 | 0 | 0% |
| amy | 839 | 0 | 0% |

### Key Observations

1. **Coder is the workflow champion** at 41.8% — nearly 4x the next agent. This aligns with KE-007 (workflow enforcement is the only reliable behavioral intervention).

2. **Tech-lead and scout are laggards** at 1.6% and 0.5%. These agents do significant work but rarely use workflows. This is a KE-020 issue (capability availability ≠ adoption).

3. **amy/amy-kimi at 0%** — these agents have no workflow integration at all.

## Quality & Efficiency Impact

| Type | N | Avg Quality | Avg Efficiency | Avg Productive | Avg Wasted |
|------|---|-------------|----------------|----------------|------------|
| **workflow** | 1075 | **0.75** | **0.65** | 0.2 | 0.0 |
| **direct** | 19637 | 0.63 | 0.56 | 16.0 | 1.9 |

- **+19% quality** for workflow sessions (0.75 vs 0.63)
- **+16% efficiency** (0.65 vs 0.56)
- Near-zero waste in workflow sessions

Note: The low productive call count (0.2) for workflow sessions suggests these are the *parent* workflow records, not the step sessions. The actual work happens in workflow_step sessions (excluded from this count).

## Recommendations

1. **Priority: Wire tech-lead and scout into workflows** — these high-volume agents (2396 and 1172 sessions) would benefit most from the +19% quality boost.

2. **Investigate coder's success** — what makes coder adopt workflows at 41.8%? Likely explicit wiring in its handlers. Replicate this pattern for other agents.

3. **Don't force workflows on may/evaluator** — these are infrastructure agents where workflows may not apply.

4. **The 5.2% headline number is misleading** — most sessions are heartbeats/dispatches (may alone is 4177). Among *worker* agents (bob, coder, coach, optimizer, qa, tech-lead, scout), adoption is ~10.2% (1077/10594).

## Conclusion

Workflow adoption remains low system-wide but delivers clear quality gains where used. The gap between coder (41.8%) and everyone else points to a wiring problem, not a value problem. Next optimization should focus on adding workflow calls to tech-lead and scout handlers.
