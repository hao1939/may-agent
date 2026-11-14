<ai_context>
summary: "A body-level XHS comparison of Town, Instinct, Muse, and Grok Bot surfaces five separate personal-agent memory governance choices: write timing, editable representation, provenance, deletion propagation, and role scope. The post is a secondary practitioner synthesis; Scout did not inspect the products or the author's underlying public sources."
triggers: ["XHS", "6ac49125000000001a02bea6", "personal agent memory", "memory governance", "Town", "Instinct", "Muse", "Grok Bot"]
last_updated: "2026-11-14"
</ai_context>

# Personal-agent memory needs separate governance choices

- **Source:** [XHS post 6ac49125000000001a02bea6](https://www.xiaohongshu.com/explore/6ac49125000000001a02bea6), “当前各家个人Agent的记忆系统是如何构建的,” by `just say`
- **Observed:** 2026-11-14
- **Coverage:** Post title, author, full text description, tags, engagement metadata, and ten visible comments were returned by the authorized XHS detail reader. Images were listed but their text was not independently inspected or OCRed.
- **Question:** What useful design distinctions does this practitioner comparison surface for personal-agent memory?
- **Disposition:** **New source-grounded comparison, with secondary-source limits.**
- **Canonical record path after publication:** `/app/projects/scout-knowledge-lib/knowledge/findings/2026-11-07-xhs-6ac49125-access-blocked.md`

## Source claims

The author says the post combines public information with their own experience building agent memory and compares four personal-agent products:

- **Town:** keeps a compact, user-editable wiki of stable summaries such as profile, goals, projects, and contacts; performs nightly consolidation; and retrieves original material such as email only when needed.
- **Instinct:** makes memory read-only during conversations, batches writes daily, versions memory files with Git, and uses keyword-and-alias retrieval rather than a vector database. The post also describes relationship-aware memory for coordination between users' agents.
- **Muse:** attaches source/message identity to memories, reportedly rechecks new memories against original wording hourly before promoting them, and creates a nightly first-person “dream” about how the user wants to be treated. The author warns that deleting source material may not remove information already derived into memory.
- **Grok Bot:** scopes memory by specialist role across multiple bots, writes silently during conversations, and—according to the post—lacks equivalent background cleanup and differentiated computer permissions.

One visible commenter identifies a concrete cost of delayed batch writes: a correction made in the morning may not reach another conversation before the nightly memory job. That comment is an architectural inference and anecdote, not a measured product result.

## Assessment

The useful signal is not a ranking of the four products. It is that “agent memory” bundles at least five independent governance decisions:

1. **Write timing:** synchronous conversational writes provide freshness but enlarge the unreviewed-write surface; delayed consolidation can improve reviewability but creates a correction-lag window.
2. **Representation and repair:** a human-editable wiki or versioned files make correction, diff, and rollback more legible than opaque state, but editability alone does not prove that downstream summaries or caches were updated.
3. **Provenance and promotion:** source/message links and rechecking before long-term promotion can preserve an audit path; they do not independently establish that the source is true or that an answer actually used it.
4. **Deletion propagation:** removing raw evidence and removing every derived memory are separate operations. A system needs explicit dependency tracking or a documented forgetting boundary rather than treating source deletion as automatic semantic erasure.
5. **Scope and authority:** role-scoped memories can reduce irrelevant context, but shared machines, shared credentials, or silent writes can collapse that logical separation at the effect boundary.

For evaluating a personal-agent memory system, record these axes separately rather than reducing the design to “Markdown versus vectors” or “has long-term memory.” A practical review should ask when a correction becomes visible, what was promoted from which source, who can edit or roll it back, what deletion invalidates, and which roles can read or act on each memory.

## Evidence limitations

This is a body-level review of an XHS practitioner synthesis, not verification of the four products. The post names no pinned product versions and provides no directly inspectable primary links, source excerpts, code, configuration, traces, tests, or measurements. Scout did not inspect the products, underlying public sources, attached image text, security documentation, or deletion behavior. Product names may also be ambiguous without canonical links.

Engagement (`868` likes and `1115` collections when read) indicates audience interest, not factual accuracy. The architecture distinctions above are Scout's interpretation of the described designs; the product-specific claims should remain provisional until checked against pinned primary sources.

## Retrieval history

On 2026-11-07, the authorized route for this same stable post ID resolved to XHS error `300031` and exposed no substantive body. The 2026-11-14 authorized detail read successfully returned the post body and visible comments, satisfying the earlier recovery condition. The earlier failure established only a temporary access boundary; it did not establish deletion, privacy, or durable unavailability.
