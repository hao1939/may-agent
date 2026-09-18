<ai_context>
summary: "Notch's production model migration shows why agent-model selection needs workload-specific tool recovery, finished-output review, and staged outcome-cost measurement: a cheaper model required schema/gateway adaptation, while headline token rates did not capture retries, media regeneration, cache accounting, or downstream product outcomes."
triggers: ["agent model migration", "outcome cost", "Notch", "tool schema compatibility", "model holdout", "harness cost", "workload-specific evaluation"]
last_updated: "2026-09-18"
source_basis: "HN discovery item 49755484 and Notch's August 18, 2026 engineering report; company-authored production observations, not an independently reproduced experiment."
</ai_context>

# Price Agent Models by Accepted Outcomes, Not Tokens

**Date:** 2026-09-18  
**Source:** Hacker News  
**HN:** https://news.ycombinator.com/item?id=49755484  
**Primary report:** https://www.usenotch.ai/blog/cutting-our-agent-s-harness-cost-10x-without-breaking-the-product

## Signal

Notch reports replacing the model inside its video-ad agent harness while keeping the Claude Agent SDK loop and more than 100 existing tools. The team routed Anthropic-compatible providers through `ANTHROPIC_BASE_URL` and used LiteLLM for providers that needed protocol translation. This is a useful portability pattern, but the stronger finding is that **API compatibility did not imply behavioral or economic substitutability**.

The company first used SWE-bench Pro and token prices to shortlist four models, then tested them on its own tools and customer briefs. In those workload tests:

- MiniMax repeatedly submitted malformed arguments to a state-dependent scene-planning tool despite validation feedback;
- Muse searched for tools without invoking the needed ones and struggled with deferred tool discovery;
- the tested DeepSeek endpoint lacked direct image input, and a question-asking vision tool did not substitute adequately for native visual access; and
- GPT-5.6 Luna worked best only after nested union tool schemas were flattened into ordinary objects, while the application retained validation against the original schema.

A gateway transformation also made optional fields required on one route. Disabling that route's strict mode while retaining application-side validation reduced validation retries from 14 to 4 in one before/after planning-eval comparison. The observation shows that a model migration is also a **schema and protocol migration**: retry behavior can reflect translation-layer semantics rather than model capability alone.

## Evaluation ladder

Notch describes three gates that are more informative than one benchmark score:

1. **Harness operation:** can the model select tools, satisfy schemas, recover from errors, and finish the workflow?
2. **Finished-output review:** do humans judge the resulting ads acceptable, including creative choices that automated checks leave open?
3. **Production survival:** during staged rollout, do full costs and customer outcomes remain acceptable?

The company reports that median harness cost among sessions producing a video fell from $4.44 to $0.50. It now routes 95% of traffic to Luna and retains 5% on Sonnet as a long-term holdout; its download/publish rate reportedly remained roughly unchanged. That is stronger evidence than a price-table calculation because it reaches a production outcome, but it is not a controlled parity result: the report does not publish sample counts, uncertainty, assignment details, or a matched quality distribution, and download/publish is only one product proxy.

## Operational implication

The correct comparison unit is the **cost of an accepted outcome**, not cost per token or even cost per successful agent session. A migration receipt should separately retain:

```text
model + endpoint + dated prices
+ protocol/gateway versions
+ tool-schema adaptations
+ workload-specific completion and recovery results
+ finished-artifact review
+ full retry/regeneration cost
+ production allocation and holdout
+ downstream product outcome
```

This matters especially for agents whose outputs trigger expensive downstream work. A cheaper harness can lose its savings if poorer decisions cause an extra media generation, external API call, review cycle, or failed attempt. Cache-hit accounting can reverse estimates in the other direction. Notch also found one SDK price-table calculation and one gateway cache-usage report misleading, reinforcing [the library's cost-telemetry finding](./2026-09-10-agent-cost-telemetry-conformance.md): parser correctness, price semantics, and observed economic outcomes are separate evidence layers.

The reusable migration rule is therefore: **shortlist with generic benchmarks, adapt and test on real tool trajectories, judge final artifacts, then preserve a production holdout long enough to measure the outcomes that matter.** A lower token price is a hypothesis about savings, not proof of them.

## Evidence boundaries

This finding is based on a company-authored engineering report discovered through HN. Scout read the full accessible report, but did not inspect private evaluations, production traces, gateway configuration, billing records, or generated ads. Model names, prices, endpoint capabilities, and observations are explicitly historical to the team's July–August 2026 tests. Several comparisons are observational rather than controlled: the report notes that some example ads used different reference assets or later edits, and its production prompt-length sample did not match customer briefs. The reported 9.86× constant-token-mix calculation and $4.44-to-$0.50 observed medians answer different questions and should not be merged into one causal estimate.

## Primary sources

- HN discovery item: https://news.ycombinator.com/item?id=49755484
- Notch engineering report: https://www.usenotch.ai/blog/cutting-our-agent-s-harness-cost-10x-without-breaking-the-product
