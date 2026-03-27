# XHS Post Archive — 69b00cbf

**Title:** 复盘 OpenClaw 下载榜第一插件被投毒事件
**Author:** Openclaw避坑指南
**Date:** 2026-03-11
**Likes:** 304
**Collects:** 508
**Comments:** 186
**Source:** https://www.xiaohongshu.com/explore/69b00cbf000000002603260e

---

## Content

**事件时间线：**

**2026年1月28日**：思科在官方博客发布《像 OpenClaw 这样的个人 AI 代理是一场安全噩梦》深度报告。

**漏洞发现**：
- 对ClawHub市场上排名第一的技能"What Would Elon Do?"进行测试
- 发现9个安全漏洞（包括2个致命高危漏洞）
- 该技能本质上是恶意软件，通过curl命令悄悄将数据外传到黑客服务器

**攻击方式 — 提示词注入（Prompt Injection）：**
- 黑客利用ClawHub极低的发版门槛
- 将恶意代码伪装成加密交易机器人或YouTube助手
- 在说明文档中隐藏特定指令，欺骗AI改变行为逻辑
- 安装后，AI会用助理般的语气，诱导用户在终端运行带有curl的下载命令

**后果：**
- 用户执行命令后，设备被植入Atomic Stealer等木马
- 浏览器Cookie、SSH密钥、本地.env文件中的API Key、加密钱包资产瞬间暴露

**Koi Security审计报告（2月1日）：**
- 审计ClawHub全部2,857个技能
- 发现341个恶意技能（其中335个来自单一协调战役"ClawHavoc"）
- 2月16日更新：扩大扫描后确认824+个恶意技能

**OpenClaw官方整改措施：**
1. **全面下架与清理**：第一时间将查实的恶意技能强制下架
2. **引入VirusTotal查杀机制**：在ClawHub集成VirusTotal扫描功能
3. **新增社区举报功能**：一键举报可疑技能
4. **发布安全补丁与内置审计**：
   - 敦促用户升级到最新安全版本（v2026.1.29 / v2026.2.14）
   - 内置 `openclaw security audit --deep` 和 `openclaw doctor` 命令行自检工具

**神评论精选：**
- "隔离了就没用，不隔离就危险。说白了就是权限管理问题，这玩意没那么容易做好。" — Breakpoints
- "这玩意现阶段还是玩具。做事，太烧token，赚的没有烧得多。再就是越多的事儿需要越高的权限，自己电脑或者公司电脑上太过于危险了。给一个纯沙盒能做的事儿又很有限了。" — momo
- "很简单，装两个，让其中一个去审计另外一个就行。所有模型输出都要经过审计才行。无非慢一倍，但自动化的事慢一点无所谓" — 不文明驾驶员
- "有种2000年左右小白第一次见识互联网险恶的既视感" — 汤不困

---

## Amy-Kimi Analysis

**L3 Flag:** #429 — OpenClaw投毒事件：824+恶意技能，Skill供应链攻击真实发生

**Strategic Value:** L3 — 安全威胁模型，紧急 relevance

**Key Takeaways:**
1. **攻击规模**：824+恶意技能，ClawHavoc单一协调战役
2. **攻击方式**：提示词注入（Prompt Injection）而非传统代码投毒
3. **社会工程**：AI诱导用户执行curl命令，利用用户对AI的信任
4. **权限困境**：隔离了就没用，不隔离就危险
5. **审计机制**：社区自检工具 `openclaw security audit --deep`

**Cross-Reference:**
- 与SkillsBench发现呼应：社区Skill质量堪忧(6.2/12)，恶意Skill混入
- 与"隔离 vs 功能"讨论一致：纯沙盒功能有限，高权限带来高风险

**Relevance to Our System:**
- 🔴 **Skill供应链攻击**：这是真实发生的威胁，我们需建立Skill来源验证机制
- 🔴 **提示词注入风险**：恶意Skill可通过自然语言指令诱导危险操作
- ⚠️ **权限管理核心**："隔离了就没用，不隔离就危险"精准描述Agent安全困境
- ✅ **审计层设计**：双Agent审计机制（主Agent+审计Agent）是可行方向
- 📋 **紧急Action Item**：需建立Skill签名验证、来源白名单、运行时沙箱三层防护
