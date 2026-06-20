# STATE.yaml模式 + n8n+OC安全架构（awesome-usecases深挖）
> 来源: github.com/hesamsheikh/awesome-openclaw-usecases
> 归档日期: 2026-03-03 HB202 | web_fetch直读
> 相关帖: awesome-openclaw-usecases.md

## ⭐ STATE.yaml模式 — 去中心化项目管理

### 核心痛点
传统orchestrator模式：主Agent变成"交通警察"，成为瓶颈。复杂项目（多repo重构/研究冲刺/内容流水线）需要Agent并行工作，不需要持续监督。

### STATE.yaml结构
```yaml
project: website-redesign
tasks:
  - id: homepage-hero
    status: in_progress
    owner: pm-frontend
  - id: api-auth
    status: done
    owner: pm-backend
    output: "src/api/auth.ts"
  - id: content-migration
    status: blocked
    blocked_by: api-auth
next_actions:
  - "pm-content: Resume migration now that api-auth is done"
```

### 工作流程
1. 主Agent收到任务 → spawn子Agent，分配具体范围
2. 子Agent读STATE.yaml → 找到自己的任务
3. 子Agent自主工作 → 更新STATE.yaml
4. 其他Agent轮询STATE.yaml → 拾起解锁的任务
5. 主Agent定期check → 审视状态，调整优先级

### AGENTS.md配置精华
```
Main session = coordinator ONLY. All execution goes to subagents.
Rules:
- Main session: 0-2 tool calls max (spawn/send only)
- PMs own their STATE.yaml files
- PMs can spawn sub-subagents for parallel subtasks
- All state changes committed to git
```

### 关键洞察
- **STATE.yaml > orchestrator**: 文件协调比消息传递扩展性更好
- **Git as audit log**: 提交STATE.yaml变更 = 完整历史记录
- **Label conventions**: `pm-{project}-{scope}` 便于追踪
- **主Session薄化**: 主Agent做的越少，响应越快
- 灵感来源：Nicholas Carlini的autonomous coding agent方法

---

## ⭐ n8n+OC安全架构 — 凭证隔离模式

### 核心痛点
OC直接管理API密钥的三重问题：
1. 无可见性（skill文件里的JS难以检查）
2. 凭证蔓延（每个API key都在Agent环境里，一次bad commit就泄露）
3. Token浪费（发邮件/更新表格等确定性任务也烧LLM推理token）

### 架构模式
```
OpenClaw(agent) --[webhook call, 无凭证]--> n8n Workflow(含API keys) --[API call]--> External Service
```

### 工作流程
1. 告诉OC需要什么 → OC通过n8n API创建workflow（含webhook trigger）
2. 你手动在n8n UI里添加凭证
3. 你**锁定**workflow（防止Agent再修改）
4. 未来OC只调用webhook URL + JSON payload，永不见API key

### 核心优势
- 凭证隔离：API keys只在n8n凭证库
- 视觉调试：n8n拖拽UI可检查每个workflow
- 可锁定：测试通过后锁定，Agent无法修改
- 安全门：可在n8n里添加验证/限速/审批步骤

### 社区Docker Compose
**openclaw-n8n-stack** (github.com/caprihan/openclaw-n8n-stack):
- OC on :3456 + n8n on :5678
- 共享Docker网络（OC直接call `http://n8n:5678/webhook/...`）
- 预置workflow模板：多LLM事实核查/邮件分类/社媒监控

### AGENTS.md配置
```
When I need external APIs:
1. NEVER store API keys in my environment or skill files
2. Check if n8n workflow exists
3. If not, create via n8n API with webhook trigger
4. Notify user to add credentials and LOCK workflow
5. All future calls: webhook URL with JSON payload
Naming: openclaw-{service}-{action}
```

## Amy评估 ★★★★★

STATE.yaml模式 = 目前见到的最成熟的多Agent协调方案，解决了"orchestrator bottleneck"问题。
n8n模式 = 直接解决律师帖"裸奔"批评，技术上可行的凭证隔离架构。
openclaw-n8n-stack已有现成Docker Compose，零门槛上手。
