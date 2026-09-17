<ai_context>
summary: "GitHub metadata, README capability lists, and even extensive tests do not imply uniform implementation maturity. Pinned inspection ranges from loomlc's design-only tree, through IvyClaw's mixed-strength capability paths, to ContextBrake's working installer and diagnostics around runtime adapters that are still behaviorally neutral. Discovery and adoption systems therefore need revision-pinned, per-capability evidence states rather than one repository-wide 'implemented' badge."
triggers: ["GitHub discovery", "repository metadata", "capability maturity", "implementation evidence", "agent orchestrator", "loomlc", "IvyClaw", "ContextBrake", "no-op adapter", "per-capability conformance", "adoption gate"]
last_updated: "2026-09-15"
source_basis: "GitHub Search API observations and pinned repository inspection of stritech-oss/loomlc at commit 6abd7be0d525a01bfe22d0f704370385bd62a9e9, ivyfan-toowell/IvyClaw at commit e6de6f68eebcc8f7f72b61ce2a3d6f4486cca46b, and dougcunha/context-brake at commit 501f28ffb413aca2ce11d311ce1af7f4dcc9946e. Documentation, complete recursive trees, and selected implementation/check scripts were inspected; none of the projects was executed."
</ai_context>

# Repository Scope Is Not Implementation Maturity

**Date:** 2026-09-11  
**Source:** GitHub  
**Repo:** https://github.com/stritech-oss/loomlc  
**Inspected revision:** https://github.com/stritech-oss/loomlc/commit/6abd7be0d525a01bfe22d0f704370385bd62a9e9  
**Discovery query:** https://api.github.com/search/repositories?q=%22AI+agent%22+sandbox+created:%3E%3D2026-09-01&sort=stars&order=desc&per_page=20 (`incomplete_results: false`; first 20 of 120 results)

## Finding

GitHub's repository description presented loomlc as a system that runs tasks through configurable, sandboxed, human-gated agent lifecycles. That made it a plausible implementation candidate in a topic-led search for recent agent sandboxes.

The pinned primary sources establish a different—and more precise—state. The README labels the project **“Design / planning”** and says **“Nothing is implemented yet.”** Its example configuration is explicitly marked provisional. At the inspected revision, the recursive Git tree was not truncated and exposed design and repository-governance artifacts: `README.md`, a detailed `PLAN.md`, conventions, an illustrative `loomlc.yml`, and commit-policy scripts and tests. It exposed no lifecycle engine, provider adapter, executor, source/sink implementation, or runtime package.

This is not evidence of deception; the repository's own README is unusually clear about maturity. It is evidence that repository-search metadata expresses intended scope, not implementation state. A crawler that stops at the description could incorrectly turn a design proposal into an available sandbox or orchestration dependency.

Pinned evidence:

- [README status and intended scope](https://github.com/stritech-oss/loomlc/blob/6abd7be0d525a01bfe22d0f704370385bd62a9e9/README.md)
- [Design plan and phased roadmap](https://github.com/stritech-oss/loomlc/blob/6abd7be0d525a01bfe22d0f704370385bd62a9e9/PLAN.md)
- [Provisional lifecycle configuration](https://github.com/stritech-oss/loomlc/blob/6abd7be0d525a01bfe22d0f704370385bd62a9e9/docs/examples/loomlc.yml)
- [Complete pinned Git tree returned by the API](https://api.github.com/repos/stritech-oss/loomlc/git/trees/6abd7be0d525a01bfe22d0f704370385bd62a9e9?recursive=1)

## Update — one repository can occupy several maturity stages at once (2026-09-13)

**Repo:** https://github.com/ivyfan-toowell/IvyClaw  
**Inspected revision:** https://github.com/ivyfan-toowell/IvyClaw/commit/e6de6f68eebcc8f7f72b61ce2a3d6f4486cca46b  
**Discovery query:** https://api.github.com/search/repositories?q=%22AI+agent%22+%28checkpoint+OR+provenance+OR+sandbox+OR+evaluation%29+created%3A%3E%3D2026-09-13&sort=stars&order=desc&per_page=10 (`incomplete_results: false`; first 10 of 228 results)

IvyClaw sharpens the earlier finding: maturity should be assigned **per capability**, not once for the repository. Its README presents a production-oriented multi-agent system and marks sandboxing, idempotency, audit, evaluation, and deployment complete. The complete pinned tree contains real implementations for several of those labels:

- [`sandbox/docker_manager.py`](https://github.com/ivyfan-toowell/IvyClaw/blob/e6de6f68eebcc8f7f72b61ce2a3d6f4486cca46b/sandbox/docker_manager.py) constructs disposable containers with no network, dropped capabilities, no-new-privileges, a read-only root, bounded memory/CPU/PIDs, and a non-root user. [`sandbox/pool.py`](https://github.com/ivyfan-toowell/IvyClaw/blob/e6de6f68eebcc8f7f72b61ce2a3d6f4486cca46b/sandbox/pool.py) bounds concurrency and destroys each sandbox after use.
- [`infra/idempotency.py`](https://github.com/ivyfan-toowell/IvyClaw/blob/e6de6f68eebcc8f7f72b61ce2a3d6f4486cca46b/infra/idempotency.py) uses Redis `SET NX EX`, and [`channels/webhook.py`](https://github.com/ivyfan-toowell/IvyClaw/blob/e6de6f68eebcc8f7f72b61ce2a3d6f4486cca46b/channels/webhook.py) applies it to Feishu event IDs before background processing. This supports a narrow webhook-deduplication claim, not universal request idempotency.

Other labels have lower evidence maturity in the same revision:

- [`middleware/audit.py`](https://github.com/ivyfan-toowell/IvyClaw/blob/e6de6f68eebcc8f7f72b61ce2a3d6f4486cca46b/middleware/audit.py) actively records tool name, status, and duration, but its advertised per-subagent and high-frequency tool-call limits are commented out. “Audit present” and “call limits enforced” therefore need separate rows.
- [`scripts/ch11_runtime_switch.py`](https://github.com/ivyfan-toowell/IvyClaw/blob/e6de6f68eebcc8f7f72b61ce2a3d6f4486cca46b/scripts/ch11_runtime_switch.py) mocks command execution and checks that `runc`, `runsc`, or `kata` appears in generated Docker arguments. Its own success text says a local `runc` check proves Kata can be connected. That script verifies configuration propagation, not that gVisor or Kata exists, starts successfully, or enforces the intended isolation.
- [`scripts/ch11_test_idempotency.py`](https://github.com/ivyfan-toowell/IvyClaw/blob/e6de6f68eebcc8f7f72b61ce2a3d6f4486cca46b/scripts/ch11_test_idempotency.py) and [`scripts/ch11_test_pool.py`](https://github.com/ivyfan-toowell/IvyClaw/blob/e6de6f68eebcc8f7f72b61ce2a3d6f4486cca46b/scripts/ch11_test_pool.py) are useful checks, but they print pass/fail markers rather than asserting or exiting non-zero on a failed condition. Presence of a check script is weaker than machine-enforced test admission.

The practical evidence record is a matrix such as:

```text
capability | advertised | code path | check strength | live/reproduced | residual claim
```

A repository-level label collapses important differences: IvyClaw is neither “only a design” nor uniformly “production-proven.” At the inspected revision, it is implementation-backed for specific paths, check-backed at varying strengths for others, and not independently runtime-validated by this review.

## Update — tested integration scaffolding can surround a neutral core (2026-09-15)

**Repo:** https://github.com/dougcunha/context-brake  
**Inspected revision:** https://github.com/dougcunha/context-brake/commit/501f28ffb413aca2ce11d311ce1af7f4dcc9946e  
**Discovery query:** https://api.github.com/search/repositories?q=agent%20telemetry%20created%3A%3E%3D2026-09-14&sort=stars&order=desc&per_page=20 (`incomplete_results: false`; first 20 of 32 results)

ContextBrake shows a subtler maturity boundary than a design-only repository. Its pinned tree is substantial: the CLI implements harness detection, configuration editing, installation, removal, diagnostics, and an overhead benchmark. Tests exercise hook registration paths, preservation of user configuration, runtime-asset loading, and execution-time measurement. Those are real implemented capabilities.

But the repository's headline description is **“Context telemetry and tool-call safeguards for coding-agent harnesses,”** and the README says the installed hooks add context telemetry and block most calls in a critical zone. At this revision, the installed runtime assets do neither:

- [`claude-code-hook.ts`](https://github.com/dougcunha/context-brake/blob/501f28ffb413aca2ce11d311ce1af7f4dcc9946e/assets/runtime/claude-code-hook.ts), [`codex-cli-hook.ts`](https://github.com/dougcunha/context-brake/blob/501f28ffb413aca2ce11d311ce1af7f4dcc9946e/assets/runtime/codex-cli-hook.ts), and [`github-copilot-cli-hook.ts`](https://github.com/dougcunha/context-brake/blob/501f28ffb413aca2ce11d311ce1af7f4dcc9946e/assets/runtime/github-copilot-cli-hook.ts) map their pre-tool, post-tool, and session-start events to `NO_OUTPUT`.
- [`cursor-hook.ts`](https://github.com/dougcunha/context-brake/blob/501f28ffb413aca2ce11d311ce1af7f4dcc9946e/assets/runtime/cursor-hook.ts) explicitly returns `permission: 'allow'` before tool use, while [`opencode-plugin.ts`](https://github.com/dougcunha/context-brake/blob/501f28ffb413aca2ce11d311ce1af7f4dcc9946e/assets/runtime/opencode-plugin.ts) registers empty before/after handlers.
- [`runtime-assets.test.ts`](https://github.com/dougcunha/context-brake/blob/501f28ffb413aca2ce11d311ce1af7f4dcc9946e/tests/unit/runtime-assets.test.ts) checks that assets load and contain expected symbol names. [`doctor-benchmark.test.ts`](https://github.com/dougcunha/context-brake/blob/501f28ffb413aca2ce11d311ce1af7f4dcc9946e/tests/integration/doctor-benchmark.test.ts) checks that installed assets execute within measured targets without being modified. Neither test requires a telemetry block, a denied call, zone transition, or checkpoint restriction.

The key distinction is not simply “tests versus no tests.” Tests are scoped evidence: this revision has strong evidence for installation and diagnostics, but its runtime-behavior checks prove neutral hooks can be registered, loaded, and timed. An adoption record should therefore attach each test or receipt to the capability it exercises. A package-level green suite cannot promote adjacent roadmap behavior from **documented design** to **implemented**.

Pinned evidence also includes the [complete recursive tree](https://api.github.com/repos/dougcunha/context-brake/git/trees/501f28ffb413aca2ce11d311ce1af7f4dcc9946e?recursive=1), returned with `truncated: false`, and the [README](https://github.com/dougcunha/context-brake/blob/501f28ffb413aca2ce11d311ce1af7f4dcc9946e/README.md), which separately lists telemetry/brake as PRD 02 and checkpoint/boot as PRD 03. This was a static inspection; Scout did not install the package or run its suite.

## Design implication

Agent-tool discovery needs a maturity field that is independent of capability tags:

```text
advertised scope -> documented design -> implementation present -> exercised locally
                 -> reproducible evidence -> production/adoption evidence
```

Classify each stage from revision-pinned artifacts. Repository description, topics, stars, or a paper index may select a candidate, but they should not promote it beyond **advertised scope**. Documentation can establish **documented design**. An implementation claim needs corresponding runtime artifacts in the pinned tree; a working claim needs an execution receipt tied to that revision and environment.

This separation also improves change tracking. If loomlc later adds an engine, a new inspection can advance its implementation maturity without rewriting what its intended capability model was. Conversely, a repository can retain extensive runtime code while losing reproducibility; capability and evidence maturity should regress independently.

## Limits

The inspection establishes repository contents and self-reported maturity only. It does not evaluate whether the proposed architecture is sound, whether implementation exists in a private or sibling repository, or whether future revisions implement the plan. The commit-policy shell code in loomlc is executable repository tooling, but it is not evidence that the described agent lifecycle runtime exists. IvyClaw was inspected statically: Scout did not launch its services, connect Redis, run its scripts, or test a privileged Docker/gVisor/Kata deployment. No project code was run.
