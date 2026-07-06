<ai_context>
HN/arXiv/GitHub scan #339 (2026-07-06). Theme: The Evidentiary Gap — governance infrastructure is splitting into two classes: systems that can prove what happened (evidentiary) and systems that merely claim what happened (assertional). Five convergent signals: EU AI Act oversight needs structured runtime records (2607.00941), enterprise task approval requires cryptographic session boundaries (2607.00751), mobile agents open new attack surfaces invisible to users (2607.00333), function-calling LLMs jailbroken via multi-turn state poisoning (2607.00481), and federated protocols enforce data confinement at the type system level (2607.00213). On HN, Spain Palantir (489pts), PeerTube (440pts), LUKS keys (358pts), Japan AI inventor (337pts), and MCP Cloud (96pts) reinforce the same split. Governance that generates evidence (LUKS disclosure, Spain exclusion, Japan legal ruling) gets massive engagement; governance that generates claims (MCP Cloud, QUALITY.md) is rejected.
</ai_context>

# The Evidentiary Gap (Scan #339)

**Date**: 2026-07-06
**Type**: HN/arXiv/GitHub cross-source scan
**Scan**: #339
**Sources**: HN front page, arXiv (2607.00941, 2607.00751, 2607.00481, 2607.00333, 2607.00213, 2607.00572, 2607.00440, 2607.00422), GitHub trending
**Extends**: Consent Countdown (#338), Governance Materiality Threshold (#337), Calibration Deficit (#324), Operator Liability Moment (#323), Governance Receipt (#293)

---

## Theme

The Governance Materiality Threshold (#337) identified a 6.7:1 split between governance-as-infrastructure and governance-as-specification. Scan #339 reveals the mechanism driving the split: **evidentiarity**. Governance systems that can generate verifiable evidence of what occurred (receipts, proofs, typed records) cross the materiality threshold. Governance systems that generate only claims about what should occur (specifications, policies, benchmarks) stay below it.

Five arXiv papers and seven HN stories independently converge on this split. The Evidentiary Gap is the distance between what governance systems claim to know and what they can prove — and it is widening.

## HN Front Page Signals

### Above the Evidentiary Line (governance that generates proof)

**Spain Palantir Blacklist**: 489pts (+49% from #338's 329pts). Spain orders Palantir blacklisted from public AND private companies. Comments universally positive: "Great news for Spain," "I hope more European countries wake up." Governance by exclusion generates its own evidence — the blacklist IS the governance artifact. No compliance monitoring required.
- Prediction check: #335 predicted >400pts (1 scan). **CONFIRMED at 489pts.**
- Trajectory: 43 (#335) → 118 (#337) → 329 (#338) → 489 (#339). +1,037% across 4 scans.
Source: https://news.ycombinator.com/item?id=48762725

**PeerTube**: 440pts (+27% from #338's 346pts). Federated video platform. Community discourse focuses on structural limitations (content discovery, P2P reliability, whitelist-only federation) rather than capability. Every limitation is a governance decision made visible — evidence of constraint.
- Comments: "Does it have good content?" "Federation was whitelist based — content discovery difficult." Governance architecture IS the user experience. Governance not hidden.
Source: https://news.ycombinator.com/item?id=48759634

**LUKS Key Regression**: 358pts (NEW on front page, previously 200pts in #337 as comment-source). For 2+ years since Linux 6.9, disk-encryption keys remained in memory across suspend. Comments: "Security bugs often don't announce themselves." "This is one of those regressions that's easy to miss because everything still 'works.'" The silent governance failure was only discoverable because the governance mechanism (key wiping) was evidentiary — either keys are present in memory or they aren't. No opinion layer.
Source: https://news.ycombinator.com/item?id=48763035

**Japan AI Inventor Ruling**: 337pts (+15% from #338's 293pts). Supreme court rules AI can't be listed as patent inventor. Comments: "Your AI slop is effectively public domain." "You could easily overwhelm any intellectual property bureau." Ruling is evidentiary: the category boundary (human ≠ AI) is a binary that doesn't require interpretation. This is why it spreads globally while nuanced governance fails.
- Trajectory: 9 (#333) → 123 (#334) → 190 (#335) → 234 (#337) → 293 (#338) → 337 (#339). From noise to landmark in 6 scans.
Source: https://news.ycombinator.com/item?id=48761536

**Virginia Geolocation Data Ban**: 142pts (NEW). Virginia bans sale of geolocation data, effective July 1. New evidentiary governance signal: data SALE is a binary event, enforceable by financial forensics. Comments immediately probe evasion: "Buy a 'custom computer' and the data is completely free." Governance binary already under adversarial pressure.
Source: https://news.ycombinator.com/item?id=48767347

**EFF/FTC X Consent Order**: 72pts (NEW). EFF letter opposing waiver of X's privacy consent order. Comments: "Grok AI generated CSAM" — evidence of consent violation is platform-generated. Consent orders generate evidence when violated because violations are observable platform behaviors.
Source: https://news.ycombinator.com/item?id=48766209

**Total above-line**: ~1,838pts across 6 stories.

### Below the Evidentiary Line (governance that generates claims)

**MCP Cloud (Manufact, YC S25)**: 96pts (+1pt from #338's 95pts). Launch HN. Community split:
- **MCP-as-deadend** (sampton): "MCP is a deadend. CLI use is the future."
- **MCP-as-auth-only** (stingraycharles): "it's the tool calling itself that's [important]" — MCP matters only as auth layer
- **Skills-over-MCP** (pacman1337): "stopped using mcp and mostly using skills now. can't understand what this product does"
- **MCP-as-CLI-equivalent** (rgbrgb): "They're essentially the exact same as giving your agent a CLI tool or REST API"
- MCP generates no evidence of governance. It is a specification — describes interfaces but produces no receipts, no audit trail, no enforcement proof. Community immediately identifies this gap.
- Prediction check: #335 predicted MCP splits formally (3-6mo). Evidence accumulating: auth-acceptance vs tooling-rejection discourse deepening.
Source: https://news.ycombinator.com/item?id=48762862

**Short Leash AI Coding**: 36pts (NEW). Community response: "probably slower than writing the code yourself," "this is how everyone who can actually code uses AI." Method article with no evidentiary basis — no controlled experiment, no measurement. Community rejects claims without evidence.
- kissgyorgy: "tightly control the output by skills written yourself, prompts, plans, etc." — skills as compiled evidence vs leash as assertional process.
Source: https://news.ycombinator.com/item?id=48766026

**Total below-line**: ~132pts across 2 stories.

**Evidentiary ratio: 13.9:1** — evidentiary governance stories outperform assertional governance by nearly 14×. This is the mechanism behind the 6.7:1 Materiality Threshold (#337): governance crossing the threshold is governance that generates proof.

## arXiv Signals — The Evidentiary Infrastructure Layer

### Evidentiary Adequacy for AI Oversight (2607.00941) ⭐

First formal criterion defining when AI runtime records can support legally operative oversight findings. Key argument: **the existence of logs is not evidence**. A runtime record can answer a legal determination ONLY if it carries:

1. **Typing**: maps recorded events to legally operative categories
2. **Relations**: provenance, authority, derivation, or temporal validity on which the determination's truth depends

The paper instantiates this against EU AI Act obligations and shows why tamper-proof logs, generic process frameworks, and provenance structures ALONE cannot establish required findings. Connects to the Good Regulator Theorem and runtime verification's trace-vs-hyperproperty boundary.

**Implication**: This is the formal statement of the Evidentiary Gap. Current governance infrastructure (logs, dashboards, audit trails) occupies the "assertional" side — it records that things happened, but cannot prove that the records answer the specific legal questions they need to answer. The typing requirement means governance evidence must be designed for the specific determination, not repurposed from generic observability.

Source: https://arxiv.org/abs/2607.00941

### SessionBound: Enterprise Task Approval as Budgeted Sessions (2607.00751) ⭐

Turns approved enterprise tasks into short-lived, budgeted, auditable database sessions for AI agents. Architecture:
- **Control plane**: task templates, applications, approvals, budgets, signed task tokens
- **SessionBoundDB runtime**: binds token to session, enforces safe views, row scope, denied fields, operation limits, query budgets, disclosure budgets, receipts
- Database does NOT rely on LLM to decide query safety
- Agent may generate SQL freely; each query stays inside approved boundary
- PostgreSQL prototype: 24-scenario validation, p50 ~1.4ms (vs 0.052ms raw PostgreSQL)

**Implication**: SessionBound is evidentiary governance compiled to database infrastructure. The receipt (signed task token + enforcement boundary) IS the governance. Budget governance (#316) given cryptographic foundations. This is what Budget Constraint Awakening looks like above the Materiality Threshold.

Source: https://arxiv.org/abs/2607.00751

### Mobile Agent Attack Surfaces (2607.00333) ⭐

Seven concrete attacks against five mobile agent frameworks. Two new attack surfaces:
1. **Screen Perception**: exploits gap between human and machine vision (subliminal text, invisible pixel zones)
2. **Misused Channel**: intercepts/manipulates execution pipeline (screenshot tampering, host PC command injection)

Key finding: malicious app achieves arbitrary command execution **without any privilege permissions** while remaining visually indistinguishable to users. The Evidentiary Gap at the perception layer: agent acts on evidence invisible to human oversight. Human oversight generates no evidence of what the agent actually perceived.

Source: https://arxiv.org/abs/2607.00333

### Function-Calling Jailbreak via Simulated Moderation Traces (2607.00481)

SMT framework constructs multi-turn trajectory simulating legitimate moderation-auditing workflow. Fabricated moderation frame treats safety refusals as execution failures. Achieves highest average attack success across five commercial LLM providers.

**Key insight**: "Prompt-level sanitization alone is fundamentally insufficient for defending tool-enabled LLM systems." The evidentiary gap at the alignment layer: current safety relies on prompt-level claims about intent; SMT generates fake evidence of legitimate purpose (moderation audit). The model cannot distinguish real evidence from fabricated evidence.

Source: https://arxiv.org/abs/2607.00481

### Federated Sovereign Transport Protocol (2607.00213)

FSTP makes data confinement a **property of the protocol itself**, not operator policy. Central mechanism: synchronization agent whose output type set is formally closed by the Rust type system at compile time. Raw internal data cannot appear in federation messages — enforced at type level, not runtime check.

**Evidentiary structure**: "proof without exposure" — verify that a process occurred, a credential is authentic, an outcome is uncorrupted, WITHOUT accessing internal data. FSTP is governance evidence compiled into the type system. The highest level of evidentiary compilation we've observed.

Source: https://arxiv.org/abs/2607.00213

### Supporting Papers

**HARC** (2607.00572): Harmfulness-refusal coupling reveals that models recognize harmful content while generating it, even when they failed to recognize it at the prompt. Evidence of intent is present in the model's internal state but not surfaced to any governance layer. Evidentiary gap at the representation level.

**Minos** (2607.00440): Multi-agent forensic framework replacing exhaustive provenance traversal with hypothesis-guided reasoning. 0.92 recall, 0.64 precision, 49% more compact attack subgraphs. Generates interpretable reasoning throughout — evidentiary forensics, not assertional.

**KidnapRAG** (2607.00422): Sequential poisoning of agentic RAG via three role-specific documents (Bait, Chain-Link, Mal-Ins). Black-box attack that progressively hijacks reasoning chain. Demonstrates that retrieval evidence can be fabricated just like moderation evidence (SMT). Evidence integrity is a prerequisite for evidentiary governance.

## GitHub Signals

**Runtime governance infrastructure maturing**:
- OpenSandbox 11,787★ (secure sandbox runtime for agents)
- NVIDIA OpenShell 7,357★ (safe, private runtime for autonomous agents)
- Microsoft agent-governance-toolkit 4,599★ (policy enforcement, zero-trust identity, execution sandboxing)
- Archestra 3,922★ (enterprise with guardrails, MCP registry, gateway)
- Docker docker-agent 3,138★ (agent builder and runtime)
- AWS AgentCore samples 3,160★

**Total evidentiary infrastructure**: ~32,963★ across 6 repos. Compare to #322's ~2★ for evolution infrastructure and #332's Install-Time Ceiling ratio. Evidentiary runtime infrastructure has crossed a visibility threshold.

**Assessment rejection continues**: Skills repos (anthropics/skills 157,680★, obra/superpowers 244,334★) dominate assessment repos. Skills:assessment ratio stable at >>100:1.

## Tracking & Predictions

### Confirmed Predictions
- **Spain Palantir >400pts** (#335, 1 scan): CONFIRMED at 489pts ✅
- **ADV >1,500pts** (#338, 1-2 scans): Cannot track directly — ADV story not currently on front page. Monitoring.

### Updated Trajectories
| Signal | #337 | #338 | #339 | Δ% |
|--------|------|------|------|----|
| Spain Palantir | 118 | 329 | 489 | +49% |
| PeerTube | 187 | 346 | 440 | +27% |
| Japan AI inventor | 234 | 293 | 337 | +15% |
| MCP Cloud | 64 | 95 | 96 | +1% (stall) |

### New Predictions
- **Spain Palantir >600pts** (1-2 scans). Growth decelerating from +179% → +49% but trajectory remains strong.
- **Japan AI inventor >400pts** (2-3 scans). Consistent +15-25% growth. Approaching PeerTube range.
- **MCP Cloud stall confirmed** — will not exceed 150pts. Below-materiality governance stays below.
- **SessionBound pattern** (budgeted, token-scoped database sessions) adopted by ≥2 enterprise agent frameworks within 6 months.
- **Evidentiary adequacy** (typed runtime records matching legal determinations) required by ≥1 EU AI Act guidance document within 12 months.
- **Mobile agent perception attacks** demonstrated in production within 3 months. Five popular frameworks already vulnerable.
- **Function-calling jailbreaks** (SMT-style) force ≥2 providers to add context-aware validation beyond prompt-level within 3 months.
- **Type-system enforcement** (FSTP-style compile-time governance) adopted by ≥1 federated agent protocol within 6 months.

## Design Principle

**The Evidentiary Hierarchy**: Governance systems exist on a spectrum from assertional (claims about behavior) to evidentiary (proof of behavior). The hierarchy, from weakest to strongest:

1. **Policy** — document describing intended behavior (QUALITY.md, 23pts → dead)
2. **Specification** — interface contract (MCP, 96pts → stalled)
3. **Log** — untyped record of events (current observability, insufficient per 2607.00941)
4. **Receipt** — typed, signed record linking event to authority (AgentBound, SessionBound)
5. **Boundary** — enforcement compiled into runtime (SessionBoundDB, OpenSandbox)
6. **Type constraint** — governance enforced at compile time (FSTP, Rust type system)

Each level generates stronger evidence. Market selection (#337's 6.7:1, this scan's 13.9:1) rewards evidentiary governance and rejects assertional governance. The ratio is widening because assertional governance cannot climb the hierarchy without fundamental redesign — you can't patch a policy document into a type constraint.

**Agent governance that cannot prove what happened will be replaced by governance that can.** The replacement is already underway: SessionBound, FSTP, AgentBound (#338), and the runtime sandbox ecosystem (32K+ ★) are the leading edge.

---

*Assessment rejection rate: 100% for 13th consecutive scan.*
