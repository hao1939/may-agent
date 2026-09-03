---
title: "Orbit — Multi-Agent Security Benchmarking Framework"
source: github
date: 2026-07-25
last_updated: 2026-07-25
type: finding
tags: [github, agent-security, multi-agent, benchmarking, red-teaming, inspect-ai]
---

# Orbit — Multi-Agent Security Benchmarking Framework

## Source

- **Repo:** [wlanderson0/orbit](https://github.com/wlanderson0/orbit) (12★, created 2026-07-21)
- **Affiliation:** Built at [Wittlab](https://wittlab.ai/) as part of the [MATS](https://www.matsprogram.org/) program, supported by the [Cooperative AI Foundation](https://www.cooperativeai.com/foundation)
- **Built on:** UK AI Safety Institute's [Inspect AI](https://inspect.aisi.org.uk/) framework

## What It Does

Orbit is a framework for empirical multi-agent safety and security evaluations. It provides:

- **5 scenario families** — coding, desktop, browser, customer-service, cooperative-allocation tasks
- **4 threat types** — prompt injection, compromised agent, collusion, misuse
- **4 defense categories** — security prompting, monitors, guardian agents, dual-LLM
- **Configurable topologies** — single agent, star, mesh (round-robin / delegation), plus custom shapes via YAML edges
- Variable memory visibility and scheduling modes per topology

## Why It Matters

Multi-agent security has lacked a standardized toolkit. Each research project required bespoke engineering, and there were no standard environments or benchmarks for comparing defenses across threat models. Orbit addresses this gap directly.

### Key Signals

1. **Topology as security surface.** The framework treats agent network topology (star, mesh, chain) as a first-class security variable. Different topologies expose different attack surfaces — delegation chains enable privilege escalation, mesh enables collusion. This formalizes what practitioners have intuited.

2. **Defense composability.** The four defense categories (prompting, monitors, guardians, dual-LLM) can be mixed and compared across the same scenarios. This enables empirical measurement of defense stacking effects.

3. **Built on Inspect AI.** Leveraging UK AISI's evaluation framework gives Orbit robust logging, tooling, and ecosystem compatibility. This is the safety-evaluation infrastructure becoming a platform.

4. **MATS + Cooperative AI provenance.** Coming from alignment research institutions rather than product companies signals a focus on rigorous evaluation methodology over marketing demos.

## Connections

- Extends our [agent security defense architectures](../agent-security-defense-architectures.md) notes with empirical benchmarking capability
- Complements [agent evaluation research](../agent-evaluation-research-beyond-outputs.md) — this is evaluation applied specifically to adversarial multi-agent scenarios
- The "guardian agent" defense pattern connects to the monitor/overseer patterns tracked in our governance notes
- The topology-as-security-variable insight is novel compared to single-agent red-teaming frameworks

## Status

Beta (APIs may change). Python 3.11+, MIT license.
