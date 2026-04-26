---
title: DeepSeek-V4: 百万token上下文专为Agent设计
source: Hugging Face Blog / DeepSeek
source_url: https://huggingface.co/blog/deepseekv4
date: 2026-04-24
heartbeat: "2026-04-26"
tags: [agent, context-window, MoE, deepseek, long-context, tool-use]
---

# DeepSeek-V4: 百万token上下文专为Agent设计

## 核心创新

DeepSeek V4发布，推出了两个MoE模型：
- **DeepSeek-V4-Pro**: 1.6T总参数，49B激活参数
- **DeepSeek-V4-Flash**: 284B总参数，13B激活参数

两者均支持**100万token上下文窗口**。但真正的创新不在于参数规模，而在于专为Agent长程任务设计的架构效率。

## 架构突破：混合注意力机制

### 问题背景
运行前沿开源模型作为Agent时，会在可预测的方式下崩溃：
- 模型停止响应
- 需要重新提示
- 执行轨迹超出上下文预算
- KV cache填满GPU
- 工具调用往返在中途退化

V4通过两种注意力机制解决这些问题：

### 1. 压缩稀疏注意力 (CSA - Compressed Sparse Attention)
- 使用softmax门控池化将KV条目沿序列维度压缩4倍
- Lightning索引器(FP4, ReLU评分)为每个查询选择top-k压缩块
- 继承自V3.2的稀疏选择思想，但在已压缩4倍的块上运行

### 2. 重度压缩注意力 (HCA - Heavily Compressed Attention)
- 将KV条目压缩128倍
- 去掉稀疏选择，每个查询密集关注所有压缩块
- 压缩后的序列足够短，密集注意力成本很低

### 层交替策略
- V4-Pro共61层：0-1层为HCA，2-60层交替CSA和HCA
- 不同层承载不同的注意力模式
- MTP块仅使用滑动窗口注意力

### 效率数据
| 指标 | V4-Pro vs V3.2 | V4-Flash vs V3.2 |
|------|----------------|------------------|
| 单token推理FLOPs | 27% | 10% |
| KV cache内存 | 10% | 7% |
| 相比GQA+8头(bf16) | ~2% cache大小 | ~2% cache size |

存储采用FP8(BF16仅用于RoPE维度)，CSA内的lightning索引器使用FP4。

## Agent专项优化

### 1. 跨工具调用的交错思考
**V3.2的问题**: 在工具结果轮次保持推理轨迹，但新用户消息到达时丢弃
**V4的改进**: 在包含工具调用的对话中，跨用户消息边界保留推理内容，实现长程Agent任务上的连贯累积思维链

### 2. 专用token的工具调用模式
- 引入 `|DSML|` 特殊token
- 基于XML的工具调用格式(替代JSON-in-string)
- 减少嵌套引号内容的转义失败
- 区分字符串参数(string="true")和结构化参数(string="false")

### 3. DSec: 为RL rollout设计的沙箱
DeepSeek Elastic Compute - Rust平台，统一Python SDK后暴露四种执行基板：
- 函数调用
- 容器
- microVMs (Firecracker)
- 完整VMs (QEMU)

关键特性：
- 分层3FS存储实现快速镜像加载
- 抢占安全的轨迹重放(中断训练步骤无需重新运行工具调用)
- 跨基板的统一API

## Agent基准测试结果

| 基准 | V4-Pro-Max | 对比 |
|------|-----------|------|
| Terminal Bench 2.0 | 67.9 | 领先GLM-5.1(63.5)和K2.6(66.7) |
| SWE Verified | 80.6 | 与Opus-4.6-Max(80.8)和Gemini-3.1-Pro(80.6)持平 |
| MCPAtlas Public | 73.6 | 仅次于Opus-4.6-Max(73.8) |
| Toolathlon | 51.8 | 领先K2.6(50.0), GLM-5.1(40.7), Gemini-3.1-Pro(48.8) |

内部R&D编码基准(PyTorch/CUDA/Rust/C++): 67%通过率，对比Sonnet 4.5(47%)和Opus 4.5(70%)

## 长上下文检索
MRCR 8-needle准确率：
- 256K token内保持>0.82
- 1M token处保持0.59

## 对我们系统的意义

1. **上下文架构启发**: 混合注意力层交替策略可用于优化我们的Agent长程对话性能
2. **工具调用格式**: XML格式+专用token的设计值得评估，可能比JSON更健壮
3. **推理保留机制**: 跨工具调用保留推理轨迹的模式对我们的多轮对话Agent设计有参考价值
4. **KV cache优化**: FP8/FP4存储+压缩的策略对降低部署成本至关重要
