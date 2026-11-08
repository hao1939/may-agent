<ai_context>
summary: "A ten-week, single-operator coding-agent fleet report links lower token use per changed line to transcript-based goodput measurement, short-lived task sessions, context ceilings, cache-aware waits, deterministic gates, and programmatic coordination; the interventions were bundled and the evidence is author-reported rather than independently reproduced."
triggers: ["coding agent efficiency", "agent token cost", "prompt caching", "context ceiling", "agent fleet", "tokens per PR", "agent goodput"]
last_updated: "2026-11-08"
source_basis: "Alexander Marquardt's 2026-11-08 practitioner report linked from HN item 50415486; Scout read the complete article text and the HN item, which had no comments at inspection."
</ai_context>

# Coding-agent efficiency needs goodput metrics, not token totals

## Observation

A current Hacker News submission links to Alexander Marquardt's report on ten weeks of operating a coding-agent fleet across four repositories. The author says raw tokens per changed line fell **3.3×** (about **2.5×** after weighting token types by price), merged PRs per week rose **4.4×**, and total weekly tokens fell **19%**. The report uses local Claude Code transcripts and merged repository work rather than elapsed time as its measurement base.

The main operational claim is that repeated context, not generated code, dominated consumption. The reported fleet attributed 94–98% of raw tokens to cache reads. A one-day breakdown found cache expiry during waits accounted for about 31% of agent usage; limiting foreground waits to less than the five-minute sub-agent cache lifetime reportedly reduced that share to 0.7%. A hook-enforced handoff ceiling and short-lived task sessions landed at the same time: median context per request fell from 218k to 101k tokens on the first day, while the share of agents exceeding 150k fell from 73% to 25%.

The workflow couples those context controls to durable state outside the conversation. One agent handles one task, pushes its branch, and leaves a handoff of fewer than 30 lines with next steps, links, and the head commit. Deterministic requirements move from prompts into tests, gates, scripts, or tool refusals. Routine queueing and health checks move from the coordinating model into a program that wakes the model only for findings requiring judgment. The author's concise principle is that the system, rather than the model conversation, should remember.

## Reusable implication

The useful metric is **verified work per cost**, not tokens per hour or one session's total. A token budget can appear unchanged while throughput improves; in the author's first day under the context ceiling, merged PRs per hour reportedly rose from 0.57 to 2.06 without a fall in hourly token use. For coding-agent operations, a practical measurement set should therefore include:

- token mix and price-weighted cost per accepted unit of work;
- calls and median context per request;
- prompt-cache expiry and rewrite cost;
- changed lines or another task-normalized output measure;
- review/fix rounds, reverts, and integration failures;
- coordinator cost separately from implementation cost.

This also sharpens the case for short, artifact-backed handoffs. Compaction keeps a long conversation alive and makes its summary part of the same repeated context. A fresh worker can instead pay orientation cost once from a small durable packet, provided the branch, exact revision, remaining steps, and acceptance evidence survive outside model memory.

## Evidence boundary

This is a detailed practitioner report from one person, one fleet, one repository mix, and one model/tool ecosystem. The two largest interventions—context ceilings with short-lived agents and cache-aware wait caps—landed together, so their effects are not separately identified. Model mix and work mix changed during the period; smaller repositories made some PR-level improvements look larger, which is why the author prefers changed-line and main-repository measures. Several supporting practices, including code maps and file caps, were not measured separately.

Quality did not improve on every measure. Reverts remained rare but rose from roughly 0.2% to 0.7% of merges, fix rounds increased from 0.8 to about 0.9–1.0 per merged PR, and the report estimates rework at about 20% of agent tokens. The HN item had one point and no discussion when inspected, so it supplies discovery rather than community validation. Scout did not inspect the private repositories or transcripts, run the companion scripts, reproduce the token accounting, or independently validate the merged-PR and quality figures.

## Sources

- Source: https://alexmarquardt.com/ai-tools/agent-fleet-token-efficiency/
- HN: https://news.ycombinator.com/item?id=50415486
