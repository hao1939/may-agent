---
title: "Limioryn — Physical Agents Need Evidence-Carrying Actuation, Not Tool-Success Semantics"
source: github
date: 2026-08-08
last_updated: 2026-08-08
type: finding
tags: [github, physical-agents, edge-agents, actuation, verification, uncertainty, safety, agent-runtime]
relevance: high
---

Repo: https://github.com/YINGLINGH/limioryn

# Limioryn

## Overview

- **Repo:** [YINGLINGH/limioryn](https://github.com/YINGLINGH/limioryn) (31★, 1 fork, created 2026-08-07)
- **Revision checked:** [`0469e409180569b1387cde191224d6e8a3fed327`](https://github.com/YINGLINGH/limioryn/commit/0469e409180569b1387cde191224d6e8a3fed327)
- **License:** Apache-2.0
- **What:** A Python edge/cloud multi-agent framework with device-capability contracts, persistent execution states, evidence ledgers, uncertainty budgets, and reference integrations for ESP32-S3, STM32, and Linux SBC devices.

## Core Signal

**For an agent acting on the physical world, a successful tool return is only transport evidence; completion must be a typed claim backed by evidence at the required physical layer.**

Limioryn models actuation as a contract rather than a one-shot tool call. The contract binds preconditions, capability authority, expected effect, verification, recovery, an uncertainty budget, and a risk limit. Its evidence hierarchy is explicit:

`transport < application < actuator < physical_effect < business_outcome`

A broker acknowledgement therefore cannot establish that a relay switched, and an application-level `APPLIED` state cannot establish that water actually flowed. If evidence is stale or insufficient, the runtime preserves `UNKNOWN` and chooses observation, reconciliation, a safer reversible action, or denial instead of upgrading delivery into success.

## Source-Grounded Design Details

1. **Authorization, risk, and uncertainty are evaluated in a fixed order.** The E0 language-neutral specification applies schema validity, identity/capability/interlock constraints, risk limits, and only then uncertainty or entropy limits. Emergency safety actions may bypass the entropy gate, but not identity, capability, hardware interlocks, or the risk ceiling.

2. **Recovery semantics account for ambiguous side effects.** The conformance vectors reject automatic retry when an effect is marked non-repeatable. This matters when an ACK is lost after a physical action: retrying a command because its confirmation disappeared can duplicate the real-world effect.

3. **Evidence cannot claim above its observed layer.** A checked vector marks transport evidence that claims `physical_effect` as invalid. Evidence also carries source, action ID, observation and freshness bounds, and a payload digest, making verification lineage part of the actuation result rather than an informal log message.

4. **Small devices receive a conservative projection, not fake precision.** Cloud or edge runtimes may maintain calibrated categorical distributions or bounded intervals. Microcontrollers can instead enforce discrete levels such as `bounded` or `uncertain`; the specification says these levels must not be converted into pseudo-probabilities.

5. **The repository contains code and conformance artifacts, not only an architecture proposal.** The checked tree includes JSON Schemas, 12 E0 decision vectors, a reference validator, device state machines, evidence-ledger modules, and device SDK tests. Reference targets cover TLS MQTT/HTTPS ESP32-S3, portable STM32 C99, and a Linux SBC node.

## Why It Matters

- **“Done” becomes claim-level, not call-level.** Agent runtimes should record what has actually been established—message delivered, application processed, actuator changed, physical effect observed, or business outcome achieved—rather than flattening all of them into success.
- **Uncertainty and consequence need separate controls.** The same missing sensor reading can be tolerable for a lamp and unacceptable for a heater or valve. A confidence threshold alone cannot encode that distinction.
- **Retries need effect semantics.** Idempotence or safe-to-repeat status belongs in the action contract, because acknowledgement loss and action failure are not equivalent.
- **Verification requirements should travel with the action.** Expected effect, required evidence level, freshness, and recovery policy are easier to enforce when they are machine-readable fields rather than prompt instructions.

## Caveats

This is a new public-preview repository with limited adoption evidence. Its included comparison is explicitly a six-scenario deterministic specification baseline, **not** hardware-in-the-loop validation; the script itself says device fault injection, probability calibration, and long-term observation remain future work. The architecture is therefore a useful implemented design signal, not evidence that the framework is functionally safe or certified for industrial deployment. The README likewise states that independent risk assessment, hardware interlocks, watchdogs, and applicable certification remain necessary.

## Scout Take

The reusable abstraction is **evidence-carrying actuation**: every external effect should return a bounded claim whose authority is no stronger than its evidence. This generalizes beyond robotics and IoT. Payments, deployments, account changes, and data deletion also need a distinction between request accepted, operation applied, external state observed, and intended outcome achieved. Agent systems that collapse those layers create false completion and unsafe retry loops even when every tool call is technically successful.

## Sources

- **Repo:** https://github.com/YINGLINGH/limioryn
- **Revision:** https://github.com/YINGLINGH/limioryn/commit/0469e409180569b1387cde191224d6e8a3fed327
- **GitHub API metadata:** https://api.github.com/repos/YINGLINGH/limioryn
- **GitHub search feed:** https://api.github.com/search/repositories?q=created%3A%3E%3D2026-08-07+agent+in%3Aname%2Cdescription&sort=stars&order=desc&per_page=30
- **README:** https://github.com/YINGLINGH/limioryn/blob/0469e409180569b1387cde191224d6e8a3fed327/README.md
- **Five-minute entropy overview:** https://github.com/YINGLINGH/limioryn/blob/0469e409180569b1387cde191224d6e8a3fed327/docs/ENTROPY_IN_5_MINUTES.md
- **E0 language-neutral specification:** https://github.com/YINGLINGH/limioryn/blob/0469e409180569b1387cde191224d6e8a3fed327/specs/entropy/README.md
- **E0 conformance vectors:** https://github.com/YINGLINGH/limioryn/blob/0469e409180569b1387cde191224d6e8a3fed327/specs/entropy/actuation_e0.vectors.json
- **Deterministic baseline:** https://github.com/YINGLINGH/limioryn/blob/0469e409180569b1387cde191224d6e8a3fed327/scripts/run_entropy_e0_baseline.py
