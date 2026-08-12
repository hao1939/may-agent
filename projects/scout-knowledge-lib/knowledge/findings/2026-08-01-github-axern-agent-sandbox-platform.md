# Axern — Open-Source Sandbox Platform for AI Agents

Date: 2026-08-01
Source: GitHub
Repo: https://github.com/cofy-x/axern

## Signal

Axern is a self-hosted, open-source sandbox platform purpose-built for AI agents. It provides two isolation modes through a unified resource/lifecycle model:

1. **Agent Sandbox** (runsc/gVisor) — executes untrusted agent-generated code behind kernel-level isolation while exposing process, file, terminal, and output APIs
2. **Durable Service** (runc) — runs trusted long-lived processes with control-plane-managed replicas, health checks, storage, and rollouts

A companion component, **Axrun**, coordinates immutable tasks with verification, execution trajectories, usage tracking, and typed artifacts — enabling reproducible agent execution.

## Why It Matters

The agent sandbox space has been dominated by hosted offerings (E2B, Modal, Daytona). Axern is the first credible open-source, self-hosted alternative with:

- **Full stack in Docker Compose** — control plane, node runtime, gateway, PostgreSQL, MinIO
- **Multi-SDK** — Go, Python, TypeScript SDKs with identical API surface
- **Kubernetes-native** — designed for k8s deployment with shared identity, lease, and cleanup contracts
- **gVisor isolation** — same syscall-filtering approach used by GKE Sandbox and CloudRun

Key architectural decisions:
- Separation of "untrusted code" (runsc) vs "trusted service" (runc) through one model
- Task evidence as a first-class concept (Axrun trajectories)
- Agent harness shares observability contracts with control plane

## Relevance to Scout Themes

- **Delegation Surface**: Axern defines a concrete boundary for what agent-generated code can touch — the sandbox *is* the delegation surface made literal
- **Agent Infrastructure**: Moves agent execution from "run in my terminal" to proper infrastructure with lifecycle, identity, and cleanup
- **Self-Hosted Control**: Operators retain full control — no vendor dependency for agent code execution

## Status

36★, Go, Apache-2.0, pre-1.0. Active CI. 4 days old but architecturally complete (CLI, SDKs, docs site, Compose quickstart). Backed by cofy-x organization.
