<ai_context>
summary: "OmniRoute gateway feature note, qualified by later HN evidence that provider fallback changes model behavior, shell-output compression does not reliably reduce end-to-end agent cost, and in-agent failover needs an explicit partial-output boundary."
triggers: ["OmniRoute", "GoatCode", "model gateway", "provider fallback", "OpenRouter", "RTK", "token compression", "behavioral conformance", "partial output"]
last_updated: "2026-09-12"
source_basis: "OmniRoute repository; HN 49621546 and HN 49656471 with linked practitioner reports; HN 49670455 and GoatCode commit a69f0779c97118aececa75d97192c55b2be77bcd."
</ai_context>

# OmniRoute: Free AI Gateway with Agent-Native Features

Date: 2026-07-21
Source: GitHub
Repo: https://github.com/diegosouzapw/OmniRoute

## Summary

OmniRoute is an MIT-licensed TypeScript AI gateway that unifies 268+ providers (50+ free) and 500+ models behind a single endpoint. It supports Claude, GPT, Gemini, Kimi K3, DeepSeek, and others. Purpose-built for coding agents — works with Claude Code, Codex, Cursor, Cline, and Copilot out of the box.

## Key Features

- **Quota-aware auto-fallback**: Automatically routes to next provider when rate limits hit
- **RTK+Caveman compression**: Saves 15–95% tokens via request/response compression
- **MCP/A2A support**: Native Model Context Protocol and Agent-to-Agent protocol integration
- **Multimodal**: Supports vision, audio, and text across providers
- **Desktop/PWA**: Includes local UI for management and monitoring

## Agent Engineering Relevance

- Solves the multi-provider orchestration problem for agents that need reliable LLM access
- Token compression directly reduces agent operating costs
- MCP/A2A support means agents can use OmniRoute as both a model router and a protocol bridge
- Auto-fallback makes long-running agent workflows resilient to per-provider rate limits

## Metrics

- 22,199★, 2,998 forks
- 500+ contributors
- MIT license
- Active development (last updated 2026-07-21)

## HN update — routing and compression need end-to-end conformance (2026-09-11)

Two front-page HN reports qualify the feature claims above. They do not test
OmniRoute itself, but they test the mechanisms its claims depend on.

### A model identifier does not define one behavioral contract

An operator reporting roughly six million open-model messages through OpenRouter
found material differences among providers serving nominally identical weights:
per-provider DeepSeek V4 Flash scores ranged from 58% to 81% on TAU-Bench
Airline; some vision endpoints returned HTTP 200 while failing to see images;
some providers ignored the reasoning-effort setting; and tool-call parsing and
reasoning-history requirements differed by provider. Three pinned providers
also failed in sequence as availability changed. HN commenters independently
reported inconsistent results, cache loss when traffic moves between providers,
and JSON/tool-call incompatibilities.

**Design implication:** quota-aware fallback is useful for transport availability,
but it is not semantically transparent. Treat `(model, provider, endpoint
configuration)` as the deployed artifact. Continuously probe each candidate from
the production network for the workload's required modalities, tool-call shape,
history rules, non-empty completion invariant, and caching behavior. A fallback
should be admitted only after those checks, and each run should record the actual
provider selected.

- Source: https://news.ycombinator.com/item?id=49621546 (662 points / 181 comments when checked)
- Source: https://mmoustafa.com/blog/so-you-want-to-use-openrouter/

### Fewer displayed bytes are not the same as a cheaper successful task

A $1,500+, 1,740-attempt Terminal-Bench 2.1 study compared RTK against baselines
on Fable 5.0 and DeepSeek V4 Pro. RTK lowered the aggregate Fable bill 5%, but
almost all savings came from one task; the average task was 1% more expensive
with no clear difference from zero. DeepSeek's aggregate bill rose 5% and its
average task cost rose 17%. DeepSeek turns increased 18%, overwhelming smaller
per-turn inputs. The tool's `rtk gain` counter also credited output that commands
such as `head` would never have emitted and omitted downstream turns. One rewrite
bug produced 339 consecutive errors before timeout.

**Design implication:** compression belongs behind an outcome-level experiment,
not in a guaranteed-savings claim. Measure pass rate, total cost per successful
attempt, turns, retries, and failure modes on the exact harness/model pair. Keep
raw output recoverable, bound rewrite retries, and never use bytes removed or a
local “tokens saved” counter as the economic metric.

- Source: https://news.ycombinator.com/item?id=49656471 (136 points / 62 comments when checked)
- Source: https://quesma.com/blog/does-rtk-make-ai-coding-cheaper/

Together these reports refine the gateway pattern: **availability routing must
preserve a declared behavioral contract, while cost optimization must be judged
at the successful-task boundary.** Auto-fallback and compression remain useful
mechanisms, but neither proves the outcome named by its feature label.

## HN update — the partial-output boundary is part of failover correctness (2026-09-12)

HN item 49670455 introduced GoatCode, a newly published terminal coding agent
whose v2.1.10 repository makes a useful failover boundary inspectable in code.
At commit `a69f0779c97118aececa75d97192c55b2be77bcd`, its agent retries retryable
429/5xx/network failures only before any text, thinking, or tool call has
streamed. If the primary still fails before content, it walks configured
fallback models; the first one to emit content becomes the session model. The
TUI also saves that model to configuration, making the switch persistent across
restarts. If either the primary or a fallback fails after emitting content, the
agent surfaces the error instead of switching again, because replaying the turn
could duplicate text or tool effects.

This is a stronger design signal than the launch claim that failover loses no
context: the code defines *when* continuation is safe. It also exposes the
remaining contract gap. The tests cover a primary 429, a failed first fallback,
a successful second fallback, sticky model selection, and the empty-chain error,
but the repository supplies no cross-provider behavioral-conformance suite or
outcome benchmark. A preserved transcript is therefore not proof that a new
model interprets that transcript, tool schemas, reasoning history, or pending
intent equivalently.

**Design implication:** agent-level failover should be modeled as a state
transition, not merely another HTTP retry. Record the provider/model transition;
permit automatic replay only before observable output or effects; make a
post-output failure explicit; and separately qualify fallback candidates for the
workload's tool and history contract. Persistence also needs a policy choice:
a sticky switch improves availability after restart but can silently turn an
emergency fallback into the next session's default.

- Source: https://news.ycombinator.com/item?id=49670455
- Repo: https://github.com/Arhan-w/GoatCode/tree/a69f0779c97118aececa75d97192c55b2be77bcd
- Implementation: `src/agent.ts`, `src/tui.tsx`; regression coverage: `tests/core.test.ts`
- Evidence limit: one author-controlled repository, created 2026-09-07, with one
  GitHub star and no independent usage or quality evaluation when checked.
