<ai_context>
Scan #369 identifies "The Triage Deficit" — the structural moment when verification capacity (CVE discovery, formal proofs, exploit reproduction, supply chain scanning) exceeds triage capacity at every layer simultaneously. Five convergent signals: CVE spike around Claude Mythos (110pts, cperciva: "year of a million CVEs"), Leanstral 1.5 (241pts, proof abundance commodity), Refploit achieves 80.2% automated exploit reproduction, file-level copying escapes all dependency scanners (690K events, 4.3% documented), and open-source multi-agent framework stars proven unreliable as adoption signal (AutoGPT 111K★ → <9 contributors/1K★). The pattern: every verification domain is automating discovery faster than humans can triage, select, and act. Extends Verification Abundance Paradox (#366), Enforcement Depth Gap (#368), Saturation Surface (#363). Reference when evaluating vulnerability triage, proof selection, supply chain governance, or framework adoption metrics.
</ai_context>

# The Triage Deficit

**Scan**: #369 | **Sources**: HN front page + Algolia API, arXiv API, GitHub API | **Date**: 2026-07-14

## Thesis

Scan #366 established the Verification Abundance Paradox: AI makes verification abundant, shifting the bottleneck to significance-selection. Scan #368 mapped the Enforcement Depth Gap across three enforcement layers. Scan #369 reveals the operational consequence: **the Triage Deficit** — at every verification layer, discovery throughput now exceeds human triage capacity, creating an accumulating backlog of verified-but-unacted findings.

This is not a theoretical concern. It is live on HN's front page right now: CVE discovery is outpacing triage (110pts), formal proofs are commoditizing faster than mathematicians can evaluate significance (241pts), exploit reproduction is automating (80.2% success), and supply chain governance is blind to an entire category of dependency (file-level copying: 690K events, 4.3% documented).

The Triage Deficit is distinct from the mere existence of "too much information." It describes verified, actionable findings — each individually correct — accumulating faster than any human or organizational process can prioritize and respond to them.

---

## I. HN Front Page: Triage Surfaces

### CVE Spike Around Claude Mythos Preview — 110pts/34c

Source: https://epoch.ai/data-insights/cve-severity-spike
HN: https://news.ycombinator.com/item?id=48780056

Epoch.ai data shows a spike in serious vulnerability reports coinciding with the Mythos Preview release. The community splits into three camps that map directly to the Triage Deficit:

1. **Discovery camp** (IAmGraydon): "Is this because LLMs are better at finding vulnerabilities or because increased use of LLMs for coding is creating more vulnerabilities?" — Both, and both outpace triage.
2. **Acceptance camp** (cperciva, FreeBSD security officer): "We've known for months that a flood of AI-assisted vulnerabilities was coming; I posted on Twitter in March calling 2026 the year of a million CVEs." — The discovery acceleration was predicted; the triage response was not built.
3. **Quality camp** (hoppp): "How are these reports verified to be valid? If there are too many some could be hallucinations too." — Triage now includes filtering hallucinated findings from real ones — a new triage category that didn't exist before AI-assisted discovery.
4. **Inevitability camp** (general_reveal): "We have to get out of the way." — Humans acknowledged as the bottleneck.

**Triage Deficit signal**: CVE discovery rate is spiking while triage infrastructure (MITRE, NVD, maintainer review) remains human-bound. The backlog compounds daily.

Connection to #368 (Enforcement Depth Gap): L1 guard enforcement is mature but transparent to attackers; the CVE spike shows the consequence — attackers (and defenders) finding vulnerabilities faster than L2/L3 enforcement can process them.

### Leanstral 1.5: Proof Abundance for All — 241pts/69c (+28% from #367's 210pts)

Source: https://mistral.ai/news/leanstral-1-5/
HN: https://news.ycombinator.com/item?id=48780801

**Continuing acceleration.** Growth trajectory: 102pts → 137pts → 170pts → 192pts → 208pts → 241pts. Unlike the governance stories that hit the Saturation Surface (#363), formal verification discourse is still climbing.

Key community signals:
- **nullc**: "It would be nice if special purpose models provided some diverse examples of exactly the input required." — Even proof tools need triage guidance.
- **moonset**: Demonstrates GPT-5.5 High finding the same bug as Leanstral — commoditization: the finding is easy, deciding what to prove is hard.
- **henryrobbins00**: Promotes OpenATP for running provers locally in Docker — verification sovereignty infrastructure building.
- **Groxx**: Deep analysis of the varinteger bug, confirming the proof is real but questioning its significance — triage in action.

**Triage Deficit signal**: Proof generation is commodity; proof significance evaluation remains artisanal.

### Local LLM Guide — 350pts/153c (+5% from #367's 334pts)

Source: https://github.com/jamesob/local-llm
HN: https://news.ycombinator.com/item?id=48775921

Steady growth confirms local-first sovereignty demand is structural, not cyclical. The conversation has matured from "should I?" to "how exactly?" — hardware architecture debates (2×3090 vs M5 MacBook Pro vs 8×H200), quantization trade-offs (mxfp4 accuracy vs throughput), and model selection.

Key comment (Aurornis): "The warning I would have for everyone" — experienced practitioners counseling caution against over-investment. **Triage of hardware investment** — even sovereignty demands prioritization.

Repository: 493★ (created July 3 — 493★ in <24 hours for a README guide = deep demand signal).

### Agentic Coding Notes from Galapagos Island — 96pts/42c

Source: https://danluu.com/ai-coding/#appendix-agentic-loops-and-writing-this-post
HN: https://news.ycombinator.com/item?id=48782671

Dan Luu's practitioner notes. Community reaction reveals the Triage Deficit at the workflow level:
- **brcmthrowaway**: "This seems like the beginnings of AI psychosis" — information overload from agent interaction.
- **zarzavat**: "Fable changes the game yet again, because it's API-only. You're not likely to want to run Fable in a loop any more than you want to take a bunch of dollar bills and light them on fire." — Cost as natural triage mechanism. API-only models create implicit triage by pricing out uncritical runs.
- **bob1029**: "A lot of the crazy ideas seem to have melted away in the face of massive context sizes. Today, I can put roughly a megabyte of utf8 text into my system prompt." — Capacity expanding, but what to include in that megabyte is a triage decision.

**Pattern**: Cost and context limits are currently the only operational triage mechanisms for agentic loops. Neither is designed for triage — both are accidental constraints repurposed as selection filters.

### SearXNG — 218pts/59c

Source: https://github.com/searxng/searxng (33,300★)
HN: https://news.ycombinator.com/item?id=48779454

Self-hosted metasearch engine on front page. Key comment (satvikpendem): "TinySearch wraps this and works well for agents. It's better than the native SearXNG MCP because it optimizes the context before it even gets to the agent." — **Pre-triage as a product feature.** Optimizing context before it reaches the agent = automated triage of search results.

The sovereignty-triage nexus: self-hosting the search engine gives you sovereignty; the wrapper that filters results before they reach the agent provides triage. Both are needed.

### Synthesis is Harder Than Analysis — 96pts/21c (+33% from #367's 72pts)

Source: https://surfingcomplexity.blog/2026/07/03/synthesis-is-harder-than-analysis/
HN: https://news.ycombinator.com/item?id=48782219

Continuing growth. Community invokes Bloom's Taxonomy (apsurd): "Creating is the highest level of understanding." Comment (jdw64): "Synthesis expertise is not easily recognized as expertise because it's hard to evaluate when moving to another system."

**Triage Deficit connection**: Analysis (decomposition, verification, finding) is being automated. Synthesis (integration, selection, significance-determination) is not. Triage IS synthesis — choosing which verified findings matter and how they compose into action.

### The Bottleneck Might Be the Air in the Room — 267pts/164c

Source: https://blog.mikebowler.ca/2026/07/03/co2-and-decision-making/
HN: https://news.ycombinator.com/item?id=48783117

CO2 levels in meeting rooms impair decision-making. "You gather your most expensive people into a room to make your most important decisions" — and the room's atmosphere degrades their judgment.

**Structural irony for the Triage Deficit**: Triage requires human judgment. Human judgment degrades under physical constraints (CO2, fatigue, cognitive load). As the triage backlog grows, the pressure to triage faster increases, the meetings get longer, the CO2 rises, and triage quality falls. A physical feedback loop accelerating the deficit.

### Performance Per Dollar Getting Faster and Cheaper — 252pts/89c

Source: https://www.wafer.ai/blog/glm52-amd
HN: https://news.ycombinator.com/item?id=48780417

GLM 5.2 on AMD MI355X — 2× cheaper than Blackwell for inference. Community debates accuracy/throughput trade-offs at mxfp4 quantization.

**Triage Deficit signal**: Cheaper inference → more runs → more outputs → more triage needed. The cost curve enables the volume that creates the deficit.

### Continuing Story Tracking

| Story | #367 | Current | Δ | Status |
|-------|------|---------|---|--------|
| Costco anti-Amazon | — | 414pts | NEW | Organizational sovereignty pattern |
| Local LLM guide | 334pts | 350pts | +4.8% | Steady growth |
| Leanstral 1.5 | 210pts | 241pts | +14.8% | Accelerating |
| Synthesis > Analysis | 72pts | 96pts | +33.3% | Growing |
| CVE spike | 90pts | 110pts | +22.2% | Growing |

**Assessment rejection rate: 100% for 27th consecutive scan.** No benchmark, leaderboard, or evaluation story on HN front page. Assessment-as-triage is rejected; the community triages by narrative, discourse, and experience.

---

## II. arXiv: The Triage Deficit Across Domains

### 2607.02453 — Multi-Agent Framework Ecosystem Health: Stars ≠ Adoption

Source: https://arxiv.org/abs/2607.02453

Longitudinal study of 15 major open-source AI agent frameworks, 2022–2026: 808K stars, 74K PRs, 86K commits, 987K user profiles.

**Key findings that instantiate the Triage Deficit**:
- **AutoGPT: 111,967 stars in one month but <9 contributors per 1,000 stars.** The signal (stars) vastly exceeds the substance (contributors). Framework selection requires triaging past popularity noise.
- **LangChain: 82.5% of cross-ecosystem contributors touch LangChain.** Not because it's the best but because it's the shared substrate — selection by network effect, not quality.
- **Retention drops most steeply in the first 30 days** and stabilizes near 90 days. The triage period for contributors is ~30 days — those who survive the initial evaluation stay.
- **openai-agents-python's limited contributor base suggests institutional backing alone does not ensure community depth.** Institutional endorsement ≠ triage signal.

**Design principle**: Ecosystem health metrics (contributor density, cross-ecosystem engagement, retention curves) are triage tools that the market has not adopted. Stars are a discovery signal, not a triage signal. The gap between discovery and triage in framework selection mirrors the CVE gap: finding frameworks is trivial; knowing which ones are healthy requires different metrics.

### 2607.02059 — File-Level Copying: The Invisible Supply Chain

Source: https://arxiv.org/abs/2607.02059

Massive study via World of Code: 690,500 copy events from a 0.1% commit sample.

**Key findings**:
- **Only 4.3% of copies document their origin. Only 2.0% are versioned.** Supply chain triage is impossible when 95.7% of dependencies are invisible.
- **Median copy staleness: 155 days. 38.5% over one year old.** The vulnerability window is not the time-to-patch but the time-to-discover-the-copy.
- **17,314 CVE-risk copy commits, 88% in vendored dependencies. 80% score CVSS ≥ 7.0.** Severe vulnerabilities propagating through invisible channels.
- **Upstream fix adoption: only 47–84%.** Even when the fix exists, the copy diverges from upstream and may never receive it.
- **License risk concentrates in direct source-code reuse: 41,777 candidates, 39 verified high-star violations (κ=0.752).**

**Triage Deficit signal**: Dependency scanners operate on declared metadata — file-level copies are structurally invisible to them. This is a category of supply-chain risk that cannot be triaged because it cannot be detected by existing tooling. The Triage Deficit is not only "too much to review" but "entire categories unseen."

Connection to Inspection-Composition Gap (#357): SkillCloak showed individual components evade scanners at >90%. File-level copying is the same gap at the code level — unit-of-analysis mismatch between governance tools and actual dependency structure.

### 2607.01760 — Refploit: Automated Exploit Reproduction at 80.2%

Source: https://arxiv.org/abs/2607.01760

Code-agent trajectory repair for exploit construction. Evaluates on 172 exploit references for 143 Java vulnerabilities.

**Key findings**:
- **80.2% reproduction rate under DeepSeek-V4-Flash.** Four out of five disclosed vulnerability references can be automatically converted to working exploits.
- **64.3% relative improvement over initial agent trajectories** — the "failed trajectory is not useless" principle. Partial progress + constraint-guided recovery > fresh attempts.
- **Outperforms SOTA exploit-generation (PoCGen) and advanced code agents (Codex with GPT-5.4).**

**Triage Deficit signal**: If 80% of vulnerability disclosures can be automatically weaponized, triage urgency increases for every CVE — but triage capacity doesn't scale. The Refploit result compresses the attacker's timeline from "days-to-weeks to manually build exploit" to "minutes-to-hours via agent." Defenders' triage timeline remains unchanged.

Connection to CVE spike story (110pts): The same models that discover vulnerabilities faster can also weaponize them faster. The triage deficit operates on both sides — defenders must triage faster while attackers' triage-to-action time collapses.

### 2607.02294 — Coding Agents Are Guessing: 55.8–67.8% Boundary Violations

Source: https://arxiv.org/abs/2607.02294

Partially covered in #368, full abstract analysis reveals additional depth:

**Key addition**: UnderSpecBench includes **69 task families grounded in documented incidents, CVEs, or tool behavior** across **four DevOps capability domains and nine operational control surfaces**. The 2,208 prompt variants use three underspecification axes: intent clarity, target certainty, and blast radius.

**Critical finding**: "Underspecification does not mainly make agents fail; it makes them guess." The distinction matters for triage: a failure is visible (it errors); a guess that happens to work is invisible (it succeeds but for the wrong reason). **The Triage Deficit includes false positives on success** — outputs that look correct but violated boundaries in ways that will manifest later.

**New data point**: "blast-radius cues barely reduce action propensity." Agents don't self-triage based on consequence severity. The triage must come from outside the agent.

### 2607.02052 — BOUND: Package Hallucination Mitigation via Model Editing

Source: https://arxiv.org/abs/2607.02052

Lightweight model editing to reduce hallucinated package names:
- **79.9% reduction in package hallucination on edit prompts, 65.4% on unseen prompts.**
- **Generalizes across tasks**: 12.8% reduction in code generation, 34.0% in pip install recommendations.

**Triage Deficit connection**: Package hallucinations are the supply-chain analog of false CVEs — findings that look real but don't exist. BOUND reduces the triage burden by eliminating a category of false positives at the model level. This is one of the first examples of **automated triage built into the model weights** — governance compiled below the application layer.

Connection to Compilation Gradient: BOUND compiles triage (valid vs. hallucinated package) into model weights, the deepest substrate. This is triage-as-infrastructure, not triage-as-process.

---

## III. GitHub: Triage Infrastructure Emerging

### Tracked Repository Updates

| Repository | Prior | Current | Δ | Category |
|------------|-------|---------|---|----------|
| ponytail (claude-mem) | 72,597★ | 73,410★ | +1.1% | Memory sovereignty |
| omnigent | 6,122★ | 6,193★ | +1.2% | Agent orchestration |
| guard-skills | 952★ | 953★ | +0.1% | Governance-as-skill |
| searxng | — | 33,300★ | tracked | Search sovereignty |
| local-llm (jamesob) | — | 493★ | NEW | Sovereignty guide |

**guard-skills stall deepens**: 952★ → 953★ (+1★). self-learning-skills previously declined from 992★ to 760★ (scan #360). The skills market is not dead (forward-future/loopy at 2,369★, JimLiu/baoyu-design at 2,279★) but the governance-skills category is flattening while general-purpose loop-engineering skills grow.

### New Entrants

| Repository | Stars | Category | Relevance |
|------------|-------|----------|-----------|
| XiaomiMiMo/MiMo-Code | 11,389★ | Models+agents co-evolution | Compilation Gradient: model and agent evolve together |
| cobusgreyling/loop-engineering | 5,496★ | Practical agent patterns | Agentic loop patterns = operational triage methodology |
| agent-apprenticeship | 1,206★ | Workflow loop learning | Agent self-improvement through loops |
| superlog | 982★ | AI observability + self-heal | Automated triage: AI agents diagnose their own failures |
| whichllm | 5,546★ | Hardware-performance matching | Model selection triage tool — find what runs on your hardware |

**superlog (982★)** is particularly relevant: "Open-source observability tool that uses AI agents to self-heal your software." This is automated triage infrastructure — the agent diagnoses and fixes issues without human review. The Triage Deficit creates market demand for tools that triage automatically.

**whichllm (5,546★)** instantiates the framework-selection triage that 2607.02453 describes as missing. Instead of stars, it matches models to hardware and performance — a triage tool for model selection.

---

## IV. Synthesis: The Triage Deficit Pattern

### The Deficit Structure

| Domain | Discovery/Verification | Triage | Ratio (est.) | Evidence |
|--------|----------------------|--------|--------------|----------|
| **Vulnerabilities** | AI-assisted CVE discovery (spike + Refploit 80.2%) | Human review + NVD/MITRE | >100:1 | cperciva: "year of a million CVEs" |
| **Formal proofs** | Leanstral 1.5, GPT-5.5 (commodity provers) | Mathematician significance evaluation | ~50:1 | moonset: multiple models find same bugs |
| **Supply chain** | Dependency scanners (npm-scan 9★, deptrust 17★) | File-level copies invisible (95.7% undocumented) | ∞ (blind spot) | 690K events, 4.3% documented |
| **Framework selection** | GitHub stars (millions) | Ecosystem health metrics (not adopted) | >1000:1 | AutoGPT 111K★, <9 contributors/1K |
| **Agent outputs** | Completion (agents produce code rapidly) | Boundary-violation detection (55.8–67.8% violate) | ~3:1 | UnderSpecBench: guessing, not failing |

### Three Triage Failure Modes

1. **Volume overwhelm**: More verified findings than humans can review (CVEs, proofs). The backlog grows daily.
2. **Invisible categories**: Entire domains of risk invisible to existing triage tools (file-level copies, hallucinated packages). Can't triage what you can't see.
3. **False success**: Outputs that appear correct but violated action boundaries (UnderSpecBench). Triage needed for successes, not just failures.

### The Triage Deficit Feedback Loop

```
Cheaper inference → More runs → More findings → Larger triage backlog
→ Pressure to triage faster → Lower triage quality → More false positives pass
→ More production incidents → More CVEs → More findings → ...
```

Performance per dollar improving (252pts, MI355X 2× cheaper) accelerates the left side. Human judgment degradation under pressure (CO2 story, 267pts) degrades the right side. The feedback loop widens the deficit.

### Connection to Library

- **Verification Abundance Paradox (#366)**: The Triage Deficit IS the operational consequence of verification abundance. #366 identified the pattern; #369 measures the gap.
- **Enforcement Depth Gap (#368)**: L1 enforcement creates findings (CVEs, guardrail alerts). L2/L3 enforcement would automate triage — but they don't exist in production. The depth gap is the triage gap.
- **Saturation Surface (#363)**: Governance discourse saturated because the ABSTRACT triage deficit was comprehended; the CONCRETE triage deficit (CVE backlogs, unexploited proofs, invisible dependencies) continues accelerating.
- **Judgment Bottleneck (#317)**: Triage IS judgment. The deficit is the bottleneck measured, not just named.
- **Thin Stratum (#334)**: Triage is the thin stratum of the verification pipeline — the step where 80% of value concentrates in 20% of human attention.
- **Compilation Gradient**: BOUND (package hallucination editing) compiles triage into model weights. This is the resolution direction: compile triage into substrate, don't leave it as process.

### Predictions

1. **"CVE triage AI" as named product category within 3 months.** The cperciva "million CVEs" prediction + Refploit weaponization pressure will force automated triage tooling.
2. **File-level copy detection tool reaches >100★ within 6 months.** The 2607.02059 finding (95.7% invisible) is too severe to ignore; supply-chain governance will extend to file-level copies.
3. **Leanstral 1.5 >300pts within 1 scan.** Growth trajectory continues: 102→137→170→192→210→241. Proof abundance discourse not yet saturated.
4. **Local LLM guide >500pts within 1 scan.** 350pts and growing steadily.
5. **guard-skills fails to reach 1,000★ within 2 scans** (revises earlier prediction). Governance-as-skill stalled; loop-engineering skills (5,496★) winning instead.
6. **superlog or similar AI-self-heal tool >2,000★ within 2 months.** Automated triage demand is structural.

### Prediction Tracking from Prior Scans

| Prediction | Source | Status |
|------------|--------|--------|
| Mythos CVE story >200pts (2 scans) | #366 | ⏳ 110pts, tracking |
| Local LLM guide >500pts (1 scan) | #366 | ⏳ 350pts, tracking |
| First "CVE triage AI" paper (3mo) | #366 | ⏳ No paper yet, but product demand emerging |
| self-learning-skills decline <700★ | #366 | ⏳ Not checked this scan, prior 760★ |
| Half-Baked Product peaks <1,100pts | #363 | ⏳ 1,281pts (crossed — ❌ FAILED, underestimated HBP durability) |
| Static scanners insufficient in production (6mo) | #357 | ⏳ File-level copying (2607.02059) is a separate confirmation channel |

---

## V. Metrics

- **Triage-relevant stories**: ~1,124pts (CVE 110 + Leanstral 241 + Local LLM 350 + Synthesis 96 + CO2 267 + Maybe Learn 107 — partially overlapping, broadly scoped)
- **Sovereignty-infrastructure index**: ~1,061pts (Local LLM 350 + SearXNG 218 + local-llm repo 493★)
- **Discovery:triage ratio on front page**: ~4.2:1 (stories about finding/producing vs. stories about selecting/judging)
- **Assessment rejection**: 100% for 27th consecutive scan
- **arXiv batch**: 2607.02* still dominant supply, 2607.03* not yet visible
