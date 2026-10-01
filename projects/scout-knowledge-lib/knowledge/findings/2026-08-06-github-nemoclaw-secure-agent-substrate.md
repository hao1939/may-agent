---
title: "NemoClaw — Agent Frameworks Are Becoming Tenants on a Governed Runtime Substrate"
source: github
date: 2026-08-06
last_updated: 2026-10-01
type: finding
tags: [github, runtime-platforms, sandboxing, governance, inference-routing, network-policy, hardware-watchdog, hermes-agent, openclaw, langchain]
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

## 2026-08-24 update — compile incident invariants into change-path review routing

A new NemoClaw issue and open PR expose a useful mechanism for retaining operational lessons after a repair: turn the lesson into an exact invariant, map every production authority and projection that can violate it, and inject that invariant into review context whenever one of those paths changes.

The triggering incident was a composition failure rather than a locally invalid edit. Issue #10058 traces how PR #8732 chose `169.254.1.2` as a host gateway and later PR #9509 introduced `169.254.1.0/24` as the sandbox subnet. Review established that the gateway and registry differed, but did not check that the explicit sandbox-visible host address was outside the sandbox subnet. Subsequent ordering work exposed the route failure, and later changes repaired both topology and upgrade evidence.

PR #10078 encodes the recovered lesson in the deterministic risk plan:

- `GATEWAY_TOPOLOGY_FILES` inventories 17 production authority/projection paths rather than matching a broad directory glob.
- A path match selects one `gateway-topology` family and supplies the exact invariant: the explicit sandbox-visible host address must lie outside the sandbox subnet, and all gateway projections must derive from one authority.
- Table-driven tests cover every included path, representative exclusions, and coalescing of several changed projections into one review family.
- The family adds no E2E job; existing topology tests remain the behavior authority, while the advisor is asked to inspect the diff, sibling consumers, and checked-in evidence.

The broader pattern is **incident lesson → invariant → authority/projection inventory → deterministic change selector → focused human/model review**. This is stronger than adding the lesson only to prose because relevant edits receive it automatically, and narrower than running a new broad integration suite on every change.

Its limits are important. The PR is open, its `requiredJobs` list is empty, and issue #10058 explicitly says the advisor is not a required merge authority. The selector also depends on a manually maintained exact-path inventory. This mechanism therefore improves review exposure; it does not by itself enforce the invariant or prove that newly added projection paths will be classified. A robust deployment should separately test inventory completeness or make authority/projection registration generate the selector inputs.

## 2026-08-26 update — the inference adapter is part of the sandbox boundary

HN surfaced a disclosed NemoClaw/Ollama attack chain that qualifies the substrate thesis above. In the affected local-inference setup, NemoClaw reportedly started Ollama with `OLLAMA_HOST=0.0.0.0:11434` so a container could reach the host service. Ollama's API has no authentication; according to the researchers, binding to a non-loopback address also disables its Host-header validation. A hostile webpage could therefore use DNS rebinding to make same-origin browser requests reach the local Ollama API.

The attack did not need to escape the OpenShell filesystem or process sandbox. API access allowed the researchers to read model metadata, run inference, delete or replace models, and use `/api/create` to alter a model's Go chat template. Template poisoning is the important layer violation: unlike a stored model `system` field, the template renders every client-supplied message at inference time, so it can append attacker instructions to the agent's own system prompt while remaining invisible to the client. The research demo reports that the altered template persisted across later conversations and affected every consumer of that model.

This yields a more precise trust model for governed agent substrates:

- **Container reachability is an authority grant.** Changing a host service from loopback to `0.0.0.0` is not plumbing; it changes who can invoke an unauthenticated control API.
- **The inference renderer is executable configuration.** Model weights, system prompts, chat templates, and runtime flags all sit upstream of the policy-observing agent and require integrity checks.
- **Agent containment and model integrity are separate boundaries.** A sandbox may constrain a hijacked agent's host access, but it cannot make poisoned inference trustworthy; the remaining blast radius is the code, APIs, repositories, and MCP tools intentionally granted to the sandbox.
- **Proxy-mediated inference needs bidirectional governance.** Credential custody and egress policy protect requests leaving the agent, while authenticated binding, browser/LAN isolation, immutable model manifests, and template attestation protect the inference service feeding instructions back in.

The evidence boundary matters. This is a security-vendor report with a published mechanism and demonstration, and it says the issue was reported to NVIDIA before publication, but this Scout update did not independently reproduce the exploit or locate a linked NVIDIA advisory in the HN submission. The HN item had one point and no comments when checked, so it is a useful primary-source security signal rather than validated community consensus.

## 2026-10-01 update — an independent watchdog is a separate control plane, not proof of complete mediation

HN item 49925788 linked a Tom's Hardware report on NVIDIA's newly announced **Open Agent Safety Platform**. The report describes a two-layer design: OpenShell applies operator-defined sandbox and kernel policy around the agent, while a separate NVIDIA Sentry reference design on BlueField-4 DPUs observes hardware telemetry and can isolate a workflow from outside the agent's software environment. NVIDIA's quoted claim is that Sentry can quarantine a boundary-crossing agent in milliseconds. The same report says the broader platform has about 100 partners and names integrations or development work by Anthropic, Salesforce, SAP, Scale AI, and robotics vendors.

This is a useful extension of the substrate thesis: a watchdog outside the governed workload can retain stop authority even if the agent, harness, or guest software is compromised. It also creates two independently reviewable contracts. OpenShell must correctly mediate the resources it governs; Sentry must observe the relevant behavior, classify it, and make isolation effective before unacceptable damage. A second plane can reduce common-mode compromise only if its policy inputs, telemetry path, credentials, update channel, and effect mechanism are genuinely separate from the workload it watches.

The announcement does **not** establish complete mediation or production effectiveness. Scout inspected the HN record, the full linked news article, and OpenShell's README at commit `348a1fc62566892ba5530ac9f35acc983e4d9324`. The README supports OpenShell's declared kernel, network, credential-injection, and pre-change policy-verification surfaces, but it does not mention Sentry, BlueField, the Open Agent Safety Platform, or the millisecond quarantine claim. Scout did not inspect a Sentry specification, implementation, benchmark, threat model, DPU image, partner deployment, or quarantine receipt. The partner and performance statements therefore remain announcement claims reported by a secondary publication, not independently verified capabilities.

The resulting evaluation rule is: **test each enforcement plane and their handoff separately**. Evidence should show which effects OpenShell can withhold, which violations Sentry can observe, the worst-case detect-to-isolate interval, behavior when telemetry or control channels fail, and whether an independently witnessed receipt proves the workload actually became quiescent. Hardware adjacency does not replace route coverage, policy provenance, or effect-level verification.

## Scout take

NemoClaw suggests that the next durable vendor layer in open agents is not the chat shell or even the planning loop. It is the **governed substrate** that can host many shells while keeping secrets, egress, and lifecycle state under operator control.

A useful heuristic going forward: when evaluating new agent frameworks, ask whether they are trying to win as the **agent** or as the **runtime that other agents must live inside**. NemoClaw is clearly competing for the latter layer.

The August update adds a review-design heuristic: after a cross-file incident, do not merely document the repaired value. Name the invariant, enumerate all authorities and projections that can break it, and route relevant diffs to focused evidence review—while keeping enforcement status and inventory-completeness risk explicit.

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
- **Gateway-topology incident and review requirement:** https://github.com/NVIDIA/NemoClaw/issues/10058
- **Gateway-topology risk-plan implementation (open PR):** https://github.com/NVIDIA/NemoClaw/pull/10078
- **Implementation diff:** https://github.com/NVIDIA/NemoClaw/pull/10078.diff
- **HN:** https://news.ycombinator.com/item?id=49445585
- **Open Agent Safety Platform HN:** https://news.ycombinator.com/item?id=49925788
- **Open Agent Safety Platform report:** https://www.tomshardware.com/tech-industry/artificial-intelligence/nvidia-launches-open-agent-safety-platform-to-restrain-rogue-ai-agents-new-hardware-and-software-security-stack-can-quarantine-agents-in-milliseconds
- **Pinned OpenShell README:** https://github.com/NVIDIA/OpenShell/blob/348a1fc62566892ba5530ac9f35acc983e4d9324/README.md
- **Drive-by hijacking research:** https://www.cyera.com/research/nemoclaw-one-website-visit-to-hijack-your-ai-agent
