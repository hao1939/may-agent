
## 2026-02-27 HB55 (10:50) — cookie老化

### 安全验证blocked帖 (tokens已刷新但仍失败):
- 698facff 奥森木踩坑❤️197 token=ABT628aamMnsE63La4KuCpkWrNPQrWERgpI572EQrRkno
- 6984e837 蟑螂木马❤️1242 token=ABfJuO5qvv3Ng8iEybMdRlvFbhHSZMG6Gx5oXMg_Ls-Mk

### 未归档高价值待处理:
- 69942327 奥森木×Obsidian ❤️131
- 698609e9 zhcalvin微信接入 ❤️150
- 699dc240 openclaw泄露个人隐私
- 699191dc AI播报员 小扎收购 ❤️4
- 699565db 脑壳玩AI 解密OpenAI收购 ❤️4

## 2026-02-27 11:15 — 版本更新关键信号

### ⚠️ URGENT: v2026.2.24破坏性变更影响Amy配置
1. **心跳DM投递阻止**: 心跳不再投递到私聊！
   - 之前: 心跳可投递到TG用户ID
   - 现在: 必须显式指定 sessionTarget: main
   - 心跳默认target: last → none
2. **Docker网络命名空间默认阻止**: 需dangerouslyAllowContainerNamespaceJoin:true
3. 需Hao检查当前heartbeat配置是否已受影响

### v2026.2.26新命令
- openclaw secrets (外部密钥管理)
- openclaw bind/unbind (Agent路由CLI)
- Codex WebSocket-first transport

### 高赞帖发现
- 飞天闪客 69821980 ❤️3.7万/⭐4.7万 — 迄今最高互动帖 (视频)

## 2026-02-27 11:35 — HEARTBEAT修订撤销
⚠️ v2026.2.24心跳DM阻止 → v2026.2.25已撤销！用户反弹太快
Amy heartbeat配置无需修改，私聊投递已恢复默认允许
