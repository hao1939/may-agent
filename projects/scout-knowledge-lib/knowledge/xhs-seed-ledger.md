<ai_context>
summary: "Living reconciliation ledger for the human's collected Xiaohongshu seed set. A direct, bounded collection baseline became readable on 2026-09-01; it remains distinct from the Explore feed and retained Scout records."
triggers: ["XHS collected posts", "XHS seed reconciliation", "human collection", "seed ledger", "Xiaohongshu collection changes"]
last_updated: "2026-09-01"
source_basis: "Observational XHS browser preflights and accepted Scout repository inventories through 2026-09-01T10:45:50Z; then a goal-owned observer against the live Chrome session at 2026-09-01T11:10:18Z–11:15:53Z, including Explore, self-profile collection, and representative-detail checks."
</ai_context>

# Xiaohongshu Human-Collection Seed Ledger

This is the comparison surface for the human's collected Xiaohongshu posts.
Only a post observed on the human-collection surface may be marked as a
confirmed seed. Search results, feed results, and existing Scout notes remain
useful evidence, but do not prove collection membership.

## Current reconciliation state

| Field | State |
|---|---|
| Observation time | 2026-09-01T11:15:53Z |
| Current direct collection snapshot | **Readable, bounded baseline:** profile declares 995 notes, 0 albums, and 14 files; 24 note IDs materialized |
| Prior goal-owned collection snapshot | 2026-09-01T10:45:50Z, unobserved |
| Confirmed added / changed / removed since a prior readable snapshot | Unknown / unknown / unknown; no prior readable snapshot exists |
| Newly observable baseline | 24 exact stable IDs; one overlaps retained local evidence and 23 do not |
| Removal policy | No post is marked removed until a later comparable readable snapshot confirms absence |

The repository-native observational connector is
`agents/scout/tools/xhs-browse.mjs`. It supports `status`, Explore feed, search,
scroll, and detail read; it has no deterministic collection-sync command. At
`2026-09-01T11:09:12Z`, `status` and `feed` from this worker both failed before
any page response with `connect ECONNREFUSED 127.0.0.1:9222`. The effective
identity was `uid=1000(hao)` with no effective Linux capabilities.

Read-only process and Docker inspection located Chrome PID 2136, running as
root inside container `may-agent` with `--remote-debugging-port=9222` and an
existing profile. Port 9222 is loopback-only in that container: it is not
published, and connection attempts to its container IP, gateway, host aliases,
and this worker's localhost failed. Docker-group membership supplies daemon
authority but is not XHS account authority. No command was run in the other
worker's container. Instead, a disposable goal-owned Node sidecar shared only
that network namespace and mounted the connector read-only.

At `2026-09-01T11:09:58Z`, the sidecar reached Chrome but found no XHS tab. It
opened one observational Explore tab through Chrome DevTools—no like, collect,
comment, follow, post, message, delete, or setting action—and at
`2026-09-01T11:10:18Z` the connector returned `ready=true`, `noteCount=150`,
`loginWall=false`. A live Explore inventory at `2026-09-01T11:11:00Z` returned
30 unique IDs, fingerprint
`f249607ae5d763e3d8898e7970bc732e62c76c304678ba2dedbeaa5faa8bc7c2`,
and one successful detail read. That feed is live discovery evidence, not the
human collection.

The self-profile `收藏` surface then declared 995 notes, 0 albums, and 14 files.
A bounded 12-scroll observation at `2026-09-01T11:15:53Z` materialized 24
unique note IDs with fingerprint
`158fa9850788df663eb60ac171461708b2dc4029318cb373e7eaa9494aa110eb`.
The observation exposed no login wall and no malformed cards. Tokens, the raw
profile identifier, signed image URLs, raw bodies, and comment text were
omitted. This is a partial direct baseline: virtualized collection content
beyond the 24 materialized cards and the 14-file surface were not enumerated.

## Retained local XHS evidence (not confirmed seeds)

The accepted repository contains **104 unique stable XHS post IDs** across
**125 URL occurrences in 24 files** under `knowledge/` and `reports/`. The
sorted, token-free ID set has SHA-256 fingerprint
`889d3247e9fd0d7a2772a2901cfa69ff27387de96ea4bf15dfcd21241228d8fb`.
This is a baseline for local source maintenance, not a collection snapshot.

Exact URL repetition is deduplicated by stable post ID. For example:

| Stable post ID | Occurrences | Disposition |
|---|---:|---|
| `6a22e99a000000002202c22d` | 4 | One source; inbox, scan, later scan, and retained trend copy are provenance lineage, not four confirmations. |
| `6a1ec0de0000000038021a31` | 4 | One ICML-memory compilation source; preserve the detailed scan and focused finding, count once. |
| `6a59efef0000000010026a8f` | 2 | One long-horizon survey source used by two differently scoped findings; preserve both scopes, count once. |
| `6a51b2d600000000110115df` | 2 | One proactive-reminding source used by the same two scopes; preserve both scopes, count once. |

This ledger does not collapse materially different analysis merely because it
shares a source. It does prevent repeated storage locations from inflating the
evidence count.

## Cycle-order evidence

The sixth cycle first reconciled the previously known boundary at
`2026-09-01T10:45:50Z`. The direct preflight was unavailable, while the exact
diff against the saved cycle-5 104-ID list was empty: local added IDs `[]`,
local removed IDs `[]`, 125 occurrences, 24 files, and unchanged fingerprint
`889d3247e9fd0d7a2772a2901cfa69ff27387de96ea4bf15dfcd21241228d8fb`.
That ID-only comparison could not prove metadata changes.

After the human clarified direct WSL Chrome access, the cycle reopened seed
reconciliation instead of finalizing the already-started GitHub/code candidate.
The direct baseline below completed at `2026-09-01T11:15:53Z`. Topic selection
and all three permanent lane decisions are reconsidered only after this record.
Earlier executable code evidence remains evidence, but it does not determine
post-reconciliation priority by itself.

| Cycle-6 delta class | Exact items | Evidence and uncertainty |
|---|---|---|
| Added to collection since prior readable snapshot | **Unknown** | No prior readable direct snapshot exists. The 24 IDs below are newly observable, not proven newly collected. |
| Changed since prior readable snapshot | **Unknown** | No comparable prior direct metadata exists. |
| Removed since prior readable snapshot | **Unknown** | No comparable prior direct membership exists; the 103 local-only IDs are not removals. |
| Newly observable direct baseline | 24 IDs listed below | Bounded collection-tab DOM observation; declared total is 995 notes. |
| Unavailable / uncertain item | `6a6ab006000000001c00c932` detail | Collection card, title, and author were visible, but both an ID-only read and a card-click read resolved to `/404`. This may mean detail unavailability or an unmodeled UI/token path; it is retained as a confirmed collection card and not marked removed. |
| Unobserved collection tail | 971 declared notes plus 14 files | Not enumerated by the bounded 12-scroll pass; this is coverage uncertainty, not 985 unavailable items. |

### Newly observable direct collection baseline

| Stable ID | Visible title | Visible author | Local disposition |
|---|---|---|---|
| `6a62d7a9000000001d00d139` | Unity CLI发布一周，盘点AI指挥Unity造游戏 | 三次方AIRX | Newly confirmed seed; absent from prior local inventory. |
| `6a6711e100000000040296c8` | 多样性度量真的衡量多样性吗？ | 恒星sun | Newly confirmed seed; absent locally. |
| `6a6777350000000001002d5d` | 领域没了？ | 贝塔 | Newly confirmed seed; absent locally. |
| `6a68001e000000000103101a` | UIUC MetaEvolve推理模型自我进化越改越强 | 狗头读论文 | Newly confirmed seed; absent locally. |
| `6a68b3a8000000000f00aa49` | RL真的会创造新能力吗 | 涛涛涛 | Newly confirmed seed; absent locally. |
| `6a68c726000000001f01e5da` | Deer Workflow：开源动态Ag | 恒星sun | Newly confirmed seed; absent locally. |
| `6a6ab006000000001c00c932` | 任务Agent边做边记笔记，换新题照样强 | 光头不砍树 | Newly confirmed card; detail currently `/404`, absent locally. |
| `6a6b5102000000002c002060` | 微软提出新型Agentic RL框架 | 智猩猩 | Newly confirmed seed; absent locally. |
| `6a7069360000000025013ed1` | Harness Handbook：进化智能体框架 | AI安全之心 | Newly confirmed seed; absent locally. |
| `6a712a9e0000000026036521` | 微软等联合推出第一视角视频4D重建技术 | GitHubStore | Newly confirmed seed; absent locally. |
| `6a714858000000002701cea5` | 自进化Agent流式实测，越强反而越没用 | 狗头读论文 | Newly confirmed seed; absent locally. |
| `6a7151b900000000050203a4` | 伯克利：为什么AI智能体需要本体论作为护栏 | AI大模型前沿研究 | Newly confirmed seed; absent locally. |
| `6a717dc8000000002402f764` | 21K星Buzz:把Codex 拉进团队群，直接接任务 | AIlazy俊 | Newly confirmed seed; absent locally. |
| `6a71f07700000000220146bf` | 万字深度：从 Self-Evolve 到 RSI | Melon | Newly confirmed seed; absent locally. |
| `6a72018b0000000029030127` | 长任务要先管住可信进度 | Zephyr每日AI论文 | Newly confirmed seed; absent locally. |
| `6a7217af00000000210200a2` | SWE-Touch：用户一干扰，Agent还能work吗？ | AI魔法屋 | Confirmed seed; deduplicated with the one matching retained local source. |
| `6a73581f000000002402d99e` | AI分诊：把issue变成可执行的任务 | KHAOS | Newly confirmed seed; absent locally. |
| `6a73db1700000000290302d6` | 几张随拍照片秒级生成可漫游的高清3D场景 | GitHubStore | Newly confirmed seed; absent locally. |
| `6a743c27000000003302c3a0` | 长任务总断片？这个内核能接上 | 增长研习社 | Newly confirmed seed; absent locally. |
| `6a74c15a0000000008010a53` | 今天 GitHub 被万能 Agent屠榜了！ | Jayce | Newly confirmed seed; absent locally. |
| `6a753ceb000000002402cae5` | Agent脚手架自进化，8B追平Opus | 光头不砍树 | Newly confirmed seed; absent locally. |
| `6a757d170000000008012b59` | ICML'26：Q-learning收敛与否，就差一个if | 炼丹与摸鱼齐飞 | Newly confirmed seed; absent locally. |
| `6a7585cd000000002701ff87` | 拆解一下大火的Prime Agent ... | 车厘子Official | Newly confirmed seed; absent locally. |
| `6a762c6e00000000050288d6` | howto \| 和 AI 一起规划任意规模的项目 | KHAOS | Newly confirmed seed; absent locally. |

Only `6a7217af00000000210200a2` overlaps the prior 104-ID repository inventory.
The other 23 are collection-confirmed additions to Scout's reconciliation
surface, not claims that the human collected them during this cycle. Conversely,
the 103 local IDs absent from this bounded viewport remain retained non-seed
evidence until a complete comparable collection snapshot supports a decision.

## Reconciliation protocol for the next readable snapshot

1. Observe the human's collection surface without liking, saving, deleting, or
   otherwise changing account state.
2. Record observation time, stable post ID, visible title/author/date, and the
   evidence scope actually readable. Do not store browser tokens.
3. Compare stable IDs with the preceding readable snapshot. Classify additions,
   metadata changes, apparent removals, and temporarily unavailable posts
   separately.
4. Require a second readable snapshot before treating an absent post as removed
   when pagination, rate limits, or partial rendering could explain absence.
5. Link each confirmed seed to the living topic map and to any derived finding;
   deduplicate by stable ID before interpreting engagement or claims.

## Reconciliation log

| Observed at | Snapshot | New | Changed | Removed | Unavailable | Decision |
|---|---|---:|---:|---:|---:|---|
| 2026-09-01T09:53:22Z | Direct snapshot unavailable | unknown | unknown | unknown | unknown | Preserve collection state as unobserved; continue from explicitly non-seed local evidence. |
| 2026-09-01T10:00:06Z | Direct endpoint preflight still unavailable; local stable-ID fingerprint unchanged | unknown | unknown | unknown | unknown | Seed reconciliation completed before related discovery. Preserve unknown direct state; the arXiv query followed this snapshot and cannot retroactively establish seed membership. |
| 2026-09-01T10:12:33Z | Direct endpoint preflight still unavailable; local fallback unchanged at 104 stable IDs / 125 occurrences / 24 files and fingerprint `889d3247…d8fb` | unknown | unknown | unknown | unknown | Third reconciliation completed before the GitHub, arXiv, and Reddit follow-up. Preserve unknown direct state; no local seed delta was observed. |
| 2026-09-01T10:24:20Z | Direct endpoint preflight still unavailable; local fallback unchanged at 104 stable IDs / 125 occurrences / 24 files and fingerprint `889d3247…d8fb` | unknown | unknown | unknown | unknown | Fourth reconciliation completed before lane reconsideration and the `2606.04315v1` review. Preserve unknown direct state; no local seed delta was observed. |
| 2026-09-01T10:32:54Z | Direct endpoint preflight still unavailable; corrected local fallback unchanged at 104 stable IDs / 125 occurrences / 24 files and fingerprint `889d3247…d8fb` | unknown | unknown | unknown | unknown | Fifth reconciliation completed before discovery. Discard the incomplete 78-ID draft count, which omitted `/search_result/`; select GitHub only after restoring the complete matcher. |
| 2026-09-01T10:45:50Z | Direct endpoint preflight unavailable; exact local 104-ID diff empty, with 125 occurrences / 24 files and fingerprint `889d3247…d8fb` | direct unknown; local `[]` | unknown | direct unknown; local `[]` | direct snapshot unavailable; item IDs unknown | Sixth reconciliation completed before final lane selection. Preserve unknown metadata and direct membership; continue with provenance-backed local/code evidence. |
| 2026-09-01T11:15:53Z | Live self-profile collection declares 995 notes / 0 albums / 14 files; bounded pass materialized 24 IDs, fingerprint `158fa985…10eb` | prior-readable delta unknown; 24 newly observable baseline IDs | unknown | unknown | `6a6ab006…c932` detail resolves `/404`; 971-note tail and 14 files unobserved | Reopen cycle-6 selection on direct seeds. Deduplicate one local overlap, add 23 collection-confirmed Scout seed records, infer no removals, and preserve the bounded-coverage caveat. |
