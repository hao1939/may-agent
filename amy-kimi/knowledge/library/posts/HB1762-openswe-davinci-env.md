# HB#1762: OpenSWE - 全球最大开源SWE训练框架

**Source**: XHS@LLM 翰林院  
**URL**: https://www.xiaohongshu.com/explore/69b7d33e0000000021006ac5  
**Paper**: daVinci-Env: Open SWE Environment Synthesis at Scale (arXiv:2603.13023)  
**Date**: 2026-03-17  
**Stats**: 20赞 / 39收藏 / 1评论  
**Fire**: 🔥🔥 (技术深度内容，小众高价值)

## 论文核心

### OpenSWE 框架规格
| 指标 | 数值 |
|------|------|
| Docker环境 | 45,320个可执行环境 |
| 覆盖仓库 | 12,800+ 个 |
| 开源程度 | Dockerfile/评估脚本/基础设施完全开源 |
| 构建方式 | 64节点分布式集群多Agent合成管道 |
| 投资规模 | $147万 ($891K环境构建 + $576K轨迹采样) |
| 产出轨迹 | ~13,000条 (来自~9,000个QA环境) |

### 质量中心过滤管道
- 描述每个环境的**内在难度**
- 过滤无法解决或挑战不足的实例
- 仅保留**最大化学习效率**的实例

### SOTA 性能
| 模型 | SWE-bench Verified |
|------|-------------------|
| OpenSWE-32B | 62.4% |
| OpenSWE-72B | 66.0% |
| 基准 | Qwen2.5系列SOTA |

### 跨领域提升
- 数学推理: **+12分**
- 科学基准: **+5分**
- 事实回忆: **无下降**

## 技术洞察

### 多Agent合成管道
> "自动化存储库探索、Dockerfile构建、评估脚本生成和迭代测试分析"

**与OpenClaw关联**: 验证了自动化环境构建和评估的基础设施价值

### 投资效率分析
- $147万投资 → 13,000条轨迹
- 单条轨迹成本: ~$113
- 质量保证环境: ~9,000个
- 单环境成本: ~$163

## OpenClaw 相关性

| 洞察 | 相关性 |
|------|--------|
| 大规模环境合成 | Skill训练基础设施参考 |
| 质量中心过滤 | Error Log筛选机制验证 |
| 多Agent构建管道 | CI/CD自动化参考架构 |
| 跨领域能力提升 | Skill泛化性评估指标 |
| 开源透明策略 | 与OpenClaw开源理念一致 |

## 标签
#openswe #swe-bench #davinci-env #training-data #multi-agent #infrastructure
