# Scout — Tools Reference

## scrape_webpage (PREFERRED for web pages)

Use `scrape_webpage` as your **first choice** for fetching any web page. It handles User-Agent headers, redirects, and bot-detection avoidance automatically, and returns clean text (HTML stripped).

```
scrape_webpage(url: "https://arxiv.org/abs/2402.12345")
scrape_webpage(url: "https://github.com/org/repo", maxLength: 30000)
scrape_webpage(url: "https://blog.langchain.com/some-post", raw: true)  # raw HTML
```

**Parameters:**
- `url` (required) — Full URL starting with http:// or https://
- `raw` (optional, default: false) — Return raw HTML instead of cleaned text
- `maxLength` (optional, default: 20000) — Max characters returned

**When to use scrape_webpage vs curl:**
- **scrape_webpage** → web pages (articles, docs, papers, blogs, repos)
- **curl** → JSON APIs (GitHub API, Arctic Shift), or when you need specific curl flags

## curl (for APIs and fallback)

Use `curl` via `exec` for JSON APIs or when scrape_webpage doesn't work.

### GitHub API

```bash
# Releases (JSON API — use curl)
curl -sL "https://api.github.com/repos/<org>/<repo>/releases?per_page=5" 2>&1
```

### GitHub Pages (use scrape_webpage instead)

```
scrape_webpage(url: "https://github.com/trending?since=weekly")
scrape_webpage(url: "https://github.com/<org>/<repo>")
```

**Note:** `github.com/<org>/<repo>/blob/main/README.md` returns login redirect. Use root URL instead.

### arXiv

```
scrape_webpage(url: "https://arxiv.org/search/?searchtype=all&query=multi+agent+systems&order=-announced_date_first")
scrape_webpage(url: "https://arxiv.org/abs/2602.XXXXX")
```

### Reddit (Arctic Shift API — JSON, use curl)

```bash
# Recent posts in a subreddit
curl -sL "https://arctic-shift.photon-reddit.com/api/posts/search?subreddit=LocalLLaMA&limit=20&sort=desc" 2>&1

# Comments on a post
curl -sL "https://arctic-shift.photon-reddit.com/api/comments/search?link_id=POST_ID&limit=15&sort=desc" 2>&1
```

Active subreddits: r/LocalLLaMA, r/MachineLearning, r/ClaudeAI, r/OpenAI, r/artificial

**Note:** Post scores need 48h+ for accuracy. Use `num_comments` as proxy for recent posts.

### Vendor Blogs

```
scrape_webpage(url: "https://anthropic.com/engineering/<slug>")
scrape_webpage(url: "https://blog.langchain.com/<slug>")
scrape_webpage(url: "https://modelcontextprotocol.io/llms.txt")
```

**Blocked sources:**
- Twitter/X — requires JavaScript, returns "Something went wrong"
- Google DeepMind blog — redirects, low signal

## Node.js for API Calls

For APIs that return JSON:
```bash
node -e "
fetch('https://api.github.com/search/repositories?q=agent+tools&sort=stars&per_page=5')
  .then(r => r.json())
  .then(d => d.items.forEach(r => console.log(r.full_name, r.stargazers_count, r.description?.slice(0,80))))
  .catch(e => console.error(e.message))
"
```

**IPv6 note:** If `fetch` times out with ETIMEDOUT, the server may not support IPv6. Try `curl` instead.
