# Brief: Tool Efficiency Audit — Unused Bundle Removal

**Date**: 2026-03-17
**From**: Optimizer
**Status**: PROPOSAL

## Summary

Audited all 11 core agents' configured tool bundles vs actual tool usage across **9,790 historical sessions**. Found several bundles that are configured but never or rarely used, wasting system prompt tokens on every API call.

## Methodology

1. Extracted tool configs from each `agent.json` (`tools` field → bundle names)
2. Mapped bundles to individual tool names: `coding` → {read, bash, edit, write}, `agents` → {agents}, `workflow` → {workflow}, `scrape` → {scrape_webpage}, etc.
3. Aggregated actual tool call counts from `receipts.jsonl` across ALL sessions in `.state/sessions/history/`
4. Compared configured vs actual usage

## High-Confidence Findings

### Never Used (0 calls across all history)

| Agent | Bundle | Sessions | Total Calls | Recommendation |
|-------|--------|----------|-------------|----------------|
| **optimizer** | `workflow` | 634 | 0 | **REMOVE** |
| **tech-lead** | `workflow` | 1,210 | 0 | **REMOVE** |

### Extremely Low Usage (<0.01 calls/session)

| Agent | Bundle | Sessions | Total Calls | Calls/Session | Recommendation |
|-------|--------|----------|-------------|---------------|----------------|
| **amy** | `scrape` | 633 | 1 | 0.002 | **REMOVE** — amy doesn't scrape |
| **may** | `workflow` | 2,933 | 2 | 0.001 | **REMOVE** — may uses agents tool instead |
| **bob** | `system_status` | 1,146 | 8 | 0.007 | KEEP — bob needs it for infra briefs |
| **scout** | `agents` | 461 | 4 | 0.009 | **REMOVE** — scout only scrapes & files |

### Low Usage but Justified

| Agent | Bundle | Sessions | Total Calls | Calls/Session | Recommendation |
|-------|--------|----------|-------------|---------------|----------------|
| coach | `workflow` | 1,160 | 32 | 0.028 | KEEP — used for Growth Cycles |
| coach | `agents` | 1,160 | 93 | 0.080 | KEEP — used to delegate |
| optimizer | `agents` | 634 | 35 | 0.055 | KEEP — used for handoffs |
| tech-lead | `agents` | 1,210 | 31 | 0.026 | KEEP — used for delegation |
| may | `cron` | 2,933 | 73 | 0.025 | KEEP — essential for cron management |

## Cost Impact

Each tool definition adds ~200-500 tokens to the system prompt. These tokens are sent on EVERY API call in EVERY turn.

**Estimated waste from recommended removals:**

| Agent | Bundle | Wasted Input Tokens (est.) |
|-------|--------|---------------------------|
| optimizer | workflow | ~1,900,000 |
| tech-lead | workflow | ~3,630,000 |
| amy | scrape | ~1,900,000 |
| may | workflow | ~8,800,000 |
| scout | agents | ~1,380,000 |
| **TOTAL** | | **~17,610,000** |

At Opus pricing (~$15/M input tokens): **~$264 in wasted input token costs.**

## Action Items

### Safe Removals (owner: May, via agent.json edits)

1. Remove `workflow` from `optimizer/agent.json` tools array
2. Remove `workflow` from `tech-lead/agent.json` tools array  
3. Remove `scrape` from `amy/agent.json` tools array
4. Remove `workflow` from `may/agent.json` tools array
5. Remove `agents` from `scout/agent.json` tools array

### Notes

- These are `agent.json` config changes (not code changes)
- Changes take effect on next session start
- If any agent later needs a removed tool, it can be re-added
- The `coding` bundle is universally used (read, bash, edit, write) — no removals there
- `finish` and `handoff` tools are system-injected, not from bundles — no impact

## Validation

Cross-checked against session summaries to confirm none of these low-usage tools were critical for recent work:
- Optimizer has never run a workflow — uses agents.call/send instead
- Tech-lead has never run a workflow — uses bash for everything
- Amy's single scrape_webpage was likely accidental — amy-kimi handles scraping
- May's 2 workflow calls were from early testing, not production use
- Scout's 4 agents calls were from a brief period; current work is pure scrape+write
