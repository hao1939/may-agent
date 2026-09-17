<ai_context>
summary: "ClawMetry shows that cross-runtime agent observability can be normalized from existing session stores without instrumenting each agent, but control remains capability-dependent: pre-execution blocking needs runtime hooks, process control needs a local process, and the enforcement proxy must be explicitly wired. The pinned repository contains a unified local-store architecture, per-runtime compatibility declarations, real-capture fixtures, and extensive tests, but most adapters are closed-source/paid and Scout did not run them."
triggers: ["ClawMetry", "cross-runtime observability", "agent telemetry", "runtime adapters", "agent governance", "pre-tool hooks", "session replay", "observability control gap"]
last_updated: "2026-09-12"
source_basis: "GitHub repository vivekchand/clawmetry pinned at 707de31fc9b926c50ee2766670edad559f43b8df; repository Search API query recorded incomplete_results=false."
</ai_context>

# Agent observability can converge before agent control does

**Date:** 2026-09-12  
**Status:** Source-grounded GitHub finding

## Core signal

GitHub discovery surfaced `vivekchand/clawmetry`, a local-first observability
and governance project that declares support for 31 agent runtimes at the
pinned revision. Its architecture illustrates a useful asymmetry:
**heterogeneous runtime histories can be translated into one observational
schema, while intervention cannot be made equally portable.**

The read path uses dedicated adapters for native JSONL, SQLite, Markdown,
Postgres, and protocol-backed session stores. Those adapters normalize sessions
and events into one local DuckDB store, after which a shared dashboard can show
timelines, tool calls, model/token/cost fields when present, and trajectory
signals. The compatibility document explicitly leaves unavailable fields
unknown rather than deriving them: for example, some cloud or local stores do
not expose model, token, cost, liveness, or timestamps.

Control has narrower prerequisites. At the pinned revision:

- pre-execution approval requires a runtime to expose a suitable tool hook;
- pause, stop, and kill require an attributable local process;
- budget blocking, loop enforcement, and model routing require the runtime's
  base URL to be pointed at a local enforcement proxy;
- autonomous policy action is opt-in and guarded by multiple locks, while
  observation is described as read-only and on by default.

This is not just repository metadata. The complete pinned tree
(`truncated=false`, 2,523 entries) contains the local-store and adapter-oriented
architecture, compatibility and overhead documents, real-capture fixture
directories for multiple runtimes, query-contract fixtures, and tests for
adapter detection, runtime attribution, hooks, approvals, process control,
policies, OTLP, and replay. That establishes implementation and verification
artifacts exist; Scout did not execute them and does not claim that the tests
pass or the system works as advertised.

## Why this matters

A unified event model is a plausible interoperability layer for **seeing** many
agents, but not a universal capability layer for **governing** them. A dashboard
can normalize whatever evidence each runtime leaves behind. It cannot recover a
pre-tool decision point from a post-hoc transcript, produce per-session process
control for a cloud-hosted loop, or infer billing fields that never reach the
client.

This suggests that cross-agent control surfaces should publish a capability
matrix rather than a single “supported” flag. At minimum, observation coverage,
field provenance, freshness, pre-execution gating, process attribution, and
reversibility should be separate dimensions. Policies should fail closed—or
remain explicitly advisory—when their required intervention capability is
absent. Otherwise a common UI can create false equivalence between a runtime
that is fully observable and controllable and one that exposes only a delayed
activity trace.

The repository also exposes an open-core reproducibility boundary. Its generated
runtime list labels 3 adapters free and 28 paid, and the architecture says paid
adapters arrive through a closed-source companion. The public compatibility
claims and fixtures are useful evidence of design intent and test inputs, but
they do not make all advertised adapter implementations independently
inspectable from this repository.

## Evidence limits

- The project documents adapter status as beta and declares real-install
  captures with fixture-backed CI; Scout did not independently inspect every
  fixture provenance file, install the runtimes, or run the test suite.
- Published overhead figures are project measurements. The document identifies
  an Apple M2 Pro setup and CI variation, and explicitly lists unmeasured paths;
  this finding does not generalize those numbers to other deployments.
- The declared 31-runtime support count mixes 3 public/free and 28 paid adapter
  paths. Presence in the generated catalog is not proof that every adapter is
  equally complete, reliable, or available in the public code.
- GitHub stars and recent activity were discovery signals only, not evidence of
  adoption, effectiveness, or security.
- The repository was inspected at one revision; later default-branch behavior
  may differ.

## Sources

- Repo: https://github.com/vivekchand/clawmetry
- Pinned revision: https://github.com/vivekchand/clawmetry/commit/707de31fc9b926c50ee2766670edad559f43b8df
- README at pinned revision: https://github.com/vivekchand/clawmetry/blob/707de31fc9b926c50ee2766670edad559f43b8df/README.md
- Architecture at pinned revision: https://github.com/vivekchand/clawmetry/blob/707de31fc9b926c50ee2766670edad559f43b8df/ARCHITECTURE.md
- Runtime compatibility at pinned revision: https://github.com/vivekchand/clawmetry/blob/707de31fc9b926c50ee2766670edad559f43b8df/docs/compatibility.md
- Approval/control boundaries at pinned revision: https://github.com/vivekchand/clawmetry/blob/707de31fc9b926c50ee2766670edad559f43b8df/docs/APPROVALS.md
- Generated supported-runtime catalog: https://github.com/vivekchand/clawmetry/blob/707de31fc9b926c50ee2766670edad559f43b8df/SUPPORTED_RUNTIMES.txt
- Overhead methodology and limits: https://github.com/vivekchand/clawmetry/blob/707de31fc9b926c50ee2766670edad559f43b8df/docs/OVERHEAD.md
- Complete pinned tree: https://api.github.com/repos/vivekchand/clawmetry/git/trees/707de31fc9b926c50ee2766670edad559f43b8df?recursive=1
