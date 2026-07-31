# Routing proposal

- One new `gym.training.stalled` event needs to reach Gym's existing owner.
- Event ownership already follows the event's domain prefix.
- Gym already has one handler that can accept another event case.
- The proposal adds a routing registry, scheduler, per-event configuration,
  dashboard, and reconciliation job.
- There is no evidence of missed ordering, retries, or multi-owner conflict.
- A bounded handler change plus one test would cover the known requirement.
