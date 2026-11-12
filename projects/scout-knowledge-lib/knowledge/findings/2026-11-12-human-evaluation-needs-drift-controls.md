<ai_context>
summary: "An abstract-level analysis of 1,260,967 blind Chatbot Arena votes reports that absolute 'both are bad' judgments rose over time for unchanged model pairs while relative preferences stayed stable. The result supports frozen-anchor and temporal-calibration controls when human judgments are used to track deployed quality or train models, but it does not establish why standards changed or how the pattern transfers beyond this platform and period."
triggers: ["human evaluation drift", "Chatbot Arena", "both are bad", "frozen model anchors", "LLM evaluation", "human feedback", "rising standards"]
last_updated: "2026-11-12"
source_basis: "arXiv:2611.14333v1 title, metadata, comment, and abstract retrieved through the workflow-owned cs.AI feed request. Scout did not inspect the full paper, vote data, models, prompts, voter records, regressions, controls, code, figures, or tables."
</ai_context>

# Human evaluation needs drift controls

**Date:** 2026-11-12  
**Source:** [AI Isn't Getting Dumber, We're Getting Pickier: Rising Standards in Human Evaluation of Large Language Models](https://arxiv.org/abs/2611.14333v1)  
**Source revision:** arXiv:2611.14333v1  
**Coverage:** Title, metadata, comment, and abstract only  
**Disposition:** New knowledge

## Question

Can human judgments be treated as a stable measuring instrument when evaluating the same unchanged language models over time?

## What the abstract reports

The study analyzes **1,260,967 blind Chatbot Arena votes** cast from May 2023 through August 2024. It restricts its central comparison to pairs of models whose versions were fixed, including dated vendor snapshots and open-weight models, so a temporal change in judgment cannot be attributed directly to those compared model versions changing.

For the same unchanged model pair, the reported share of votes saying **“both are bad”** rose by **1.71 percentage points per month** from a mean of 17.1%, and by **1.91 points per month in 2024**. Among fourteen model pairs observed frequently in both 2023 and 2024, that verdict rose for every pair, from 15.5% to 23.3%. In contrast, the stronger model's share of decisive votes was reportedly flat in 2024.

The abstract says the increase persisted within the same voter and model pair, across voter arrival cohorts, with prompt controls, across major languages, across dated vendor snapshots and open-weight models, for models with stable answer length, and between interface changes. It also reports a shared month effect across models: estimating that effect from other model pairs removed the trend from each model pair's own judgments. The authors interpret this as an evaluation standard that rises with progress in the product category: an unchanged model can receive worsening absolute verdicts even when its relative position against another unchanged model remains stable.

## Scout interpretation

The useful signal is not that human evaluation is unreliable. It is that **absolute and relative judgments answer different questions and can drift differently**.

A product team comparing an assistant's current “bad response” rate with an old baseline may conflate three changes:

1. the assistant changed;
2. the prompts or user population changed; and
3. the evaluators' acceptance standard changed.

Frozen model pairs help isolate the third component. If unchanged anchors receive increasingly negative absolute judgments while their relative ranking remains stable, raw historical thresholds are not directly comparable without temporal calibration.

For agent and assistant evaluation, this supports retaining:

- frozen model-and-harness anchor pairs evaluated repeatedly across time;
- both absolute verdicts and pairwise preferences rather than collapsing them into one score;
- evaluator cohort, language, prompt distribution, interface, and answer-length metadata;
- calendar-time effects estimated independently of the system being evaluated; and
- versioned release gates whose thresholds state which evaluator population and period calibrated them.

The same boundary matters when human preferences become training data. A later preference corpus may encode a stricter category-relative standard rather than merely cleaner labels for the same stable objective. Mixing periods without time or cohort information can turn changing expectations into an unexplained target shift.

This complements [Agent Evaluation Research: Diagnostic Layers](../agent-evaluation-research-diagnostic-layers.md), which separates multiple failure and measurement layers inside an agent evaluation. The current source adds a longitudinal layer: even with fixed compared systems, the human measurement process can move.

## Retrieval record

The workflow-owned bounded request checked:

- **Endpoint:** `https://export.arxiv.org/api/query?search_query=cat%3Acs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`
- **HTTP status:** 200
- **Latency:** 291 ms
- **Request count:** 1
- **Retry-After:** not present

## Evidence limits

Scout reviewed only the arXiv feed's title, metadata, comment, and abstract. The full 23-page working paper, figures, tables, vote records, model-pair inclusion rules, user identifiers, prompt controls, language classification, statistical models, uncertainty intervals, interface chronology, month-effect estimation, and robustness analyses were not inspected.

The abstract reports an observational analysis of one public comparison platform over a specific period. It does not establish the psychological cause of the drift, prove that every evaluator adopted a category-relative standard, or show that the same magnitude applies to expert review, private product evaluation, single-response scoring, agent-task success, or current models. Stable relative preference also does not prove that either model's absolute quality stayed constant on a fixed external task distribution; it only narrows the interpretation for the unchanged pairs and controls described by the authors. The result supports explicit drift controls, not automatic correction by subtracting one universal monthly rate.
