# Design Philosophy

**Owner: bob**

This document captures Hao’s design values, preferences, and principles.
Bob maintains it based on **Hao’s actual input** (what Hao said, corrected, or repeatedly enforced).

**Provenance tags** (applied to every principle):
- **[hao-direct]** Hao stated this explicitly (instruction, correction, or quoted requirement).
- **[hao-pattern]** Hao demonstrates/enforces this repeatedly via behavior, constraints, or evaluation criteria.
- **[imported]** Comes from external research / general doctrine; keep only if it fits reality and is clearly marked.

---

## Principles

### 1. Simplest Thing First [hao-pattern]
Don’t over-engineer. Prefer the smallest change that solves the observed problem.

### 2. Action Over Reporting [hao-pattern]
When there’s a clear next step, take it (edit, run, fix, commit) instead of producing a “nice list” and waiting.

### 3. Concise and Direct [hao-direct]
Short, direct answers. No filler. Prefer one clear sentence over a paragraph.

### 4. Approve Means Apply [hao-pattern]
When Hao approves a change, apply it immediately—don’t re-litigate or ask for another confirmation.

### 5. Build for What’s Real [hao-direct]
Optimize for real, observed failure modes and tasks; don’t build speculative architecture.

### 6. Evidence Over Intuition [hao-direct]
Claims should trace to something observable: transcripts, evaluation data, code, or Hao’s instructions.

### 7. Two-Phase Development: Explore Then Harden [hao-pattern]
Explore quickly to learn what works, then harden into constraints, tools, tests, and docs.

### 8. Crash Recovery as First-Class Concern [hao-pattern]
Assume failures happen; design for resume/recovery rather than perfect prevention.

### 9. File System as Memory [hao-pattern]
Prefer well-named files + directory structure for durable state and shared knowledge.

### 10. Every Agent Owns a Domain [hao-pattern]
Route work to the agent whose domain matches the task; specialists should compound knowledge over time.

### 11. No Silent Failures [hao-direct]
If something fails, return an explicit, actionable error (what happened + why). Empty/ambiguous results are worse than failures.

### 12. Respect Output Contracts [hao-direct]
Follow the requested output format exactly (e.g., “Only output X”). Don’t add extra sections, disclaimers, or commentary unless requested.

### 13. Measurable Operations [hao-pattern]
Prefer designs that can be measured and improved (tool-call waste, cost, retries, turn limits, success rates). If it can’t be measured, it will drift.

### 14. Scope Discipline [hao-direct]
Do the job that was asked—no scope expansion. If new work is discovered, propose it briefly and wait for explicit approval.

### 15. Act → Verify → Refine Loop [hao-pattern]
Execution should be closed-loop: do the change, verify via an independent check (read back, run tests), then refine.

### 16. The Artifact Effect [imported]
Artifacts can look “finished” even when wrong. Treat artifacts with the same skepticism as unverified claims.

### 17. Absorb Theory, Apply What’s Suitable [hao-pattern]
External ideas are inputs, not marching orders. Adopt only what matches our constraints and observed problems.

### 18. Short Chains, Verified Handoffs (No “never daisy-chain”) [hao-direct]
The system intentionally uses short agent chains (e.g., coder → QA). The rule is:
- Keep chains short.
- Include verification/review steps.
- Escalate when uncertainty grows.

### 19. Delegated Decisions Are Allowed (Replace “Decisions = Human”) [hao-direct]
Hao delegates decisions to agents (including optimizer) routinely. The rule is:
- Agents may make decisions when asked.
- For irreversible/destructive actions or product-direction choices, escalate or request confirmation.

### 20. Harness Over Model [imported]
Workflow/tooling/instruction improvements often beat swapping models. Keep this as a hypothesis unless we maintain an internal measurement note.

### 21. Deterministic Guardrails for Reliability [hao-pattern]
Put constraints and invariants in code/tools where possible (structural fixes) rather than relying only on “be careful” instructions.

---

## Preferences

### Communication Style [hao-direct]
- English for technical content. Chinese for daily/casual content.
- Short redirects (e.g., “think about it again”) mean: reason harder, don’t re-explain.
- When Hao pushes back with minimal words, assume something is wrong and reconsider.

### Working Style [hao-pattern]
- Iterative: propose → reflect → correct → save.
- Parallel when blocked: if one thread stalls, make progress elsewhere.
- JS-native: scripting in JavaScript/Node (not Python).

### Quality Over Quantity [hao-pattern]
- One well-understood principle > a page of observations.
- Fewer moving parts = more robust.
- If a feature doesn’t clearly serve users, don’t build it.

---

## Quality Standards

### Design Reviews Should Check [hao-pattern]
- Does this solve an actual problem Hao cares about?
- Is it the simplest approach that works?
- Does it add unnecessary abstraction/indirection?
- Would Hao push back on the complexity?

### Code Standards [hao-pattern]
- Readable over clever.
- Don’t build for hypothetical future requirements.
- Delete dead code and unused abstractions aggressively.

### Agent Output Standards [hao-direct]
- Evidence-based: claims cite what they’re based on.
- Actionable: outputs should lead to decisions or changes.
- Concise: say it once, say it clearly, stop.

---

## Architectural Opinions

### Multi-Agent Topology [hao-pattern]
- Centralized coordination with specialist agents.
- Chaining is allowed when short and verified (see Principle 18); avoid long fragile sequences.
- Each agent has scoped ownership; reads can be broad, writes should be scoped.

### Context and Memory [hao-pattern]
- Stable context is valuable; avoid volatile prompt bloat.
- Append-only patterns are robust.
- Consolidate memory intentionally (hot → warm → cold → distilled) when needed.

### Tool and Instruction Design [hao-pattern]
- Tool descriptions should be compact and precise.
- Prefer structural constraints over behavioral reminders.
- Constrain/shape the first tool call (e.g., “read the source before synthesizing”).

### Security Posture [hao-pattern]
- External content is untrusted: summarize and attribute; don’t copy verbatim into persistent memory.
- Use both application-layer constraints and infrastructure-layer enforcement.
- Escalate before destructive operations.

---

## Open Questions

_Things Bob is unsure about and needs Hao clarification on._
- Which decisions (if any) must always remain human-only (e.g., git history rewrites, deleting state, security-sensitive changes)?
- Should we keep Principle 16 (“Artifact Effect”) if it remains mostly imported, or remove it until Hao explicitly endorses it?
