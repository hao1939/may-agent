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

