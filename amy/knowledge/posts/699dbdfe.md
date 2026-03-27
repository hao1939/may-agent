# 699dbdfe — 用 openclaw Agent 军团替代了整个开发团队
> Author: 奥森木（来源：Elvis案例） | ❤️12 | 2026-03-02 archived
> URL: https://www.xiaohongshu.com/explore/699dbdfe000000001b01fbc2

## ⭐ Elvis 一人公司生产级系统

### 核心数据
```
日均提交：50 commits | 单日最高：94 commits
月成本：Claude $100 + Codex $90 = 总计 < $200
30分钟内：7个PR从想法到生产
硬件瓶颈：16GB Mac Mini跑4-5个Agent，已下单128GB Mac Studio
```

### 架构：两层设计
```
层1（OC）：持有全部业务信息，翻译成精准prompt喂给coding agent
层2（coding agent）：只管写代码
← 与 Stripe 内部 Minions 系统是同一思路
← "塞满代码就没空间放业务上下文"
```

### Zoe 编排 Agent（AI编排层）
```
能力：自动派任务 | 写prompt | 选模型 | 监控进度
主动行为：
  早上主动扫Sentry修bug
  开完会扫Obsidian笔记派功能
  晚上扫git log更新文档
学习：成功模式记录下来，prompt越写越准
```

### 八步工作流
```
1. 客户打电话
2. 会议笔记自动同步到Obsidian
3. Zoe已有全部上下文，零解释成本直接scope功能
4. Zoe帮客户充值解锁
5. 从生产数据库拉配置
6. 派生带完整上下文的Codex Agent
7. 每个Agent跑在独立git worktree + tmux session
8. 中途跑偏→直接发指令纠偏
```

### 监控：10分钟Cron（不直接poll agent）
```
读JSON注册表检查：tmux存活 | PR状态 | CI结果
失败：自动重试最多3次
只有需要人工介入才通知
```

### Done标准（严格）
```
CI全过 | 三个AI分别review | UI改动必须附截图
```

### 三AI互相Code Review分工
```
Codex：最彻底，抓边界case和竞态条件，误报率极低
Gemini Code Assist：免费，发现安全和扩展性问题
Claude Code：太谨慎，多是过度工程建议，只看critical标记
三个互相补位，直接在PR上评论
```

### Agent 选型路由（Zoe自动）
```
Codex     → 主力90%任务：后端逻辑/复杂bug/多文件重构
Claude Code → 更快：前端+git操作
Gemini    → 前端设计（再交给Claude Code实现）
```

### 失败处理
```
不盲目重试：Zoe用业务上下文诊断，改写prompt后再试
```

## Amy评估 ★★★★★
**迄今见过的最完整OC生产实战案例文档。** Elvis系统将所有已知最佳实践整合：
- 两层架构（业务上下文与执行分离）← 独立发现了与Stripe Minions相同的模式
- Zoe主动扫描（而非被动等待）= 真正的自主Agent
- 三AI互相review（不批自己作业）← 与Antfarm独立Verifier完全收敛
- JSON注册表监控（不poll agent）= 便宜且可靠的监控方案
- 硬件瓶颈清晰：16GB→4-5个Agent，想要更多需128GB
预判：2026年涌现大量一人百万美元公司。
