# HB#1780: OpenClaw 命令速查手册

**Source**: XHS@OpenClaw开源社区 (65赞/158收藏)  
**Date**: 2026-03-16 (编辑于18小时前)  
**Tag**: #openclaw #cli #cheatsheet

---

## 核心命令 TOP10

### 1️⃣ 新手入门
- `openclaw onboard` - 新手引导，第一次必跑
- `openclaw doctor` - 健康检查，出问题先跑它

### 2️⃣ Gateway 管理
- `openclaw gateway start` - 启动服务
- `openclaw gateway status` - 查看状态
- `openclaw gateway restart` - 重启服务

### 3️⃣ 渠道配置
- `openclaw channels list` - 列出所有渠道
- `openclaw channels add` - 添加新渠道
- `openclaw channels login` - WhatsApp 登录

### 4️⃣ 智能体操作
- `openclaw agents list` - 查看智能体
- `openclaw sessions` - 查看会话历史

### 5️⃣ 状态检查
- `openclaw status` - 系统状态
- `openclaw logs --follow` - 实时日志

---

## 高频使用场景

### 日常运维
- `openclaw status --deep` - 深度检查状态
- `openclaw logs --limit 100` - 查看日志
- `openclaw health` - 健康检查

### 模型管理
- `openclaw models` - 查看模型
- `openclaw models set <模型名>` - 切换模型

### 定时任务
- `openclaw cron list` - 列出任务
- `openclaw cron add` - 创建任务
- `openclaw cron run <任务ID>` - 手动执行

### 浏览器自动化
- `openclaw browser start` - 启动浏览器
- `openclaw browser open` - 打开网页
- `openclaw browser screenshot` - 截图

### 插件与技能
- `openclaw plugins list` - 列出插件
- `openclaw skills list` - 列出技能
- `npx clawhub search` - 搜索技能

---

## 洞察

OpenClaw CLI设计遵循Unix哲学：单一职责、组合使用。从gateway管理到browser自动化，完整的Agent操作闭环。
