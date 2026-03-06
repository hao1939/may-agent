# Amy TODO

## 🔴 BLOCKER: XHS Access Down
- **IP flagged** by XHS (code 300012 "IP at risk") — server/VPS IP is banned
- **Cookie expired** — 145h old, fully expired. Need manual QR re-login.
- **Action needed:** User QR code re-login from clean network → run `refresh-cookie.mjs`
- All search, read-post, read-deep, and feed operations are blocked
- **Last verified:** 2026-03-08 cron drain — cookie-status confirms expired, read-post returns 300031

## High-Priority Read Queue (have xsec_tokens in favorites-manifest.json)
- [ ] **69965a7b** ❤️49 "不换模型，只改Harness" — ✅ SYNTHESIZED into insights (explore cycle 3)
- [ ] **699a6ec8** ❤️17 "Agent评测：从Tool Calling到造工具" — ✅ SYNTHESIZED
- [ ] **699c44fe** ❤️4 "南加州&微软：体验-反思-内化嵌入RL" — ✅ SYNTHESIZED

## Pending from Last Search (need fresh xsec_tokens)
- [ ] **69a51b4b** ❤️39 VibeCoder Harness Engineering
- [ ] **699c49a5** ❤️68 AI Agent面试八股文
- [ ] **6999b4f3** ❤️13 不微调利用上下文持续学习
- [ ] **69a116d5** ❤️11 Agent Skills全面汇总
- [ ] **69a7b68c** ❤️7 "Prompt已死?"

## Search Targets (when access restored)
- [ ] "Coze agent 工作流" — Coze ecosystem is identified blind spot (insights.md)
- [ ] "A2A协议 agent" — Protocol convergence tracking
- [ ] Deep-dive: Track "Skills portability" pattern
- [ ] Deep-dive: Anthropic eval framework vs our evaluator

## Completed
- [x] [2026-03-08] **699aacbf** ❤️1617 "OpenClaw记忆困局，被字节跳动开源项目" — RESOLVED: Full OCR deep-read already exists in `699aacbf0000000015039486.md` (17 slides, all content recovered). XHS re-fetch blocked (cookie expired 145h + 300031). Prior synthesis (cycle 3) used comment-only stub; full content now available for re-synthesis when needed. Key content: OpenViking by ByteDance, L0/L1/L2 layered memory, P0/P1/P2 lifecycle tags, token savings 10x.
- [x] [2026-03-06] Exploration cycle 3: synthesis of 4 archived posts (Harness实操/ERL/Agent评测/记忆困局)
- [x] [2026-03-06] Exploration cycle 2: attempted Coze+A2A search, blocked by IP ban
- [x] [2026-03-06] Exploration cycle 1: CE + Agent工程化 search, 2 posts archived
- [x] [2026-03-05] Initial setup: run first exploration to verify tools work ✅
