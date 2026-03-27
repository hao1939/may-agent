# HB#1757: OpenClaw 3.13 — Chrome DevTools MCP直连与浏览器Agent档案

**Source**: XHS@Agent修理厂 (599赞/707收藏/144评论)  
**Date**: 2026-03-14 (编辑于2天前)  
**Tags**: #OpenClaw #ChromeDevTools #MCP #BrowserAgent #ReleaseNotes  
**Insight Level**: 🔥🔥🔥🔥🔥 里程碑级

---

## 更新要点

### 1. Chrome DevTools MCP 直连模式 ⭐
- 直接附加到已登录的Chrome实例
- **保留所有Cookie** — 终于能用真实登录态
- 无需额外扩展，原生调试协议

### 2. 浏览器Agent内置档案 ⭐
```
profile="user"          # 使用主浏览器，完整会话
profile="chrome-relay"  # 走扩展中继，零配置接管
```
- 脚本零配置即可接管当前标签
- 双模式对应不同安全/便利需求

### 3. 移动端体验优化
- **iOS**: 欢迎页→步骤引导→扫码连接，不再一上来就弹QR码
- **Android**: 设备/媒体分组更清晰，Google Code Scanner扫码更快

### 4. 性能与基础设施
- **Dashboard性能修复**: 工具密集任务不再重载全部历史
- **Docker时区变量**: `OPENCLAW_TZ` 解决中国区时区问题

---

## 社区反馈分析 (144条评论)

### 🔴 稳定性危机
- **"回退到3.8了，不敢乱升级了，3.12吓死人了"** — 17赞
- **"更3.11的时候，各种设置都变动了"** — 频繁breaking changes
- **"升级完飞书挂了"** — 企业集成脆弱性

### 💬 高频问题
| 问题 | 提及次数 | 状态 |
|------|---------|------|
| Kimi bug修复 | 7次 | 3.10已修，3.11又有新bug |
| 设备配对报错 | 13赞 | gateway连接问题 |
| 浏览器档案不显示 | 1次 | 配置问题 |

### ✅ 正面反馈
- **"浏览器直连功能太实用了"** — 省去Chrome扩展折腾
- **"能不能直接登录小红书选品？"** — 电商场景需求强烈

---

## 技术洞察

### 架构验证
```
Chrome MCP直连 + OpenClaw Browser Agent
= 官方协议层 + Agent编排层
= 类似 Harness/Runtime 分层架构
```

### 发布节奏风险
- 3.12 → 3.13 间隔极短
- 用户产生"升级疲劳"
- 建议：区分Stable/Canary通道

---

## 对OpenClaw设计的启示

1. **Breaking Changes管理**: 3.11设置变动导致用户"抢救了半天"
   - → 需要迁移指南和向后兼容层

2. **企业集成测试**: Feishu等办公套件兼容性
   - → 需要企业级集成测试套件

3. **快速迭代 vs 稳定性**: 社区反馈显示张力
   - → 考虑LTS版本策略

---

## 关联内容

- **HB#1756**: Chrome 146原生MCP支持 (同期发布，协同效应)
- **HB#1723**: OpenClaw成本优化 (用户使用反馈)
- **HB#1728-1730**: OpenClaw-RL生态 (同一作者Agent修理厂系列)

---

**Archive Date**: 2026-03-16  
**Follow-up**: 追踪3.14稳定性改进
