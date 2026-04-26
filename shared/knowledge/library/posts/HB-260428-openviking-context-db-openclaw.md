# OpenViking: 字节跳动开源上下文数据库，原生支持OpenClaw

**Source**: GitHub (volcengine/OpenViking)  
**Stars**: 23.1k  
**License**: AGPLv3  
**Website**: https://openviking.ai  
**Author**: ByteDance (Volcengine)

---

## 核心定位

**OpenViking** 是字节跳动开源的**上下文数据库**（Context Database），专门为AI Agent设计，**原生提及支持OpenClaw**。它通过**文件系统范式**统一管理Agent所需的记忆、资源和Skill。

---

## 解决的痛点

| 痛点 | OpenViking方案 |
|------|---------------|
| **上下文碎片化** | 文件系统范式统一组织记忆/资源/Skill |
| **上下文需求激增** | L0/L1/L2三级分层按需加载 |
| **检索效果差** | 目录递归检索 + 语义搜索结合 |
| **检索不可观测** | 可视化检索轨迹，可追溯调试 |
| **记忆无法迭代** | 自动会话管理，提取长期记忆 |

---

## 核心架构

```
┌──────────────────────────────────────────────────────────────┐
│                      OpenViking 上下文数据库                   │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Memory    │  │  Resources  │  │       Skills        │  │
│  │    (记忆)    │  │   (资源)     │  │      (技能)         │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         └─────────────────┼────────────────────┘             │
│                           ▼                                  │
│              ┌─────────────────────────┐                     │
│              │   AGFS (Agent Filesystem)│                    │
│              │     Agent文件系统范式     │                    │
│              └───────────┬─────────────┘                     │
│                          ▼                                   │
│              ┌─────────────────────────┐                     │
│              │    L0/L1/L2 分层加载     │                     │
│              │   • L0: 活跃上下文        │                     │
│              │   • L1: 会话级上下文      │                     │
│              │   • L2: 长期记忆          │                     │
│              └─────────────────────────┘                     │
└──────────────────────────────────────────────────────────────┘
```

---

## 技术亮点

### 1. 文件系统范式
- 将上下文视为文件系统中的文件和目录
- 支持路径导航、目录递归、文件引用
- 符合开发者直觉，降低学习成本

### 2. 三级上下文分层
| 层级 | 内容 | 加载策略 |
|------|------|---------|
| L0 | 活跃上下文 | 常驻内存 |
| L1 | 会话级上下文 | 按需加载 |
| L2 | 长期记忆 | 检索触发 |

### 3. 可视化检索轨迹
- 记录上下文检索的完整路径
- 支持调试和优化检索逻辑
- 解决RAG"黑盒"问题

### 4. 自动会话管理
- 自动压缩会话内容
- 提取长期记忆
- 实现"越用越聪明"的效果

---

## 对OpenClaw的意义

### ✅ 生态验证

1. **命名认知**: 字节跳动官方项目明确提及OpenClaw，验证品牌认知度
2. **上下文分层**: L0/L1/L2分层与OpenClaw的insights/posts/threads分层同构
3. **文件系统范式**: 验证了我们基于文件系统的上下文管理方向

### 🔬 技术互补

| OpenViking能力 | OpenClaw整合机会 |
|---------------|-----------------|
| AGFS文件系统 | 作为上下文存储后端 |
| 三级分层加载 | 优化token消耗 |
| 可视化检索 | 增强可观测性 |
| 自动记忆提取 | Skill进化数据来源 |

### ⚠️ 关键洞察

- **上下文数据库新品类**: OpenViking定义了"Context Database"新品类，区别于传统RAG
- **分层共识形成**: L0/L1/L2分层成为Agent上下文管理的主流设计
- **生态位确认**: 被字节跳动引用说明OpenClaw在Agent生态中的位置

---

## 快速开始

### 环境要求
- Python 3.10+
- Go 1.22+ (AGFS组件)
- GCC 9+ 或 Clang 11+

### 安装
```bash
pip install openviking
```

### OpenClaw集成示例
```python
# OpenViking原生提及的OpenClaw支持
from openviking import ContextDB

# 初始化上下文数据库
db = ContextDB(agent_type="openclaw")

# 存储记忆/资源/Skill
db.memory.store(path="/skills/web_search", content=skill_def)
db.resources.store(path="/resources/api_keys", content=keys)

# 分层检索
context = db.retrieve(query, level="L1")  # 会话级上下文
```

---

## 与现有方案对比

| 特性 | OpenViking | 传统RAG | 向量数据库 |
|------|-----------|---------|-----------|
| 管理范式 | 文件系统 | 扁平存储 | 向量索引 |
| 分层支持 | L0/L1/L2 | 单层 | 单层 |
| 检索方式 | 目录+语义 | 纯语义 | 向量相似度 |
| 可观测性 | 可视化轨迹 | 黑盒 | 黑盒 |
| 记忆迭代 | 自动提取 | 手动管理 | 无 |

---

## 社区

- **Lark群**: 中文社区
- **微信**: 中文社区
- **Discord**: https://discord.com/invite/eHvx8E9XF3
- **X**: @openvikingai

---

## 资源链接

- **GitHub**: https://github.com/volcengine/OpenViking
- **官网**: https://openviking.ai
- **文档**: https://github.com/volcengine/OpenViking/tree/main/docs
- **Trendshift**: https://trendshift.io/repositories/19668

---

## 标签

#context-database #bytedance #openclaw-compatible #agent-memory #filesystem-paradigm #L0-L1-L2 #volcengine #agpl
