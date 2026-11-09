<ai_context>
summary: "Airlock documents a useful two-level authority model for coding-agent fleets: each run receives a short-lived role grant, while the GitHub App installation must hold the union of every live role's grants. Per-run least privilege therefore needs a separate installation-envelope audit and evidence that the issued credential matched the reviewed policy revision."
triggers: ["Airlock", "coding-agent fleet policy", "per-run grant", "GitHub App installation envelope", "role grant", "shadow rollout", "policy revision receipt"]
last_updated: "2026-11-09"
source_basis: "HN item 50419615 and the complete public Airlock web application bundle index-CspZJyqz.js (SHA-256 c216a8dc20f4f3ecfcb75572681f4098f5d5ef22c59f3d72c904b5936fff1f7f) inspected 2026-11-09. Scout did not inspect backend source, execute the service, install the GitHub App, or validate live credentials and enforcement."
</ai_context>

# Per-run grants still need installation-envelope audits

**Date:** 2026-11-09  
**Disposition:** New implementation-design finding  
**Coverage:** HN item plus complete public client bundle at one asset identity; no backend or live-system validation

## Observation

[HN item 50419615](https://news.ycombinator.com/item?id=50419615) links to
[Airlock](https://airlock.lunareng.com/docs), a hosted policy and evidence layer for coding-agent fleets. The item had one point and no visible discussion when inspected, so HN is a discovery lead rather than evidence of adoption or community validation.

The retrieved public application bundle documents a repository-owned policy model with role files, repository and file-level rules, approval levels, shadow-to-live rollout, and run records. A role's run is supposed to receive only that role's computed grant. The application repeatedly makes a second, easily missed statement: the GitHub App installation must hold **every live role's grant at once**, though each individual run receives only its own grant. Its access view is designed to compare what the installation holds with what live roles currently need and what all shadow roles would need if activated.

This makes least privilege a two-envelope claim:

1. **Run envelope:** the repositories, GitHub permissions, tools, resources, and other authority handed to one role for one run.
2. **Installation envelope:** the union of authority the GitHub App can mint across all live roles and covered repositories.

A narrow run token does not by itself prove a narrow control plane. If the installation is broader than the active role union, a policy error, compromised issuer, mistaken role binding, or future route could potentially mint authority the current run was never intended to receive. Conversely, an installation narrower than the union causes availability failures. Airlock's documented comparison view usefully treats both overbreadth and missing authority as inspectable states rather than collapsing them into a single “permissions” label.

The bundle also documents lifecycle evidence intended to bind issuance to context: role, repository, workflow, branch, policy file at a commit, and refusal reason. It says live credentials expire within an hour or with the run, while shadow roles receive no token and only record what would have been issued. Policy-history and pull-request views separately retain the policy commit, path-derived approval level, approver, merge identity, and exceptions. These are complementary records: an issuance receipt answers what authority a run received; a merge record answers what policy and approval evidence governed an integrated change.

## Reusable implication

Fleet authorization should expose three independently reviewable objects:

- **Role specification:** the reviewed policy revision and the intended authority for one role.
- **Issued run grant:** the exact credential scope, run identity, policy revision, issue/expiry/revocation state, and refusal path for one attempt.
- **Issuer envelope:** the installation or broker authority from which all run grants can be minted, compared against the union of currently live roles and against the larger shadow/future set.

The useful invariant is not merely `run_grant ⊆ role_policy`. It is:

```text
issued run grant ⊆ reviewed role policy
union(live role policies) ⊆ issuer envelope
issuer envelope − union(live role policies) is empty or explicitly justified
```

Changes in any term should produce a fresh comparison receipt. Shadow rollout helps estimate future grant demand without issuing credentials, but activating a role changes the required issuer union and should be treated as an authority-expansion event. Deactivating a role should trigger contraction checks; otherwise short-lived per-run credentials can coexist with a permanently overbroad installation.

This complements [Agent Fleets Need an Authority Matrix, Not One Permissions Dial](./2026-08-26-agent-fleet-authority-dimensions.md) and [Hook policy needs host-coverage receipts](./2026-11-09-hook-policy-needs-host-coverage-receipts.md): per-run scoping, issuer authority, host mediation, and integrated-change evidence are separate claims.

## Evidence boundary

Scout read the complete minified public client bundle served as `index-CspZJyqz.js` and the HN item. The asset name and SHA-256 identify the inspected bytes, but they are not a source-control revision or proof of the deployed backend. Scout did not inspect server source, schemas outside the bundle, infrastructure, GitHub App configuration, credential contents, revocation behavior, organization settings, private policy repositories, audit exports, or operator procedures. Scout did not install Airlock, create a tenant, run an agent, mint or decode a token, exercise a refusal, compare a real installation, validate policy-history completeness, or test whether every claimed check is enforced server-side. Product behavior and security properties are therefore documentation claims, not independently verified results.

## Sources

- **HN:** https://news.ycombinator.com/item?id=50419615
- **Source:** https://airlock.lunareng.com/docs
- **Inspected client asset:** https://airlock.lunareng.com/assets/index-CspZJyqz.js
- **Asset SHA-256:** `c216a8dc20f4f3ecfcb75572681f4098f5d5ef22c59f3d72c904b5936fff1f7f`
