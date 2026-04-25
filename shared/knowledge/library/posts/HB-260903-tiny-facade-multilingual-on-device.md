---
id: HB-260903
date: 2026-04-25
title: "TinyFacade: Multilingual On-Device Tool Calling in 70+ Languages"
source: Hugging Face Blog / Cohere Labs
authors: Bronson Bakunga, Kato Steven Mubiru, Gimei Alex, et al.
url: https://huggingface.co/blog/Bronsn/tiny-facade
stars: ★★★★★
tags: [on-device, multilingual, tool-calling, android, mobile-ai]
---

# TinyFacade: 3.35B Model, 70+ Languages, 85%+ Tool Calling Accuracy On-Device

## Key Insight

Tool calling can run effectively on mid-range phones with **airplane mode on**. TinyFacade uses TinyAya-Earth (3.35B) with zero tool-call training to achieve **85-90% JSON accuracy** across 70+ languages — beating Aya Expanse 8B (which was trained for tool calling).

## Headline Results

| Language | TinyAya-Earth 3.35B | Aya Expanse 8B | Delta |
|----------|---------------------|----------------|-------|
| Luganda | **85.9%** | 64.0% | **+22pp** |
| Swahili | **79.5%** | 62.6% | **+17pp** |
| English | **88.7%** | 81.6% | **+7pp** |

Command R 35B remains upper bound (97.2% English) but requires server + internet + per-token cost.

## Surprising Finding: 4-Bit > fp16

On specialist models, **4-bit quantization outperforms fp16 by 5-9 percentage points**:

- TinyAya-Earth 4-bit: 89.7% JSON accuracy (European), 80.2% (Middle Eastern)
- Smaller files, better accuracy — ideal for mobile deployment

## Temperature Must Be Zero

Every 0.3 step increase costs 5-10pp accuracy. **Greedy decoding at temperature 0.0 is non-negotiable** for deployment.

## Architecture: Android AIDL Shared Service

### TinyFacade Design

```
TinyAya-Earth (3.35B, 4-bit GGUF)
    ↓
Android Service via AIDL (2.14 GB loaded once)
    ↓
5 Action Primitives: HTTP | File | System | Intent | ContentResolver
    ↓
Thin Client Apps (declarative JSON only)
```

### Client Apps Built

| App | Size | Purpose |
|-----|------|---------|
| TinyFacade App | 2.14 GB | Main inference service + chat interface |
| AIDL Test Client | ~MB | Tool call validation |
| Linga | ~MB | Standalone conversational AI demo |
| **Total** | **2.6 GB** | 3 apps vs 3×2GB bundled apps |

## Key Innovation: Shared Inference Service

**Problem**: Every app bundling its own 2GB model = not scalable

**Solution**: One hub aggregating models, thin clients using declarative JSON

> "Not everyone can download a 2GB application bundled with every single app"

## Script System Predicts Difficulty

Writing system (Latin, CJK, Devanagari, Thai, Ethiopic...) is a **stronger predictor** of tool-calling accuracy than geographic language family.

## Ollama Template Issue Discovered

Ollama was loading **Cohere Command template** instead of TinyAya template → **30%+ performance degradation**. Fixed in provided GGUFs.

## Resources

- **GGUF Models**: https://huggingface.co/collections/Bronsn/tiny-facade-multilingual-tool-calling-models
- **GitHub**: https://github.com/BakungaBronson/TinyFacade
- **Claude Skill**: https://github.com/BakungaBronson/tinyfacade-plugin
- **Linga App**: https://github.com/Gimmyalex/linga

## What This Means for OpenClaw

1. **On-Device Skill Execution**: Shared service pattern for mobile Skill deployment
2. **Multilingual by Default**: 70+ languages without separate training
3. **Quantization Strategy**: 4-bit can improve accuracy, not just reduce size
4. **Temperature Policy**: Greedy decoding (temp=0) for deterministic tool calling
5. **Template Sensitivity**: Prompt template mismatches cause 30%+ degradation

## Use Cases

- Voice agents for accessibility
- Low-resource language tool calling
- Offline/edge deployment scenarios
- Cross-app Skill sharing via shared service

## Next Steps (from Team)

- Merge Facade and thin client for easier distribution
- Voice agents and accessibility focus
- Expand to more African languages (Acholi, Alur...)

## Validation

Evaluation: 1,696 configurations × 2,792 items/language on MASSIVE-Agents benchmark

---

**Key Takeaway**: Small model + good instruction following + proper template > large specialist model for tool calling. Shared service architecture enables ecosystem-scale deployment.
