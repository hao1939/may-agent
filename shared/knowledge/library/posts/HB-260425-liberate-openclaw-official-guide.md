# HB-260425: Liberate your OpenClaw — HF 官方迁移指南

## 来源
- **URL**: https://huggingface.co/blog/liberate-your-openclaw
- **作者**: Clem (HF CEO) 等团队
- **发布时间**: March 27, 2026
- **点赞**: 45 (+39)

## 核心发现

### 背景：Anthropic 限制 Claude 访问
Anthropic 正在限制 Claude 模型在开放 Agent 平台（OpenClaw, Pi, Open Code）上的访问，仅限 Pro/Max 订阅者。HF 团队发布此指南帮助用户迁移到开源模型。

### 两种迁移路径

#### 路径1: Hugging Face Inference Providers（快速恢复）
- 适合：想要最快恢复 Agent 能力的用户
- 推荐模型：**GLM-5** (zai-org/GLM-5)
  - Terminal Bench 2.0 高分
  - 数干个模型可选
- 配置方式：
```bash
openclaw onboard --auth-choice huggingface-api-key
```
```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "huggingface/zai-org/GLM-5:fastest"
      }
    }
  }
}
```
- HF Pro 订阅：每月 $2 免费额度

#### 路径2: 本地 llama.cpp（完全自主）
- 适合：追求隐私、零 API 成本、完全控制
- 推荐模型：**Qwen3.5-35B-A3B** (4-bit GGUF)
  - 32GB RAM 可运行
  - UD-Q4_K_XL 量化
- 配置方式：
```bash
# 启动本地服务器
llama-server -hf unsloth/Qwen3.5-35B-A3B-GGUF:UD-Q4_K_XL

# OpenClaw 配置
openclaw onboard --non-interactive \
  --auth-choice custom-api-key \
  --custom-base-url "http://127.0.0.1:8080/v1" \
  --custom-model-id "unsloth-qwen3.5-35b-a3b-gguf" \
  --custom-api-key "llama.cpp" \
  --secret-input-mode plaintext \
  --custom-compatibility openai
```

## 关键洞察

### OpenClaw 生态认知度
- Hugging Face 官方认可 OpenClaw 作为重要开源 Agent 平台
- 与 Pi、Open Code 并列提及
- "Liberate"（解放）一词暗示对厂商锁定的批判立场

### 开源模型已具备竞争力
- GLM-5、Qwen3.5-35B-A3B 等模型可替代 Claude 完成 Agent 任务
- Terminal Bench 2.0 等基准验证开源模型能力
- 成本仅为闭源模型的 fraction（文中明确提及）

## 对 OpenClaw 的意义

| 维度 | 影响 |
|------|------|
| **生态地位** | 获 HF 官方认可，成为开源 Agent 三大平台之一 |
| **模型选择** | 验证多模型后端支持的战略必要性 |
| **成本效益** | 开源路径可大幅降低运营成本 |
| **去风险** | 单一模型供应商锁定风险可通过多后端架构规避 |

### 战略建议
1. **强化多模型后端**：确保平滑切换不同模型提供商
2. **本地优先选项**：llama.cpp 集成降低对外部 API 依赖
3. **模型推荐列表**：维护经测试验证的模型兼容性列表
4. **成本透明化**：向用户展示不同配置的成本对比

## 社区反馈亮点
> "I love that ❤️🦞. This community has so much to offer. It would be a shame if it got blocked by crazy costs."
> — SebConejo (Manifest.build)

> "These are the values we share at Manifest too. Open source values. And the desire to give this community, agents that are super effective and cost-efficient!"

---
**证据强度**: ★★★★★ (HF 官方博客，团队背书)
**相关**: [HB-260801](HB-260801-agent-infrastructure-roundup.md) | [HB-260812](HB-260812-rl-human-action-intent-dataset.md)
