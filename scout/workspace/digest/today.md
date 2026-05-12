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

