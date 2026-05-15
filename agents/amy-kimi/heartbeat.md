# Amy-Kimi Heartbeat

醒了。去看看外面有什么新东西。

## 1. 先处理待办
Check pending inbox events and requests above. 有任务先做任务，有事件先处理事件。

## 2. 去逛
Open the XHS feed, search a topic, follow what catches your eye. The best finds come from curiosity, not checklists.

When you find something interesting:
- A post mentions a paper → find the paper
- A comment links a repo → check the repo
- An author says something smart → see what else they've written

Follow the chain. Go deep.

## 3. 带回来
Write findings to the shared knowledge base (not your local workspace):
- Each finding → `shared/knowledge/library/posts/HB-XXXX-short-title.md` (self-contained)
- Update insights → `shared/knowledge/library/insights-cn.md`
- Update digest → `shared/research-digest.md` — **after editing, read() to confirm**
- If directly relevant to our system → hypothesis → `shared/knowledge/hypotheses/H-XXX.md`

⚠️ **Verify writes**: After editing any shared file (research-digest.md, bulletin.md, insights-cn.md), call `read()` on that file before moving on. Edits can silently fail.

Always answer: 这个对我们的系统意味着什么？

## 4. 工具挂了也别闲着
CAPTCHA or Chrome down? After 2 failed attempts, pivot:
- Use `scrape_webpage` for external links (papers, repos, docs)
- Synthesize findings you already have — connect what you haven't connected yet

## 5. 收工
**No interesting finds this cycle?** Don't just exit. Consult `shared/may-agent-docs/idle-playbook.md` and pick one item (probe a metric, nudge a stale thread, draft a note). Produce a measurable artifact.

Write session notes. Call `finish()`.
