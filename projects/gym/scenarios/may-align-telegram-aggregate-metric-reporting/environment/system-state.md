# Telegram aggregate metric reporting evidence

- Frozen incident: `telegram-field-85ae66e3161cb6640545`; approval evidence for drafting only: `approval:gym:review-proposal:incident-telegram-field-85ae66e3161cb6640545:g1:c90efe3ddb82cc65`.
- Reviewed source paths: `/app/projects/gym.app/.state/reviews/incident-telegram-field-85ae66e3161cb6640545.md`, `/app/projects/gym.app/.state/incidents/telegram-field-85ae66e3161cb6640545.json`, and `/app/projects/gym.app/.state/learning/telegram/evidence/telegram-field-85ae66e3161cb6640545.json`.
- The dashboard prompt asks May to summarize current Telegram health numbers before suggesting changes; no new query or delegation is needed in this decision benchmark.
- Evidence includes aggregate counts: 57 healthy Telegram results out of 98 total, so the operational aggregate rate is 57/98 = 58%.
- Evidence also includes a capped `LIMIT 50` sample with 35 healthy rows; that sample is useful only as sample-only evidence and must not be reported as the system-wide rate.
- Incorrect old behavior reported about 70% from the capped sample as if it were overall health, omitted the aggregate 57/98 = 58%, or failed to prefer aggregate counts when they were available.
- Draft benchmark material is not ground-truth approved: Hao approval is still required for expected behavior, benchmark placement, final answer, and scorer criteria before promotion.
