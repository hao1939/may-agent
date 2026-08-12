---
title: "GitHub — ocm-mcp-server: Safe AI Agent Operations on Kubernetes Fleets"
source: github
date: 2026-07-27
last_updated: 2026-07-27
type: finding
tags: [github, mcp-server, kubernetes, agent-safety, guardrails, multi-cluster, infrastructure-agents]
---

# GitHub 2026-07-27 — ocm-mcp-server: Safe AI Agent Ops on Kubernetes Fleets

## Summary

A new MCP server (32★, created 2026-07-25) that lets AI agents operate multi-cluster Kubernetes fleets through an Open Cluster Management hub, with four independent safety layers between the model and production clusters. Represents a maturing pattern: infrastructure-as-agent-tool with hard guardrails that cannot be prompt-injected away.

## Notable Repo

### sandeepbazar/ocm-mcp-server — AgentOps for Kubernetes Fleets (32★)

- **Repo:** https://github.com/sandeepbazar/ocm-mcp-server
- **What:** An MCP server exposing OCM (CNCF project) hub capabilities to AI agents. The agent never holds a kubeconfig. Every write is policy-checked, human-approved, and traced.
- **Four guardrail layers (none in system prompt, so none can be talked out of):**
  1. **Static checks** — server-side, before anything: blocks privileged pods, host access, system namespaces, unpinned images
  2. **Policy admission** — Kyverno dry-run on the hub cluster
  3. **Human approval** — Ed25519 signed token, bound to content + operation + expiry
  4. **Least-privilege RBAC** — no Secrets, no exec, no deletes outside its own ManifestWorks
- **Architecture:** Reads flow freely; all mutations go through propose → policy-check → human-approve → apply → audit pipeline
- **Language:** Python 3.11+, Apache-2.0

## Signal Analysis

- **Pattern: Hard guardrails outside the prompt.** The project explicitly states "none of these layers live in the system prompt, so none can be talked out of." This is the correct architecture for agent safety — enforcement in code/infrastructure, not instructions.
- **Pattern: Agent as fleet operator.** Targets the "2 a.m. page" use case — agents doing incident response on Kubernetes. The control-plane approach (hub → ManifestWork) means agents never touch individual cluster credentials.
- **Pattern: MCP as universal agent-infrastructure interface.** Further evidence that MCP is becoming the standard protocol for connecting agents to real infrastructure (beyond just dev tools and APIs).
- **Contrast with naive kubectl-as-tool:** The README explicitly warns against giving agents cluster-admin + kubectl, citing non-determinism, credential exposure, and lack of audit trail.

## Relevance to Scout

Validates the thesis that production agent deployments need infrastructure-level safety guarantees. The four-layer pattern (static → policy → human-in-loop → RBAC) could generalize beyond Kubernetes to any agent-operated infrastructure.
