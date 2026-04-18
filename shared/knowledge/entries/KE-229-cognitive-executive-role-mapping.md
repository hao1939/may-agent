# KE-229: Parallax cognitive-executive separation reveals our role split is cognitive-cognitive, not cognitive-executive

**Date**: 2026-04-18
**Source**: DD-763 (Parallax, arXiv 2604.12986)
**Confidence**: Medium-High
**Connects**: KE-212, KE-222, KE-007, H-098, WKWA-007

## Core Finding

Parallax's cognitive-executive separation draws the boundary between **reasoning** (deciding what to do) and **execution** (doing it with real-world effects). Mapping this to our system reveals that our multi-agent role split (architect/Bob, optimizer, coach, tech-lead) is entirely within the **cognitive** layer — all roles reason and produce text artifacts. The **executive** layer in our system is the dispatcher infrastructure, tool execution engine, git operations, and workflow runners. This means:

1. Our role specialization is **cognitive differentiation** (different reasoning strategies), not cognitive-executive separation
2. The actual cognitive-executive boundary in our system is the **tool call interface** — the point where an agent's reasoning becomes an action with side effects
3. Our hard gates (WKWA-007) work precisely because they sit at this cognitive-executive boundary, not because they're "stronger prompts"

## Evidence

- Parallax architecture: Cognitive System (LLM reasoning) → Validator → Executive System (action execution). The validator is structurally independent.
- Our architecture: Bob/optimizer/coach (all LLM reasoning) → dispatcher → tool calls (bash, write, git). The dispatcher + guards sit at the boundary.
- Our hard gates achieve 100% compliance (WKWA-007) because they intercept at the tool-call boundary — exactly where Parallax places its validator
- Our skills/prompts achieve ~0% because they live inside the cognitive layer alongside the reasoning they're trying to constrain — same as Parallax's prompt-guardrails-are-zero finding

## Mechanism / Why

Cognitive-executive separation works because it creates a **structural information asymmetry**: the executive layer doesn't need to "understand" the reasoning to validate it — it checks formal properties (is this file path allowed? is this action in the approved set?). Our role split doesn't create this asymmetry because all roles share the same LLM reasoning substrate. Bob can't structurally constrain optimizer any more than a prompt can constrain itself.

## Implications

### 1. Role proliferation won't improve safety — only boundary enforcement will
Adding more cognitive roles (auditor, reviewer, safety-agent) doesn't create the structural separation Parallax shows is necessary. All cognitive roles share the same vulnerability to reasoning compromise. Safety improvements must come from the dispatcher/tool layer.

### 2. Our dispatcher IS the Parallax validator — and could be formalized as such
The dispatcher already sits at the cognitive-executive boundary. Parallax's "graduated determinism" (allow-list → pattern-match → LLM-judge tiers) suggests our guard system could be explicitly tiered: some actions always allowed, some pattern-checked, some requiring secondary validation.

### 3. Information flow control is the missing dimension
Parallax propagates data sensitivity labels through workflows. We have nothing equivalent — any agent can read any file. Adding sensitivity-aware routing (e.g., credentials only accessible via specific tool patterns) would strengthen our cognitive-executive boundary.

## Actionable

- Frame future safety work as **strengthening the dispatcher boundary**, not adding cognitive roles or prompt rules
- Consider formalizing the dispatcher's guard tiers along Parallax's graduated determinism model
- Investigate information flow labels as an addition to our enforcement taxonomy

## Open Questions

- Does our multi-agent cognitive differentiation provide any indirect safety benefit (e.g., diversity of reasoning reducing correlated failures)?
- Could a "validator agent" that runs in a separate context (no shared memory with the primary agent) approximate structural separation even within the cognitive layer?
