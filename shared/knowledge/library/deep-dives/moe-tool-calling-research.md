# MoE (Mixture of Experts) Model Tool-Calling Failures & Workarounds

**Research Date:** 2026-03-09 12:56 UTC (verified via `date -u`)
**Source:** Reddit r/LocalLLaMA via arctic-shift API (`arctic-shift.photon-reddit.com`)
**Researcher:** Scout Agent

---

## Executive Summary

MoE models are among the most capable local LLMs, but they suffer from a consistent pattern of tool-calling failures that dense models often avoid. These failures span **inference backend incompatibility**, **quantization-induced degradation**, **tool-parser bugs**, and **bizarre agentic-loop regressions**. The community has developed a patchwork of workarounds—custom parsers, proxy wrappers, backend-specific fixes, and quantization strategies—but no unified solution exists.

---

## 1. The Core Problem: MoE Models and Tool-Calling Infrastructure

### 1.1 Fast MoE Backends Break OpenAI-Compatible Tool Calling
**[CONFIRMED]** — Full post read: u/Teachings, 2025-05-07, post `1kgpujo` (32 upvotes, 18 comments)

The fastest inference backends for large MoE models—**ik_llama** and **ktransformers**—which are specifically designed for models like Qwen3-235B and DeepSeek-V3-0324 (685B), **completely break OpenAI-style tool calling and structured JSON responses**. Despite exposing a `/v1/chat/completions` endpoint and claiming OpenAI compatibility, neither properly handles:

- The `tools` or `function` field in requests
- Emitting valid JSON when expected as structured output

**Workaround (community-developed):** The author wrote **FastAgentAPI** ([GitHub](https://github.com/Teachings/FastAgentAPI)), a local proxy wrapper that:
1. Intercepts chat completions requests
2. Enriches prompts with tool metadata (injecting tool schemas into the system/user prompt)
3. Parses and transforms the raw model output into OpenAI-compatible tool-call responses

This pattern—prompt injection + output parsing—has become the de facto workaround when the serving backend doesn't natively support tool calling for MoE models.

### 1.2 Seed-OSS 36B: The Agentic Loop Paradox
**[CONFIRMED]** — Full post read: two independent sources

**Source A:** u/AvocadoArray, 2026-03-06, post `1rmn4gx` (174 upvotes, 140 comments) — "Finally bought an RTX 6000 Max-Q"

Seed-OSS 36B (ByteDance's MoE model) required **fixing vLLM's tool call parser** to work at all. The author has an [open PR #32430](https://github.com/vllm-project/vllm/pull/32430) against vLLM with fixes, which had been stale for weeks. Interim workaround: bind-mounting a fixed parser file to `/usr/local/lib/python3.12/dist-packages/vllm/tool_parsers/seed_oss_tool_parser.py`.

Even with the fixed parser, the model still:
- Occasionally fails the `apply_diff` tool call in Roo Code
- Gets line indentation wrong in generated code
- These issues persist across quantization levels (INT4 and AWQ-INT8), suggesting they may be **tool-parsing errors** rather than quantization artifacts

Additionally: **"tool parsing in llama.cpp is more broken than vLLM"** for this model and "does not work with Roo Code" at all via the llama.cpp backend.

**Source B:** u/3615-computer (Alyx), 2026-02-23, post `1rcjepp` (96 upvotes, 39 comments) — MCP benchmark of 17 models

> "**seed-oss-36b is the most bizarre result.** In single-shot it scored 100% L0 and 80% L1 (71% overall) — among the better results. In the agentic loop it scored **0% across all 28 tasks** and never emitted a single tool call."

The only difference between runs was that the agentic runner feeds tool results back as context. Receiving tool results caused the model to **completely stop calling tools**. The benchmarker explicitly asked the community: "If you've run this model in an agentic setup successfully, I'd genuinely like to know what setup you used."

**Assessment:** Seed-OSS 36B (MoE) has a fundamental regression when it receives tool results in context. This is a model-level issue, not just a parser issue.

### 1.3 llama.cpp Tool Parsing: Broadly Broken for MoE Models
**[CONFIRMED]** — Read in RTX 6000 Max-Q post (Source A above)

The author explicitly states: "MagicQuant mxfp4_moe-EHQKOUD-IQ4NL performs great as well, but **tool parsing in llama.cpp is more broken than vLLM** and does not work with Roo Code." This refers to MoE-specific GGUF quantizations where the llama.cpp server's tool-call parsing cannot correctly handle the model's output format.

**[INFERRED]** — From multiple partial sources: llama.cpp's tool-calling support is a known pain point across the r/LocalLLaMA community. The 21-model small LLM benchmark (post `1r4ie8z`) found that **5 out of 21 models required custom fallback parsers** because they output non-standard formats (bracket notation, raw JSON, bare function calls, missing XML tags). This parser fragility is amplified with MoE models that may route through different experts producing inconsistent output formatting.

---

## 2. Quantization-Specific Issues for MoE Tool Calling

### 2.1 Unsloth's Qwen3.5-35B-A3B Tool-Calling Chat Template Bug
**[CONFIRMED]** — Full post read: u/danielhanchen (Unsloth), 2026-03-03 (approx.), post on HuggingFace + Reddit `1rjh5wg` (301 upvotes) and companion post (505 upvotes)

Unsloth discovered and fixed a **tool calling chat template bug** affecting Qwen3.5-35B-A3B (an MoE model with 35B total / 3B active parameters). This bug **"affects all quant uploaders"** — meaning every GGUF quantization of this model from other providers (Bartowski, Ubergram, etc.) shipped with broken tool calling until the fix.

Key quantization findings from Unsloth's 150+ KL Divergence benchmarks (9TB of GGUFs tested):
- **Quantizing `ssm_out` (Mamba layers) dramatically increases KLD** — bad for hybrid MoE+SSM architectures
- **`ffn_down_exps` is more sensitive** than `ffn_up_exps` or `ffn_gate_exps` to quantization
- **MXFP4 is "much worse" than Q4_K** on many tensor types (attn_gate, attn_q, ssm_beta, ssm_alpha)
- **Imatrix helps significantly** reduce KLD and perplexity for MoE quantizations
- **3-bit (iq3_xxs) is the sweet spot** for expert FFN layers — compromise between size and quality

**Practical impact:** After downloading the fixed Unsloth quants, one user (post `1rjh5wg`, 301 upvotes) reported that Qwen3.5-35B-A3B went from "a small jump over GLM-4.7-Flash" to being "incredible at research tasks" with native tool calling via llama.cpp-rocm + OpenWebUI + SearXNG.

### 2.2 Unsloth FP8-dynamic Quant Failures
**[CONFIRMED]** — RTX 6000 Max-Q post

For Qwen3-Coder-Next, Unsloth's FP8-dynamic quant "loaded just fine, but always responded with infinitely repeating exclamation points '!!!!!!!!!!...'". The fix was to use the official `Qwen/Qwen3-Coder-Next-FP8` quant from Hugging Face, which works correctly. This suggests that quantization method matters enormously for tool-calling models, and community quants can silently break functionality.

---

## 3. Model-Specific MoE Tool-Calling Performance

### 3.1 Comprehensive MCP Benchmark (17 models, real API)
**[CONFIRMED]** — Full post read: u/3615-computer, 2026-02-23, post `1rcjepp`

This benchmark tested models against a real MCP server with 19 tools across 3 difficulty levels. Key MoE-relevant findings:

| Model | Type | Single-Shot | Agentic | Notes |
|-------|------|-------------|---------|-------|
| **Seed-OSS 36B** (ByteDance) | MoE | 71% | **0%** | Complete agentic collapse |
| **Qwen3-Coder 30B** | MoE-like | 71% | 88% | Strong, 2nd place |
| **Ernie-4.5-21B-A3B** (Baidu) | MoE | 0% (not tool-trained) | 83% | Massive agentic improvement |
| **GLM-4.7-Flash 30B** | MoE | 44% | 61% | Inverted: L2 (71%) > L0 (55%) |
| **GLM-4.6v-Flash 9.4B** | MoE | 67% | 68% | Modest improvement |
| **IBM Granite-4-h-tiny 7B** | Dense | 73% | **89% (#1)** | Best overall |

**Key takeaway:** MoE models show the widest variance between single-shot and agentic performance. Seed-OSS collapses entirely; Ernie goes from 0% to 83%. Dense models are more predictable.

**Universal failure modes across all models:**
- **L1-03** ("add three tasks"): Most models call `create_task` once and stop — they can't handle multiple sequential calls from a single message
- **L2-07** (sprint closeout): **0/17 models pass** — 3-step sequential task with state threading is unsolvable
- **DeepSeek-R1 8B** hallucinated a tool named literally `tool_name` on most tasks — understood the shape but not the content

### 3.2 AMD's Coding Agent Testing (20+ models)
**[CONFIRMED]** — Full post read: u/unknown, 2025-09-30, post `1nufu17` (414 upvotes, 112 comments), referencing AMD's official blog

AMD tested 20+ local models for AI coding via Cline + LM Studio. Results:
- **Only Qwen3-Coder 30B and GLM-4.5-Air consistently work** for complex tool-calling that coding agents need
- "DeepSeek, smaller Llama models, GPT-OSS-20B, **Seed-OSS-36B** all produce broken outputs or can't handle tool use properly"
- Cline is "pretty demanding in terms of tool-calling and context management"

This independently validates the MCP benchmark finding that Seed-OSS-36B has fundamental tool-calling issues.

### 3.3 Qwen3-Coder-Next vs Seed-OSS 36B (Head-to-Head)
**[CONFIRMED]** — RTX 6000 Max-Q post

Direct comparison from daily agentic coding use:

**Seed-OSS 36B (MoE):**
- Required fixing vLLM's tool parser (open PR #32430)
- Occasionally fails `apply_diff` tool calls
- "tool parsing in llama.cpp is more broken than vLLM"
- Great at following instructions over long multi-turn tasks
- Code quality nearly indistinguishable from human

**Qwen3-Coder-Next (dense-ish):**
- "More consistent with tool calls"
- Twice as fast at FP8 than Seed at INT4
- Stronger debugging capability
- "Highly sycophantic. HATES to explain itself"
- More prone to "stupid" mistakes but self-corrects 95% of the time
- "Extremely lazy without guardrails"

**Devstral 2 Small** was noted as "broken in Roo right now after they removed the legacy API/XML tool calling features."

### 3.4 GLM-4.6: "Haunted Model" Failure States
**[CONFIRMED]** — Full post read: u/unknown, 2025-10-27, post `1oh4cwo` (4 upvotes, 42 comments)

GLM-4.6 (a large MoE model from Zhipu/Z.ai) exhibits severe failure modes:
- **Hybrid reasoning mode failures:** Race conditions between "thinking" mode and direct response mode
- **KV cache competition:** Two modes appear to compete for the same KV cache, causing memory access conflicts
- **Conversational text bleeding into thinking traces** (and vice versa)
- Aggressive KV cache quantization for 200K context causes "compression artifacts that accumulate over long generations"
- **Attention mechanism corruption** cascading through longer contexts

These architectural issues directly impact tool-calling reliability, as tool-call formatting requires precise structured output that is especially vulnerable to the described corruption modes.

---

## 4. Infrastructure & Parser Issues

### 4.1 The Parser Problem Is As Important As the Model
**[CONFIRMED]** — Full post read: u/MikeVeerman, 2026-02-14, post `1r4ie8z` (89 upvotes, 42 comments)

Testing 21 small LLMs on tool-calling judgment revealed:

> "**How you parse tool calls matters as much as what you test.**"

Five models required custom fallback parsers:
- **lfm2.5** → bracket notation `[get_weather(city="Antwerp")]`
- **jan-v3** → raw JSON
- **gemma3** → function syntax inside tags
- **deepseek-r1** → bare function calls
- **smollm3** → sometimes omits tags entirely

Critical insight: **Fixing the parser doesn't always help:**
- lfm2.5: 0.640 → 0.880 (parser was hiding correct behavior)
- gemma3: 0.600 → **0.550** (parser blindness was hiding BAD behavior)
- "Format-blind benchmarks don't just underestimate models. They can **overestimate them too**."

### 4.2 vLLM Docker + CUDA Bugs
**[CONFIRMED]** — RTX 6000 Max-Q post

vLLM v0.15 Docker image fails to see CUDA devices on newer GPUs due to [bug #32373](https://github.com/vllm-project/vllm/issues/32373). Workaround:
```bash
-v /dev/null:/etc/ld.so.conf.d/00-cuda-compat.conf -v /dev/null:/etc/ld.so.conf.d/cuda-compat.conf
```

### 4.3 Ollama's MoE-Specific Implementations
**[CONFIRMED]** — Full post read: 2025-05-15 (approx.), post `1knp0ra` (Ollama blog repost)

Ollama's new engine includes MoE-specific optimizations for tool calling:
- **Llama 4 Scout/Maverick** (MoE): Required implementing chunked attention, attention tuning, specific 2D rotary embedding
- Warning: "If a model's attention layer isn't fully implemented... the end user may begin to see erratic or degraded output over time. This becomes especially prominent the longer the context."
- Tool calling with streaming responses listed as "What's next" (not yet implemented at time of post)

---

## 5. Workarounds Summary

| Problem | Workaround | Source |
|---------|-----------|--------|
| ik_llama/ktransformers no tool support | **FastAgentAPI proxy** — intercept, inject, parse | Post `1kgpujo` [CONFIRMED] |
| Seed-OSS 36B vLLM parser broken | Bind-mount fixed `seed_oss_tool_parser.py`; PR #32430 | Post `1rmn4gx` [CONFIRMED] |
| Seed-OSS 36B agentic loop → 0% | **No known workaround** — model-level issue | Post `1rcjepp` [CONFIRMED] |
| llama.cpp tool parsing broken for MoE | Use vLLM instead; or prompt-inject tools | Posts `1rmn4gx`, `1kgpujo` [CONFIRMED] |
| Qwen3.5-35B-A3B tool calling broken | Re-download **Unsloth-fixed GGUFs** | Post `1rjh5wg` [CONFIRMED] |
| Non-standard tool-call output formats | Custom fallback parsers per model | Post `1r4ie8z` [CONFIRMED] |
| Unsloth FP8-dynamic → infinite `!!!` | Use official Qwen FP8 quant instead | Post `1rmn4gx` [CONFIRMED] |
| GLM-4.6 reasoning/generation corruption | Use NovitaAI (not Z.ai) as provider; avoid long contexts | Post `1oh4cwo` [CONFIRMED] |
| Devstral 2 broken after XML removal | Wait for Roo Code fix (no current workaround) | Post `1rmn4gx` [CONFIRMED] |
| MoE quant quality loss in expert layers | Keep `ffn_down_exps` ≥3bit; don't quantize `ssm_out`; use imatrix | Unsloth research [CONFIRMED] |
| Models without native tool training | Agentic loop + context gives them enough info (Ernie: 0%→83%) | Post `1rcjepp` [CONFIRMED] |

---

## 6. Emerging Solutions

### 6.1 Vera 1.6: Purpose-Built MoE for Tool Calling
**[HEADLINE-ONLY]** — Title and body read but model is brand new (2026-03-09), 0 comments, unvalidated

Cortex Research's Vera 1.6 claims to be an agentic MoE built on Qwen 3.5 with:
- Gated Delta Networks + Sparse MoE architecture
- 1M token context with native multimodal support
- "Agent-Specific Alignment" — trained on datasets for high-fidelity JSON generation, multi-step tool calling, and long-context execution
- Standard RLHF allegedly "makes models polite but terrible at recursive tool use"

**Assessment:** Unvalidated — no community feedback yet. The claimed approach (RL specifically for tool use on an MoE backbone) directly targets the problems documented in this report.

### 6.2 Multi-Agent Coordination with Local MoE Models
**[CONFIRMED]** — Full post read: u/unknown, 2026-03-04, post `1rkqs6p`

The aIRCp project demonstrates using Qwen3 80B MoE as a lead agent alongside cloud models, with a **`[TOOL: name]` fallback parser** for models without native function calling. The tool router handles format differences transparently. The 80B MoE Qwen3 scored 19/20 on coordination tasks (tool use, structured output, multi-turn reasoning).

### 6.3 Conservative Tool-Calling Behavior Wins
**[CONFIRMED]** — Full post read: Round 2 benchmark (post `1r4ie8z`)

Top-scoring models succeed by **not acting on uncertain prompts** — restraint score matters as much as action score. This has implications for MoE models where different experts may have different "opinions" about whether to call a tool, potentially leading to inconsistent behavior.

---

## 7. Key Conclusions

1. **MoE models are NOT inherently worse at tool calling** — Qwen3-Coder 30B scores 88% agentic, second only to dense IBM Granite 7B. The problem is infrastructure, not architecture.

2. **The serving stack is the weakest link.** ik_llama, ktransformers, and llama.cpp all have broken or incomplete tool-calling support for MoE models. vLLM is the most reliable but still requires model-specific parser fixes.

3. **Quantization of MoE expert layers requires extreme care.** Aggressive quantization of `ffn_down_exps` and `ssm_out` tensors disproportionately impacts structured output quality. The Unsloth team's research provides the most rigorous guidance available.

4. **Chat template bugs can silently break tool calling for every downstream user.** The Qwen3.5-35B-A3B chat template bug affected "all quant uploaders" until Unsloth caught it.

5. **Agentic loops can both rescue and destroy MoE tool calling.** Ernie-4.5-21B-A3B went from 0% to 83% with agentic context. Seed-OSS-36B went from 71% to 0%. The interaction between MoE routing and multi-turn context is poorly understood.

6. **The community's workaround pattern is: proxy wrapper + prompt injection + custom parser.** This is fragile, model-specific, and doesn't scale. A standardized tool-calling middleware layer for local inference is a clear gap in the ecosystem.

---

## Sources Index

| ID | Date | Title | Score | Comments | Confidence |
|----|------|-------|-------|----------|------------|
| `1rmn4gx` | 2026-03-06 | Finally bought an RTX 6000 Max-Q | 174 | 140 | CONFIRMED |
| `1rcjepp` | 2026-02-23 | Benchmarked 17 local LLMs on MCP tool calling | 96 | 39 | CONFIRMED |
| `1rjh5wg` | 2026-03-03 | Unsloth fixed Qwen3.5-35B-A3B incredible at research | 301 | 67 | CONFIRMED |
| `1r4ie8z` | 2026-02-14 | Tested 21 small LLMs on tool-calling judgment R2 | 89 | 42 | CONFIRMED |
| `1kgpujo` | 2025-05-07 | ik_llama and ktransformers break tool calling | 32 | 18 | CONFIRMED |
| `1nufu17` | 2025-09-30 | AMD tested 20+ models, only 2 work | 414 | 112 | CONFIRMED |
| `1oh4cwo` | 2025-10-27 | GLM-4.6 major fail state uncovered | 4 | 42 | CONFIRMED |
| `1rkqs6p` | 2026-03-04 | Local LLMs as first-class agents (aIRCp) | 2 | 0 | CONFIRMED |
| `1knp0ra` | 2025-05-15 | Ollama's new engine for multimodal models | 1 | 0 | CONFIRMED |
| `1rolkad` | 2026-03-09 | Vera 1.6: Agentic MoE on Qwen 3.5 | 1 | 0 | HEADLINE-ONLY |
| `1rg4zqv` | 2026-02-27 | Unsloth Qwen3.5-35B-A3B dynamic GGUFs + benchmarks | 516 | 164 | CONFIRMED |
| `1nj5n67` | 2025-09-17 | Qwen 30B Coder BF16 crashes on llama.cpp | 4 | 19 | HEADLINE-ONLY |
