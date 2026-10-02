# Retire the obsolete AKS metrics

The user approved retiring the exact 39 active AKS RP E2E metric definitions.
The seven already-closed definitions and all measurements, alerts and history
remain unchanged. Retirement means the existing collector and Evaluation
selector exclude those definitions; it does not delete records.

May declares the approved complete definitions in `retired-aks-metrics.json`,
with only persisted `status` changed to `retired`. Optional null source fields
are omitted in the App declaration and persist as the same null values. The normal App-definition reload uses
`MetricService.define` to apply them. No dedicated workflow, Task-generation
check or new approval process is needed for this already-authorized operation.
Repeated reloads retain retirement and leave other definition fields intact;
`updated_at` is the existing mechanical definition-write timestamp.

The original approval manifest remains at
`outputs/aks-rp-e2e-retirement-manifest-v2.json` (SHA-256
`584e49ccff5070940459b64c9b51e1bc4bc2c7921a2af14482c01462e822487e`).
It records the exact scope and before/after fields. Its old execution-generation
binding is historical provenance, not a new approval requirement. The retired
workflow and its tests remain in Git history.

Before activation, compare all current definitions to the approved fields and
run the real definition installer on a disposable database copy. After activation,
read back the exact 39 retired plus seven closed definitions, compare all other
fields and retained history, observe one former collection interval, and verify
an ordinary reload preserves the result. Keep receipts on the original Task.
