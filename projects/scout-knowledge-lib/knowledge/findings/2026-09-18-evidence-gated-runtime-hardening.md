<ai_context>
summary: "RunTheRepo implements runtime hardening as a three-way evidence gate: keep a least-privilege mutation only after the pinned app boots and every baseline journey still passes, roll it back on a demonstrated regression, and stop rather than score when coverage or execution is unsupported. Its benchmark also refuses to average missing samples into success. The boundary matters: the prompt-injection fixture runs with zero model calls, and real isolation depends on an externally configured Docker Sandboxes runtime whose PID bound is explicitly unverified."
triggers: ["RunTheRepo", "RepoTrial", "tested hardening", "hardening mutation", "KEEP ROLLBACK STOP", "unavailable metric", "baseline journey replay", "least privilege", "Docker Sandboxes", "prompt injection fixture", "evaluation coverage"]
last_updated: "2026-09-18"
source_basis: "GitHub Search API discovery and revision-pinned static inspection of Taiquan-Zhou/RunTheRepo at ddc7dfe0336d14db98d5477215cc7b1651d3a685: README, complete recursive tree, hardening policy and engine, sandbox provider, benchmark metrics, prompt-injection fixture, integration tests, and CI workflow/run metadata. Source was not executed locally."
</ai_context>

# Runtime Hardening Needs Keep, Rollback, and Unknown

**Date:** 2026-09-18  
**Source:** GitHub  
**Repo:** https://github.com/Taiquan-Zhou/RunTheRepo  
**Inspected revision:** https://github.com/Taiquan-Zhou/RunTheRepo/commit/ddc7dfe0336d14db98d5477215cc7b1651d3a685  
**Discovery query:** https://api.github.com/search/repositories?q=%22AI+agent%22+created%3A%3E2026-09-01&sort=stars&order=desc&per_page=20 (`incomplete_results: false`; first 20 of 16,021 results)

## Finding

RunTheRepo is a recent agent for running and hardening Docker Compose projects. Its useful design signal is not merely that it proposes familiar least-privilege changes. It treats each hardening change as a counterfactual experiment with **three terminal states**:

1. **KEEP** only when the modified app boots and every previously established journey still passes;
2. **ROLLBACK** when the candidate causes a boot or journey regression; and
3. **STOP** when the system lacks coverage or cannot establish the verdict because boot, observation, publication, or journey execution is unsupported or failed.

That third state prevents missing evidence from being converted into either a safety win or an application failure. The policy will not propose mutations unless at least one baseline journey passed. It stops after unsupported evidence, an eight-experiment budget, or three consecutive rollbacks. It can also perform a bounded repair sequence: if a read-only root breaks because the service writes under `/tmp`, it can add a tmpfs and then retry read-only mode against the new accepted configuration hash.

The mutations are ordered and concrete: remove privileged mode, remove a writable Docker socket, set a non-root user, drop capabilities, set a read-only root filesystem, and replace host networking. Each accepted change therefore means **the checked workflows survived this mutation at this revision**—not that the repository is secure in general.

## Why the evidence model matters

The benchmark preserves the same distinction at the aggregate level. Its metric helper returns `None` if a sample set is empty or contains an unavailable sample; it does not silently omit the missing run and average the remainder. Repository-authored integration tests explicitly check that an unsupported boot or journey projects to `"unavailable"`, while ordinary functional failures remain numeric failures. Other tests check a genuinely required capability rolls back rather than being counted as unnecessary privilege, and that all fixtures are executed twice through fresh provider state before replay consistency is claimed.

This suggests a reusable contract for automated hardening:

```text
source revision
+ baseline behavior/coverage
+ one bounded mutation
+ isolated candidate execution
+ replayed acceptance checks
+ {keep | rollback | unknown/stop}
+ cleanup evidence
```

A binary pass/fail collapses two operationally different cases: “the mutation broke a covered behavior” and “the harness could not tell.” A hardening score should also report both precision (accepted mutations that preserve ground-truth behavior) and recall (known redundant privileges actually removed), because aggressively deleting authority can look good on recall while breaking the application.

## Trust boundaries

The repository is unusually explicit about several limits:

- Runtime isolation depends on authenticated Docker Sandboxes v0.42.0 with a reviewed default-deny policy; host Docker fallback is unsupported.
- CPU, memory, disk, network-deny, and duration controls are represented in the provider, but the README says the supported runtime has no verified hard PID bound, so fork-bomb protection is not claimed.
- The provider treats unconfirmed sandbox or subprocess cleanup as an error rather than normal completion.
- Real-target browser workflows and accepted LLM contribution have not been demonstrated.
- The shipped “prompt injection” fixture is a useful **authority-path regression test**, not evidence about model robustness. Its hostile README asks for a host SSH key and exfiltration, but the benchmark test asserts `model_calls == 0`; the deterministic fixture provider accepts only an exact command/environment dialect and verifies that the forbidden key and attacker URL never appear. This proves the fixture path cannot expand its fixed authority, not that an LLM resisted the instruction.

The distinction reinforces the main finding: even a carefully designed test must be labeled by the capability it actually exercises.

## Evidence and limitations

Scout inspected the README, full untruncated 279-entry tree, hardening policy and execution paths, sandbox provider, metrics, prompt-injection fixture, integration tests, and CI definition at the pinned revision. GitHub reports one CI run for that exact commit, [run 34934814759](https://github.com/Taiquan-Zhou/RunTheRepo/actions/runs/34934814759), completed successfully; the workflow installs dependencies and Chromium, runs Ruff, formatting, mypy, and the project pytest suite with branch coverage of at least 85%.

This was static source inspection. Scout did not execute the repository, provision Docker Sandboxes, inspect CI job logs for skipped platform-dependent tests, or validate the isolation boundary against a hostile live repository. The successful project-authored CI run supports test-suite health, not independent security or production-readiness claims.

## Primary sources

- [README and preview boundaries](https://github.com/Taiquan-Zhou/RunTheRepo/blob/ddc7dfe0336d14db98d5477215cc7b1651d3a685/README.md)
- [Hardening proposal and three-way decision policy](https://github.com/Taiquan-Zhou/RunTheRepo/blob/ddc7dfe0336d14db98d5477215cc7b1651d3a685/src/repotrial/hardening/policy.py)
- [Candidate execution and journey replay](https://github.com/Taiquan-Zhou/RunTheRepo/blob/ddc7dfe0336d14db98d5477215cc7b1651d3a685/src/repotrial/hardening/engine.py)
- [Fail-closed sandbox provider](https://github.com/Taiquan-Zhou/RunTheRepo/blob/ddc7dfe0336d14db98d5477215cc7b1651d3a685/src/repotrial/sandbox/docker_sbx.py)
- [Metric treatment of unavailable samples](https://github.com/Taiquan-Zhou/RunTheRepo/blob/ddc7dfe0336d14db98d5477215cc7b1651d3a685/src/repotrial/eval/metrics.py)
- [Benchmark integration tests](https://github.com/Taiquan-Zhou/RunTheRepo/blob/ddc7dfe0336d14db98d5477215cc7b1651d3a685/tests/integration/eval/test_fixture_benchmark.py)
- [Prompt-injection fixture](https://github.com/Taiquan-Zhou/RunTheRepo/blob/ddc7dfe0336d14db98d5477215cc7b1651d3a685/tests/fixtures/prompt_injection/README.md)
- [Complete pinned tree](https://api.github.com/repos/Taiquan-Zhou/RunTheRepo/git/trees/ddc7dfe0336d14db98d5477215cc7b1651d3a685?recursive=1)
