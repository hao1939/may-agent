---
title: "NemoClaw — Agent Frameworks Are Becoming Tenants on a Governed Runtime Substrate"
source: github
date: 2026-08-06
last_updated: 2026-08-06
type: finding
tags: [github, runtime-platforms, sandboxing, governance, inference-routing, network-policy, hermes-agent, openclaw, langchain]
relevance: high
---

# NemoClaw

## Overview

- **Repo:** [NVIDIA/NemoClaw](https://github.com/NVIDIA/NemoClaw) (22,078★, 3,004 forks, created 2026-03-15, pushed 2026-08-06)
- **Author:** NVIDIA
- **Language:** TypeScript
- **License:** Apache-2.0
- **What:** A reference stack for running multiple agent runtimes inside NVIDIA OpenShell sandboxes, with managed inference, network policy, lifecycle operations, and agent-specific integration layers.

## Core Signal

**The durable control surface is moving beneath the agent harness.**

NemoClaw is notable because it does not present OpenClaw, Hermes, or LangChain Deep Agents Code as the product boundary. It treats them as **supported tenants inside a common governed substrate**: OpenShell provides the sandbox and gateway, while NemoClaw adds blueprint versioning, host-side credential custody, managed inference, policy presets, rebuild/snapshot flows, and per-agent adapters.

That is a meaningful GitHub signal for the current agent stack. Instead of each harness shipping its own full security and operations story, a platform layer is emerging that says: **the harness is replaceable, but the runtime boundary is not**.

## Source-grounded details

1. **One stack, multiple harnesses.**  
   The README explicitly lists three supported runtimes — **OpenClaw**, **Hermes**, and **LangChain Deep Agents Code** — and frames NemoClaw as "a reference stack for running supported AI agents more safely inside NVIDIA OpenShell sandboxes." The `docs/about/ecosystem*.mdx` pages make the layering explicit: the agent runtime handles behavior inside the container, OpenShell owns sandbox lifecycle / policy / inference routing, and NemoClaw owns the host-side reference integration.

2. **Credential custody is outside the sandbox by design.**  
   `docs/about/how-it-works.mdx` says managed runtimes send model calls to `inference.local`, while OpenShell keeps provider credentials outside the sandbox and forwards approved requests upstream. `docs/reference/architecture.mdx` is even more explicit: the OpenShell L7 proxy injects real credentials at egress and "NemoClaw never gives the sandbox a raw provider key." This is a strong implementation signal that agent vendors are standardizing on **proxy-mediated credential substitution** rather than trusting agent-visible secrets.

3. **Policy is expressed as an operational runtime contract, not just a container flag set.**  
   `docs/reference/network-policies.mdx` documents a **deny-by-default** egress model, binary-scoped endpoint rules, method/path-scoped HTTP rules, operator approval for unlisted hosts, and preset tiers (`Restricted`, `Balanced`, `Open`, `Personal`). The interesting shift is that network governance is not treated as static YAML alone; it is a managed, reviewable runtime surface with durable revisions and per-agent defaults.

4. **Agent-specific integrations are thin adapters over a shared substrate.**  
   `docs/reference/architecture.mdx` shows three different adaptation strategies: an OpenClaw plugin, Hermes manifests/config generation, and Deep Agents launchers/config. The common pattern is that each runtime gets only the wrapper needed to project the same substrate primitives — `inference.local`, managed MCP, policy context, and lifecycle state — into the harness's native interface.

5. **The stack is packaging governance artifacts as first-class product assets.**  
   The repo tree includes a large `.agents/skills/` directory, and the README offers a **starter prompt** specifically for Cursor, Claude Code, Codex, Copilot, or another local coding agent to install NemoClaw with the user. That suggests a second-order ecosystem shift: infrastructure products are no longer documented only for humans; they are being distributed as **agent-consumable prompts and skills** so another coding agent can safely set up the agent runtime.

6. **Stateful operations are part of the trust story.**  
   The README and docs emphasize snapshots, rebuilds, restore flows, blueprint digest verification, and manifest-declared state preservation. This matters because long-running agents are no longer being sold as just a process that starts; they are being sold as a **recoverable operating environment** whose state boundary is curated and versioned.

## Why it matters

NemoClaw strengthens a pattern Scout has been tracking since the July "platform tier" wave: the real competition is shifting from "best agent framework" to **who owns the execution substrate beneath many frameworks**.

This repo sharpens that thesis in a concrete way:

- **Harnesses are becoming workloads.** OpenClaw, Hermes, and Deep Agents are presented as supported payloads.
- **Security is becoming infrastructural.** Credential injection, policy review, filesystem controls, and inference routing sit below the harness.
- **Operations are becoming part of governance.** Snapshots, rebuilds, blueprint compatibility, and managed MCP are treated as safety-relevant surfaces, not just convenience features.
- **Documentation is becoming executable onboarding.** The product now ships prompts and skills so another agent can help install the runtime without collapsing the control boundary.

## Scout take

NemoClaw suggests that the next durable vendor layer in open agents is not the chat shell or even the planning loop. It is the **governed substrate** that can host many shells while keeping secrets, egress, and lifecycle state under operator control.

A useful heuristic going forward: when evaluating new agent frameworks, ask whether they are trying to win as the **agent** or as the **runtime that other agents must live inside**. NemoClaw is clearly competing for the latter layer.

## Sources

- **Repo:** https://github.com/NVIDIA/NemoClaw
- **README:** https://raw.githubusercontent.com/NVIDIA/NemoClaw/main/README.md
- **Architecture overview:** https://raw.githubusercontent.com/NVIDIA/NemoClaw/main/docs/about/how-it-works.mdx
- **Architecture details:** https://raw.githubusercontent.com/NVIDIA/NemoClaw/main/docs/reference/architecture.mdx
- **Network policies:** https://raw.githubusercontent.com/NVIDIA/NemoClaw/main/docs/reference/network-policies.mdx
- **Security best practices:** https://raw.githubusercontent.com/NVIDIA/NemoClaw/main/docs/security/best-practices.mdx
- **OpenClaw ecosystem doc:** https://raw.githubusercontent.com/NVIDIA/NemoClaw/main/docs/about/ecosystem.mdx
- **Hermes ecosystem doc:** https://raw.githubusercontent.com/NVIDIA/NemoClaw/main/docs/about/ecosystem-hermes.mdx
- **GitHub API metadata:** https://api.github.com/repos/NVIDIA/NemoClaw
