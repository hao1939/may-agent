---
title: "Numbat: Perplexity's Endpoint Visibility Tool for AI Agents"
date: 2026-07-29
last_updated: 2026-07-29
source_platform: github
query: "ai agent created:>2026-07-22 sort:stars"
tags: [agent-observability, endpoint-security, agent-monitoring, forensics, perplexity, open-source]
Repo: https://github.com/perplexityai/numbat
---

# Numbat: Perplexity's Endpoint Visibility Tool for AI Agents

## Summary

Numbat is an open-source (Apache-2.0) Go tool from Perplexity AI that provides
endpoint-level visibility into AI agent activity on developer workstations.
85★ in 5 days (created 2026-07-24). It monitors desktop, CLI, IDE, and gateway
agents through local hooks, plugins, and OTLP/HTTP logs, normalizing activity
into a single event model evaluated by a CEL rule engine.

## Key Capabilities

- **Live monitoring** via hooks, plugins, and OTLP/HTTP log exporters
- **Endpoint-local detection** with built-in CEL rules and custom YAML rules
- **Opt-in blocking** through pre-action hooks (monitor-only by default)
- **Forensic reconstruction** from on-disk session artifacts without prior instrumentation
- **Read-only artifact scanning** with secret redaction
- **Investigation tools**: agent inventory, per-session timelines, portable case bundles with SHA-256 manifests
- **Single-binary distribution** (macOS, Linux, Windows), no cgo

## Why This Matters

This is the first open-source tool from a major AI company treating coding agents
as endpoints that need security monitoring — the same way EDR tools monitor
human-operated endpoints. Key signals:

1. **Vendor acknowledges agent risk**: Perplexity building this implies they see
   unmonitored agent activity as a real operational risk, not theoretical.
2. **CEL-based policy enforcement**: Reuses proven policy-as-code patterns from
   cloud infrastructure (Envoy, GKE) for agent governance.
3. **Forensics-first**: The ability to reconstruct agent sessions from artifacts
   without prior instrumentation suggests post-incident investigation is already
   a real workflow.
4. **Complements, not replaces**: Works across agent boundaries (Codex, Claude Code,
   IDE agents) rather than being tied to one agent framework.

## Connections

- Extends the **agent observability** pattern seen in TraceRoot (XHS finding
  2026-07-24), but operates at the OS/endpoint layer rather than within the
  agent runtime.
- Aligns with the **agent security harness** pattern (SHarD, arXiv 2607.25890)
  — both wrap agents in external safety layers.
- The opt-in enforcement model mirrors the "monitor-then-enforce" graduation
  seen in Kubernetes admission controllers and cloud security posture tools.

## Assessment

High relevance. Signals maturation of the agent security tooling category from
framework-internal guardrails to OS-level endpoint monitoring — a pattern shift
that will likely accelerate as enterprises deploy coding agents at scale.
