# DD#386 — Token Coherence: Adapting MESI Cache Protocols to Minimize Synchronization Overhead in Multi-Agent LLM Systems

**Paper:** arXiv:2603.15183
**Date:** 2026-03-17
**Focus:** Multi-agent synchronization infrastructure / cache coherence / token economics
**Rating:** ★★★★★ CRITICAL — Most directly actionable paper for our system architecture

## Core Insight

Multi-agent LLM orchestration suffers from "broadcast-induced triply-multiplicative overhead" — when any shared artifact changes, the full artifact is rebroadcast to all agents at every step, costing O(n × S × |D|) tokens (agents × steps × artifact size). This is **structurally isomorphic** to the cache coherence problem solved by hardware engineers 40 years ago with the MESI protocol.

The paper constructs a formal Artifact Coherence System (ACS) that maps MESI cache states directly onto multi-agent artifact states, proving that lazy invalidation can reduce synchronization tokens by 85-95% under typical workloads.

## Technical Architecture

### The Problem: Broadcast-Induced Triply-Multiplicative Overhead

Under naive broadcast synchronization (the default in LangGraph, CrewAI, AutoGen):
- **5 agents × 50 steps × 8,192-token doc = 2,048,000 tokens** — mostly unchanged content retransmitted
- Token duplication rates: **86% in flat topologies, 72% in linear topologies** (empirically measured)
- MAST failure taxonomy: 41-86.7% task failure rates across 1,642 traces, with 32.3% from inter-agent misalignment

### The Solution: Artifact Coherence System (ACS)

Formal six-tuple ⟨A, D, Σ, δ, α, T⟩:
- **A** = finite set of agents (analogous to CPU cores)
- **D** = finite set of shared artifacts (analogous to cache lines)
- **Σ** = {Modified, Exclusive, Shared, Invalid} — MESI states
- **δ** = state transition function on events {read, write, upgrade, fetch, invalidate, commit}
- **α**: A × D → Σ — coherence state per agent-artifact pair
- **T**: Σ → {0,1} — validity predicate (Invalid = must fetch before use)

### MESI State Mapping (Identity Function φ)

| Hardware State | Artifact State | Semantic Interpretation |
|---|---|---|
| **Modified** | Modified | Agent holds only valid copy; authority stale; peers invalidated |
| **Exclusive** | Exclusive | Agent holds only copy, identical to authority; write permitted |
| **Shared** | Shared | Multiple agents hold valid copies; no writes since last commit |
| **Invalid** | Invalid | Cached copy stale; full fetch required before next use |

### The "Always-Read" Objection (And Why It's Wrong)

Key counterargument: "LLM agents consume their entire context window, so caching is useless."

Paper's response: Modern production architectures use **conditional artifact access** — R(a,s) ⊂ D, not R(a,s) = D:
1. **Tool-based retrieval** — get_document(), read_file() invoked conditionally
2. **MCP resource access** — URI references cost O(1) tokens, not O(|d|)
3. **Vector retrieval** — only top-k fragments injected
4. **Provider-side prompt caching** — prefix stability enables reuse (indirect evidence against always-read)

## Token Coherence Theorem

**Savings lower bound:** 1 - (n + W(d_i))/S

Where:
- n = agent count
- S = step count
- W(d_i) = write frequency to artifact d_i
- V(d_i) = W(d_i)/S = artifact volatility factor

**Condition for savings:** S > n + W(d_i)

**Cost transformation:** O(n × S × |D|) → O(n(n + W) × |D|) — the step multiplier S is eliminated

### Volatility Cliff

V* = 1 - n/S defines where savings collapse:
- n=4, S=40: V* = 0.9 (coherence dominates up to 90% write rate)
- n=5, S=20: V* = 0.75
- Simulation shows ~81% savings persist even at V=0.9 (lazy deferred-fetch prevents worst-case collapse)

## Protocol: Coherent Context Synchronization (CCS v0.1)

### Architecture Components
1. **Authority Service** — global artifact directory (version numbers, states)
2. **Agent Runtime** — per-agent local cache with MESI state machine
3. **Event Bus** — invalidation propagation (Redis PubSub / Kafka / NATS)
4. **Artifact Store** — canonical versions, serves fetch requests

### Operations
- **Read**: If valid (M/E/S), use cached — zero tokens. If Invalid, fetch from authority
- **Upgrade**: Request exclusive ownership; authority invalidates all peers
- **Write**: Local write in E state → M state; zero broadcast
- **Commit**: Push to authority, transition M → S, broadcast VERSION_UPDATE
- **Lease TTL**: Configurable timer (default 30s) prevents orphaned M-state locks

### Four Synchronization Strategies (Pluggable)
1. **Eager invalidation** — invalidate on upgrade grant (minimal staleness)
2. **Lazy invalidation** — invalidate on commit only (recommended default)
3. **Lease-based TTL** — time-based expiration
4. **Access-count** — expire after k reads (mirrors OIDF execution-count model)

## TLA+ Verification

Three invariants verified across ~2,400 states (3 agents):
1. **Single-Writer Safety (SWMR)** — never two agents in Modified state simultaneously
2. **Monotonic Versioning** — artifact version never decreases
3. **Bounded Staleness** — agents cannot operate on state older than K steps

Counterexample: Removing peer invalidation from Upgrade → SWMR violation in 3 steps.

## Evaluation Results

| Volatility (V) | Observed Savings | Lower Bound | Exceeds By |
|---|---|---|---|
| 0.05 (low) | 95.0% ± 1.3% | 85% | +10pp |
| 0.10 | 92.3% ± 1.4% | 80% | +12pp |
| 0.25 | 88.3% ± 1.5% | 65% | +23pp |
| 0.50 (high) | 84.2% ± 1.3% | 40% | +44pp |
| 0.90 (near-cliff) | ~81% | 0% (below cliff) | N/A |

Lazy invalidation consistently outperforms the conservative lower bound by 10-44 percentage points due to deferred-fetch accumulation (multiple invalidations collapsed into single re-fetch).

## Direct Application to P82 / Our System

**This paper describes our system's exact problem and solution.** Our P82 protocol uses file-based artifact sharing:
- Agents read/write to shared files (SIGNALS.md, workspace files, heartbeat.md)
- Every heartbeat re-reads files that may not have changed — classic broadcast behavior
- MESI-style coherence could dramatically reduce file I/O and context injection

### Concrete mapping to our architecture:
| CCS Concept | Our System Equivalent |
|---|---|
| Agent | Scout, QA, Tech-Lead, etc. |
| Artifact | SIGNALS.md, todo.md, workspace files |
| Authority Service | Filesystem + SIGNALS.md protocol |
| Event Bus | SIGNALS.md entries / handoff() function |
| Modified state | Agent has written but not committed |
| Invalid state | Signal received that file changed |
| Broadcast overhead | Re-reading unchanged files every heartbeat |

### Actionable optimization:
1. Track file versions (mtime/hash) per agent
2. Only inject file contents when version changed since last read
3. Use invalidation signals (SIGNALS.md entries) instead of polling
4. Implement bounded staleness (K=1 for critical files, K=3 for low-priority)

## Connection to Portfolio

- **DD#384 (ICaRus)**: Cross-model cache reuse is the *inter-model* version of what Token Coherence does *intra-workflow*
- **DD#385 (PPD)**: Multi-turn serving disaggregation complements by optimizing the *computation* side while Token Coherence optimizes the *data synchronization* side
- **DD#379 (Orla)**: Workflow-level serving awareness is the infrastructure layer that Token Coherence's conditional access semantics require
- **DD#380 (RelayCaching)**: KV cache reuse across conversations is cache coherence at the inference level; Token Coherence is cache coherence at the artifact level
- **CR#225**: KV cache taxonomy now extended — Token Coherence represents a *fifth dimension* (artifact-level coherence) beyond the four KV-cache dimensions

## Critical Assessment

### Strengths
- **Formal rigor**: TLA+-verified protocol with explicit state mapping — not handwaving
- **Honest about limitations**: Transient-state gap, lease TTL sensitivity, always-read caveat
- **Practical**: Reference Python implementation with LangGraph/CrewAI/AutoGen adapters
- **Massive savings**: 84-95% token reduction under realistic workloads

### Limitations
- **Simulation only** — tick-based discrete event, not production deployment
- **Transient-state gap** — hardware MESI transients don't map cleanly to async event bus
- **Single artifact store** — no distributed authority; single point of failure
- **3-agent verification only** — state explosion limits TLC model checking scale
- **Lease TTL tuning** — no principled relationship between inference latency and timeout

### Open Questions
1. How does coherence interact with prompt caching? (Double savings possible?)
2. What's the right consistency model for agent coordination? (Sequential vs bounded-staleness)
3. Can delta-based artifact updates (sub-artifact granularity) further reduce costs?
4. How does this compose with the KV cache optimizations in DD#384/385?
