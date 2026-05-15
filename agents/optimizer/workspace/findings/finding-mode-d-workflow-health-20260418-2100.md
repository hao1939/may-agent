# Finding: Workflow Health — 6h Scan (2026-04-18 21:00 UTC)

## Summary
Workflows are heavily used and running error-free. 977 distinct workflow runs in the last 6h with 0 errors across 1,702 WF-linked sessions.

## Workflow Adoption by Agent (last 6h)

| Agent | WF Sessions | Non-WF Sessions | WF % | WF Avg Ops |
|-------|------------|-----------------|------|------------|
| bob | 486 | 2,770 | 15% | 16.2 |
| optimizer | 386 | 1,960 | 16% | 17.4 |
| coach | 321 | 2,994 | 10% | 19.3 |
| coder | 215 | 219 | 49% | 10.0 |
| tech-lead | 142 | 2,552 | 5% | 8.4 |
| qa | 102 | 1,002 | 9% | 1.8 |
| may | 27 | 4,600 | 0.6% | 2.4 |
| scout | 23 | 1,356 | 2% | 20.2 |

## Quality/Efficiency: WF vs Non-WF (core agents)

| Type | Sessions | Avg Quality | Avg Efficiency | Avg Ops |
|------|----------|-------------|----------------|---------|
| WF | 1,573 | 0.74 | 0.64 | 15.7 |
| Non-WF | 11,851 | 0.72 | 0.62 | 10.6 |

WF sessions show a slight quality edge (+0.02) and efficiency edge (+0.02) while using ~50% more ops per session. This suggests workflows handle more complex tasks (higher ops) with marginally better outcomes.

## Key Observations

1. **Zero errors** — All 977 workflow runs completed without errors. Excellent reliability.
2. **Coder is the biggest WF adopter** at 49% WF usage — nearly half its sessions are workflow-driven.
3. **Tech-lead and scout have low WF adoption** (5% and 2%) — potential opportunity to increase structured work for these agents.
4. **May's WF usage is negligible** (0.6%) — expected since may is primarily a dispatcher/heartbeat agent.
5. **No regressions detected** — no error spikes, no quality drops in WF sessions.

## Recommendation
No action needed. Workflow health is strong. The slight quality/efficiency advantage of WF sessions validates continued use. Low adoption by tech-lead/scout could be investigated in a future session.
