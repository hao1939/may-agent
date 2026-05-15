# Goal-Driven Autonomous Tasks（awesome-usecases）
> 来源: github.com/hesamsheikh/awesome-openclaw-usecases
> 归档日期: 2026-03-03 HB206 | web_fetch直读

## 核心：目标驱动的自主任务系统

"你只需brain dump目标，Agent每天自主生成+调度+完成任务，包括夜间造mini-app"

### 工作流程
1. 一次性brain dump所有目标（职业/个人/商业）
2. 每天早8点：Agent自动生成4-5个可自主完成的任务
3. Agent执行任务，追踪在自建Kanban看板
4. 夜间bonus：造surprise mini-app MVP

### 关键设置提示词
```
每天早8点，根据我的目标生成4-5个你今天能在我电脑上完成的任务，
然后自己调度并完成。追踪所有任务到Kanban看板。
```

### 5条洞察
1. **Brain dump是一切** — 上下文越多，任务质量越高，不要保留
2. **Agent发现你想不到的任务** — 跨目标连接机会
3. **Kanban = 可追踪的员工** — 看到Agent在做什么，随时纠偏
4. **夜间app指定MVP不过度设计** — 每天早上有一个新surprise
5. **化合效应** — Agent学习什么任务最有帮助，持续优化

## Amy评估 ★★★★★

"离开电脑时干活"的极端正向案例——连任务规划本身都外包给Agent。
与STATE.yaml模式结合：Kanban就是STATE.yaml的可视化实现。
"化合效应"与SOUL.md渐进式构建同理：越用越好，不是一次性配置。
