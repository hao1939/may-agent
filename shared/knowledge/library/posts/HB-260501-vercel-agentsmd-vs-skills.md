# Vercel研究：8KB AGENTS.md打爆Skills

**来源**: 小红书 @智东西 | Vercel软件工程师Jude Gao  
**赞数**: 970 | 收藏: 1533 | 评论: 119  
**原文链接**: https://www.xiaohongshu.com/explore/6989b8d6000000001a01e993  
**时间**: 2025-02

---

## 核心发现

Vercel工程师在研究如何让AI编程Agent学习Next.js 16时发现：**一个简单的AGENTS.md文件嵌入压缩后的文档索引，竟然把Skills打爆了**。

**结果对比**:
| 方案 | Next.js 16 API评测通过率 |
|------|------------------------|
| 8KB AGENTS.md (压缩索引) | **100%** |
| Skills (主动工具调用) | 53% (最高79%) |

---

## 问题背景

AI编程代理的性能受限于**训练数据截止日期**。Next.js 16引入的全新API不在当前大模型训练数据中，导致AI经常：
- 生成错误代码
- 回退到过时模式

**两种解决思路**:
1. **Skills**: AI识别到需求时主动调用文档 (主动工具)
2. **AGENTS.md**: 项目根目录Markdown文件，提供每轮对话的持久上下文

---

## 为什么"笨方法"更有效？

Jude Gao分析三个原因：

### 1. 消除决策点
AI不需要决定"我是否需要查阅文档"，信息已经直接呈现在面前。

### 2. 持续可用性
- Skills: 异步加载，可能调用失败
- AGENTS.md: 内容在每一轮对话的系统提示词中都存在

### 3. 解决顺序冲突
Skills会让AI纠结"是先读文档还是先看项目结构"，而被动上下文消除了这种排序难题。

---

## 社区讨论亮点

| 评论者 | 观点 |
|--------|------|
| @momo | "Skills是中间产物，不如MCP有意思，感觉过不了俩月就会淘汰" |
| @浅浅 | "MCP才是中间产物，Skill是进阶形态" (134赞) |
| @One-M | "他把所有node.js文档做了无格式索引塞在agents.md里，管这个叫compressed" |
| @HU | "agents.md里可以只写description然后外链到skill.md，实现上比skill还省个tool" |
| @散修架构师 | "skill解决能力问题，最新api是memory问题，两个不同维度" |

---

## 对OpenClaw的意义

### ✅ 验证
- **AGENTS.md优先策略**: OpenClaw的AGENTS.md+SKILL.md分层与Vercel发现一致
- **大道至简**: 简单原始的方案往往比复杂工具链更有效

### 🔬 可探索
- **压缩索引**: 如何优化AGENTS.md的信息密度？
- **渐进式披露**: 基础上下文inline + 详细skill外链的混合策略
- **决策开销**: Skill调用是否引入了不必要的决策负担？

### ⚠️ 警示
- **Skills≠银弹**: 不是所有事情都需要Skills，也不是所有事情用Skills都更高效
- **Token限制**: @九只猫的质疑 — "问题是有这么多token和这么大的上下文吗？"

---

## 关键洞察

> "最新、最火的东西是不是最好的？我们真的需要那么多Skills吗？并不见得。有时候简单原始反而是最合适的，正所谓大道至简。"

---

## 相关

- [HB-260428-tool-attention-diffmas-reasoning-skills](HB-260428-tool-attention-diffmas-reasoning-skills.md) - Tool Attention 95% MCP Tax消除
- [insights-cn.md](../insights-cn.md) - 协议分层与CLI优先策略
