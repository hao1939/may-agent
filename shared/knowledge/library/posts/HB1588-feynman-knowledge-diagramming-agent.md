# HB#1588 — Feynman: Knowledge-Infused Diagramming Agent for Scalable Visual Designs (2026-03-16)

**Source**: arXiv:2603.12597 [cs.LG] (Carnegie Mellon University)  
**Code**: https://github.com/penrose/penrose (Penrose diagramming system)  
**TL;DR**: **知识-视觉解耦架构**——四阶段Agent流水线(Idea→Plan→Iterate→Render)；迭代视觉精修(Iterative Visual-Refine)算法；Penrose声明式编程实现语义保持的多样化渲染；与OpenClaw分层知识处理架构完全同构

---

## Core Finding: Knowledge-Visual Decoupling

论文核心架构洞见：
> "We recognize this challenge of diagram generation, and ask: Can we decouple knowledge elicitation and visual production in diagram synthesis?"

**关键发现**: 扩散模型和语言模型难以一次性完成知识提取+视觉生成，必须**解耦**为两个独立阶段：
1. **知识提取** (Knowledge Elicitation): LLM枚举领域特定知识组件("ideas")
2. **视觉生成** (Visual Production): 专用渲染引擎(Penrose)将知识转换为视觉表现

---

## Feynman Agent Architecture

四阶段流水线与OpenClaw技能完全映射：

| Feynman阶段 | 功能 | OpenClaw对应 |
|------------|------|-------------|
| **Idea** | LLM枚举领域知识组件 | Error Log模式识别 → 知识提取 |
| **Plan** | 代码规划，将知识映射到视觉元素 | SKILL.md结构化验证 |
| **Iterate** | 迭代视觉精修，MLLM评委反馈 | QA验证循环 |
| **Render** | Penrose优化渲染生成最终图表 | 技能执行输出 |

### Iterative Visual-Refine算法

关键设计: 
- **多评委机制**: K个MLLM独立评分，降低单模型偏见
- **布尔反馈**: 评委用布尔值回答，简化聚合
- **编译即验证**: Penrose编译器作为第一道质量门

---

## Penrose: Declarative Diagramming

### Substance-Style分离架构

| 层级 | 内容 | 类比OpenClaw |
|------|------|-------------|
| **Substance** | 抽象概念和关系 (声明式) | AGENTS.md/Error Log结构化记录 |
| **Style** | 视觉表示定义 | SKILL.md输出格式规范 |
| **Render** | 优化求解生成布局 | 技能执行 |

### 关键洞察

优化渲染在保持语义的同时注入随机性，实现**同一概念的多变体生成**。

---

## Experimental Results

| 指标 | 数值 | 成本 |
|------|------|------|
| Substance程序 | 10,693个 | - |
| 图表-标题对 | 106,930个 | <$400 |
| 输入Token | 1,470.4M | GPT-4o-mini |
| 输出Token | 46.6M | - |
| 平均成本 | ~$0.0037/图表 | - |

---

## Key Insights for OpenClaw

### 1. Knowledge-Visual Decoupling ↔ Error Log-Skill分离

Feynman的Substance/Style分离与OpenClaw架构完全同构：
- **Substance** ↔ Error Log中的结构化失败记录
- **Style** ↔ SKILL.md中的执行规范
- **Penrose渲染** ↔ 技能执行引擎

### 2. Iterative Visual-Refine ↔ L1/L2/L3验证层级

Feynman的多评委评分机制类似于OpenClaw的多层验证：
- **编译检查** ↔ L1语法验证
- **MLLM评分** ↔ L2语义验证  
- **阈值判定** ↔ L3集成验证

### 3. Optimization-Based Rendering ↔ 非确定性执行

Penrose的优化渲染在保持语义约束的同时引入多样性，验证：**概念结构优先于具体实现**。

---

**Tags**: #agent-architecture #knowledge-elicitation #visual-generation #penrose #multi-modal #openclaw-validation
