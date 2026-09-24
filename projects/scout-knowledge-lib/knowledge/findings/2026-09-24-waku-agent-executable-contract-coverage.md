<ai_context>
summary: "Waku Agent's hosted-boundary tests show that a deterministic guard can still be one representation removed from the effect it claims to protect. Its current contracts enumerate package member paths, independently derive both sides of cross-component sets, account for syntax the scanner cannot parse, and state known escapes rather than calling drift tripwires a sandbox."
triggers: ["executable contract", "guard coverage", "closed set", "policy drift", "packaging boundary", "bidirectional set equality", "mutation testing", "Waku Agent"]
last_updated: "2026-09-24"
source_basis: "Static inspection of ShenSeanChen/waku-agent at immutable commit ea82d3d4525ec80a412bfcc4a3c969b648079edc on 2026-09-24; no code was executed and the repository's reported test runs were not reproduced."
</ai_context>

# An executable contract must observe the effect, not a convenient projection

Date: 2026-09-24  
Last_updated: 2026-09-24  
Source: https://github.com/ShenSeanChen/waku-agent  
Repo: https://github.com/ShenSeanChen/waku-agent  
Commit: https://github.com/ShenSeanChen/waku-agent/commit/ea82d3d4525ec80a412bfcc4a3c969b648079edc  
Tags: agent-harness, executable-contract, guard-coverage, policy-drift, packaging, mutation-testing

## Observation

Waku Agent is a local-first Python agent harness. Its current repository also contains an unfinished `hosted/` deployment layer that is intentionally absent from both the wheel and source distribution. The useful signal is not that the project has many tests, but that its checked-in tests and commit history document several ways a green deterministic guard remained **one representation removed** from the property it named.

The packaging boundary went through three shapes:

1. checking that an exclusion string existed in `pyproject.toml` did not prove which files the build included;
2. building archives and comparing only their top-level names still missed `hosted/` force-included under another path such as `waku/hosted`; and
3. the current test asks Hatchling for the distribution paths its builder would emit, then rejects `hosted` or `lab` as a path component wherever it appears.

This is stronger because it checks the build system's output namespace rather than configuration text or a lossy projection of archive members. It is still static build enumeration, not evidence from installing and running a published artifact.

The cross-component contracts use a related pattern. `test_route_contract.py` independently loads the dashboard's pinned live routes and requires their set to equal the hosted policy table plus two named prefixes. It separately pins every route's verdict and verifies longest-prefix resolution, so key presence alone cannot hide a pass/block flip or shadowed entry. `test_paused_contract.py` compares error codes derived from gateway bodies with string comparisons found in dashboard JavaScript in both directions.

The latter test also records why a nominally closed set may not be closed enough. A hand-written body list missed a newly added body. A `*_BODY` naming convention then missed ordinary alternatives such as `MAINTENANCE = {...}` and a nested `ERROR_BODIES` map. The current scanner therefore selects dictionaries structurally by a `code` field, recurses one level, and retains the name check only to detect body-shaped names with no code. On the JavaScript side it counts every `.code` token and fails when its comparison parser cannot account for one, rather than silently treating an unrecognized access shape as absent.

A separate import-boundary test makes its assurance boundary explicit. The hosted tree gets a default-deny import-root allowlist, bans common dynamic code-loading names, and is imported in a fresh interpreter to detect `waku` entering that process's module table. The file also names two known escapes: delayed dynamic import inside a function and loading `waku` in a child process. It calls the mechanism a tripwire against accidental drift, not a sandbox against a contributor deliberately routing around it.

Primary implementation inspected:

- Packaging and import boundary: https://github.com/ShenSeanChen/waku-agent/blob/ea82d3d4525ec80a412bfcc4a3c969b648079edc/evals/deterministic/test_hosted_boundary.py
- Route contract: https://github.com/ShenSeanChen/waku-agent/blob/ea82d3d4525ec80a412bfcc4a3c969b648079edc/evals/deterministic/hosted/test_route_contract.py
- Error-body/page contract: https://github.com/ShenSeanChen/waku-agent/blob/ea82d3d4525ec80a412bfcc4a3c969b648079edc/evals/deterministic/hosted/test_paused_contract.py
- Hosted policy source: https://github.com/ShenSeanChen/waku-agent/blob/ea82d3d4525ec80a412bfcc4a3c969b648079edc/hosted/core/policy.py
- Hosted scope and maturity statement: https://github.com/ShenSeanChen/waku-agent/blob/ea82d3d4525ec80a412bfcc4a3c969b648079edc/hosted/README.md

## Reusable pattern

An executable contract should be reviewed along four axes:

1. **Effect adjacency:** observe the artifact or runtime representation that carries the effect. Build members are stronger evidence than exclude text; full paths are stronger than top-level projections.
2. **Independent derivation:** derive producer and consumer sets from their respective sources, then compare both differences. Repeating one shared constant on both sides only lets the claim move with the bug.
3. **Selector closure:** ask what ordinary new syntax, nesting, name, or alternate path falls outside the scanner. Make unparsed occurrences fail visibly instead of disappearing from the measured set.
4. **Declared assurance boundary:** distinguish drift detection from adversarial mediation. Name known escapes and the processes, file types, lifecycle phases, or effect paths the guard cannot observe.

Mutation probes are especially valuable here: change the configuration while preserving the effect, move the effect under a different path or name, add an unrecognized producer shape, flip a verdict, or satisfy a set from the wrong file. A guard is credible when those changes fail for the property it claims—not merely because some nearby test also happens to break.

This extends the library's [compilation gradient](../governance-compilation-gradient.md): moving a rule from prose into code is necessary but not sufficient. The compiled rule must be bound to the effect representation and its coverage must itself be tested. It also complements the [retrieval-verdict contract drift finding](./2026-08-25-retrieval-verdict-contract-drift.md), where a retained verifier did not protect the installed entry point.

## Boundary

This is static repository analysis at one pinned commit. Scout did not install Waku Agent, build distributions, run the claimed mutation plants, or reproduce the commit message's reported `956 passed, 60 skipped`. The hosted README says the deployment is not yet runnable because later image and deployment work is unfinished. The evidence therefore supports an implementation pattern and unusually explicit self-documented failure history, not a claim that the hosted service is production-ready, secure against adversarial code, or operationally reliable.
