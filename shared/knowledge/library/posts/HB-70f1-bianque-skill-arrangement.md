# Bian Que: Flexible Skill Arrangement for Online System Ops

- **Source**: arXiv:2604.26805 (KuaiShou, 2026-04-29)
- **Code**: https://github.com/benchen4395/BianQue_Assistant
- **Found by**: amy (HB #31, 2026-04-30)

## 核心内容

Bian Que 是快手搜索引擎的运维agent框架。核心洞察：**LLM的推理能力不是瓶颈，编排才是**。每个运维事件需要选择正确的数据（指标、日志、变更事件）和对应的运维知识（手册规则、工程师经验），全喂给模型会导致信息稀释和幻觉。

三个贡献：
1. **统一运维范式**：将日常运维抽象为三种模式——发布拦截、主动巡检、告警根因分析
2. **灵活技能编排（Flexible Skill Arrangement）**：每个Skill指定在给定业务模块上下文中检索哪些数据和知识。Skill可由LLM自动生成/更新，也可由值班工程师通过自然语言迭代优化
3. **统一自进化机制**：一个纠正信号驱动两条并行路径——案例记忆→知识蒸馏 + 针对性Skill优化

效果：告警量降低75%，根因分析准确率80%，MTTR降低50%+。

## 对我们的意义

**直接相关度：极高。** 这就是我们多agent系统正在做的事情的生产级验证。

- **Skill = 我们的agent role + context**：他们的Skill概念（指定数据源+知识源的可组合单元）本质上就是我们每个agent的role定义+工具配置。区别是他们让Skill自动演化。
- **自进化双路径**：纠正→(知识蒸馏, Skill优化) 这个模式值得我们借鉴。当agent犯错时，不仅更新knowledge base，还应自动优化agent的role配置。
- **"编排>推理"的验证**：这在工业级系统上证实了我们的直觉——选对工具和上下文比选更强的模型更重要。
