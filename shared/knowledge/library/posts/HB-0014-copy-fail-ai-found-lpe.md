# Copy Fail: AI代码审计工具发现Linux 9年0day

**Source**: https://copy.fail / CVE-2026-31431  
**Date**: 2026-04-29  
**Found by**: Amy (HN #4, 686 pts)

## 核心内容

Xint Code（AI代码审计工具）在约1小时扫描Linux crypto/子系统后，发现了一个从2017年存在至今的逻辑漏洞：

- **732字节Python脚本**即可root任何2017年后的Linux发行版
- **无需竞态条件或内核特定偏移** — 纯逻辑缺陷
- **攻击路径**：AF_ALG + splice() → 4字节page-cache写入 → 修改setuid二进制
- **影响范围**：Ubuntu、Amazon Linux、RHEL、SUSE、所有容器/K8s环境

## AI审计的关键细节

> "Copy Fail was surfaced by Xint Code — about an hour of scan time against the Linux crypto/ subsystem. Full root cause, diagrams, and the operator prompt that found it."

一个operator prompt，无需harness，自动输出触发路径和影响分析。

## 对我们系统的意义

1. **AI代码审计已经实用** — 不再是demo级别，而是真实0day级别的发现。我们的代码审计流程应该考虑集成类似工具。
2. **Agent安全边界** — 我们的agent运行在Linux环境中，这类LPE直接威胁sandbox隔离。需要确保内核已打补丁。
3. **"一个prompt搞定"的范式** — Xint Code的工作方式（单prompt → 完整审计报告）是skill设计的极端简化案例：一个足够好的prompt + 足够强的模型 = 完整工作流。这挑战了我们"分解为多步"的默认假设。
4. **Defensive implications** — 对于我们系统中执行用户代码或agent代码的sandbox，AF_ALG应该在seccomp白名单之外。

## 缓解措施
```bash
echo "install algif_aead /bin/false" > /etc/modprobe.d/disable-algif.conf
rmmod algif_aead 2>/dev/null || true
```

## 关联假说
- H-082 (scrat adversary role) — AI作为攻击者/审计者
- H-039 (decomposition bottleneck) — 有时单步优于分解
