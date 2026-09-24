# Scout Context

## Source Access

- arXiv: use `https://export.arxiv.org/api/query` with redirects enabled. Read
  the abstract before writing a summary or implication.
- Hacker News: use `https://hn.algolia.com/api/v1/search`.
- GitHub: use `https://api.github.com/search/repositories`.
- Reddit: start topic-led discovery with the read-only public Atom feed at
  `https://www.reddit.com/search.rss`, using a descriptive User-Agent and
  bounded connection and total timeouts. Preserve stable post IDs, and do not
  treat feed metadata as body-level evidence. If Reddit returns an
  authentication, network-security, or rate-limit boundary, record the exact
  endpoint and HTTP status; do not log in, bypass it, or substitute another
  source.
- XHS: use
  `node /app/projects/scout-knowledge-lib.app/agents/scout/tools/xhs-browse.mjs`
  with `feed`, `search <keyword>`, `read <url>`, or `scroll`.
  Use `prepare` for bounded setup: it opens an absent XHS tab and then checks
  the current page. `status` only observes. A failed probe is diagnostic
  evidence; a confirmed login screen can justify a human request.
  The browser adapter defaults to Chrome DevTools at `localhost:9222`; when the
  observational browser runs behind explicit container or host wiring, set
  `SCOUT_XHS_CDP_HOST` and `SCOUT_XHS_CDP_PORT` instead of copying credentials.

Use real current source data. Never simulate or mock a source. Preserve a URL,
repository, paper ID, post ID, or other stable source reference for claims. If
the assigned source cannot be checked, report that exact fact rather than using
a different source.

## Working Environment

- In the standard container, use `python3`, Node, or Bun. Do not assume the
  `python` alias, BeautifulSoup (`bs4`), `pdftotext`, or `file` is installed.
  Check optional commands or modules before relying on them; prefer standard
  libraries and readable HTML over installing dependencies during research.
- Optional evaluator feedback is not a prerequisite for source work. Use its
  documented path only if present; a missing file does not justify guessing
  another App's feedback path or blocking the run.

## Output

- Durable knowledge: `/app/projects/scout-knowledge-lib/knowledge/`
- Flat dated findings:
  `/app/projects/scout-knowledge-lib/knowledge/findings/YYYY-MM-DD-<topic>.md`
- Durable maintenance reports: `/app/projects/scout-knowledge-lib/reports/`
- Working files:
  `/app/projects/scout-knowledge-lib.app/agents/scout/workspace/`
- Daily accumulator:
  `/app/projects/scout-knowledge-lib.app/agents/scout/workspace/digest/today.md`

Search by topic, title, source URL, paper ID, repository, or post ID before
creating a file. Update an existing note when it already covers the topic. Use
the workflow-supplied candidate root for hosted library edits; the roots above
are the final publication locations. Code publishes accepted changes and returns
their canonical paths with Git evidence. Failed candidates remain available for
recovery. Never create another `projects/scout-knowledge-lib` tree beneath the
domain workspace, and never mistake a working draft for a committed result.

## Safety And Verification

- Filename dates and explicit `date` or `last_updated` values cannot be later
  than the actual current date. Use `date -u +%Y-%m-%d` when unsure.
- Read a file before changing it; make a narrow edit; read it again afterward.
- A read-only error describes the exact path checked, not the whole library.
  Do not bypass that protection. Use a suitable writable note or a distinct
  source-grounded finding when appropriate; otherwise preserve a draft and
  report the exact blocker. A run-level draft is not library integration.
- Keep `<ai_context>` preambles where the library already uses them.
- Do not create legacy KE files under `/app/shared/knowledge/entries/`.
- Before appending to the digest, check it for the same title or source URL.
- Verification evidence must name the action and concrete result, for example:
  `Step 3: read(path) showed the new source reference`.
- If a check finds a pre-existing problem outside the edit, preserve it and
  report that limitation separately from checks of the new material. A narrow
  passing check does not mean the whole file or library is clean.

Hosted workflows may include bounded task, metric, alert, or experience context
in the request. Treat it as evidence for the current run. Direct Scout use does
not require task, event, metric, or database infrastructure.
