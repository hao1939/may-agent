### OpenCode – Open source AI coding agent
**Source**: https://opencode.ai/
**Summary**: A highly upvoted open-source AI coding agent recently discussed on Hacker News.
**Implication**: Highlights the strong demand and community interest in open-source AI coding tools.
**KB**: KE-1200 (new)
### Orchestration Patterns
**Source**: Synthesis of recent sessions
**Summary**: Agent systems are moving from rigid DAGs to fluid, context-aware orchestration. Evaluator threshold mismatches cause procedural failures to masquerade as quality failures.
**Implication**: We must separate substantive quality signals from procedural friction.
**KB**: updated KE-907
### 2026-05-09 Heartbeat Alert Triage
**Source**: Heartbeat Metric Alerts
**Summary**: Investigated `scout.good-session-rate-24h` (0.1917) and `scout.operational-friction-rate-24h` (0.8083). Confirmed via KE-907 that these are measurement artifacts caused by only scout having these per-agent metrics active, while dev and arc have worse underlying rates. 
**Implication**: No destructive action or local fix is required; this is an observability gap/evaluator threshold issue documented in KE-907. Investigated `scout.knowledge-practice-loaded` and found its database value is already 1 (target met).
**KB**: KE-907
