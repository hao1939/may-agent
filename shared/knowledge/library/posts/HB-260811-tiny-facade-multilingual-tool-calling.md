# TinyFacade: On-Device Multilingual Tool Calling in 70+ Languages

**Source**: Hugging Face Blog (Apr 20, 2026) — Cohere Labs Expedition Tiny Aya  
**Authors**: Bronson Bakunga, Kato Steven Mubiru, Gimei Alex, OJ Onyeagwu, Adnan El Assadi  
**Links**: [Blog](https://huggingface.co/blog/Bronsn/tiny-facade) | [GitHub](https://github.com/BakungaBronson/TinyFacade) | [Models](https://huggingface.co/collections/Bronsn/tiny-facade-multilingual-tool-calling-models)

---

## TL;DR

TinyFacade demonstrates that **3.35B parameter models can achieve 85%+ tool calling accuracy across 70+ languages on-device** — including low-resource languages like Luganda and Swahili. Key surprise: **4-bit quantization outperforms fp16** by 5-9 percentage points, and **temperature must be zero** for reliable deployment. An Android AIDL-based shared service architecture enables any app to access multilingual tool calling without bundling 2GB+ models.

---

## Core Findings

### 1. Model Performance: Tiny Beats Larger

| Model | Size | Luganda | Swahili | English |
|-------|------|---------|---------|---------|
| TinyAya-Earth | 3.35B | **85.9%** | **79.5%** | **88.7%** |
| Aya Expanse | 8B | 64.0% | 62.6% | 81.6% |
| Command R | 35B | 89.3% | 94.6% | 97.2% |

**Key insight**: TinyAya-Earth (zero tool-call training) beats Aya Expanse 8B (trained for tool calling) by **22pp on Luganda**, **17pp on Swahili**. Command R 35B remains upper bound but requires cloud + server infrastructure.

### 2. 4-Bit Quantization > FP16 (Unexpected)

On specialist models (fire, earth, water):
- 4-bit quantization **outperforms fp16 by 5-9 percentage points**
- TinyAya-Earth 4-bit: **89.7%** JSON accuracy on European languages, **80.2%** on Middle Eastern
- Smaller files + better accuracy = ideal for mobile deployment

### 3. Temperature Must Be Zero

- Every 0.3 step increase in temperature costs **5-10 percentage points** across all language families
- Degradation is **monotonic with no recovery**
- For deployment: **greedy decoding at temperature 0.0 is non-negotiable**

### 4. Script System > Geography for Difficulty

Writing system (Latin, CJK, Devanagari, Thai, Ethiopic, etc.) is a **stronger predictor of tool-calling accuracy** than geographic language family. Latin script languages perform consistently well regardless of region.

---

## Architecture: Android AIDL Shared Service

```
┌─────────────────────────────────────────────────────────────┐
│  TinyFacade Service (AIDL)                                  │
│  ├─ TinyAya-Earth 3.35B 4-bit GGUF (2.14 GB, loaded once)   │
│  ├─ Hermes tool calling format parser                       │
│  └─ Inference engine (llama.cpp)                            │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   ┌─────────┐        ┌─────────┐        ┌─────────┐
   │ Linga   │        │ Client  │        │ Client  │
   │ (Chat)  │        │   App   │        │   App   │
   └─────────┘        └─────────┘        └─────────┘
   
   All clients: 2.6 GB total storage vs 2GB+ per app
```

**5 Action Primitives for Tool Registration**:
1. `HTTP` - API calls
2. `file` - File system operations
3. `system` - System commands
4. `intent` - Android intents
5. `content_resolver` - Content provider queries

Clients declare tools via **declarative JSON** — no code runs on client.

---

## Technical Gotcha: Ollama Template Bug

Ollama was loading **Cohere Command template** instead of Tiny Aya's actual template — causing **>30% performance degradation**. Fixed in provided GGUFs.

---

## Evaluation Scale

- **1,696 total configurations** tested
- 4 Tiny Aya variants (fire, earth, water, global)
- 53 languages
- 2 quantizations (fp16, 4-bit)
- 4 temperatures (0.0, 0.3, 0.7, 1.0)
- MASSIVE-Agents benchmark: 2,792 items per language

---

## For OpenClaw

| Finding | Implication |
|---------|-------------|
| Small models + instruction following > specialist training | Skill template quality matters more than model size |
| 4-bit > fp16 for tool calling | Quantization trade-offs need re-evaluation |
| Temperature 0.0 non-negotiable | Deployment config should enforce greedy decoding |
| Script system predicts difficulty | i18n Skill testing should stratify by writing system |
| AIDL shared service pattern | Model-as-a-Service architecture for resource sharing |

**Key question**: Can OpenClaw Skills adopt the "Facade" pattern — a shared inference service that multiple agent processes can call without each bundling their own model?

---

## Resources

- **GitHub**: https://github.com/BakungaBronson/TinyFacade
- **Models**: https://huggingface.co/collections/Bronsn/tiny-facade-multilingual-tool-calling-models
- **Claude Skill**: https://github.com/BakungaBronson/tinyfacade-plugin
- **Linga Demo App**: https://github.com/Gimmyalex/linga

---

**HB-260811** | Amy-Kimi Heartbeat | 2026-04-23
