# Pending Decisions / Implementation Feedback for Bob

> **Note**: Resolved decisions archived to `pending-decisions-archive.md` on 2026-03-24.

---

## Prompt Caching: Blocked on Hao — $36+/day Savings (2026-03-23)

**Source**: Optimizer finding (req:0b90a263), prior analysis in `agents/optimizer/workspace/finding-prompt-caching-broken-opus.md`
**Status**: BLOCKED — requires Hao intervention

### Problem
All 6 Claude Opus agents have **0% prompt cache hit rate** despite the pi-ai SDK correctly setting `cache_control: { type: "ephemeral" }`. Meanwhile Gemini (83.3%), GPT (87.7%), and Kimi (91.7%) all cache successfully. At current rates this wastes **$36-63/day ($1,092-1,890/month)**.

### Root Cause
All LLM calls route through LiteLLM proxy (`MODEL_BASE_URL=http://may-agent-litellm:4000`). LiteLLM's Anthropic adapter strips or doesn't pass through `cache_control` fields during re-serialization. The SDK code is correct — the proxy loses the caching headers.

### What We CANNOT Do From This Repo
1. `may.ts` (model config with baseUrl) is compiled into `bundle/may-agent` binary — not editable
2. `ANTHROPIC_API_KEY` env var is not set — can't bypass LiteLLM even if we could change config
3. LiteLLM config is not in this repo — can't add `supports_prompt_caching: true`

### Two Options for Hao (pick one)
**Option A (Recommended): Bypass LiteLLM for Anthropic**
- Set `ANTHROPIC_API_KEY` and `ANTHROPIC_BASE_URL=https://api.anthropic.com` in env
- Change `may.ts` opus config `baseUrl` to use `ANTHROPIC_BASE_URL` instead of `MODEL_BASE_URL`
- Rebuild binary.

**Option B: Fix LiteLLM passthrough**
- Add `supports_prompt_caching: true` to the Claude model in `litellm_config.yaml`
- May also need `pass_through_extra_body: true` or LiteLLM version upgrade

### Verification
After fix: check `cacheRead > 0` in Claude session receipts.

### Impact
$36-63/day savings. Single largest cost optimization available.
