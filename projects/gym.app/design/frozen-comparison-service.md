# Frozen comparison service

Gym accepts ordinary `goal` Tasks. A comparison goal places these values in `data.context.comparison`: request id (added at admission), `agent` (`may` or `scout`), frozen baseline run id, candidate name and fingerprint, benchmark, scorer revision, model, scenario ids, trials, per-trial timeout and total allowance.

The focused `compare-candidate` workflow invokes the standalone Gym `verify` primitive and retains argv, cwd, timestamps, exit status, stdout/stderr, manifest/comparison paths and all requested identities. It holds rather than supports a candidate on command failure, timeout, missing artifacts, baseline/candidate/agent/benchmark/model drift, invalid trials, unapproved truth, regression or no demonstrated improvement. The scenario set must include at least incident, paraphrase, opposite-control and unrelated-transfer cases. Transfer answers remain outside candidate preparation.

The output is a content-addressed comparison receipt. It is evidence only: no approval, merge, apply, deploy, benchmark-truth mutation or model training occurs here.

Legacy autonomous campaign sources are archived outside active agent discovery. The App has no schedules, approval-event subscription, metric trigger or improve action. On first activation, an operator must use public Task reads to inventory unfinished Gym Tasks, wait/cancel with explicit authority as appropriate, and verify no old workflow session remains active before reloading. Retained old Tasks whose `improve-agent` binding is absent must remain visible in attention; never restore the workflow merely to drain them. This source change does not mutate retained state.
