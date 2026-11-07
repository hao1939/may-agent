<ai_context>
summary: "Checkpoint for the finite Xiaohongshu backfill requested after the 2026-11-07 `explore-xhs` run. It preserves every exact run ID still recoverable from workflow evidence, keeps later discoveries separate, records nine evidence-backed dispositions, and identifies the workflow's 20-item truncation as the exact gap preventing reconstruction of all 29 run identities."
triggers: ["XHS backfill", "2026-11-07 explore-xhs", "wr_1794040651688_zrzq", "d66f10ca9325825c"]
last_updated: "2026-11-07"
</ai_context>

# Xiaohongshu backfill inventory — 2026-11-07 checkpoint

## Scope and source evidence

This is a **finite backfill checkpoint**, not an inventory of all Xiaohongshu posts.
It is anchored to the `explore-xhs` search for `AI agent 智能体` checked at
`2026-11-07T08:37:31.711Z` in workflow run
`wr_1794040651688_zrzq` (search fingerprint `d66f10ca9325825c`). The accepted
run reported 29 items.

The run's preserved workflow output and bounded researcher packet expose only
the first 20 exact IDs. The workflow source applies `search.items.slice(0, 20)`
before constructing that packet and again caps `itemIdsOrUrls` at 20. The
preserved evidence therefore does **not** contain the other nine exact identities.
They must not be guessed from a later search.

Evidence locations:

- `/app/.state/workflow-runs/wr_1794040651688_zrzq/run.json`
- `/app/.state/sessions/s_1794040667665_599f0ad9-5f8e-4120-9306-27d5319fb350/meta.json`
- Published review of one run item: [`../../knowledge/findings/2026-11-07-agent-sandbox-control-plane-boundary.md`](../../knowledge/findings/2026-11-07-agent-sandbox-control-plane-boundary.md)

## Recoverable frozen-run inventory

| # | XHS post ID | Search-card title | Durable disposition |
|---:|---|---|---|
| 1 | `6961ace3000000000903b207` | 大家将agent称为“智能体”？我已经搞明白了！ | **Inaccessible.** Retrieval of the exact post identity redirected to a Rednote login screen and returned only “Log in - rednote - share, connect, love,” with no post body or post-specific content. Recovery requires permitted access through an already authenticated XHS/Rednote browser session, or another authorized retrieval mechanism that returns the exact post body; do not use a login bypass or substitute source. Durable assessment: [`2026-11-07-source-assessment-bbe01fe68cd6.md`](../../knowledge/findings/2026-11-07-source-assessment-bbe01fe68cd6.md). |
| 2 | `6aee77c70000000002037f37` | 一群AI组队干活？先泼盆冷水 | **Inaccessible.** Retrieval of the exact post identity redirected to a Rednote/XHS login page and returned only “Log in - rednote - share, connect, love,” with no post body, caption, author details, media, comments, or links. This is retrieval evidence only and does not support a substantive characterization or body-level review. Recovery requires authorized access that returns the actual post body; do not bypass login or substitute search-card metadata. Durable assessment: [`2026-11-07-source-assessment-a189aa436cf1.md`](../../knowledge/findings/2026-11-07-source-assessment-a189aa436cf1.md). |
| 3 | `6adeb34e00000000150130b7` | 别再折腾多Agent编排了：Claude | **Inaccessible.** Retrieval of the exact post identity redirected to a Rednote login page and returned only “Log in - rednote - share, connect, love,” with no title, body, author identity, images, captions, video, outbound links, implementation details, or engagement context. This supports only an authentication blocker, not any characterization of the post. Recovery requires authorized retrieval that exposes the actual post body and any material media or links; do not bypass login or infer content from search-card metadata. Durable assessment: [`2026-11-07-source-assessment-ad01c037a78f.md`](../../knowledge/findings/2026-11-07-source-assessment-ad01c037a78f.md). |
| 4 | `6ae8935000000000360101cd` | 曾经爆火的 Coze，为什么走到这一步？ | **Inaccessible.** Retrieval of the exact post identity redirected to a Rednote login page and returned only “Log in - rednote - share, connect, love,” with no post body, title, author identity, images, video, comments, linked sources, or underlying primary evidence. This supports only an authentication blocker, not a content-level disposition. Recovery requires authorized retrieval of this exact post's substantive body or media; do not bypass authentication or substitute another post or search-card metadata. Durable assessment: [`2026-11-07-source-assessment-ad621f72c274.md`](../../knowledge/findings/2026-11-07-source-assessment-ad621f72c274.md). |
| 5 | `6ad5542b000000000c00e056` | Agent沙箱卷到25ms，然后集体翻车 | **Reviewed and integrated.** Complete readable body and visible comments were reviewed; the durable finding is [`2026-11-07-agent-sandbox-control-plane-boundary.md`](../../knowledge/findings/2026-11-07-agent-sandbox-control-plane-boundary.md). Attached images and cited primary sources were not inspected. |
| 6 | `6ade2282000000002a0397c4` | ORCA实测：最强智能体综合管理工具 | **Inaccessible.** Retrieval of the exact post identity redirected to a Rednote login page and returned only “Log in - rednote - share, connect, love,” with no title, author statements, body text, image captions, video transcript, cited evidence, or substantive outbound links. This establishes an authentication barrier only, not a content-level disposition. Recovery requires authorized retrieval of this exact post's body and any materially necessary image or video content; do not bypass authentication or substitute search-card metadata. Durable assessment: [`2026-11-07-source-assessment-4829292b37a3.md`](../../knowledge/findings/2026-11-07-source-assessment-4829292b37a3.md). |
| 7 | `6ab358e60000000015004988` | agent 夯拉榜 | **Inaccessible.** Retrieval of the exact post identity redirected to `rednote.com/login` with the target ID preserved in `redirectPath` and returned only the 39-character interface label “Log in - rednote - share, connect, love.” No title, author identity, body, images, video, caption, comments, citations, or linked-source content was exposed, so this supports only a login/body-access blocker and no content inference from search-card metadata. Recovery requires permitted access to the exact post body and any substantive media; do not bypass authentication. Durable assessment: [`2026-11-07-source-assessment-ed07063dea95.md`](../../knowledge/findings/2026-11-07-source-assessment-ed07063dea95.md). |
| 8 | `6aee979e000000001b01d6fa` | 什么是智能体（AI Agent）？ | **Out of scope.** A current detail read returned the readable post caption, which only gives a generic perception–decision–action introduction, contrasts goal delegation with chat, and says humans must judge correctness. That adds no reusable evidence beyond basic agent definitions. The source is a video; its audio, frames, and linked images were not inspected, so no broader claim is attributed to it. |
| 9 | `6ab7046b00000000140305a3` | 国内谁最有机会先把 Personal Agent 跑出来 | **Inaccessible.** Retrieval of the exact post identity redirected to a Rednote login URL and returned only the 39-character login-page label “Log in - rednote - share, connect, love.” No post body, author caption, claims, comments, images, video, OCR, transcript, or other material media text was exposed, so this supports only an authentication/body-access blocker and no content inference from search-card metadata. Recovery requires a policy-compliant, untruncated authenticated retrieval of this same post ID that exposes the exact body and any material media text; do not bypass access controls or substitute another post. Durable assessment: [`2026-11-07-source-assessment-28361b51fb69.md`](../../knowledge/findings/2026-11-07-source-assessment-28361b51fb69.md). |
| 10 | `6a6c2de5000000003501680a` | 为什么我们砍掉了多智能体流水线 | Pending body review |
| 11 | `6abf8d0e0000000002011add` | Personal Agent，会成为下个入口吗🤔 | Pending body review |
| 12 | `6aab4f5f0000000028029fa8` | 智能体失控的事 国安部下场点名 | Pending body review |
| 13 | `6adc2057000000002c017530` | 背下来！你的AI Agent就会很牛 | Pending body review |
| 14 | `6ae927e0000000000e00da4c` | 别再把AI当聊天搭子，尽早进入Agent时代 | Pending body review |
| 15 | `6aed6919000000000901282b` | 国产智能体平台落地指南 | Pending body review |
| 16 | `6ad9eb15000000002c017145` | 2026 年，个人 Agent 走到了哪一步 | Pending body review |
| 17 | `6abf9feb000000001403021a` | 10月Agent榜，Codex杀进前三 | Pending body review |
| 18 | `6ac49125000000001a02bea6` | 当前各家个人Agent的记忆系统是如何构建的 | Pending body review |
| 19 | `6acca2d10000000002010546` | 哈佛这门Agent课的大纲有点太满了 | Pending body review |
| 20 | `6adeca5a000000001a033dde` | AI快讯｜把子智能体折叠进主循环 | Pending body review |
| 21–29 | **Exact IDs absent from retained run evidence** | — | **Inaccessible identity evidence.** The accepted run count is 29, but the workflow retained only 20 IDs. Recovery condition: obtain an untruncated archive or original search receipt for `wr_1794040651688_zrzq`; a later search cannot establish historical membership. |

## Later search kept separate

A bounded same-query recheck during this backfill returned 27 current cards. It
shared 16 IDs with the recoverable frozen-run set, omitted four frozen IDs, and
introduced the following 11 IDs. These are **newly discovered candidates**, not
silently added to the frozen 29-item inventory:

- `6a787a1f000000002402ff7b` — Agent Memory全面总结五种主流框架
- `6adc355500000000250052a3` — AI快讯｜AI清道夫上线
- `6ad17a61000000001500841d` — 一张图看懂：Personal Agent 大战
- `6ac61d1900000000150053ca` — Personal Agent：分享一些近期看过的好东西
- `6aeeaa87000000000300208d` — 13分钟学会开源模型｜完整讲解
- `6a9b6bf3000000002a0055e9` — Astra正在吞掉Agent
- `6aeea8db000000000602f8b3` — AI 资讯｜2026／11／07
- `6aedcd82000000002a01ff6f` — 我劝退了 6 个想做 AI Agent 的客户
- `6a6790380000000001031018` — 天天喊 AI Agent,什么问题都要用 Agent吗？
- `6aee833c000000001b01d651` — 架构第1课：会自己干活的程序🤖
- `698c420e000000000d00a4e6` — 姚顺雨的智能体公开课！强烈推荐

No inference is made that any of these 11 are among the nine unretained IDs.

## Checkpoint counts and continuation

- Frozen-run total reported by the source workflow: **29**
- Exact frozen-run identities durably recovered: **20**
- Evidence-backed dispositions among recovered identities: **9**
  - reviewed and integrated: **1**
  - out of scope with reason: **1**
  - inaccessible with exact authentication blocker: **7**
- Known recovered identities still eligible for body review: **11**
- Frozen-run identities blocked on exact identity recovery: **9**
- Later discoveries kept separate: **11**

Continue with the 11 known eligible IDs, starting with
`6a6c2de5000000003501680a`, without rereading the nine dispositioned entries. In
parallel, recover the original nine identities only from an untruncated
historical receipt; do not substitute or guess from a refreshed search
population.
