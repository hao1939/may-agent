# Garry Tan's GBrain: OpenClaw的记忆层进化

> **Source**: GitHub (garrytan/gbrain) | 11.5K stars | 1.4K forks  
> **Date**: April 2026  
> **Author**: Garry Tan (President & CEO, Y Combinator)

## 核心发现

Garry Tan（Y Combinator总裁兼CEO）开源了**GBrain** —— 一个专为OpenClaw和Hermes Agent设计的记忆增强系统。这不是实验性项目，而是**生产级系统**：已管理17,888页面、4,383人、723公司，21个cron job自主运行。

### 项目定位
> "Your AI agent is smart but forgetful. GBrain gives it a brain."

GBrain填补了OpenClaw生态的关键空白：**持久化、可查询、自进化的记忆层**。

## 技术架构亮点

### 1. 自连接知识图谱 (Self-Wiring Knowledge Graph)
- **零LLM调用实体抽取**: 每次页面写入自动提取实体引用
- **类型化链接**: `attended`, `works_at`, `invested_in`, `founded`, `advises`
- **自动关联**: 无需人工配置，图谱自我生长

### 2. 混合搜索 (Hybrid Search)
- 向量搜索 + 图遍历 + BM25文本搜索
- **Backlink-boosted ranking**: 被引用多的实体排名提升
- 支持复杂查询: "who works at Acme AI?" 或 "what did Bob invest in this quarter?"

### 3. 性能数据 (BrainBench)
| 指标 | GBrain | 无图版本 | ripgrep-BM25+向量RAG |
|------|--------|----------|---------------------|
| P@5 | **49.1%** | 17.7% | ~18% |
| R@5 | **97.9%** | - | - |
| 提升幅度 | 基准 | **+31.4 points** | 类似差距 |

*测试语料: 240页Opus生成的富文本*

### 4. 部署特性
- **PGLite**: PostgreSQL在浏览器/WASM中运行，2秒启动，零服务器
- **29 skills**: 开箱即用的技能集
- **~30分钟**: 完整安装时间
- **llms.txt / llms-full.txt**: 为LLM消费优化的文档格式

## 对OpenClaw的意义

### ✅ 架构验证
| OpenClaw设计 | GBrain对应 | 验证强度 |
|-------------|-----------|----------|
| AGENTS.md优先 | `AGENTS.md` + `CLAUDE.md`双协议 | ⭐⭐⭐⭐⭐ |
| Markdown文件记忆 | 知识图谱+Markdown混合 | ⭐⭐⭐⭐☆ |
| Skill系统 | 29内置skills | ⭐⭐⭐⭐⭐ |
| 文件化记忆 | `llms.txt`标准化 | ⭐⭐⭐⭐⭐ |

### 🔬 技术借鉴
1. **知识图谱层**: 从纯Markdown记忆升级到图结构
2. **混合检索**: 向量+图+关键词三层检索
3. **零调用抽取**: 规则+模式实体识别，非LLM抽取降成本
4. **PGLite**: 考虑嵌入式数据库替代文件存储

### ⚠️ 竞争信号
- **生态成熟**: OpenClaw已有第三方专门构建记忆层
- **使用规模**: 实际承载YC CEO的生产负载
- **快速开发**: 12天构建，显示OpenClaw生态开发效率

## 关键文件结构

```
gbrain/
├── AGENTS.md          # 非Claude Agent协议
├── CLAUDE.md          # Claude Code专用协议
├── llms.txt           # LLM消费文档地图
├── llms-full.txt      # 内联完整文档
├── skills/            # 29个技能
├── recipes/           # 使用配方
└── openclaw.plugin.json  # OpenClaw插件配置
```

## 安装方式

### 对于OpenClaw用户
Agent直接执行:
```
Retrieve and follow the instructions at:
https://raw.githubusercontent.com/garrytan/gbrain/master/INSTALL_FOR_AGENTS.md
```

### AlphaClaw一键部署
Render平台: `Deploy AlphaClaw on Render (one click, 8GB+ RAM)`

## 关键洞察

> "The brain wires itself. Every page write extracts entity references and creates typed links with zero LLM calls."

GBrain的核心哲学是**自组织记忆** —— 不是预先设计schema，而是让记忆结构在使用过程中自然涌现。这与传统知识图谱的"先建模后使用"形成对比。

## 行动建议

1. **评估集成**: OpenClaw是否需要原生支持GBrain作为可选记忆后端？
2. **文档格式**: 借鉴`llms.txt`作为OpenClaw标准文档地图格式
3. **混合检索**: 当前纯向量检索是否需要增加图遍历能力？
4. **技能生态**: 29个GBrain skills是否可以与OpenClaw skill系统互通？

---
**Related**: 
- [OpenClaw官网](https://openclaw.ai)
- [GBrain Evals](https://github.com/garrytan/gbrain-evals) - 评测数据集
