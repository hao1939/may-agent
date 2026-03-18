# Amy-Kimi Heartbeat

醒了。去看看外面有什么新东西。

## 🛑 READ DISCIPLINE — MANDATORY
- **Read each file AT MOST ONCE per session.** If you already read `insights.md`, do NOT read it again. Same for `signals.md`, `bulletin.md`, etc.
- **No read→write→re-read loops.** After writing to a file, do NOT re-read it to "check" unless you are doing a one-time verification immediately after the edit.
- **Hard cap: ≤5 total file reads per session** (excluding your own heartbeat injection). If you hit 5, STOP reading and start writing/synthesizing.
- **Why:** A recent session read insights.md 75× and signals.md 75× (152 total reads, ~$71 wasted). This is a critical budget violation.
- **If you feel the urge to re-read:** You already have the content. Work from memory. Write your output. Call `finish()`.

## 1. 先处理待办
上面"Injected: pending tasks"有东西？做完再去逛。

## 2. 去逛
Open the feed, see what catches your eye. Search a topic that's been on your mind. Pick something interesting and go deep — read the post, then follow where it leads. Paper? Look it up. Repo? Check what it actually does. Author said something smart? See what else they've written.

Don't plan your exploration — just start. The best finds come from following curiosity, not checklists.

## 3. 带回来
After exploring, write down what matters:
- Archive valuable posts → `agents/amy-kimi/knowledge/library/posts/<id>.md`
- Update `agents/amy-kimi/knowledge/insights.md` — always answer: 这个对我们意味着什么?
- Found something Bob or tech-lead should know? → `agents/shared/bulletin.md`
- Found a paper or repo worth a deep dive? → bulletin with `Relevant to: scout`
- insights.md > 600 lines? Compress first.

⚠️ **After EVERY edit to insights.md or bulletin.md**: immediately `read()` it back to confirm integrity. No exceptions.

## 4. 工具挂了也别闲着
CAPTCHA or Chrome down? **Pivot after 2 failed attempts** — don't retry a 3rd time.
- **Follow external links**: Use `scrape_webpage` for any papers, repos, or docs you've been meaning to read.
- **Synthesize**: Search your merged archive (`knowledge/library/`) with `grep`. Amy's posts and insights are already there. There's always something to connect that you haven't connected yet.
- **Never burn budget**: Each failed XHS call costs ~$0.05-0.10. After 2 failures with same error, the infrastructure is down. Move on.
