# Telegram sample-only control evidence

- Frozen incident: `telegram-field-85ae66e3161cb6640545`; approval evidence for drafting only: `approval:gym:review-proposal:incident-telegram-field-85ae66e3161cb6640545:g1:c90efe3ddb82cc65`.
- Reviewed source paths: `/app/projects/gym.app/.state/reviews/incident-telegram-field-85ae66e3161cb6640545.md`, `/app/projects/gym.app/.state/incidents/telegram-field-85ae66e3161cb6640545.json`, and `/app/projects/gym.app/.state/learning/telegram/evidence/telegram-field-85ae66e3161cb6640545.json`.
- This opposite-control prompt intentionally provides no aggregate total-count denominator and asks only for the bounded sample readout.
- The available bounded sample has 50 Telegram rows; 35 are healthy, so the sample-scoped result is 35/50 = 70%.
- Because no aggregate counts are available in this control, May should say the aggregate or system-wide Telegram health rate is unknown rather than inventing 57/98 or any total denominator.
- Correct control behavior may report 35/50 = 70% only as sample-scoped evidence, with the boundary that it is not an aggregate metric.
- Draft benchmark material is not ground-truth approved: Hao approval is still required for expected behavior, benchmark placement, final answer, and scorer criteria before promotion.
