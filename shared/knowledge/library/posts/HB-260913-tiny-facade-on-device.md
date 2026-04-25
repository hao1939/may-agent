# HB-260913: TinyFacade — Multilingual Tool Calling in 70+ Languages On-Device

**Source**: Hugging Face Blog (April 20, 2026) — Cohere Labs Expedition Tiny Aya  
**Authors**: Bronson Bakunga, Kato Steven Mubiru, Gimei Alex, OJ Onyeagwu, Adnan El Assadi  
**GitHub**: https://github.com/BakungaBronson/TinyFacade  
**Claude Plugin**: https://github.com/BakungaBronson/tinyfacade-plugin

---

## Core Finding: Instruction Following > Tool Training

**TinyAya-Earth (3.35B)** with **zero tool-call training** beats **Aya Expanse 8B** (trained for tool calling):

| Language | TinyAya-Earth | Aya Expanse 8B | Gap |
|----------|--------------|----------------|-----|
| Luganda | 85.9% | 64.0% | +21.9pp |
| Swahili | 79.5% | 62.6% | +16.9pp |
| English | 88.7% | 81.6% | +7.1pp |
| European (avg) | 89.7% (4-bit) | — | — |
| Middle Eastern (avg) | 80.2% (4-bit) | — | — |

**Upper bound**: Command R 35B at 97.2% (English), 94.6% (Swahili), 89.3% (Luganda) — but requires server, internet, per-token cost.

**TinyFacade value**: Runs on mid-range phone in airplane mode.

---

## Key Surprises

### 1. 4-Bit Quantization > FP16
On specialist models (fire, earth, water), **4-bit beats fp16 by 5-9 percentage points**:
- TinyAya-Earth 4-bit: 89.7% JSON accuracy (European), 80.2% (Middle Eastern)
- Smaller files, better accuracy — ideal for mobile

### 2. Temperature = 0 is Non-Negotiable
Every 0.3 step increase costs **5-10pp across all language families**:
| Temperature | Impact |
|-------------|--------|
| 0.0 | Baseline (best) |
| 0.3 | -5 to -10pp |
| 0.7 | -10 to -20pp |
| 1.0 | Severe degradation |

Degradation is **monotonic with no recovery**.

### 3. Script System > Geography for Difficulty
Writing system (Latin, CJK, Devanagari, Thai, Ethiopic, Armenian, Myanmar, Khmer) predicts tool-calling accuracy better than geographic language family.

Latin script languages perform well regardless of region.

### 4. Template Matters (Ollama Issue)
Ollama loaded **Cohere Command template** instead of **Tiny Aya template** → **>30% performance degradation**.

Fixed in provided GGUFs.

---

## Architecture: Android AIDL Shared Service

**Problem**: Every app bundling 2GB+ model = not scalable

**Solution**: TinyFacade pattern

```
┌─────────────────┐     AIDL      ┌─────────────────────┐
│  Thin Client    │ ◄────────────► │  TinyFacade Service │
│  (any Android   │   (2.14 GB    │  (3.35B 4-bit       │
│   app)          │    loaded     │   TinyAya-Earth)    │
│  ~MB size       │    once)      │  Multilingual       │
└─────────────────┘               │  JSON function calls│
                                  └─────────────────────┘
```

**Service Features**:
- 5 action primitives: HTTP, file, system, intent, content resolver
- Client registers custom tools via declarative JSON
- No code runs on client
- Latency: <3 seconds on mid-range phones (4-6GB RAM)

**Client Examples** (total: 2.6GB storage):
1. TinyFacade App — main inference service + chat interface
2. AIDL Test Client — validation tool
3. Linga — standalone chat demo

---

## MASSIVE-Agents Evaluation

**Scale**: 1,696 total configurations
- 4 TinyAya variants (fire, earth, water, global)
- 53 languages
- 2 quantizations (fp16, 4-bit)
- 4 temperatures (0.0, 0.3, 0.7, 1.0)
- 2,792 items per language

---

## For OpenClaw

### ✅ Validation
- **Skill template quality > model size**: Instruction following beats specialized training
- **4-bit quantization viable**: May improve (not degrade) tool-calling performance
- **Shared service pattern**: AIDL architecture enables multi-app Skill deployment
- **Temperature 0 policy**: Critical for deterministic tool execution

### ⚠️ Considerations
- Template matching critical — 30%+ variance possible
- Script-based i18n testing (not just geography)
- Shared inference service for multi-agent deployment

### 🔬 Opportunities
1. **Facade pattern for Wing**: Shared Skill inference service
2. **Quantization strategy**: Evaluate 4-bit for production deployment
3. **i18n Skill templates**: Test by writing system categories
4. **On-device deployment**: Android/edge Skill execution

---

## Resources

- **Models**: [HuggingFace Collection](https://huggingface.co/collections/Bronsn/tiny-facade-multilingual-tool-calling-models)
- **Android App**: [GitHub](https://github.com/BakungaBronson/TinyFacade)
- **Claude Plugin**: [GitHub](https://github.com/BakungaBronson/tinyfacade-plugin)
- **Demo App**: [Linga](https://github.com/Gimmyalex/linga)

---

## Related
- [HB-260903](HB-260903-tiny-facade-multilingual-on-device.md) — Earlier coverage
- [HB-260811](HB-260811-tiny-facade-multilingual-tool-calling.md) — Deep dive
- Hermes tool calling format — Template standard
