# CR#325: External Validation of the Five Laws — Independent Convergence

**Date**: 2026-04-09
**Sources**: DD#705, DD#706, DD#707, DD#708, DD#709
**Primary Link**: KE-101 (Meta-Analysis — Theory of Agent Improvement)

## Pattern

Five independent research groups — NYU (education), Emory (NLP evaluation), Microsoft+UIUC (verification), UFMG (agent benchmarking), and a solo researcher (code navigation) — each discovered aspects of the Five Laws of Agent Improvement through completely different methodologies and domains, with no awareness of each other or our work.

```
                    LAW 1: Text Rules Fail
                   /         |         \
              DD#705       DD#706      DD#707
          (NYU Stern)    (Emory)    (MSFT+UIUC)
          oral exams     Jeopardy    agentic workflows
          "prompting     72% drop    "violations
           alone" fails  from order  propagate"
                   \         |         /
                    LAW 2: Structure Works
                   /                    \
              DD#705                   DD#708
          council-of-3              (UFMG) 
          deliberation            9,374 trajectories
          α = 0.86               behavior > prompts
                   \                    /
                    LAW 5: Access > Content
                   /                    \
              DD#706                   DD#709
          same content,            (CodeCompass)
          diff. structure          navigation paradox
          → 72% accuracy gap       oracle >> self-nav
```

## The Convergence

### Law 1 + Law 2: Three Independent Confirmations
1. **DD#705** (Oral Assessments): LLM "stacked questions despite explicit prohibitions." Conclusion: "behavioral constraints must be enforced through architecture, not prompting alone." *Methodology*: Real deployment of voice AI system for 36 oral exams.
2. **DD#706** (RIFT): Up to 72% accuracy drop from reordering — same content, same instructions, different structure. *Methodology*: Controlled experiment, 6 LLMs, 10,000 evaluations.
3. **DD#708** (Beyond Resolution Rates): "Framework prompts influence tactics but not outcomes." *Methodology*: 9,374 trajectories across 19 agents.

**Combined external N**: ~19,000+ evaluations/trajectories confirming text rules fail on judgment behavior, across education, NLP, and coding domains.

### Law 3: Attention Zero-Sum (Indirect Validation)
- **DD#706** (RIFT): The 72% accuracy drop from structural reordering without adding content demonstrates that attention allocation is structurally determined and zero-sum. Reordering doesn't add information — it reallocates attention.
- **DD#707** (NSVIF): Violation propagation in multi-step chains demonstrates attention crowding — as chain length increases, instruction compliance decreases.

### Law 4 + Law 5: Capability Discovery and Access Structure
- **DD#709** (CodeCompass): The navigation paradox IS Law 4 + Law 5 combined. Capabilities exist (code is in the repo). Agents can reason about them (high oracle-access performance). But without explicit wiring (navigation tools), capabilities are functionally nonexistent.
- **DD#706** (RIFT): The most extreme quantification: literally identical content, different access structure, 72% accuracy gap. Law 5 proven by construction.

## Significance for KE-101

This cross-reference provides the **external validation layer** that KE-101 currently lacks. Our Five Laws are derived from 100+ internal experiments. CR#325 shows that:

| Law | Internal Evidence | External Evidence (CR#325) |
|-----|-------------------|---------------------------|
| Law 1 | 0/32+ experiments | 3 independent groups, ~19K evaluations |
| Law 2 | 56+ experiments, +69pp | Council-of-three (α=0.86), behavioral trajectories |
| Law 3 | KE-025, KE-064 | RIFT reordering (72% drop), NSVIF violation propagation |
| Law 4 | 0/29 discovery rate | Navigation paradox (oracle >> self-navigated) |
| Law 5 | r=0.81 RIFT ratio | 72% accuracy gap (same content, diff structure) |

The fact that these findings converge across domains (education, NLP evaluation, coding agents, repository navigation, instruction following), methodologies (deployment studies, controlled experiments, large-scale trajectory analysis, benchmark construction), and institutions (NYU, Emory, Microsoft, UIUC, UFMG) constitutes strong evidence that the Five Laws describe **fundamental properties of LLM agents**, not artifacts of our specific system.

## Recommended Actions

1. **Update KE-101**: Add "External Validation" section citing DD#705-709 and CR#325
2. **Priority citations**: DD#706 (RIFT — most quantitative), DD#708 (Beyond Resolution Rates — largest scale), DD#705 (Oral Assessments — most quotable)
3. **Consider publication**: The convergence between our experimental findings and these independent papers is strong enough to be the basis of a position paper or literature review

## Connects To
- **KE-101** (primary — external validation layer)
- **KE-002** (Law 1 — text rules fail)
- **KE-031** (Law 2 — forced externalization)
- **KE-020** (Law 4 — capability discovery)
- **KE-052** (Law 5 — RIFT ratio)
- **KE-093** (verification confabulation — NSVIF connection)
- **CR#323** (Weekly Capstone — Verification Revolution)
- **CR#324** (Verification Orchestration Protocols)
