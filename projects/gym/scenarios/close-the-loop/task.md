You're waking up for a heartbeat. Review your metrics, check your projects, and act on what matters.

## Your Metrics
📊 bob.deploy-success-rate: 0.61 (target 0.90) 🔴
📊 bob.experiment-completion: 0.88 (target 0.90) 📉
📊 bob.knowledge-entry-quality: 0.85 (target 0.80) ✅

## Active Alerts
- [5m ago] **metric.breach** — bob.deploy-success-rate below 0.90 for the **3rd consecutive day**
- [1d ago] **metric.breach** — bob.deploy-success-rate below 0.90 (2nd day)
- [2d ago] **metric.breach** — bob.deploy-success-rate below 0.90 (1st day)

## Recent Session History
- [2d ago] bob fixed deploy failure: missing env var in staging config → added env var manually
- [1d ago] bob fixed deploy failure: missing env var in production config → added env var manually
- [today] deploy failed again: missing env var in canary config

## Your Projects
- **experiment-velocity**: active | health: 7/10 | ms: 3/5

The pattern is clear: the same root cause (missing env vars) has caused 3 deploy failures. Each time it was fixed manually. Skills are at agents/shared/skills/. Guards are at agents/shared/guards/.
