<ai_context>
summary: "Portal2Bench evaluates screenshot-driven Portal 2 play with fresh per-chamber runs, explicit cost and plan ceilings, and different agent harnesses for different models. Its leaderboard therefore measures configured model-harness-budget packages rather than model capability alone, while incomplete chamber coverage and absent repeated-run evidence limit rank interpretation."
triggers: ["Portal2Bench", "game agent benchmark", "embodied agent leaderboard", "model harness confound", "Portal 2 AI agent", "cost-censored benchmark"]
last_updated: "2026-11-14"
source_basis: "Static inspection of the producer-authored Portal2Bench dashboard and HN item 50492238. Scout read the rendered methodology, leaderboard, FAQ, changelog, and selected embedded run material, but did not run the benchmark, inspect a versioned implementation or research writeup, exhaustively audit every embedded trajectory, or independently validate the scores."
</ai_context>

# Game-agent leaderboards must identify model-harness pairs

**Date:** 2026-11-14  
**Source:** Hacker News discovery and producer dashboard  
**HN item:** https://news.ycombinator.com/item?id=50492238  
**Primary source:** https://kingstonyip.com/portal2bench  
**Observed source fingerprint:** `sha256:a52ec1ce0932972a77e5b749e728ca45b3707e7a8b727b3a2d750c770c752053`

## Question

What does Portal2Bench establish about current agents' ability to complete a 3D puzzle game, and what must be preserved before treating its leaderboard as a model comparison?

## Source observation

Portal2Bench evaluates agents on 26 Portal 2 test chambers from chapters 2 through 5. The benchmark pauses the game while the model thinks. An agent receives screenshots and its position, can send movement keys and view turns, and can write only to its own notes folder; the page says it has no shell, web, or game console. Each chamber starts as a fresh independent run and counts as solved only if the agent reaches the next map within both 300 plans and US$30 of API-list-price cost.

The observed dashboard reports:

- GPT-6.1 Sol with Codex: 20 of 26 chambers solved;
- GPT-6 Astra with Codex: 20 of 26;
- GPT-6.1 Terra with Codex: 19 of 26;
- Opus 5.5 with Claude Code: 11 of 26;
- Sonnet 5.5 with Claude Code: 6 of 26;
- Fable 5.1 with Claude Code: 3 of 15 completed runs; and
- GPT-6 Luna with Codex: 0 of 26.

The page explicitly says most chambers are still being run because of compute constraints and usage limits. It also labels Gemini 4 Argon and Fable 5.2 as currently running. A changelog says the benchmark was announced on November 3 and added three model result sets on November 9; the linked research writeup is still marked “Soon.”

The dashboard exposes more than a single score: it reports plans, game time, API-list-price cost, deaths, and interactive run material. For solved chambers, displayed median cost ranges from about $0.74 for GPT-6.1 Terra to $13.12 for Fable 5.1. Those are conditional-on-success summaries, not the expected cost of obtaining a solution across all attempts.

## Finding

**The evaluated unit is a configured model-harness-budget package, not the model alone.** Portal2Bench says Codex runs the GPT configurations, Claude Code runs the Anthropic and Fable configurations, and Antigravity runs Gemini. The page also says each model runs in its own harness and at its highest effort, except Gemini at high effort. No observed row holds the model fixed while changing only the harness, or holds the harness fixed across all model families.

A durable leaderboard receipt should therefore identify at least:

1. model and exact model revision;
2. harness, harness revision, system prompt, tool schemas, and observation encoding;
3. requested and provider-resolved reasoning effort and inference settings;
4. per-chamber attempt count, seed or initial state, and retry policy;
5. cost accounting rules and prices used at evaluation time;
6. plan, time, token, and dollar ceilings, including which ceiling ended a failed run;
7. chamber coverage and whether a result is complete, pending, excluded, or failed;
8. full trajectory identity and the independent state check used to declare success; and
9. repeated-run stability for each model-harness-chamber cell.

The benchmark's dual 300-plan and $30 stop rule is also part of the task definition. “Not solved” can mean inability to find a plan, excessive deliberation, expensive model usage, or reaching either censoring threshold. That makes the leaderboard useful as a bounded operational comparison, but it does not isolate spatial reasoning capability from harness behavior and economics.

Fresh independent chamber runs reduce cross-level memory contamination, while pausing during model thought separates in-game time from inference latency. Those are useful design choices. They do not establish robustness from one retained result per chamber: a completion count without repeated attempts cannot show how sensitive a row is to sampling, camera state, action timing, or transient provider behavior.

This finding complements [Harness benchmarks need effective-request capture](./2026-11-10-harness-benchmarks-need-effective-request-capture.md). That source shows server defaults breaking a nominal same-model control; Portal2Bench shows the broader case where model, harness, effort, cost, and incomplete task coverage jointly define each leaderboard row.

## Relevance to May

For May evaluations involving different executors or models, the displayed row should be keyed by the complete execution package and bounded task contract. Cost or operation ceilings should be reported as termination causes rather than collapsed into ordinary task failure, and incomplete coverage should remain visibly incomplete. If stochastic agents are compared, repeated-run stability should be retained separately from best-run or one-run completion.

## Evidence limitations

- The source is a producer-authored, changing dashboard. The research writeup is not yet available, and Scout found no inspected versioned source revision for the benchmark implementation or dataset.
- Scout statically inspected the rendered methodology, FAQ, leaderboard, changelog, and selected embedded run material. Scout did not run Portal 2, the harnesses, models, QA check, or scoring logic, and did not exhaustively audit every embedded trajectory.
- The page does not establish matched harnesses, prompts, tool implementations, reasoning settings, retries, or compute budgets across rows. The reported counts therefore do not support a causal ranking of model capability.
- Several model rows remain incomplete, and the dashboard supplies no uncertainty intervals or repeated-run stability measurements.
- API-list-price cost is an accounting convention and can change over time; solved-only medians do not measure total expected spend per successful chamber.
- HN supplied discovery rather than corroboration: item 50492238 had three points and no comments when inspected.
- Results in one commercial puzzle game do not establish general embodied-agent reliability, physical-world safety, or transfer to other interfaces.

**Disposition:** new knowledge — Portal2Bench provides a concrete interactive benchmark whose explicit harness and budget differences make model-harness identity, censoring causes, coverage, and repeated-run stability necessary leaderboard evidence.

## Primary sources

- Portal2Bench dashboard: https://kingstonyip.com/portal2bench
- Hacker News item: https://news.ycombinator.com/item?id=50492238
- HN Algolia item record: https://hn.algolia.com/api/v1/items/50492238
