# First E2E Run Results

**Date:** 2026-05-12
**Build Version:** `hayuaebld163822451`
**Scenario:** `Scenario_If_Match` candidate (dev suite)

## Status: IN PROGRESS — Devbox Access Verified

The earlier "cannot SSH to devbox" conclusion was wrong. It came from routing
remote commands through local `bash`, seeing a local path-guard warning for
remote `/home/...` paths, and treating that warning as remote access failure.

`cc_worker` can execute `ssh devbox '...'` commands and has returned real
devbox output in sessions `s_1778502610207_137` and `s_1778575778461_3`.
However, `cc_worker` is a delegated LLM worker, not an exact shell. For
reproducible stdout/stderr, use `ssh_exec`.

## Evidence From `cc_worker`

- `kubectl get pods -n aks-rp` reached devbox but used a stale kubeconfig
  server name and failed DNS lookup:
  `aks-e2e-te-rg-aksflexnode-e-26fe00-4sbho5lq.hcp.westus2.staging.azmk8s.io`.
- `test/e2ev3/hack/e2ev3 dev --build-version hayuaebld163822451` built the
  dev binary successfully: 2,019 actions in about 43s.
- The config blob exists and loaded:
  `https://akse2eci.blob.core.windows.net/config/hayuaebld163822451`.
- `akse2e.NewTestContext` succeeded.
- A run without `-s` failed only at scenario selection:
  `SelectScenario: specify --scenario or -s`.
- `--list-scenarios` is not a real flag; scenario names were discovered from
  `test/e2ev3/cmd/dev/main.go`.

## Scenario Discovery

Candidate dev-suite scenarios include:

- `Scenario_Traffic_AppRouting_DefaultDomain_HelloWorld`
- `Scenario_Traffic_AppRouting_Nginx_Disablement`
- `Scenario_Traffic_ApiProxy_Cert_Rotation`
- `Scenario_Traffic_ApiProxy_Cert_Rotation_Mock`
- `Scenario_If_Match`
- `Scenario_RBAC_Disabled`
- `Scenario_ComponentVersion`
- `Scenario_AP_Cross_Version`
- `Scenario_CNI_Overlay`

`Scenario_ComponentVersion` was not a good first run because it matched multiple
registered scenarios across Kubernetes versions. `Scenario_If_Match` appeared
unique and was the next attempted scenario in session `s_1778575778461_3`.

## Next Command

Continue by capturing the result with exact execution:

```json
{
  "host": "devbox",
  "command": "cd /home/hayua/rp && test/e2ev3/hack/e2ev3 dev --build-version hayuaebld163822451 -s Scenario_If_Match --debug --timeout 10m 2>&1 | tail -150",
  "timeout": 900
}
```

## Result

- [ ] PASS — scenario completed successfully
- [ ] FAIL — scenario failed with actionable test output
- [x] PARTIAL — access, build, and config loading verified; final scenario
      result still needs to be captured
