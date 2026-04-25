# DeepSeek-V4: 百万Token上下文专为Agent工作负载设计

**来源**: Hugging Face Blog (Apr 24, 2026) — DeepSeek Official
**链接**: https://huggingface.co/blog/deepseekv4
**评分**: ★★★★★

## 核心定位

DeepSeek-V4不是为了追求SOTA benchmark，而是**让Agent能实际使用的百万Token上下文**。

> "Running a frontier open model as an agent today breaks in predictable ways. The model stops. You reprompt. The trace blows past the context budget, or the KV cache fills the GPU, or tool-call round trips degrade halfway through a long task. V4 is built to fix these known failures."

## 关键数据

| 指标 | V4-Pro | V4-Flash | 对比基准 |
|------|--------|----------|----------|
| 总参数 | 1.6T | 284B | — |
| 激活参数 | 49B | 13B | — |
| 上下文窗口 | 1M tokens | 1M tokens | — |
| 单token推理FLOPs | V3.2的27% | V3.2的10% | V3.2 |
| KV缓存 | 标准架构的~2% | 标准架构的~0.7% | GQA 8头 bfloat16 |

## 架构创新：混合注意力

### CSA (Compressed Sparse Attention) — 4x压缩
- 沿序列维度压缩KV条目4x
- softmax门控池化 + 学习位置偏置
- lightning indexer (FP4, ReLU评分) 选取top-k压缩块
- 滑动窗口分支处理最近未压缩token

### HCA (Heavily Compressed Attention) — 128x压缩
- 更重压缩器 (128x vs 4x)
- 密集注意力覆盖压缩流
- 相同滑动窗口分支

### 层交替策略
- 层0-1: HCA
- 层2-60: CSA和HCA交替
- MTP块: 仅滑动窗口

### 存储优化
- FP8存储大部分KV条目
- BF16仅用于RoPE维度
- CSA内lightning indexer用FP4

## Agent专用设计

### 1. 跨工具调用保留推理 (Interleaved Thinking)
**问题**: V3.2在新用户消息到达时丢弃推理痕迹，多轮Agent工作流丢失累积状态

**V4方案**: 
- 工具调用对话中**跨用户消息边界保留推理内容**
- 保留完整推理历史，跨所有轮次
- 无工具对话保持旧行为：每轮清空推理保持上下文简洁

### 2. XML工具格式 + DSML专用Token
- 引入 `|DSML|` 专用token
- XML格式减少JSON-in-string的转义失败
- 区分string参数 (string="true") 和结构化参数 (string="false")
- 消除数字/布尔值解析错误

### 3. DSec沙箱：为RL Rollout设计
**DeepSeek Elastic Compute (DSec)**:
- Rust平台，统一Python SDK
- 四种执行后端：函数调用、容器、microVMs (Firecracker)、完整VMs (QEMU)
- 单集群**数十万并发沙箱**

**关键特性**:
- 分层3FS存储快速镜像加载（RL rollout不等容器启动）
- 抢占安全轨迹重放（中断训练步骤恢复不重跑工具调用）
- 统一API跨后端（训练harness无需重写）

## Agent基准结果

| 基准 | V4-Pro-Max | 对比 |
|------|------------|------|
| Terminal Bench 2.0 | 67.9 | 超GLM-5.1(63.5), K2.6(66.7) |
| SWE Verified | 80.6 | 持平Gemini-3.1-Pro(80.6), 接近Opus-4.6-Max(80.8) |
| MCPAtlas Public | 73.6 | 仅次于Opus-4.6-Max(73.8) |
| Toolathlon | 51.8 | 超K2.6(50.0), GLM-5.1(40.7), Gemini-3.1-Pro(48.8) |

**长上下文检索**: MRCR 8-needle准确率
- 256K tokens: >0.82
- 1M tokens: 0.59

## 模型变体

| 模型 | 总参数 | 激活参数 | 类型 |
|------|--------|----------|------|
| DeepSeek-V4-Pro | 1.6T | 49B | instruct |
| DeepSeek-V4-Flash | 284B | 13B | instruct |
| DeepSeek-V4-Pro-Base | 1.6T | 49B | base |
| DeepSeek-V4-Flash-Base | 284B | 13B | base |

### 推理模式
- **Non-think**: 快速，无思维链
- **Think High**: 显式推理，<think>块
- **Think Max**: 最大推理努力，需≥384K上下文

推荐采样参数: temperature=1.0, top_p=1.0

## 对 OpenClaw 的意义

### ✅ 核心验证
- **上下文压缩 > 原始长度**: Agent架构一级约束
- **跨turn推理持久化**: 多轮Agent会话关键能力
- **专用工具格式**: XML+专用token可能比JSON更鲁棒

### ⚠️ 基础设施缺口
- 缺乏类似DSec的规模化沙箱基础设施
- 无interleaved thinking机制
- 未优化KV缓存效率

## 关键洞察

> "A 1M context window is just capacity, not performance. Whether you can use it depends on the cost of every forward pass at that depth."

100万上下文窗口只是容量，不是性能。能否使用取决于该深度每次前向传递的成本。

> "Efficient long-context attention is necessary for agent workflows but not sufficient."

高效长上下文注意力对Agent工作流必要但不充分。
