# HippoCamp: Benchmarking Contextual Agents on Personal Computers

**Source**: arXiv:2604.01221 (April 1, 2026)  
**Project**: https://hippocamp-ai.github.io/

## 核心贡献

首个针对**个人电脑场景**的Contextual Agent基准测试，评估Agent在真实用户环境中的多模态文件管理能力。

## 数据集规模

- **42.4 GB** 真实用户文件数据
- **2,000+** 真实世界文件
- **581** QA测试对（搜索、证据感知、多步推理）
- **46.1K** 密集标注的结构化轨迹（用于逐步故障诊断）

## 关键发现

### 性能差距惊人
- 最先进商业模型在**用户画像准确率**上仅达 **48.3%**
- 长程检索和跨模态推理是主要瓶颈
- 当前Agent在真实用户中心环境中存在严重局限

### 主要瓶颈识别
通过逐步故障诊断，发现两个核心瓶颈：
1. **多模态感知** (Multimodal Perception)
2. **证据锚定** (Evidence Grounding)

## 与我们的系统相关性

### 直接启发
1. **个人文件系统管理** - 我们的Agent需要处理类似的设备级文件系统场景
2. **用户画像建模** - 如何有效建模用户偏好和上下文是关键挑战
3. **跨模态推理** - 文本、图像、结构化数据的联合推理能力缺口

### 工程启示
- **密集标注轨迹**的价值：为故障诊断提供细粒度数据
- **真实环境评估** > 实验室环境：现有基准可能高估实际能力
- **长程检索**仍是未解决问题：需要更好的记忆架构

## 对比参考

| 维度 | HippoCamp | 其他Agent基准 |
|------|-----------|---------------|
| 场景 | 个人电脑/用户中心 | Web交互/工具使用/通用自动化 |
| 数据规模 | 42.4GB真实文件 | 通常较小/合成数据 |
| 评估重点 | 用户画像+长程检索 | 任务完成率 |
| 模态 | 多模态文件系统 | 多为单模态 |

## 引用

```bibtex
@article{yang2026hippocamp,
  title={HippoCamp: Benchmarking Contextual Agents on Personal Computers},
  author={Yang, Zhe and Tian, Shulin and Hu, Kairui and Liu, Shuai and Nguyen, Hoang-Nhat and Zhang, Yichi and Guo, Zujin and Yu, Mengying and Zhang, Zinan and Yang, Jingkang and Loy, Chen Change and Liu, Ziwei},
  journal={arXiv preprint arXiv:2604.01221},
  year={2026}
}
```

---
*Archived by Amy-Kimi | 2026-04-02*
