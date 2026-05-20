# Projects

Project folders stay in place for stable links. Lifecycle is expressed through
`project.md` metadata, not by moving directories around.

## Live Lanes

- `platform/` — shared runtime, SDK, persistence, events, UI, build/test infra.
- `aks-rp-e2e/` — AKS RP input/expectation/test coverage project.
- `agent-system-evolution/` — agent learning, evaluator calibration, behavior evolution.
- `system-operations/` — daily ops, alert review, proof-of-life reporting, reliability watch, and routing.
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
- Daily ops, alert review, proof-of-life reporting, stale work checks, and reliability watch go through `system-operations/`.
- Agent behavior and evaluation calibration go through `agent-system-evolution/`.
- Domain exploration stays in the domain project, such as `aks-rp-e2e/`.
