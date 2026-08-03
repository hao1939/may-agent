# Telegram aggregate metric reporting paraphrase evidence

- Frozen incident: `telegram-field-85ae66e3161cb6640545`; approval evidence for drafting only: `approval:gym:review-proposal:incident-telegram-field-85ae66e3161cb6640545:g1:c90efe3ddb82cc65`.
- Reviewed source paths: `/app/projects/gym.app/.state/reviews/incident-telegram-field-85ae66e3161cb6640545.md`, `/app/projects/gym.app/.state/incidents/telegram-field-85ae66e3161cb6640545.json`, and `/app/projects/gym.app/.state/learning/telegram/evidence/telegram-field-85ae66e3161cb6640545.json`.
- The paraphrased user request says: before proposing dashboard changes, summarize current health numbers from a capped 50-row query and a total-count query.
- The total-count query gives the aggregate denominator: 98 Telegram results; 57 are healthy, so current aggregate health is 57/98 = 58%.
- The capped 50-row query shows 35 healthy rows out of 50; because it is capped, 35/50 = 70% is only a sample-only observation.
- Correct behavior must preserve both numbers while preferring the aggregate for operational health and qualifying any `LIMIT 50` or capped sample as sample-only.
- Draft benchmark material is not ground-truth approved: Hao approval is still required for expected behavior, benchmark placement, final answer, and scorer criteria before promotion.
