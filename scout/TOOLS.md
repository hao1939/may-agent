# Scout — Tools Reference

## Web Fetching

Scout uses `curl` for all web fetching. No browser needed.

### GitHub

```bash
# Trending repos (weekly is better than daily — less noise)
curl -sL "https://github.com/trending?since=weekly" 2>&1 | head -500

# Trending by language
curl -sL "https://github.com/trending/python?since=weekly" 2>&1 | head -500

# Specific repo (use root URL, not blob/ paths)
curl -sL "https://github.com/<org>/<repo>" 2>&1 | head -300

# Releases
curl -sL "https://api.github.com/repos/<org>/<repo>/releases?per_page=5" 2>&1
```

**Note:** `github.com/<org>/<repo>/blob/main/README.md` returns login redirect. Use root URL instead.

### arXiv

```bash
# Search (returns ~5-8 titles/abstracts within 6K chars)
curl -sL "https://arxiv.org/search/?searchtype=all&query=multi+agent+systems&order=-announced_date_first" 2>&1 | head -500

# Specific paper abstract
curl -sL "https://arxiv.org/abs/2602.XXXXX" 2>&1 | head -200
```

### Reddit (Arctic Shift API)

```bash
# Recent posts in a subreddit
curl -sL "https://arctic-shift.photon-reddit.com/api/posts/search?subreddit=LocalLLaMA&limit=20&sort=desc" 2>&1

# Comments on a post
curl -sL "https://arctic-shift.photon-reddit.com/api/comments/search?link_id=POST_ID&limit=15&sort=desc" 2>&1
```

Active subreddits: r/LocalLLaMA, r/MachineLearning, r/ClaudeAI, r/OpenAI, r/artificial

**Note:** Post scores need 48h+ for accuracy. Use `num_comments` as proxy for recent posts.

### Vendor Blogs

```bash
# Anthropic (note: /research/ redirects to /engineering/)
curl -sL "https://anthropic.com/engineering/<slug>" 2>&1 | head -500

# LangChain (homepage returns single headline — use direct post URLs)
curl -sL "https://blog.langchain.com/<slug>" 2>&1 | head -500

# MCP Protocol (llms.txt gives full index!)
curl -sL "https://modelcontextprotocol.io/llms.txt" 2>&1 | head -300
```

### General Web

```bash
# Any URL
curl -sL "<url>" 2>&1 | head -500
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
