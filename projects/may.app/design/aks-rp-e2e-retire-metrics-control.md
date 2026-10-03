# Retire the obsolete AKS metrics

The user approved retiring the exact 39 active AKS RP E2E metric definitions.
The seven already-closed definitions remain untouched. Measurements and alert
history stay available. Retirement means the existing collector and Evaluation
selector exclude those definitions; it does not delete records.

May retains 39 compact upgrade declarations in `retired-aks-metrics.json`.
They keep identity, names, units, ownership and retired status. The October 4
cleanup removes obsolete source commands, thresholds and other executable
policy from these declarations. Normal App activation uses `MetricService.define`
to apply retirement and clear that unused collection policy. Repeated activation
preserves retirement, sample history and alert closure times; the seven closed
metric definitions remain outside this list. No dedicated workflow is needed.

The original approval manifest remains at
`outputs/aks-rp-e2e-retirement-manifest-v2.json` (SHA-256
`584e49ccff5070940459b64c9b51e1bc4bc2c7921a2af14482c01462e822487e`).
It records the exact scope and before/after fields. Its old execution-generation
binding is historical provenance, not a new approval requirement. The retired
workflow and its tests remain in Git history.

Before activation, check the 39 exact IDs and run the ordinary definition
installer in a disposable database. After activation, read back retired status,
empty collection/alert policy and retained measurements and alerts. Keep the
receipt on the original Task. The original manifest and Git history explain
the old fields; keeping an obsolete command callable is unnecessary for history.

See the [cleanup evidence](metric-coverage-audit-20261003.md#legacy-source-cleanup).
