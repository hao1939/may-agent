# 191: 两种Agent记忆系统的比较与分析（下）

**Source**: 小红书 @YipU  
**URL**: https://www.xiaohongshu.com/explore/69aad5990000000015020194  
**Date**: 6天前  
**Stats**: 211 likes, 284 collects, 26 comments

## Summary

YipU的续篇，深入对比Markdown文件流派vs RAG流派，提出二者融合是2026年的主流趋势，以OpenClaw为典型案例。

## Markdown文件流派

**好处：**
1. 人类介入简单，直接改文档
2. 有版本控制，可以基于时间回溯
3. 瞬时，检索零延迟
4. 成本低，硬盘存储，无需托管向量数据库
5. Agent可以不断修改记忆，迭代进步

**坏处：**
1. 可扩展性弱，md文件没办法无限扩充
2. 多Agent难以并发处理一个md文件

## 二者融合

2026年当下，更多Agent架构采取二者混合的形式，比如OpenClaw。

**架构细节：**
- 记忆本身依旧是markdown文件
- 检索记忆利用了向量数据库
- markdown文件会按 `##` 进行切分，存入向量数据库
- Agent需要回忆时，主动检索（**70%向量，30%BM25全文本关键词**）
- 主干记忆累积过多，自动压缩（compact），进行summary

## 二者应用方向

- **RAG**: 在海量文本的知识平台，依旧是基石
- **Markdown记忆**: 一个特定用途的Agent，可能更需要本地化的Markdown记忆系统

## 评论区高价值讨论

### faskety - 记忆库入库方案
> "文档流是对的。多agent协调管理的并行写入问题是可以解决的。记忆库入库为单独的jsonl文件，每个agent对话都是单独的jsonl新增，然后一个记忆库agent定时处理这些文件分门别类存为不同周期的md文件。检索时只检索md文件，jsonl相当于冷备份。仿照图书馆建立整体系统。"

### 泳娃家的菜爸 - 实际实现方案
> "我的实现是本地用markdown加sqlite-vec，类似于QMD，但是我加了记忆自动归纳整理合并：不同类别的记忆放到不同的md文件，语义相近的记忆会被合并，整个md文件可以被统一整理归纳。知识库例如我让openclaw收集的网页数据存放在数据库，分两层，一层是elasticsearch存原文和metadata，好处是原文压缩比高，自带bm25。第二层是向量数据库，只存chunk以后的向量"

### null - 为什么直接读markdown
> "用spec driven development 和CLI + agents写代码你就会发现为什么想直接读markdown，直接给markdown上index。再看Rag复杂和不方便的地方。"

## L3 Flag

**L3 Flag #191**: Markdown+Vector混合检索架构（70%向量+30%BM25）成为社区共识，OpenClaw作为典型案例被反复引用。多Agent并发写入可通过jsonl冷备份+记忆库Agent定时归档解决。

## Relevant Context

- 与insights.md中的记忆系统演进路线高度对齐
- faskety的jsonl方案可作为Workspace层并发写入的参考实现
- BM25+向量混合检索验证了我们的三层架构检索策略
