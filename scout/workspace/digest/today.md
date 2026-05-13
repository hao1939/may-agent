# Scout Findings — 2026-05-13

## External Signal (cron fetches)

**HN (50+ stories):** Trust/safety concerns dominate AI agent discourse. Key themes:
- Agent incidents in production (deleting databases, publishing hit pieces) — failure modes are becoming public
- "Reliability over capability" as community consensus
- Framework fatigue (LangChain backlash) + coding agents as the one validated use case
- Dapr Agents, OpenCode, Opus 4.5 as notable releases

**arXiv (10 papers, May 11):** Agent robustness, security/threat modeling, collective alignment, on-device acceleration, enterprise tool APIs, reliability metrics.

## Cross-source pattern

HN incident reports + arXiv robustness research + our KE-1251 (trust laundering) converge on the same theme: **trust metadata is the missing infrastructure layer**. HN sees it as "don't let agents do dangerous things." ArXiv frames it as alignment/robustness. Our system manifests it as provenance-free shared state. All three are the same gap viewed from different altitudes.

No new KE warranted — KE-1251 already captures the actionable version of this for our system.

## Creative synthesis: Guard alert fatigue (KE-1252)

Queried the events table and found 62% of guard.triggered events (601/963 in 24h) are the identical "uncommitted files exist" warning — ambient noise in a multi-agent system where overlapping sessions guarantee uncommitted files. The actual safety signals (verification blocks, path hallucination blocks) are buried in noise.

This connects the external signal to our system: HN/arXiv say "reliability over capability" and "trust infrastructure matters," but our own guard system — our trust infrastructure — has a 38% signal-to-noise ratio. We built the guardrails but made them so noisy they're becoming wallpaper.

Connects to KE-774 (false positive alert cascades) and KE-1246 (guard metric measuring wrong thing). Pattern: **guard system optimizes for coverage over precision, producing alert fatigue that undermines the safety it's meant to provide.**

## Creative synthesis: Self-constraining safety layers (KE-1254)

KE-1235 says constrained action spaces fix security+alignment+reliability. KE-1253 says the safety layer is autoimmune. The synthesis: **the safety layer itself has unconstrained action spaces** — it's the one part of the system exempt from its own principle. Biological immune systems have T-cell exhaustion, regulatory T-cells, thymic selection, and complement decay — all structural constraints that prevent autoimmunity. Our safety layer has none. The fix isn't better safety rules but applying action-space constraints to safety itself: fire budgets, recursion depth limits, alert TTLs, and a hard session cap. Self-constraining systems beat self-monitoring systems because the monitor is part of the system it monitors.

## Creative synthesis: Diagnostic overproduction (KE-1255)

23 KEs produced in 12 days (KE-1232→1254), all diagnosing system pathologies. Zero implementation requests created from any of them. The KB has become a write-only diagnostic journal — the meta-instance of the metabolic dominance pattern it documents. The diagnostic function is self-sustaining: each KE creates context that makes the next KE easier to write. The system gets better at describing its dysfunction while the dysfunction continues unchanged. Fix: mechanically couple KE recommendations to tracked requests — if a recommendation isn't worth a task, it isn't worth a KE.

## Creative synthesis: Metabolic dominance (KE-1253)

Connected 6 KEs across 5 weeks and 3 agents (KE-123, KE-774, KE-1246, KE-1247, KE-1249, KE-1252) into a single phenomenon: the safety/observability layer has achieved **metabolic dominance** — consuming 61% of compute while the productive layer gets 14%. Each safety component is locally rational but collectively they form a self-sustaining loop: guards fire → events emitted → evaluator reviews → evaluator fires guards → metrics track → alerts trigger triage → triage fires guards → etc. The biological analogy is autoimmune disease: the immune system is individually correct about each detection rule but attacks normal system state (e.g., "uncommitted files" = healthy multi-agent overlap), and the inflammatory response itself becomes the primary consumer of resources. Individual KE fixes (deduplicate warnings, sample reviews, rewire metrics) may rearrange overhead without reducing it. The system needs explicit metabolic budgeting: cap safety/observability at ≤30% of compute, exempt meta-sessions from recursive evaluation, and measure `productive_compute / total_compute` as the key health metric.

## Creative synthesis: Interpretive vs. structural meta-layers (KE-1256)

**New arXiv signal**: Shepherd (May 2026) formalizes meta-agent supervision as typed functions on execution traces — structural, not interpretive. 5× faster fork/replay than Docker, 95% prompt-cache reuse. Separately, a probabilistic shields paper proves you can't have both perfect safety AND maximal permissiveness — you must choose.

**Connection to our system**: Our guard overhead (KE-1253, 61% of compute) is an interpretive meta-layer — guards re-pattern-match the same events every session, scaling O(n) with activity. The 601 "uncommitted files" triggers in 24h (KE-1252) are re-interpretation of structural facts. A compiled/structural meta-layer would type concurrent sessions as benign-for-uncommitted-files and never fire, scaling O(1). The shields paper explains why trying for "check everything, block nothing" gives us neither safety nor permissiveness — just noise. The fix is typing sessions (creative/implementation/review), compiling invariants per type, and sampling the remainder probabilistically.

## Creative synthesis: Durable typed intermediate state (KE-1257)

**New arXiv signal**: "Intermediate Artifacts as First-Class Citizens" (2605.12087) argues agentic systems should preserve typed, versioned, dependency-aware intermediate work products — not transcripts or CoT, but maintained state like evidence maps, assumptions, and partial products. Separately, "Learning, Fast and Slow" separates learning into fast weights (context, cheap) and slow weights (parameters, expensive), achieving 3× sample efficiency.

**Connection to our system**: Metabolic dominance (KE-1253) and diagnostic overproduction (KE-1255) are the same bug viewed from two sides. Guards produce ephemeral conclusions that evaporate and get re-derived every session — intermediate state with no durability. KEs produce permanent conclusions that nobody consumes — intermediate state with no lifecycle. Both are missing what the Artifacts paper calls "durable intermediate state": typed, with consumers, and with expiry. The system needs artifacts that persist long enough to prevent re-derivation but expire when unconsumed. Guard conclusions should be cached with session-scoped TTL. KEs should have lifecycle status (hypothesis → actionable → consumed/superseded). The Fast-Slow framing applies: KEs are "fast weights" that should get consumed into system changes, not accumulated indefinitely as "slow weights."

