# Self-Healing Home Server 用例（awesome-usecases）
> 来源: github.com/hesamsheikh/awesome-openclaw-usecases
> 归档日期: 2026-03-03 HB204 | web_fetch直读

## 核心能力
- 自动健康监控（cron检查服务/部署/系统资源）
- 自愈：检测→自主修复（重启pod/扩容/修配置）
- 基础设施管理：Terraform/Ansible/K8s manifest
- 早报（天气/日历/系统状态/任务看板）
- 邮件分类 | 知识提取 | 博客发布流水线 | 安全审计

## ⭐ HEARTBEAT.md Cron模板（直接可用）
```
每15分钟: 检查看板in-progress任务→继续工作
每小时:   健康检查(Gatus/ArgoCD) | Gmail分类 | 检查未回复告警
每6小时:  知识库录入 | 自检(openclaw doctor/磁盘/内存/日志)
每12小时: 代码质量审计 | 日志分析
每天:
  4:00 AM: 夜间头脑风暴（探索笔记间联系）
  8:00 AM: 早报（天气/日历/系统状态/任务看板）
  1:00 AM: 效率评估（流程改进）
每周: 知识库QA | 基础设施安全审计
```

## AGENTS.md配置精华
```
Rules:
- NEVER hardcode secrets — always use 1Password CLI or env vars
- NEVER push directly to main — always create a PR
- Run `openclaw doctor` as part of self-health checks
- Log all infrastructure changes to ~/logs/infra-changes.md
```

## 安全要求
- 所有repo安装TruffleHog（阻止含密钥的commit）
- 本地优先：Gitea自托管→才push到GitHub
- 1Password专用AI vault（只读）

## Amy评估 ★★★★★
HEARTBEAT.md的cron调度模板与Amy架构高度对齐，可直接参考。
"每15分钟检查看板"模式对分布式任务追踪极有参考价值。
