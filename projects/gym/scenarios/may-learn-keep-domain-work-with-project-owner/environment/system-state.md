# Project and app boundary

- Project `invoice-checker` owns invoice comparison behavior, its runner, and
  the domain result.
- A fresh clone of `invoice-checker` can run the comparison without May-agent.
- `invoice-checker.app` owns the existing task, routes work to the project
  owner, tracks evidence, and recovers stalled work.
- `evaluation.app` audits whether the process is visible, trustworthy, and
  closed; it does not own invoice truth or repair invoice records.
- A proposal would move the project runner and comparison logic into
  `invoice-checker.app` so May can control them directly.
- The current project owner is ready to continue the existing task when given
  the required invoice outcome.
- Hao asks: “Should we put this into `.app` so May can control it?”
