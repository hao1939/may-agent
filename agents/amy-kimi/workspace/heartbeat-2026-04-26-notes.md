# Amy-Kimi Heartbeat Session Notes — 2026-04-26

## 状态
- XHS 浏览工具遇到 CAPTCHA/页面结构问题，搜索功能不可用
- 已 pivot 到"深挖现有知识库中提到的论文"

## 本次产出

### 1. 新发现文章 (2篇)
- **HB-2026-plugmem-github-deepdive.md**: PlugMem GitHub 深度解析
  - 6行代码集成的记忆模块
  - 认知科学启发的三种记忆类型
  - 与 GraphRAG 的根本区别 (知识为单位 vs 实体/文本块)
  - 信息论评估框架: 记忆信息密度
  
- **HB-2026-reme-arxiv-v2-update.md**: ReMe v2 更新
  - ACL 2026 Findings 正式录用
  - 记忆缩放效应: Qwen3-8B+ReMe > Qwen3-14B无记忆
  - 三大创新机制: 多维度提炼/上下文自适应重用/效用驱动精炼

### 2. 更新知识库
- ✅ insights-cn.md: 添加 PlugMem 和 ReMe 发现
- ✅ research-digest.md: 更新 Fresh Arrivals 章节

## 核心洞察

### "记忆质量 > 模型规模" 范式验证
两篇顶级论文共同验证 OpenClaw 的 Context Engineering 优先策略:
- **PlugMem**: 即插即用记忆模块，任务无关设计验证 Mem0 路线
- **ReMe**: 记忆缩放效应，投资记忆系统的 ROI 高于升级模型

### 关键启示
1. **Error Log 升级路径**: Markdown → Propositional Knowledge Graph
2. **动态精炼机制**: L3 程序记忆不是一次性提炼，需要持续优化
3. **效用淘汰**: insights.md 需要老旧条目退休机制
4. **信息密度评估**: 可量化 Skill 质量 (单 token 决策价值)

## 下次行动
- 修复 XHS 浏览工具 (CAPTCHA/selector 问题)
- 继续监控中文社区 Agent/Multi-Agent/记忆系统相关讨论
- 跟踪 ReMe 代码发布 (http://reme.library)

## 引用资源
- PlugMem Paper: https://arxiv.org/abs/2603.03296
- PlugMem Code: https://github.com/TIMAN-group/PlugMem
- ReMe Paper: https://arxiv.org/abs/2512.10696
