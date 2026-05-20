# Projects

Project folders stay in place for stable links. Lifecycle is expressed through
`project.md` metadata, not by moving directories around.

## Live Lanes

- `platform/` — shared runtime, SDK, persistence, events, UI, build/test infra.
- `aks-rp-e2e/` — AKS RP input/expectation/test coverage project.
- `agent-system-evolution/` — agent learning, evaluator calibration, behavior evolution.
- `closed-loop-reliability/` — metric-driven operational reliability watch lane.
- `daily-alert-review/` — recurring human-facing alert review/reporting lane.
- `scout-second-brain-learning/` — scout-specific learning adoption lane.
- `ruflo-learning-loop/` — paused external-methodology learning loop with a falsifier.

## Historical Projects

Closed historical projects remain at their original paths with:

```yaml
status: closed
type: archive
```

They are evidence and context, not active work queues. If a historical issue
recurs, open a concrete task in the owning live lane instead of resurrecting a
stale broad project by default.

## Ownership Rules

- Platform work goes through `platform/`.
- Agent behavior and evaluation calibration go through `agent-system-evolution/`.
- Runtime reliability regressions go through `closed-loop-reliability/`.
- Daily human-facing alert reporting goes through `daily-alert-review/`.
- Domain exploration stays in the domain project, such as `aks-rp-e2e/`.
