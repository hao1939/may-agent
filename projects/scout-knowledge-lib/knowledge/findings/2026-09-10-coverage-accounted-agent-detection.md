<ai_context>
summary: "A pinned GitHub inspection of Uber's ADR repository exposes a useful defensive pipeline: enumerate agent surfaces with explicit partial-coverage status, normalize heterogeneous local agent histories, then use cheap high-recall triage before deeper reasoning. The implementation is evidence that these control stages exist in the repository, not independent proof of production efficacy."
triggers: ["ADR", "agent detection and response", "agent security observability", "coverage-accounted discovery", "partial scan", "agent telemetry normalization", "two-tier detection", "Uber ADR"]
last_updated: "2026-09-10"
source_basis: "Read-only GitHub Search API discovery and pinned inspection of uber/ADR at commit e0a3874a155044ed7f46884d8f748099cb44a111."
</ai_context>

# Coverage-Accounted Discovery Is the First Stage of Agent Detection

**Date:** 2026-09-10  
**Repo:** [uber/ADR](https://github.com/uber/ADR)  
**Inspected revision:** [`e0a3874a155044ed7f46884d8f748099cb44a111`](https://github.com/uber/ADR/tree/e0a3874a155044ed7f46884d8f748099cb44a111)

## Observation

A topic-led GitHub repository search surfaced ADR (Agentic AI Detection and
Response). At the pinned revision, its open-source tree contains three connected
control stages rather than a detector in isolation:

1. **Discovery** inventories desktop applications, agents, MCP servers, skills,
   and plugins. Crucially, its CLI reserves exit code `2` for a scan that produced
   a snapshot but encountered unavailable, unreadable, or truncated surfaces.
   That preserves the difference between *nothing found* and *not fully observed*.
2. **Sensor** parses local histories from several heterogeneous harnesses—including
   Claude Code, Cursor, Cline, Claude Desktop, Codex CLI, Warp, and opencode—into
   a shared event representation containing messages, tool use, session context,
   and source identity.
3. **Detection** configures a high-recall triage model before a deeper reasoning
   agent, with threat-intelligence, source-code, and policy context providers that
   can be ablated independently.

The resulting pattern is:

> **coverage-accounted inventory → normalized evidence → cheap recall gate →
> context-enriched adjudication**

This extends static exposure inventory into an operational detection chain. The
important invariant is not merely that discovery runs first; its uncertainty must
survive downstream. A detector cannot responsibly interpret an empty event stream
as benign when discovery reported unreadable or truncated surfaces.

## Why this matters

Agent-security designs often start at policy or classification, but both operate
on an evidence boundary. ADR's repository makes two easy-to-miss requirements
concrete:

- **Coverage is data.** Partial visibility needs a machine-readable state and
  cannot be collapsed into a successful clean scan.
- **Cross-harness normalization precedes behavioral rules.** Tool names, session
  storage, and context differ across agent products; detection policy needs a
  stable event schema while retaining source-specific provenance.

The two-stage detector also gives an economic shape to defense-in-depth: broad,
high-recall triage limits which sessions pay for long-horizon reasoning. That is
an implementation pattern, not evidence that the chosen models or thresholds
achieve the claimed security outcome in another environment.

## Evidence boundary

This run inspected repository metadata and source documentation at one pinned
commit; it did **not** execute ADR-Bench or reproduce paper metrics. The root
README says ADR is deployed at Uber, but the open-source Detection README
separately warns that its benchmark is a research artifact with synthetic
fixtures and dependencies unsuitable for production. Therefore:

- the checked tree supports claims about the presence and shape of the open-source
  discovery, telemetry, benchmark, and detection components;
- the production-deployment statement remains the maintainers' self-report; and
- repository metadata or included benchmark fixtures do not independently prove
  production effectiveness.

## Primary evidence

- [Root README at pinned revision](https://github.com/uber/ADR/blob/e0a3874a155044ed7f46884d8f748099cb44a111/README.md)
- [Discovery README: coverage gaps and exit codes](https://github.com/uber/ADR/blob/e0a3874a155044ed7f46884d8f748099cb44a111/Discovery/README.md)
- [Sensor README: supported sources and normalized schema](https://github.com/uber/ADR/blob/e0a3874a155044ed7f46884d8f748099cb44a111/Sensor/README.md)
- [Detection README: benchmark scope and non-production warning](https://github.com/uber/ADR/blob/e0a3874a155044ed7f46884d8f748099cb44a111/Detection/README.md)
- [Detector configuration: triage and reasoning stages](https://github.com/uber/ADR/blob/e0a3874a155044ed7f46884d8f748099cb44a111/Detection/config_detector.yaml)

## Related Scout knowledge

- [Agent Security: Defense Architectures](../agent-security-defense-architectures.md#231-deterministic-control-plane--agent-config-supply-chain-governance) — static exposure inventory and baseline drift as prerequisites to governance.
