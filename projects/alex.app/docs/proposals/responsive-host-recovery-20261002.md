# Keep recovery from blocking ordinary Host requests

**Status — 2026-11-12:** The implementation plan, measurements and rollout
observations are preserved in the
[dated responsiveness record](../archive/reviews/responsive-host-recovery-20261002.md).
This forwarding entry preserves the original address.

Bounded startup recovery and current execution rules belong to
[Runtime](../2a-design/runtime.md#startup). Remaining representative query/control
performance evidence belongs to the
[Host follow-up](host-contract-improvements-20261016.md#query-cost-and-control-responsiveness).
Reproduce a current failure before reviving an old isolation or query repair plan.

The [single active recovery proposal](unified-agent-recovery-20261017.md) owns
the connected recovery trial. Responsive controls are one contrast within that
trial; quiet queues or low SQL counters do not establish original-work recovery.
