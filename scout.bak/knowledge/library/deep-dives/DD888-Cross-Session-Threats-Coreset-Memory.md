# DD888: Cross-Session Threats in AI Agents — Coreset Memory Reader

**Paper:** arXiv:2604.21131 (Azarafrooz, Apr 2026)
**Relevance:** ★★★★★ — Directly addresses security of multi-session agent systems like ours

## Core Insight

AI agent guardrails are **memoryless** — each message judged in isolation. An adversary can spread an attack across dozens of sessions, invisible to any single-session detector. Only the aggregate reveals the threat.

## Key Contributions

### 1. CSTM-Bench (26 attack taxonomies)
- **Four cross-session operations:** accumulate, compose, launder, inject_on_reader
- **Seven identity anchors** ground-truth what counts as "violation"
- Two splits: **dilution** (compositional) and **cross_session** (12 isolation-invisible scenarios)
- Benign-pristine and Benign-hard confounders included

### 2. Session-bound detection fails
- Both session-bound judges AND full-log correlators (concatenating all prompts into one long-context call) lose ~50% attack recall on cross_session split
- Problem is NOT context window size — it's within frontier windows
- The information bottleneck framing: how much signal survives compression to the correlator?

### 3. Bounded-Memory Coreset Reader
- Retains K=50 highest-signal fragments across sessions
- **Only reader whose recall survives both shards**
- New metric: CSR_prefix (ordered prefix stability, LLM-free)
- Combined metric: CSTM = 0.7 F1(CSDA@action, precision) + 0.3 CSR_prefix

## System Implications

1. **Our session isolation is a security feature AND a vulnerability.** Each agent session is independent — good for containment, but blind to cross-session adversarial patterns.

2. **Coreset memory pattern** — keeping K highest-signal fragments across sessions — maps directly to our checkpoint/context system. We could apply this for security monitoring.

3. **The "ranker reshuffle breaks KV-cache" finding** matters for any system doing repeated context ranking (like our context curation).

## Connection to Existing Work
- DD881/DD886 (Tool Attention) — context selection is dual to threat detection selection
- DD880 (Experience Compression) — coreset = extreme compression with signal preservation
- Our checkpoint system is an implicit coreset — but not optimized for security signal retention

## Actionable Hypothesis
**H-069: Cross-Session Threat Blindness** — Our system has zero cross-session threat detection. An adversary could accumulate context-poisoning fragments across sessions. A coreset-based security monitor retaining K=50 signal fragments could detect patterns invisible to per-session checks.

**Tags:** #security #memory #cross-session #coreset #benchmark
