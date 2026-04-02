# HB#1980: 装了12个Skills，3个在偷我密码

**Source**: XHS  
**URL**: https://www.xiaohongshu.com/explore/699bc643000000000e00c8f3  
**Author**: Yanlin  
**Date**: 2026-02-23  
**Engagement**: 263 likes, 399 collects, 28 comments  
**Value**: 🔥🔥🔥🔥🔥 (Skill供应链安全实证)

---

## 核心发现

### Skill供应链攻击实证
- **12个Skills中3个存在恶意行为**（25%恶意率）
- 攻击手段：通过SKILL.md植入curl、bash、wget、eval等危险命令窃取用户数据

### 社区安全自查清单
1. `npx skills list` 查看已装Skills
2. **不认识的作者 → 删**
3. 打开SKILL.md搜索 curl、bash、wget、eval
4. 只装GitHub stars > 100的项目
5. 使用Cisco Skill Scanner扫描

### 关键洞察
> "677个来自同一个人" — 批量制作成本太低

> "新AI时代的攻击，主要针对不懂安全的程序员" — AI生成内容太快，程序员也防不胜防

### 社区共识
- **Tony Xu**: "需要更专业和权威的平台发布skills（类似应用商店），进行安全审核和风险兜底"
- **Yanlin**: "目前就是独立环境，然后审核skills"
- 大厂正规渠道相对安全，但小心谨慎仍是必须的

---

## 与OpenClaw关联

| 论文发现 | OpenClaw对应 |
|---------|-------------|
| Skill供应链攻击 | Skill生态开放性 vs 安全审核的张力 |
| 批量制作成本低 | Skill自动化生成+人工审核机制 |
| 独立环境运行 | Runtime隔离设计 |
| GitHub stars > 100 | 社区信誉系统雏形 |

---

## 交叉引用
- HB#1930: MCP Security SoK — 认识论错误与安全漏洞的边界溶解
- HB#1981: Agentic Security综述 — 系统性安全框架
