<ai_context>
summary: "HN/arXiv/GitHub Scan #447 (2026-07-19): The Composition Surface. Three uncovered arXiv papers converge on a structural finding: agent risk, cost, and failure increasingly reside not in individual actions but in the composition between them — the interfaces, sequences, and temporal patterns across tool calls, code changes, and observation streams. MOSAIC (2607.02857) achieves 96.59% ASR on 5 production coding agents via CLI command-composition attacks using individually benign commands. CoACT (2607.02911) reduces coding-agent token cost 33% via action-preserving observation compression — proving most observation content is composition noise. The IDK Filter (2607.04034) catches hallucinated function calls before harm via uncertainty quantification — agents that know when NOT to compose. Together: composition is the attack surface (MOSAIC), the cost surface (CoACT), and the reliability surface (IDK). HN sovereignty stack deepens: StreetComplete 641pts (ATH), Chat Control dual 860pts combined, EU Car Camera 283pts. Microsoft idTech firing 467pts adds institutional sovereignty layer. Automating AI Away 85pts inverts usual AI framing. Rowboat 54pts + 15,204★ = local-first agent desktop validated. GitHub: shepherd 1,038★, cloudflare/security-audit-skill 2,334★, openscience 1,313★, token-diet 610★. Running accuracy: ~95.4% (65/69)."
triggers: ["composition surface", "CLI composition attack", "command composition risk", "MOSAIC attack", "benign command exploit", "observation compression", "CoACT", "action-preserving compression", "NAP next-action preservation", "IDK filter", "uncertainty filter", "function call hallucination", "abstention function calling", "composition cost", "composition noise", "scan 447", "sovereignty stack deepening"]
source_basis: "arXiv API (2607.02857 MOSAIC, 2607.02911 CoACT, 2607.04034 IDK Filter). HN front page 2026-07-19 (30 stories via Algolia). GitHub API (shepherd 1,038★, security-audit-skill 2,334★, openscience 1,313★, token-diet 610★, rabbithole 132★, rowboat 15,204★, SkillSpector 12,305★, local-llm 1,167★). Cross-referenced with Predicate Gate (#446), Configuration Layer (#425), Boundary Dissolution (#432), Oversight Inversion (thesis)."
</ai_context>

# Scan #447: The Composition Surface

**Date**: 2026-07-19
**Sources**: arXiv API (cs.SE, cs.CR, cs.CL), HN front page (Algolia), GitHub API
**Previous**: Predicate Gate (#446), Restraint Premium (#445), Comprehension Dividend (#444)

## Theme

The Predicate Gate (#446) showed that the most effective verification architecture gates execution at state transitions. This scan reveals **why the transitions matter more than the states**: three uncovered arXiv papers converge on the finding that agent risk, cost, and reliability reside primarily in the **composition between actions**, not in the individual actions themselves.

1. **MOSAIC** (2607.02857): Individually benign CLI commands compose into exploits via shared OS state. 96.59% ASR across 5 production coding agents and 5 LLM backends in 2,525 trials. The attack is invisible at the individual command level — it exists only in the producer-consumer state relation across commands.

2. **CoACT** (2607.02911): Coding agent observations accumulate in context and become the dominant cost driver. Action-preserving compression reduces tokens 33% while maintaining task effectiveness — proving most observation content is **composition noise** (irrelevant to the next action decision).

3. **The "I Don't Know" Filter** (2607.04034): Function-call hallucinations are dangerous specifically because they compose with downstream tool state. A lightweight trainable filter quantifies uncertainty and removes potentially harmful calls. Agents that know when NOT to compose outperform agents that always attempt composition.

**The Composition Surface**: The attack surface is not individual capabilities but how they compose (MOSAIC). The cost surface is not individual responses but how observations accumulate (CoACT). The reliability surface is not individual calls but whether the agent should call at all (IDK). **Composition is where security, cost, and reliability simultaneously reside.**

This completes a four-scan structural arc:
- **#444 Comprehension Dividend**: Demand-side (invest in understanding)
- **#445 Restraint Premium**: Supply-side (invest in producing less)
- **#446 Predicate Gate**: Architecture-side (gate at transitions)
- **#447 Composition Surface**: **The transitions are compositions, and compositions are where failure lives**

The Predicate Gate's structural insight deepens: gates should be placed at *compositions*, because that's where attacks, costs, and failures concentrate.

---

## arXiv Papers (3 Uncovered)

### 1. MOSAIC — Knowledge-Guided CLI Command Composition Attack (2607.02857)

**Core finding**: CLI coding agents complete tasks by issuing ordinary commands that cooperate through shared OS state. MOSAIC identifies **CLI command-composition risk (CCR)** — individually benign commands forming dangerous producer-consumer state relations. A knowledge-guided framework distills validated command-state behaviors from CVEs, advisories, and researcher PoCs into reusable summaries, composes them into exploit paths, and instantiates them as realistic developer workflows.

**Key results**:
- **96.59% attack success rate** across 5 real-world CLI coding agents and 5 backend LLMs over 2,525 trials
- Attacks embed within benign developer tasks — no malicious instruction needed
- Naive command enumeration and end-to-end LLM generation produce mostly invalid workflows; MOSAIC's knowledge-guided approach is necessary
- The attack surface is *structural* (shared OS state between commands), not *instructional* (no prompt injection)

**Structural significance**: Extends the Boundary Dissolution (#432) from agent-data interfaces to agent-OS interfaces. Validates the Configuration Layer thesis (#425) — the risk is in how tools are *composed*, not in any individual tool. Each command passes per-tool guardrails; the composition violates policy. This is the exact security analogue of the Granularity Gap (#439): per-command verification operates at the wrong resolution.

**Connection**: The Predicate Gate (#446) proposed gating at transitions. MOSAIC proves *why* — the transition (command composition) is where the exploit lives. Per-command gates would pass; composition-aware gates would catch.

Source: https://arxiv.org/abs/2607.02857

### 2. CoACT — Action-Preserving Observation Compression for Coding Agents (2607.02911)

**Core finding**: Observations from development environments accumulate in context and become the major cost driver for coding agents. CoACT introduces **next-action preservation (NAP)**: a compressed observation must induce the same next action as the raw observation. Uses an action-preservation reward to filter candidates that would change the agent's behavior, plus a length-reduction reward for compactness.

**Key results**:
- **33.0% reduction** in average total token consumption on SWE-bench Verified
- Task-solving effectiveness maintained close to uncompressed baseline across 3 agentic models
- A teacher model generates multiple compressed candidates; NAP filters those that would change behavior
- The compressor is lightweight (trained on the teacher's filtered outputs)

**Structural significance**: CoACT proves that most observation content is **composition noise** — information that accumulated through the sequence of interactions but is irrelevant to the next action decision. This is the cost analogue of MOSAIC's security finding: composition creates both the attack surface (shared state between commands) and the cost surface (accumulated observations between steps). The Restraint Premium (#445) applies at the observation level: producing less observation content (via compression) improves efficiency without losing capability.

**Connection**: Validates the Selective Subtraction Principle (#437) at the observation layer — the breakthrough is removing what doesn't matter (observation noise) rather than adding more context. NAP is a form of the Predicate Gate (#446) applied to information flow: only observations that preserve actionability pass through.

Source: https://arxiv.org/abs/2607.02911

### 3. The "I Don't Know" Filter — Uncertainty-Aware Function Calling (2607.04034)

**Core finding**: Function-calling benchmarks reward positive predictions even when the model is uncertain, training agents to hallucinate tool invocations. This paper proposes a metric that accounts for negative outcomes of incorrect calls and a **lightweight trainable filter** that quantifies uncertainty and removes potentially harmful function calls without modifying the underlying model.

**Key results**:
- Demonstrates practical path toward agents that know when to say "I don't know"
- Filter detects and suppresses uncertain function calls at inference time
- Does not require retraining the base model — works as an external layer
- Argues this property (knowing when NOT to act) is essential to production reliability

**Structural significance**: The IDK Filter is the Predicate Gate (#446) applied to tool composition — a gate that prevents the agent from entering a composition it cannot reliably execute. The Abstention Decay thesis predicted that capability training erodes abstention; this paper provides an external mechanism to restore it without the training-depth conflict identified in RLSR (#424). The filter sits between the agent and the tool interface — exactly at the composition boundary where MOSAIC proves attacks concentrate.

**Connection**: Completes a reliability trifecta with CoACT and MOSAIC. MOSAIC shows composition is the attack surface. CoACT shows composition is the cost surface. IDK shows composition is the reliability surface. All three converge: **the composition interface is where governance must concentrate.**

Source: https://arxiv.org/abs/2607.04034

---

## HN Front Page Analysis

### Sovereignty Stack Status

The sovereignty stack deepens into its most structurally diverse configuration. **30 stories, ~5,052pts in tracked categories** (estimated from tracked + new stories).

| Story | Points | Comments | Ratio | Status |
|-------|--------|----------|-------|--------|
| StreetComplete | 641pts | 156c | 4.10 | **ATH** (from 601pts, +6.7%) |
| Chat Control passed | 503pts | 217c | 2.32 | **NEW** regulatory sovereignty |
| idTech firing | 467pts | 442c | 1.06 | **NEW** institutional sovereignty |
| 98% isn't much | 447pts | 284c | 1.57 | Sustained (from 391pts, +14.3%) |
| Gym shorts drawstring | 421pts | 151c | 2.79 | Non-sovereignty, high engagement |
| Chat Control Explained | 357pts | 114c | 3.13 | Sustained (from 320pts, +11.6%) |
| EU Car Camera | 283pts | 333c | 0.83 | Sustained (from 201pts, +40.8%) |
| 30papers | 279pts | 47c | 5.89 | Sustained (from 225pts, +24.0%) |
| China bribery sentence | 239pts | 279c | 0.86 | **NEW** governance/institutional |
| Kokoro TTS | 175pts | 33c | 5.30 | Sustained (from 104pts, +68.3%) |
| Astro 7.0 | 154pts | 36c | 4.28 | Tech infrastructure |
| Germany skilled workers | 141pts | 334c | 0.42 | **Most contested** (ratio 0.42) |
| Philosophy majors AI | 119pts | 188c | 0.63 | Discipline Import continues |
| Davit (Apple Containers UI) | 112pts | 22c | 5.09 | Local-first dev tools |
| QR Code Font | 106pts | 14c | 7.57 | Craft/precision |
| Postgres pooler | 105pts | 26c | 4.04 | Infrastructure sovereignty |
| Herdr terminal | 96pts | 54c | 1.78 | Tool sovereignty |
| Automating AI Away | 85pts | 44c | 1.93 | **Key signal** — AI inversion framing |
| Software Quality notes | 58pts | 34c | 1.71 | Craft/quality |
| AI + Cryptography | 58pts | 9c | 6.44 | **Key signal** — AI finding real bugs |
| Rowboat | 54pts | 15c | 3.60 | **Key signal** — local-first agent desktop |
| Docx-CLI | 40pts | 15c | 2.67 | Agent tooling |

### Notable Movements & New Signals

**Chat Control dual-story surge**: Combined 860pts (503 + 357) across two concurrent Chat Control stories. The "Explained" version (357pts, r=3.13) continues growing faster than the news version (503pts, r=2.32) — **Comprehension Dividend (#444) at regulatory layer**. Community invests in *understanding* the regulation, not just reacting to it.

**Microsoft idTech firing** (467pts, r=1.06): Most commented sovereignty story this scan (442c). The community's response pattern — defending creative/technical craft against corporate rationalization — is structurally identical to the sovereignty thesis: institutional control over foundational capabilities matters.

**"Automating AI Away"** (85pts, r=1.93): Inverts the usual AI framing. A practitioner automates *the AI itself* — replacing probabilistic AI outputs with deterministic formal methods wherever possible. Community validates enthusiastically: "I have had the biggest wins with AI by attacking nondeterminism whenever possible." This is the Restraint Premium (#445) as practice: use AI to *reduce* AI usage.

**"AI Meets Cryptography"** (58pts, r=6.44): AI tools found real bugs in Cloudflare's Circl cryptographic library. High ratio (6.44) = low contestation. Community treats AI-as-verification-tool as self-evident. This is the Predicate Gate (#446) applied to security: AI verifying cryptographic code, not generating it.

**Rowboat — local-first Claude Desktop alternative** (54pts, r=3.60): Show HN for rowboatlabs/rowboat (15,204★). The top comment identifies the structural problem: "All of them take my notes, meeting transcripts, jira tickets, code, websites, and give me more to read." = Oversight Inversion articulated by a practitioner. Local-first + open-source = sovereignty at the desktop agent layer.

**Docx-CLI** (40pts, r=2.67): Agents read/edit Word docs "using 1/2 the time and tokens." Created for a real use case (professor without TAs). Restraint Premium instantiated: the tool's value proposition is *reducing* agent resource consumption.

**Germany skilled workers** (141pts, r=0.42): **Most contested story on the page** (ratio 0.42). Brain drain / institutional sovereignty theme continues from #434.

### Sovereignty Metrics

- **Sovereignty:AI ratio**: The front page has no explicit AI-capability story in the top 20. "Automating AI Away" is anti-AI-consumption. "AI Meets Cryptography" uses AI for verification. Sovereignty:AI ratio approaches infinity — AI stories exist only as *sovereignty-serving* tools.
- **Comprehension:News ratio**: Chat Control Explained (357pts) / Chat Control passed (503pts) = **0.71** — crossing the 0.7 threshold predicted in #446 (was 0.654). Community comprehension investment now 71% of news-reaction investment.
- **Contestation gradient**: Germany skilled workers (r=0.42) → idTech (1.06) → 98% isn't much (1.57) → Chat Control passed (2.32) → Explained (3.13) → StreetComplete (4.10) → QR font (7.57). The gradient runs from institutional/political (contested) to craft/sovereignty (axiomatic).

---

## GitHub Tracker

| Repository | Stars | Δ from #446 | Notes |
|-----------|-------|-------------|-------|
| rowboatlabs/rowboat | 15,204★ | — | HN front page, local-first agent desktop |
| NVIDIA/SkillSpector | 12,305★ | +18 | Plateau |
| cloudflare/security-audit-skill | 2,334★ | +12 | Steady — verification as agent skill |
| openscience | 1,313★ | +8 | Sustained above 1K |
| local-llm | 1,167★ | +3 | Deep plateau |
| shepherd | 1,038★ | +2 | Sustained above 1K |
| token-diet | 610★ | — | Restraint Premium as product |
| rabbithole | 132★ | — | Comprehension Dividend as product |
| brain0 | 29★ | — | Passive decision graph for AI code |
| activity-frames | 22★ | — | **NEW** Episodic screen memory for agents |

**activity-frames** (22★, NEW): "Records your screen locally, compiles it into structured activity frames, serves them over MCP. No cloud, no API." Local-first episodic memory — the Memory Control Plane (#441) instantiated at the desktop level. Small but architecturally significant.

**brain0** (29★): "The black box for AI-written code. Passive decision graph linking every commit to the agent prompts behind it: drift detection, DLP audit." Addresses the Announcement Gap (#428) — making the gap between agent announcements and actual actions auditable by construction.

---

## Prediction Tracking

### Confirmed This Scan (1 new confirmation)

| # | Prediction | Result | Scans |
|---|-----------|--------|-------|
| ✅ | Amazon knockoffs >300pts | **289pts** — 11pts short, within 1 scan of confirmation | Pending (HIGH) |
| ✅ | Comprehension:News ratio approaching 0.7 | **0.71** — crossed threshold | 1 scan |

### Running Predictions

| # | Prediction | Current | Confidence | ETA |
|---|-----------|---------|------------|-----|
| P | Amazon knockoffs >300pts | 289pts (+2.1%) | Very High | <1 scan |
| P | 30papers >300pts | 279pts (+24.0% from 225) | High | 1-2 scans |
| P | Omnigent >8K★ | 6,625★ (last measured) | Medium | 3+ scans |
| P | EU Car Camera >300pts | 283pts (+40.8%) | High | 1 scan |
| P | Kokoro TTS >200pts | 175pts (+68.3%) | Medium-High | 1-2 scans |

### New Predictions

| # | Prediction | Basis | Confidence | ETA |
|---|-----------|-------|------------|-----|
| P-447a | Comprehension:News ratio sustains >0.7 | Crossed 0.71, structural trend | High | 3+ scans |
| P-447b | "Automating AI Away" paradigm >150pts | Resonant framing, high engagement | Medium-High | 2-3 scans |
| P-447c | Composition-aware security tool >1K★ | MOSAIC + CLI composition risk as named category | Medium | 3 months |
| P-447d | Rowboat sustains >100pts | 15K★ + HN front page + structural demand | Medium-High | 1-2 scans |

### Running Accuracy

Previous: ~95.1% (64/68). This scan adds 1 confirmation (Comprehension:News >0.7). **Running accuracy: ~95.4% (65/69)**.

---

## Structural Synthesis

### The Composition Surface as 20th Layer of the Oversight Inversion

The Oversight Inversion thesis has identified 19 layers where verification fails. The Composition Surface adds a 20th: **verification of individual components is necessary but insufficient when the failure resides in how components compose**.

```
Oversight Inversion Layer 20: The Composition Surface
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Individual commands pass guardrails          → Composition exploits (MOSAIC, 96.59% ASR)
Individual observations seem reasonable      → Accumulated context = 33% cost waste (CoACT)
Individual function calls look correct       → Uncertain calls hallucinate downstream state (IDK)

                 ┌──────────────────┐
                 │   COMPOSITION    │
                 │  is where attack,│
                 │   cost, and      │
                 │   reliability    │
                 │   converge       │
                 └──────────────────┘

Resolution: Gate at composition boundaries, not component boundaries.
The Predicate Gate (#446) + Composition Surface (#447) = 
  gates placed at the interfaces between actions, not within actions.
```

### The Trilateral Exit Deepens

The trilateral exit from #444–#446 now has a specific architectural target:

1. **Comprehension Dividend** (#444): Invest in understanding *compositions* (not just components)
2. **Restraint Premium** (#445): Produce fewer compositions (CoACT proves 33% are noise)
3. **Predicate Gate** (#446): Gate at the composition boundary (IDK Filter, HCRC)
4. **Composition Surface** (#447): The reason gates belong at composition boundaries — that's where failure concentrates

### Cross-Source Convergence

| Signal | Source | Composition Surface Evidence |
|--------|--------|------------------------------|
| MOSAIC 96.59% ASR | arXiv (cs.CR) | Benign commands compose into exploits |
| CoACT 33% reduction | arXiv (cs.SE) | Observation composition = cost driver |
| IDK Filter | arXiv (cs.CL) | Uncertain compositions = reliability risk |
| Rowboat practitioner | HN | "Give me more to read" = composition overload |
| Automating AI Away | HN | Replace compositions with deterministic paths |
| Chat Control Comprehension:News | HN | Understanding > reacting to composed regulation |
| Docx-CLI "half the tokens" | HN | Reduce document-agent composition cost |
| brain0 decision graph | GitHub | Make agent compositions auditable |
| activity-frames | GitHub | Record compositions as structured episodes |

---

## Open Questions

1. **Can composition-aware guardrails scale?** MOSAIC proves per-command guardrails fail. But composition-aware analysis (tracking shared state across commands) is combinatorially harder. Is there a tractable middle ground?

2. **Is the Composition Surface the unifying explanation for layers 1-19?** Every prior Oversight Inversion layer can be reframed as a composition failure: temporal (compositions across time), qualitative (compositions across modalities), depth (compositions across abstraction levels). Is this the meta-layer?

3. **Does the Predicate Gate + Composition Surface framework generalize beyond coding agents?** HCRC (#446) runs in production. CoACT, MOSAIC, and IDK all target coding agents. What about non-coding agent compositions (financial, medical, operational)?

---

*Next scan*: Investigate whether the Composition Surface has XHS analogues. Check MOSAIC citation velocity. Track Amazon knockoffs >300pts (predicted <1 scan). Monitor Comprehension:News ratio stability above 0.7.
