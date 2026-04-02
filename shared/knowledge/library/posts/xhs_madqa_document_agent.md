# XHS Post: agent 真的会看文档吗

**Source**: XHS @momo (7分钟前 美国)  
**URL**: https://www.xiaohongshu.com/explore/69b61018000000002102ccbe  
**ID**: 69b61018000000002102ccbe  
**Archived**: 2026-03-15

---

## 论文标题
**Strategic Navigation or Stochastic Search? How Agents and Humans Reason Over Document Collections**
- arXiv: 2603.12180 (March 12, 2026)
- 15位作者，包括CMU、Stanford等机构

---

## 核心问题
**Agent到底是在做strategic reasoning，还是只是在暴力试错(brute-force search)?**

研究动机：现在越来越多multimodal agent处理长文档、复杂PDF和document workflow，但一个核心问题一直没被认真拆开——**agent做对了题，到底是因为真的会规划、会定位关键信息，还是因为不断尝试直到撞对？**

只看最终accuracy，很容易把brute-force search误当成reasoning ability。

---

## 方法简介

### MADQA Benchmark
- **2,250个人工编写的问题**
- **800份异构PDF文档**
- 基于Classical Test Theory设计，最大化不同agentic能力水平的区分力

### 创新评估协议
引入**accuracy-effort trade-off**：
- 不只测答对率
- 还要看为了得到这个结果花了多少搜索和操作成本
- 区分"聪明地找到答案" vs "靠反复翻文档硬搜出来"

---

## 实验结论

| 发现 | 细节 |
|------|------|
| 准确率接近人类 | 最强agent在raw accuracy上已能接近human searcher |
| 答对的问题不同 | 它们答对的题和人类**并不一样** |
| 依赖暴力搜索 | 仍然明显依赖brute-force search来补偿weak strategic planning |
| 存在性能缺口 | 离oracle performance还有接近**20%的差距** |
| 陷入低效循环 | 常常persisting in unproductive loops |

---

## 核心洞察

> "Document agent的下一步不只是把搜索做得更猛，而是要把**检索、规划和effort calibration一起纳入评测**。"

---

## 对OpenClaw的意义

### 1. Error Log设计验证
MADQA的accuracy-effort trade-off与OpenClaw的Error Log机制异曲同工——都不只看结果对错，更关注**获得结果的过程质量**。

### 2. AGENTS.md as Strategic Planning
论文揭示的"weak strategic planning"问题，正好对应OpenClaw的AGENTS.md设计：
- 静态、预定义的规划层级
- 避免运行时的stochastic search
- 用结构约束替代暴力试错

### 3. L3 Flag 潜在新增
"Agent是否陷入unproductive loop"应成为运行时监控指标。

---

## 相关论文
- arXiv:2603.12180 - MADQA官方论文
- 代码与数据集: https://github.com/ (论文提及release dataset和evaluation harness)

---

## Tags
#agent-evaluation #document-agent #benchmark #reasoning #brute-force-search #strategic-planning
