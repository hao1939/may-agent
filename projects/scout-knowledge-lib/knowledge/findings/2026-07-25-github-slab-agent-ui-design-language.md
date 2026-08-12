---
title: "Slab — A Deterministic Design Language for Agent-Authored UI"
source: github
date: 2026-07-25
last_updated: 2026-07-25
type: finding
tags: [github, agent-ui, deterministic-rendering, design-language, rust, wasm]
---

# Slab — A Deterministic Design Language for Agent-Authored UI

Repo: https://github.com/stencil-hq/slab

## Signal

A new Rust project (MIT, pre-alpha, 15★ as of 2026-07-25) introduces `.slab` — a text-based
design language that compiles to a binary IR (SLIR/Protobuf) and is evaluated by a single
deterministic kernel. The same kernel drives native (wgpu), web (DOM), terminal (TUI), and
static (SVG/PNG) renderers with byte-identical layout output.

## Why This Matters for Agents

The core thesis is that **agent-authored UI must be deterministic and diffable**:

- No flexbox surprises or per-platform reimplementation.
- Agents generate `.slab` text; the kernel guarantees pixel-identical results everywhere.
- Diffs between two `.slab` documents are meaningful (no hidden state).
- Typed parameters (`params {}`) give agents a structured interface to fill.
- Exported components (`def ... export`) let agents compose UIs from a library of parts.

This addresses a real gap: when agents generate HTML/CSS, the output is non-deterministic
across renderers and hard to verify. Slab constrains the design space so agents can
confidently produce correct UI.

## Architecture

```
.slab source → compiler → SLIR (Protobuf binary)
                              ↓
                     slab-kernel (Rust, single solver)
                     ↓        ↓        ↓        ↓
                  native    web      TUI      static
                  (wgpu)   (DOM)  (terminal) (SVG/PNG)
```

Key features:
- Design tokens, typed host params, exported components
- Declarative state (`when hover`, `when !playing`)
- Signals (`act=toggle`, `act=pick`) for interaction
- Host-filled `hole`s for dynamic content injection
- No Rust toolchain needed — ships as WASM in npm CLI

## Relevance to Agent Architectures

This fits an emerging pattern: **constrained output languages for agents**. Rather than
asking agents to produce arbitrary HTML/CSS (high-dimensional, non-deterministic), you give
them a restricted but expressive DSL where correctness is verifiable by construction.

Related patterns in the knowledge base:
- Agent skills as portable behavioral specifications
- Deterministic tool interfaces (structured I/O)
- Agent-authored artifacts with verifiable properties

## Status

Pre-alpha. Language, binary format, and APIs subject to change. 14 example documents
included. Conformance testing via golden byte comparison across all drivers.
