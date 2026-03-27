# Semantic Memory Search（awesome-usecases）
> 来源: github.com/hesamsheikh/awesome-openclaw-usecases
> 归档日期: 2026-03-03 HB227 | web_fetch
> 工具: memsearch（zilliztech/memsearch，Milvus团队出品）

## 解决痛点
OC记忆存为Markdown文件，随时间增长后只能grep（关键词）或全量加载（浪费token）。
**memsearch = 向量语义搜索层，直接加在现有.md文件上**

## 4步上手
```bash
pip install memsearch
memsearch config init          # 交互式配置
memsearch index ~/memory/      # 建立向量索引
memsearch search "what caching solution did we pick?"  # 语义查询
memsearch watch ~/memory/      # 文件监听，自动重索引
```

## 完全本地模式（无API key）
```bash
pip install "memsearch[local]"
memsearch config set embedding.provider local
```
嵌入提供商：OpenAI / Google / Voyage / Ollama / 完全本地 ← 任选

## 三个架构亮点
1. **Markdown永远是事实来源**：向量索引只是缓存，随时`memsearch index`重建
2. **SHA-256智能去重**：只重新嵌入有变化的文件，API调用近零浪费
3. **混合搜索（BM25+向量+RRF重排序）**：比纯向量搜索更准确

## Amy评估 ★★★★★

直接解决档案HB210的痛点："原生内存搜索需要OpenAI/Gemini API才能激活嵌入层"
memsearch = 该问题的完整解决方案，且支持完全本地模式

与一蛙"长期记忆4种方法"互证：
- 方法②原生搜索（需API）→ memsearch local模式（无需API）
- 方法③MEM0（高级）→ memsearch（更轻量，直接操作.md文件）

Zilliz（Milvus背后公司）主动做这个工具 = 企业级向量数据库团队在押注OC生态。
