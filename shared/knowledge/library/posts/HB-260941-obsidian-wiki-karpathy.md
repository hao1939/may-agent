# Obsidian-Wiki: Karpathy LLM Wiki模式的Agent实现

**ID**: HB-260941  
**日期**: 2026-04-26  
**来源**: GitHub (Ar9av/obsidian-wiki) | 704⭐  
**标签**: #knowledge-management #obsidian #karpathy #llm-wiki #memory

---

## 核心发现

**obsidian-wiki**是一个基于Andrej Karpathy "LLM Wiki"模式的AI Agent知识管理框架——不是每次问LLM同样的问题，而是将知识编译成互联的Markdown文件并持续维护。Obsidian作为查看器，LLM作为维护者。

### Karpathy的LLM Wiki模式

**核心思想**:
> "Instead of asking an LLM the same questions over and over (or doing RAG every time), you compile knowledge once into interconnected markdown files and keep them current."

**对比**:
| 方式 | 问题 | 方案 |
|------|------|------|
| 重复询问 | 每次重新推理，token浪费 | 知识预编译 |
| 每次都RAG | 检索开销，相关性不稳定 | 结构化存储 |
| LLM Wiki | **一次编译，持续更新** | **Markdown知识库** |

### 框架设计

```
.obsidian/          # Obsidian配置
├── skills/         # 技能定义
├── .agents/skills/ # Agent技能
├── .claude/skills/ # Claude特定技能
├── .cursor/        # Cursor配置
├── .kiro/          # Kiro配置
├── .windsurf/      # Windsurf配置
├── AGENTS.md       # Agent通用指南
├── CLAUDE.md       # Claude特定指南 (symlink)
└── GEMINI.md       # Gemini特定指南 (symlink)
```

**多Agent支持**: 同时支持Claude Code、Cursor、Windsurf、Kiro等多种AI编码工具。

---

## 对OpenClaw的意义

### ✅ 文件化记忆验证

obsidian-wiki与OpenClaw的设计理念高度一致：
- **Markdown优先**: 知识以文件形式持久化
- **人可读**: Obsidian作为查看器
- **Agent可维护**: LLM持续更新

### 🔬 跨平台Skill标准

项目采用多目录结构支持不同Agent：
```
.skills/           # 通用技能
.agents/skills/    # Agents特定
.claude/skills/    # Claude特定
```

这提示OpenClaw的SKILL.md可能需要：
- 核心SKILL.md (通用)
- .openclaw/skills/ (OpenClaw特定)
- AGENTS.md交叉引用

### 🔬 知识库即产品

obsidian-wiki展示了一种新的知识工作流：
1. Agent执行生成知识
2. 自动整理到Obsidian
3. 人工查看和审阅
4. 反馈驱动Agent改进

这与OpenClaw的Error Log → AGENTS.md更新流程一致。

---

## 与OpenClaw架构对照

| obsidian-wiki | OpenClaw |
|---------------|----------|
| Obsidian查看器 | VS Code/Terminal |
| LLM维护者 | Agent执行 |
| Markdown知识库 | `.state/` + `insights/` |
| 多Agent支持 | 单一框架内多Agent |

**互补性**: obsidian-wiki偏向个人知识管理，OpenClaw偏向工程执行。

---

## 相关资源

- **GitHub**: https://github.com/Ar9av/obsidian-wiki
- **Karpathy Gist**: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
- **Stars**: 704⭐
- **Forks**: 93

---

## session_notes
- 已写入insights-cn.md和research-digest.md
- 关键洞察：Karpathy的LLM Wiki模式与OpenClaw文件优先设计一致
- 建议：探索与Obsidian的知识库集成
