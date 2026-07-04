# GPU Request Shape Repair - 2026-07-02

## Finding

The fresh GitHub reruns for:

- `spec.gpu.mig-partitioning`
- `spec.gpu.multi-gpu-workload`
- `spec.gpu.operator-default-install`
- `spec.gpu.skip-driver-install`

failed before product assertions because their ManagedCluster create body sent
`agentPoolProfiles[].gpuProfile.installGPUDriver`. The staging API rejected the
field with `UnmarshalError: json: unknown field "installGPUDriver"`.

Local REST schema evidence under the public Azure REST API specs shows the
current `GPUProfile` contract uses `gpuProfile.driver` with values `Install` and
`None`.

## Repair

Updated the GPU live carriers to use:

- `gpuProfile: { driver: "Install" }` for default driver install, MIG, and
  multi-GPU workload.
- `gpuProfile: { driver: "None" }` for skip-driver install.

Updated the source specs for default install and skip-driver install so future
planning/compact generation uses `agentPoolProfiles[].gpuProfile.driver` instead
of the obsolete field.

## Local Proof

Commands run:

```bash
bun runner/check-private-source-policy.ts --spec spec.gpu.operator-default-install --spec spec.gpu.skip-driver-install --spec spec.gpu.mig-partitioning --spec spec.gpu.multi-gpu-workload
bun runner/check-live-admission.ts --spec spec.gpu.operator-default-install --spec spec.gpu.skip-driver-install --spec spec.gpu.mig-partitioning --spec spec.gpu.multi-gpu-workload
for f in features/gpu/tests/gpu-operator-default-install.ts features/gpu/tests/gpu-mig-partitioning.ts features/gpu/tests/gpu-multi-gpu-workload.ts features/gpu/tests/gpu-skip-driver-install.ts; do bun "$f"; done
```

Result:

- Dependency policy passed for all 4 specs.
- Live admission policy passed for all 4 specs.
- All 4 GPU carrier check-mode runs completed and wrote evidence.

No live rerun was dispatched from this repair task.
