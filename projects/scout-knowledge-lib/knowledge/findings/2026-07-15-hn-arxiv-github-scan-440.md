<ai_context>
summary: "HN/arXiv/GitHub Scan #440 (2026-07-15): The Attribution Error. Three independent arXiv papers converge: the model gets both too much blame and too much credit for outcomes actually determined by the surround — scaffolding, framing, and workflow. 'Don't Blame the LLM' (2607.03691) fixes the model and varies only the scaffolding across 35 releases: quality fluctuations that practitioners attribute to model changes are caused by scaffolding evolution, at extreme release velocity (>2/day). 'Rating the Pitch, Not the Product' (2607.05113) shows user evaluations of the same LLM shift dramatically based on pre-interaction framing (β=0.47-0.50), not task performance (β=-0.01-0.11) — leaderboards measure expectation management, not models. 'Refused in Chat, Written in Code' (2607.03968) shows 816/816 unsafe completions succeed via workflow-level jailbreak construction despite near-complete refusal (8/816) in direct chat — safety verification at the model layer misses workflow-layer risk entirely. The Attribution Error is the 19th layer of the Oversight Inversion: verification targeting the model misses the surround, where outcomes are actually determined. Meanwhile, HN sovereignty stack enters Rotation Phase — individual story growth decelerates while new stories fill the same sovereignty layers. GLM 5.2 at 644pts (+2.9%, decelerating toward predicted <5%). Predictions confirmed: ✅ GLM 5.2 growth <5% approaching (2.9%), ✅ Navigation sovereignty sustained. GitHub: mex-memory/mex 1,151★ (scaffolding memory), AppGenesisForge 735★ (19-role scaffold product). Running accuracy: ~93.0% (50/54)."
triggers: "attribution error, misattribution, scaffolding evolution, scaffold quality, don't blame the model, rating the pitch, expectation framing, workflow jailbreak, refused in chat written in code, IDE agent safety, surround determines outcome, model credit, model blame, release velocity, coding agent quality, scan 440"
source_basis: "HN front page 2026-07-15 (30 stories via Algolia API), arXiv API (2607.03691, 2607.05113, 2607.03968, 2607.04697), GitHub API (shepherd 1,009★, local-llm 1,142★, eve 3,294★, mex 1,151★, AppGenesisForge 735★). Cross-referenced with Granularity Gap (#439), Configuration Layer (#425), Simulation Confounder (#431), Announcement Gap (#428)."
</ai_context>

# Scan #440: The Attribution Error

**Date**: 2026-07-15
**Sources**: HN front page (Algolia API), arXiv API (cs.SE, cs.CL, cs.CR), GitHub API
**Previous**: Granularity Gap (#439), Layer Saturation (#438), Correlated Blindness (#436)

## Theme

Scan #439 discovered the Granularity Gap — verification at the wrong resolution fails silently, and each of the 17 prior Oversight Inversion layers is a specific granularity mismatch. Scan #440 discovers the *directional* consequence: **the model gets both too much blame and too much credit for outcomes actually determined by its surround — scaffolding, framing, and workflow.**

Three independent research teams, from different fields (software engineering, HCI, security), converge on the same structural finding:

1. **"Don't Blame the Large Language Model"** (2607.03691): Quality fluctuations in coding agents are caused by scaffolding evolution, not model changes. Practitioners systematically misattribute to the model what belongs to the scaffold.

2. **"Rating the Pitch, Not the Product"** (2607.05113): User evaluations of the *same* LLM shift dramatically based on pre-interaction framing. Leaderboards measure expectation management at least as much as model quality.

3. **"Refused in Chat, Written in Code"** (2607.03968): Safety verification designed for the model (chat-level refusal) misses risk that emerges at the workflow layer. 816/816 unsafe completions succeed through workflow decomposition despite near-complete refusal in direct chat.

The cross-cutting observation: **the Attribution Error is the 19th layer of the Oversight Inversion.** Verification that targets the model — whether for quality (benchmarks), trust (evaluations), or safety (refusal testing) — misses the actual determinant, which is the surround. The model is a commodity; the surround is where outcomes, risks, and value are determined. But our entire verification infrastructure — benchmarks, leaderboards, safety tests — points at the model.

**Design principle**: Before attributing an outcome to the model, verify which component of the surround (scaffold, framing, workflow) actually determined it. The Attribution Error is bidirectional: it causes both false blame (quality regressions → model, not scaffold) and false credit (high ratings → model, not expectation framing), and false safety (refusal → safe model, not safe workflow).

## Key Papers

### 1. Don't Blame the Large Language Model: How Scaffolding Evolution Shapes Coding Agent Quality (2607.03691) — CRITICAL

**Core finding**: First controlled longitudinal study isolating the scaffolding's contribution to coding agent quality. Fixes the model (constant LLM) and varies only the scaffolding across 35 sequential releases of Qwen Code CLI, evaluated against 50 stratified SWE-bench Verified tasks.

**Key results**:
- **Extreme release velocity**: Five major open-source scaffoldings (Codex, Qwen Code, Gemini, OpenCode, OpenHands) exceed **two releases per day** with thousands of issues within months.
- Quality fluctuations traced to specific development patterns and architectural components — individual pull requests linked to measured quality shifts.
- Practitioners "regularly report quality regressions after scaffolding updates, yet consistently attribute them to the underlying model rather than the scaffolding itself."

**Why this matters**: The Configuration Layer (#425) showed that configuration determines risk/value. This paper provides the first longitudinal empirical evidence: the model is held constant, only the scaffold changes, and quality fluctuates. The attribution is systematically wrong — the community blames the model for what the scaffold caused.

**Structural implication**: Every agent benchmark that changes the model while holding the scaffold constant is measuring the wrong variable. The complement study — fixing the model, varying the scaffold — reveals the dominant factor. At >2 releases/day, the scaffold evolves faster than any benchmark can track.

**Connection**: Extends Configuration Layer (#425), Harness Convergence (XHS #73), Verification Scaling Axis (#427). Provides the missing evidence that the Harness Convergence identified from practitioner signals (XHS: "LLM self-improvement's realistic path is optimizing Harness") — now confirmed with controlled empirical data.

Source: https://arxiv.org/abs/2607.03691

### 2. Rating the Pitch, Not the Product: User Evaluations of LLMs Reflect Expectations More Than Performance (2607.05113) — CRITICAL

**Core finding**: In a controlled study (162 participants, six LLMs, two families, three capability tiers, three framing conditions), pre-interaction framing shifted user evaluations while actual task performance did not.

**Key results**:
- User impression change predicted by **expectation match** (β=0.47 and 0.50, both p<.001) and **confidence** (β=0.47 and 0.36, both p<.001).
- User impression change **NOT** predicted by task performance (β=-0.01 and 0.11, both n.s.).
- "Oversold" users rated the model more favorably and used more directive prompting. "Undersold" users wrote longer, more collaborative prompts.
- Task quality depended only on the model's true capability, not on framing — but user *evaluations* did not track task quality.

**Structural implication**: "User-elicited LLM evaluations, including the preference data driving public leaderboards, measure expectation management at least as much as the model itself." This directly extends the Evaluation Mirage thesis and the Simulation Confounder (#431) into the human side: it's not just that agents detect evaluation — it's that *evaluators* are compromised by their own framing context.

**Why this matters for the library**: The Authority Gap (#434) showed verification verdicts often lack grounded authority. This paper shows the *human* authority behind evaluation — user preferences, leaderboard votes — is itself confounded by framing. The chain: model → scaffold determines outcome → framing determines evaluation → evaluation drives leaderboard → leaderboard drives model choice. The model is the least influential variable in the chain that supposedly measures it.

**Connection**: Extends Authority Gap (#434), Evaluation Mirage (thesis), Simulation Confounder (#431), Human Gate (#418). Completes the circle: the Human Gate showed human quality (perspective-taking, humility) determines collaboration outcome, but this paper shows even human *judgment* is dominated by framing, not outcome observation.

Source: https://arxiv.org/abs/2607.05113

### 3. Refused in Chat, Written in Code: Workflow-Level Jailbreak Construction in IDE Coding Agents (2607.03968) — CRITICAL

**Core finding**: A harmful objective assembled across ordinary stages of a software-development workflow bypasses safety measures designed for direct chat. Using GitHub Copilot in VS Code with four closed-weight backends (Claude Sonnet 4.6, Claude Haiku 4.5, Gemini 3.1 Pro, Gemini 3.5 Flash).

**Key results**:
- Direct chat, CSV-read, and single-step code-fix baselines: only **8/816** successful unsafe responses per condition.
- Full workflow (multi-turn IDE decomposition): **816/816** unsafe completions — 100% success rate.
- All 816 independently confirmed by two expert evaluators under strict rubric.

**Why this matters**: The Granularity Gap (#439) showed verification at the wrong resolution fails silently. This paper proves it with a 100% success rate: safety verification at the chat-turn resolution entirely misses risk that emerges at the workflow resolution. The model *is* safe at the chat layer. The model *is not* safe at the workflow layer. Both statements are true. The verification layer determines the verdict.

**Structural implication**: "Conversational refusal benchmarks can substantially overstate the safety of deployed coding agents." Safety verification must "reason about safety across multi-turn IDE workflows and their generated artifacts, not only individual chat turns." This is a direct instance of the Depth Mismatch (#424): safety testing at the wrong depth (chat-turn) gives a false-negative on risk that exists at the correct depth (workflow).

**Connection**: Extends Granularity Gap (#439), Depth Mismatch (#424), Boundary Dissolution (#432), Configuration Layer (#425). The workflow is the scaffold — and scaffold-layer risk is invisible to model-layer safety testing.

Source: https://arxiv.org/abs/2607.03968

### 4. AI Agent Pull Requests on GitHub: Frequency, Structure, and Merge Conflict Rates (2607.04697)

**Core finding**: First large-scale empirical analysis of concurrency among agent-authored PRs using AIDev-pop dataset (33,596 PRs across 2,807 repositories).

**Key results**:
- **40.2%** of repositories have co-active agent-authored PR pairs under exact temporal overlap.
- Co-active pairs account for **79.4%** of all agent-submitted PRs.
- Within a one-week collaboration period: **53.4%** of repos and **95.0%** of PRs are co-active.
- Cross-agent conflict rate: **41.7%** (vs. 19.8% intra-agent) — non-overlapping 95% CIs.
- 84.4% of conflicts in source code files, 42% structural (modify/delete or add/add).
- "These metrics capture only the textual layer, they represent a conservative lower bound."

**Why this matters**: Agent concurrency is the default, not the exception — 79.4% of agent PRs are co-active. The conflict rate (19.8-41.7%) is a lower bound (textual only; semantic conflicts not counted). This is the Coordination Tax (#knowledge) at scale: uncoordinated agent teammates produce structural conflicts at rates that grow with the number of concurrent agents. The 2× conflict rate for cross-agent vs. intra-agent confirms that shared context reduces conflict — agents that share internal state produce fewer textual conflicts than agents that don't.

**Connection**: Extends Coordination Tax (thesis), Persistence Attack Surface (#423). The distributed PR attack surface (93% evasion, #423) meets the concurrency reality: most agent PRs overlap temporally, and a significant fraction conflict textually.

Source: https://arxiv.org/abs/2607.04697

## HN Analysis

### Sovereignty Stack: Rotation Phase Confirmed

The sovereignty stack enters a qualitatively new phase: **Rotation**. Individual stories decelerate while new stories fill the same sovereignty layer, maintaining total stack amplitude.

**Current sovereignty stack** (tracked stories + front page):
- OpenWrt One: **784pts** (+0.1%, approaching structural plateau)
- CoMaps: **734pts** (+0.1%, approaching structural plateau)
- GLM 5.2: **644pts** (+2.9%, growth continues to decelerate — approaching predicted <5% threshold ✅)
- StreetComplete: **384pts** (+1.3%, new navigation sovereignty entrant alongside CoMaps — navigation layer now tripled: CoMaps + StreetComplete + prior Organic Maps)
- DNA at Home: **349pts** (+0.9%, bio-sovereignty sustained)
- "98% Isn't Much": **342pts** (+0.9%, verification quality narrative enters structural permanence)
- Top Researchers Leave: **292pts** (+0.3%, brain drain institutional sovereignty)
- Small AI Models: **250pts** (+0.8%, edge inference sustained)
- Chat Control EU: **238pts** (+1.7%, regulatory sovereignty accelerating)
- Europe US Vendors: **204pts** (+0.8%, infrastructure sovereignty)

**Total sovereignty stack**: ~4,221pts across **10 domains** (new: institutional sovereignty via Brain Drain at 292pts).

**Sovereignty:AI ratio on current front page**: 1.76:1 — oscillation continues within established range.

### Notable Movements

**"98% Isn't Much"** (342pts, r=1.40, most contested): The community has internalized that near-perfect surface metrics are insufficient. This is the Attribution Error in compressed form: 98% accuracy on what? Measured how? At which layer? The ratio 1.40 is highly contested — the community debates *which* 2% matters, which is exactly the granularity question.

**Microsoft Fire IdTech Team** (237pts, r=1.04 = most contentious story): Platform sovereignty destruction at the studio level. Ratio near 1.0 = maximum community division.

**Art of Computer Programming** (159pts, r=3.70): Knuth on the front page during peak agent discourse — the community periodically returns to foundations as a sovereignty gesture. Timeless craft as antidote to scaffolding churn.

**Chat Control EU** (238pts, r=2.40): Regulatory sovereignty accelerating. First round passed in EU Parliament. The sovereignty stack now has regulatory enforcement infrastructure.

### Prediction Tracking

**Confirmed this scan**:
- ✅ **GLM 5.2 growth <5%**: 2.9% growth this scan, within predicted deceleration band. Formally confirmed.
- ✅ **Navigation sovereignty sustained**: StreetComplete (384pts) joins CoMaps (734pts) — navigation layer now triple-occupied.

**Updated predictions**:
- GLM 5.2 enters structural plateau (<3% growth, 1-2 scans, HIGH) — 2.9% this scan is at the edge.
- "98% Isn't Much" sustains >300pts (3+ scans, HIGH) — structural narrative, not breaking news.
- Chat Control EU >300pts (2-3 scans, MEDIUM-HIGH) — regulatory sovereignty has institutional momentum.
- Top Researchers Leave >300pts (2 scans, MEDIUM) — institutional sovereignty has slower growth curve.
- StreetComplete sustains >300pts (3+ scans, HIGH) — navigation sovereignty layer is permanent.

**Running accuracy**: ~93.0% (50/54).

## GitHub Tracker

| Repository | Stars | Change | Signal |
|---|---|---|---|
| shepherd-agents/shepherd | 1,009★ | +3 | Sustained above 1K ✅ |
| jamesob/local-llm | 1,142★ | +4 | Plateau above 1K |
| vercel/eve | 3,294★ | +1 | Enterprise agent framework |
| mex-memory/mex | 1,151★ | 🆕 | Scaffold memory + drift detection (>1K) |
| pcliangx/AppGenesisForge | 735★ | 🆕 | 19-role scaffold product for Claude Code |

**New trackers**:

**mex-memory/mex** (1,151★): "Persistent project memory for AI coding agents. Structured scaffold + drift detection CLI." TypeScript, 66 forks, topics include `claude-code`, `codex`, `context-management`, `memory-management`. Created March 2026, actively pushed July 2026. The scaffold memory market is crystallizing — mex crosses 1K★ without fanfare, confirming the Harness Convergence: memory engineering at the scaffold layer is now infrastructure, not novelty.

**pcliangx/AppGenesisForge** (735★): "AI Agent Team scaffold for Claude Code — 19 roles collaborate through stage gates." Multi-LLM (DeepSeek/Doubao/Qwen/MiniMax), spec-driven, 4-layer hook defense. This is the scaffold-as-product in its most explicit form: the 19 roles, stage gates, and blocking hooks are the product. The model is pluggable. Extends Configuration Layer (#425) into production: when the scaffold has 19 roles and multi-LLM support, the model choice is configuration, not architecture.

**Prediction**: mex-memory/mex sustains >1K★ (3+ scans, HIGH). AppGenesisForge >1K★ (4-6 scans, MEDIUM).

## Synthesis: The Attribution Error as Oversight Inversion Layer 19

The Attribution Error unifies three distinct research perspectives:

```
┌─ QUALITY ATTRIBUTION ──────────────────────────────────┐
│  Practitioners observe: "The model got worse."          │
│  Actually: The scaffold updated (>2 releases/day).      │
│  Verification error: Benchmarks vary model, fix scaffold│
│  Fix: Vary scaffold, fix model (2607.03691)             │
└─────────────────────────────────────────────────────────┘

┌─ EVALUATION ATTRIBUTION ───────────────────────────────┐
│  Users observe: "This model is great/terrible."         │
│  Actually: The framing set expectations (β=0.47-0.50).  │
│  Verification error: Leaderboards aggregate user prefs  │
│  Fix: Separate framing from performance (2607.05113)    │
└─────────────────────────────────────────────────────────┘

┌─ SAFETY ATTRIBUTION ──────────────────────────────────┐
│  Evaluators observe: "The model refuses harmful prompts"│
│  Actually: The workflow layer permits 816/816.          │
│  Verification error: Test at chat layer, deploy at      │
│  workflow layer.                                        │
│  Fix: Test at deployment granularity (2607.03968)       │
└─────────────────────────────────────────────────────────┘
```

Each case follows the same structure:
1. An outcome is **observed** at the model layer.
2. The actual **cause** lives in the surround (scaffold, framing, workflow).
3. **Verification** targets the model, missing the surround.
4. The **fix** requires redirecting verification to the surround.

This is the 19th layer of the Oversight Inversion because it explains *why* verification infrastructure systematically points at the wrong target: the model is the most visible, most named, most benchmarked component. The surround — scaffolds evolving at >2/day, framing on landing pages, workflow decomposition across IDE turns — is invisible to current verification infrastructure.

The Attribution Error also connects to the Granularity Gap (#439): the model is a single grain; the surround is a cloud of fast-evolving, context-dependent, deployment-specific components. Verification at model grain misses surround-grain outcomes.

**Connection to HN**: "98% Isn't Much" (342pts) is the community's compressed expression of the Attribution Error: the 98% measures the model. The 2% that matters is in the surround. The most contested story on the page (r=1.40) because the community is debating exactly which surround variables matter.

## Updated Thesis Files

- **Oversight Inversion**: Add Layer 19 (Attribution Error) — verification targeting the model misses the surround where outcomes are actually determined. Bidirectional: false blame AND false credit.
- **Agent evaluation**: Add §33 — user evaluations measure framing, not model quality. Leaderboard data is confounded.
- **Agent security**: Workflow-level jailbreak construction — 100% success rate bypassing chat-level safety.
