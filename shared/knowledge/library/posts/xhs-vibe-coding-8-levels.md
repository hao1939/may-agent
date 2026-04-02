# Vibe Coding 鄙视链：智能体工程的8个等级

**Source**: XHS@Guanlan | **Date**: 2026-03-15 (编辑于昨天 21:58 美国)
**Original**: Bassim Eledath 的 Agentic Engineering 8层模型
**XHS Link**: https://www.xiaohongshu.com/explore/69b5d6a50000000023021235

---

## 8层模型概览

| Level | 名称 | 核心特征 | 与OpenClaw映射 |
|-------|------|----------|----------------|
| 1-2 | AI辅助编码 | Copilot补全、Cursor连代码库 | 基础IDE功能 |
| 3 | **上下文工程** | Prompt是写给模型看的，精简token、写rules文件 | ✅ AGENTS.md |
| 4 | **复利工程** | Plan→Delegate→Assess→Codify，知识写入规则系统 | ✅ Skill体系 |
| 5 | 能力扩展 | MCP/CLI & Skills，模型从think到act | ✅ Tools |
| 6 | **反馈系统工程** | 自动测试→日志→bug重现→修复循环 | ✅ Error Log机制 |
| 7 | 后台智能体 | Long horizon，需要Effect Log/Capability Gateway/Resumability | ⚠️ 待探索 |
| 8 | 多Agent协同 | 终极形态，需前7层稳固 | ⚠️ 未来方向 |

## 两个分水岭

### 分水岭1: Level 4 复利工程
> "流程变成 Plan、Delegate、Assess、Codify，把这次学到的东西写进规则系统"

- 这与OpenClaw的 **AGENTS.md + Skill** 架构直接对应
- 不是单次优化，而是积累工程资产

### 分水岭2: Level 6 反馈系统工程 (Harness Engineering)
> "自动测试、日志查询、bug重现、自动验证，形成写代码→运行→检查→修复→再跑的循环"

- 这才是"真正的agent，前面的都只是工具"
- 与OpenClaw的 **Error Log** 和 **禁止Self-Evolution** 设计呼应

## Level 7 的三个基础设施原语
1. **Effect Log**: tool call按可恢复语义分类，规定恢复策略，实现 durable execution
2. **Capability Gateway**: 中介所有外部访问，权限边界在基础设施层强制执行
3. **Resumability**: 可调试、可恢复、可分叉探索

## OpenClaw验证
- ✅ Level 3: AGENTS.md 作为静态规则系统
- ✅ Level 4: Skill作为可积累资产
- ✅ Level 6: Error Log机制实现反馈循环
- ⚠️ Level 7: Effect Log/Capability Gateway/Resumability 可纳入路线图

## L3 Assessment
- **Relevance**: High — 行业框架与OpenClaw架构高度对齐
- **Urgency**: Medium — Level 7原语可作为未来设计输入
- **Action**: 研究Level 7三个原语与现有架构的融合

---
*Archived: 2026-03-15 | HB#1349*
