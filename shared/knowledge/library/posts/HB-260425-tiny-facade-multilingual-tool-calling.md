# TinyFacade: Multilingual Tool Calling in 70+ Languages On-Device

**Source**: Hugging Face Blog (Cohere Labs)
**Date**: April 20, 2026
**Authors**: Bronson, Kato Steven Mubiru, Gimei Alex, OJ Onyeagwu, Adnan El Assadi
**URL**: https://huggingface.co/blog/Bronsn/tiny-facade

---

## Core Finding

A **3.35B parameter model with zero tool-call training** can outperform models explicitly trained for tool calling on 70+ languages, including low-resource languages like Swahili and Luganda. Key insight: **good instruction following + proper template > specialist training**.

---

## Key Results

### Model Comparison (Tool Calling Accuracy)

| Model | English | Swahili | Luganda | Notes |
|-------|---------|---------|---------|-------|
| **TinyAya-Earth (3.35B)** | 88.7% | 79.5% | 85.9% | Zero tool-call training |
| Aya Expanse (8B) | 81.6% | 62.6% | 64.0% | Trained for tool calling |
| Command R (35B) | 97.2% | 94.6% | 89.3% | Server required |

**Key insight**: TinyAya-Earth beats Aya Expanse 8B by **22pp on Luganda**, **17pp on Swahili**, **7pp on English** — despite being 2.4x smaller and having no tool-call training.

### Critical Finding: 4-Bit > FP16

4-bit quantization **outperforms** fp16 by 5-9 percentage points on specialist models:
- TinyAya-Earth 4-bit: **89.7%** JSON accuracy (European languages)
- TinyAya-Earth 4-bit: **80.2%** (Middle Eastern languages)

**Implication**: Smaller files, better accuracy, mobile deployment viable.

### Temperature = 0 Non-Negotiable

Every 0.3 step increase in temperature costs **5-10 percentage points** across all language families. Degradation is monotonic with no recovery.

**For deployment**: Greedy decoding at temperature 0.0 is mandatory for reliable tool calling.

### Script System > Geography

The **writing system** (Latin, CJK, Devanagari, Thai, Ethiopic, Armenian, Myanmar, Khmer) predicts tool-calling accuracy better than geographic language family. Latin script languages perform consistently well regardless of region.

---

## Android Shared Service Architecture

The team built a "facade" inference engine using **Android AIDL shared service pattern**:
- Single inference process shared across multiple apps
- Apps query the service via IPC
- Reduces memory overhead vs each app bundling its own model

**Pattern**: Similar to Chrome's network service — one heavy process, many lightweight clients.

---

## Ollama Template Bug

Discovered that Ollama was loading **Cohere Command template** instead of Tiny Aya's actual template, degrading performance by **>30%**. Fixed in their GGUFs.

**Lesson**: Template matching is critical — wrong template can destroy performance regardless of model quality.

---

## What This Means for OpenClaw

1. **On-device Skill viability**: 3.35B models with good templates can achieve >85% tool calling accuracy on mobile — Skill execution can happen locally for sensitive operations

2. **Temperature policy**: Must enforce temperature=0 for deterministic tool calling (already in spec?)

3. **Quantization strategy**: 4-bit may improve accuracy for tool calling, not just reduce size — counterintuitive finding worth validating

4. **Template hygiene**: Skill templates must be explicitly versioned and matched to model — template mismatch can silently degrade performance 30%+

5. **Multilingual Skills**: Hermes tool calling format works across 70+ languages — Skill schema may not need per-language customization if using Hermes format

6. **Shared service pattern**: Evaluate Android AIDL / iOS XPC pattern for multi-app Skill deployment — single inference process, multiple agent clients

---

## Open Questions

- How does 4-bit quantization affect non-tool-calling Skill performance?
- Can we build a "Skill Facade" shared service for desktop (not just mobile)?
- Should we add script-system metadata to Skill spec for language routing?

---

**Rating**: ★★★★★ — Validated on-device deployment path, revealed counterintuitive quantization finding, established temperature=0 as non-negotiable for production.
