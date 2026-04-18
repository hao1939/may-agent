# Research Synthesis: Memory Architecture + Prescreen Gate (2026-04-18)

## Thread Summaries

### KE-253: Cognitive-Executive Separation (from DD-763)
Architectural separation between reasoning and execution yields 98.9-100% safety vs 0% for prompt guardrails. Strongest external validation of Law 2. Parallax paper: 280 adversarial cases, 9 attack categories.

### KE-254: Cooperative Memory Paging (from DD-765)
Keyword bookmarks (~8-24 tokens) + on-demand recall outperforms **full context** on long conversations. Coarse fixed pages (96.7%) crush sophisticated topic segmentation (56.7%). Bookmark distinctiveness is the bottleneck, not retrieval.

### Prescreen Gate Retrospective
3-trial prescreen would have correctly predicted 19/19 experiment outcomes (100% accuracy). Our results are bimodal (0% or ~100%), making small prescreens nearly optimal. Estimated savings: ~$18 and dozens of wasted trials.

## Cross-Thread Connections

**1. Architecture > Behavior (convergent evidence)**
All three findings reinforce the same meta-pattern:
- KE-253: Architectural separation > prompt guardrails (0% vs 99%)
- KE-254: Simple fixed pages > sophisticated segmentation (97% vs 57%)
- Prescreen: Our own experiments show binary thresholds — interventions either structurally solve recognition or don't

The common principle: **simple structural mechanisms dominate complex behavioral ones**. This is Law 2 applied everywhere.

**2. Memory architecture connects to prescreen through recognition bottleneck**
KE-254 shows bookmark quality determines retrieval accuracy. Our experiments show agent success is binary — either the agent recognizes the issue or doesn't. These are the same phenomenon: recognition depends on whether the right knowledge is surfaced at decision time. Better bookmarks = better recognition = crossing the binary threshold.

**3. Complexity penalty is universal**
- KE-254: Content-aware segmentation collapses (56.7%) while dumb fixed pages succeed (96.7%)
- KE-253: Simple architectural boundary beats nuanced prompt engineering
- Our experiments: Combined interventions degrade (KE-123), single targeted ones work

## Ranked Findings (impact × novelty)

1. **KE-254 bookmark insight** (HIGH) — Directly actionable for our context.md design. Optimize for distinctiveness, not completeness.
2. **Prescreen gate adoption** (HIGH) — Immediate cost/time savings, 100% historical accuracy.
3. **KE-253 external validation** (MEDIUM) — Confirms Law 2 with strong external data, but we already knew this.

## Next Steps

1. **Adopt 3-trial prescreen** as standard experiment protocol (write into experiment template)
2. **Audit context.md bookmark quality** — are entries distinctive enough? Apply KE-254 findings
3. **Consider formalizing paging protocol** for long sessions — evict old context, leave keyword bookmarks
