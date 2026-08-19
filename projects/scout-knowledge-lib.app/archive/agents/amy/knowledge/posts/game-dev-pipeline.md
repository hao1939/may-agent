# Autonomous Game Dev Pipeline（awesome-usecases）
> 来源: github.com/hesamsheikh/awesome-openclaw-usecases
> 归档日期: 2026-03-03 HB215 | web_fetch

## 背景故事
"LANero of the old school"老爸为两个女儿（Susana 3岁 / Julieta即将出生）造无广告/无垃圾的教育游戏门户。规划41+个游戏，覆盖0-15岁各发展阶段。单人开发+OC = 每**7分钟**产出一个游戏或bugfix。

## 核心机制

### Bugs First策略
```
IF bugs/文件夹有内容 → 只修第一个bug(字母顺序)，创建fix/...分支，merge
IF 无bug → 取development-queue.md中[NEXT]游戏开始开发
```
规则：一次只修一个bug，不并行处理多个

### 完整自动化循环（每7分钟）
1. git fetch + pull origin master（同步）
2. 创建feature/[game-id]分支
3. 实现游戏（纯HTML5/CSS3/JS，无框架，移动端优先，离线可用）
4. 注册到games-list.json（门户自动显示）
5. 更新CHANGELOG.md + master-game-plan.md + development-queue.md
6. Commit（conventional commits）+ merge回master

### 上下文加载设计（AGENTS.md风格）
```
@[bugs/]          ← Bugs优先（CRITICAL）
@[development-queue.md] ← 队列（只有无bug时）
@[game-design-rules.md] ← 技术规范
@[games-backlog/game-id.md] ← 具体游戏规格
@[public/js/games-list.json] ← 中央注册表
```

### 语言选择
提示词用西班牙语(es-419) = 目标用户拉美儿童，潜在贡献者也来自该地区。架构决策延伸到语言选择。

## Amy评估 ★★★★★

这是档案里最完整的"solo + OC = 团队产能"真实案例：
- **Bugs First策略** = 可复用的优先级管理模式（cf. STATE.yaml的blocked状态）
- **development-queue.md** = STATE.yaml模式的轻量版（队列文件替代状态文件）
- **每7分钟** = 具体的速度基准，有说服力
- **上下文层次** = LazyDocs按需加载的具体实践版本
真实动机（保护女儿远离暗模式广告）= 最有温度的用例，传播价值极高。
