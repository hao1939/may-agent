<ai_context>
summary: "Lockwalk combines a declared tool inventory, expected authorization cases, positive controls, policy-engine queries, subprocess effect counters, and observed traces. The pattern catches gaps that policy-unit tests alone cannot, but its producer-authored harness covers only configured Python routes and patched effects, so a pass is not proof of production-wide mediation or security."
triggers: ["lockwalk", "authorization test coverage", "tool permission coverage", "FAIL_EXECUTION", "door test", "effect counter", "positive authorization control"]
last_updated: "2026-11-10"
source_basis: "Static inspection of AluminumShark/lockwalk at commit 9d5bee2557911a47258ae18bb07b169a681a9693, including the complete README, repository tree, security and test guides, harness runner, network guard, verdict logic, observe checks, CI workflow, and project metadata. Scout did not install or run the package or independently reproduce its tests."
</ai_context>

# Authorization tests need both an inventory denominator and effect controls

**Date:** 2026-11-10  
**Disposition:** new knowledge  
**Question:** What evidence is missing when an agent policy engine's own authorization tests pass?  
**Repo:** https://github.com/AluminumShark/lockwalk  
**Reviewed version:** commit [`9d5bee2557911a47258ae18bb07b169a681a9693`](https://github.com/AluminumShark/lockwalk/commit/9d5bee2557911a47258ae18bb07b169a681a9693)  
**Coverage:** live repository-search metadata; repository metadata and recursive tree; complete README; security and test guides; harness runner, network guard, verdict logic, and observe checks; CI workflow; and package metadata. Static inspection only.

## Source observation

Lockwalk separates authorization assurance into evidence layers that ordinary policy-unit tests commonly collapse.

1. **Inventory coverage.** It starts from a configured list of agents and tools, then reports tools with no expected case and high-risk tools with no deny case. This makes the denominator the declared capability surface rather than only the policy rules somebody remembered to test.
2. **Expected decision coverage.** A security specification states the actor, role, agent route, tool, action, resource fixture, and expected allow or deny result. `lockwalk test` asks the configured IAM or policy decision point and reports disagreement as `FAIL_POLICY`.
3. **Positive controls.** A deny result is inconclusive unless a matching action and resource type is allowed somewhere. This prevents a broken adapter or deny-everything policy from receiving false credit for every negative case.
4. **Effect-path probes.** An optional door harness imports the application in a fresh subprocess, replaces configured side-effect functions with counters, records the application's authorization call, and invokes the tool. A policy deny followed by a counted effect becomes `FAIL_EXECUTION`; an allow whose effect never runs also fails or remains inconclusive rather than being silently counted as success.
5. **Observed-route comparison.** A separate `observe` path compares traces with the declared agent/tool map and can flag off-map routes, unknown components, identity mismatches, and calls that appear to have skipped the authorization door.

The verdict logic contains a useful anti-vacuity control for effect replacement itself. A clean deny with zero counted effects does not establish anything until some allowed case proves that the configured counter can observe that tool's effect. If a patch target is wrong, the real function could run while its counter stays at zero; requiring an allowed control makes that misconfiguration visible instead of turning it into a false pass.

The implementation also treats partial harness evidence as unsafe. Each job runs in a fresh subprocess with import and execution timeouts; incomplete door evidence fails closed. A Python-level network guard blocks ordinary socket routes during door tests, while the documentation explicitly says this guard is a mistake-catching safety net rather than a sandbox.

## Reusable interpretation

An authorization test suite should preserve at least four distinct denominators:

- **declared capabilities:** which tools and agent routes are believed to exist;
- **specified expectations:** which allow and deny decisions have authored cases;
- **policy execution:** which cases actually reached the real decision engine and matched expectations;
- **effect execution:** which tested routes demonstrably withheld or performed a substituted effect after the decision.

A green policy-engine suite covers only the third denominator, and sometimes only a hand-selected subset of it. It cannot reveal an undeclared tool, a missing deny case, an application route that bypasses the policy check, or a test adapter that returns deny for every malformed question. Inventory-derived gaps, matched positive controls, and effect counters address those failure classes separately.

The deeper design rule is: **test a deny at the effect boundary, and prove that the probe could have observed an allowed effect**. Without the second clause, “zero effects after deny” is vacuous. Without the first, the policy engine can be correct while the application ignores it.

This pattern is relevant to agent runtimes because tool authorization is a composition claim, not just a policy claim. A defensible result should bind the tested principal, route, policy question, verdict, authorization-door observation, and effect marker under one case identity. Static inventory coverage and production trace comparison then provide two different gap signals: what was never specified, and what happened outside the specified map.

## Evidence boundary

Lockwalk's harness is still bounded test evidence, not proof of complete production mediation. The side effects and authorization door are supplied by the adopter, and the harness dynamically patches supported Python routes in a test subprocess. Its documentation says a missed patch can let the real function run; C extensions, other processes, `uvloop`, unconnected sockets, and newer framework paths may fall outside the Python network guard or fake-model patches. The inventory is only as complete as configured sources, and runtime-selected tools may remain invisible until a trace exposes them.

The project is also explicit that it is not an IAM system, policy engine, gateway, sandbox, or security score. It trusts declared risk, roles, delegation modes, fixtures, and source configuration. Passing therefore means that the configured scope produced the expected evidence under the harness; it does not establish prompt-injection resistance, allowed-tool data safety, authenticated identity, complete effect mediation, or production deployment security.

That limitation does not erase the useful contribution. The reusable advance is an assurance structure that refuses three common false passes: testing only rules that already exist, crediting deny-everything behavior, and treating an unobserved side effect as proof that no effect occurred.

This complements [Agent Security: Enforcement Evidence and Runtime Coverage](../agent-security-enforcement-evidence.md), which distinguishes correct verdicts from effect-owning mediation and complete route coverage. Lockwalk contributes a concrete test design for connecting those layers without claiming that the test harness itself owns every production effect.

## Limits

- Scout inspected repository-authored source and documentation but did not install Lockwalk, execute its tests, run a sample policy engine, invoke the harness, inspect generated reports, or replay traces.
- The repository was created on the observation date and identifies release `0.1.0` as alpha; report and configuration formats may change, and there is no adoption or production-effectiveness evidence in this review.
- The large checked-in test suite and CI workflow show producer-authored coverage intent, not independent correctness or security validation. Scout did not inspect every test or GitHub Actions job result.
- The configured inventory can omit dynamic, hidden, or unsupported tools. Observed traces can expose some omissions but are themselves limited to captured and correctly interpreted activity.
- Function replacement proves only the selected substitute target and route. It does not establish that every equivalent effect, subprocess, extension, external service, or production deployment path is mediated.
- The Python network guard is explicitly not a sandbox and does not cover every network mechanism or descendant process.
- Search API response `incomplete_results: false` applies only to the bounded query response; it does not make this repository representative of GitHub or all agent-authorization tools.

## Sources

- **Repo:** https://github.com/AluminumShark/lockwalk
- **Inspected revision:** https://github.com/AluminumShark/lockwalk/commit/9d5bee2557911a47258ae18bb07b169a681a9693
- **README:** https://github.com/AluminumShark/lockwalk/blob/9d5bee2557911a47258ae18bb07b169a681a9693/README.md
- **Security and trust boundary:** https://github.com/AluminumShark/lockwalk/blob/9d5bee2557911a47258ae18bb07b169a681a9693/docs/lockwalk-security.md
- **Policy and door-test guide:** https://github.com/AluminumShark/lockwalk/blob/9d5bee2557911a47258ae18bb07b169a681a9693/docs/lockwalk-test.md
- **Harness verdict logic:** https://github.com/AluminumShark/lockwalk/blob/9d5bee2557911a47258ae18bb07b169a681a9693/src/lockwalk/harness/verdicts.py
- **Harness subprocess runner:** https://github.com/AluminumShark/lockwalk/blob/9d5bee2557911a47258ae18bb07b169a681a9693/src/lockwalk/harness/runner.py
- **Python network guard:** https://github.com/AluminumShark/lockwalk/blob/9d5bee2557911a47258ae18bb07b169a681a9693/src/lockwalk/harness/guard.py
- **Observed-route checks:** https://github.com/AluminumShark/lockwalk/blob/9d5bee2557911a47258ae18bb07b169a681a9693/src/lockwalk/observe/checks.py
- **CI workflow:** https://github.com/AluminumShark/lockwalk/blob/9d5bee2557911a47258ae18bb07b169a681a9693/.github/workflows/ci.yml
