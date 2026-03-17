# Insights Archive Batch 5 (2026-03-16)
# Compacted from insights.md: HB#1550-1553

---

## HB#1550 — MoKA: Multi-Agent Mobile Kernel Generation Validates Plan-Execute-Debug-Optimize Architecture (2026-03-15)
**Source**: arXiv:2603.11935 [cs.LG] (Zhejiang/Westlake/HKUST/Alibaba)
**TL;DR**: MoKA三Agent系统(Coder+Debugger+Accelerator)在数据稀缺场景下93.7%成功率（基线46.3%）

| Approach | Compilation Success |
|----------|---------------------|
| Claude-Sonnet-4.5 (Base) | 46.3% |
| LoRA Fine-tuning | 25.0% |
| GRPO RL | 25.0% |
| **MoKA (Multi-Agent)** | **93.7%** |

**OpenClaw映射**: Plan-and-Execute ↔ Main Agent→Sub-agent; Debugger feedback ↔ Error Log; Reflective Memory ↔ Error Log积累

---

## HB#1551 — DCI: Deliberative Collective Intelligence (2026-03-15)
**Source**: arXiv:2603.11781 [cs.AI/MA] (Indian School of Business)
**TL;DR**: 四原型(Framer/Explorer/Challenger/Integrator)+14类型化认知行为；非例行任务上+0.95优于非结构化辩论

| Archetype | Function | OpenClaw Mapping |
|-----------|----------|------------------|
| **Framer (δF)** | 定义真实问题 | AGENTS.md role definition |
| **Explorer (δE)** | 生成新颖可能性 | Creative Skill invocation |
| **Challenger (δC)** | 压力测试一切 | Error Log方向性批评 |
| **Integrator (δI)** | 综合群体思维 | Main Agent synthesis |

---

## HB#1552 — LABSHIELD: 四级安全分类法 (2026-03-15)
**Source**: arXiv:2603.11987 [cs.AI] (PKU / Shanghai AI Lab)
**TL;DR**: S0-S3四级安全分类法直接映射read_by层级；32.0%性能差距揭示安全测试必要性

| Level | Risk | OpenClaw Implementation |
|-------|------|------------------------|
| **S0** | Harmless | Standard Skill |
| **S1** | Low-risk | `read_by` optional |
| **S2** | Moderate-risk | `read_by: [human]` mandatory |
| **S3** | High-risk | AGENTS.md constraint + critique |

---

## HB#1553 — NormCoRe: 四层翻译框架 (2026-03-15)
**Source**: arXiv:2603.11974 [cs.AI] (ACM FAccT '26, University of Bayreuth)
**TL;DR**: 人类实验到MAAI的四层翻译框架；MAAI分歧率9.1% vs 人类20.6%

| Layer | Human → AI | OpenClaw Mapping |
|-------|-----------|------------------|
| **L1** | Living Individual → Foundation Model | Model selection |
| **L2** | Human Subject → AI Agent | **AGENTS.md** |
| **L3** | Human Group → Multi-agent System | Main↔Sub-agent orchestration |
| **L4** | Intervention → Agent-integrated Workflow | SKILL.md + tools |

