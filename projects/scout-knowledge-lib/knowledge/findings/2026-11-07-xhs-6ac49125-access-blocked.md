<ai_context>
summary: "Exact-source access assessment for XHS post 6ac49125000000001a02bea6. The authorized browser route reached XHS error 300031 and exposed only a generic unavailable-page/QR prompt, so no body or media claims are recoverable."
triggers: ["XHS backfill", "6ac49125000000001a02bea6", "error 300031"]
last_updated: "2026-11-07"
</ai_context>

# XHS post 6ac49125000000001a02bea6 — unavailable at exact source

- **Source identity:** https://www.xiaohongshu.com/explore/6ac49125000000001a02bea6
- **Observed:** 2026-11-07T10:23Z
- **Question:** Perform a body-level review for the finite 2026-11-07 XHS backfill and produce one evidence-backed disposition.
- **Disposition:** **Access blocked / inaccessible.** No substantive source content was exposed.
- **Canonical record path after publication:** `/app/projects/scout-knowledge-lib/knowledge/findings/2026-11-07-xhs-6ac49125-access-blocked.md`

## Exact coverage

Scout used the authorized XHS browser adapter to read the exact explore URL above. The request preserved post ID `6ac49125000000001a02bea6` but resolved to an XHS `/404` URL carrying `error_code=300031`, the message `Sorry, This Page Isn't Available Right Now.`, and the exact requested URL in its encoded `redirectPath`. The page also displayed the generic prompt `请打开小红书App扫码查看` (open the Xiaohongshu app and scan the code).

The adapter classified the note type as unknown and returned no description, author, publication date, likes, collections, comments, tags, or post-specific media. Its only image was the site's generic search-icon SVG. The visible page text otherwise consisted of site navigation, regulatory/footer text, the unavailable-page message, the QR prompt, feedback, and return-home controls.

## Evidence boundary

No post body, caption, author claim, image text, video, audio, OCR, transcript, comment, citation, or substantive outbound link was available. Therefore this retrieval supports only the access diagnosis. It does **not** support a characterization of the post, an assessment of its relevance, or any inference from the inventory's search-card title.

The response does not establish whether the post was deleted, made private, region-limited, or temporarily unavailable; those causes remain unknown. The generic app-scan prompt is not evidence that an app session would necessarily expose this exact post.

## Recovery condition

Reassess the same source identity only when an authorized XHS route can expose its actual body and materially relevant media text (including OCR or transcript where needed), or when authoritative source evidence establishes the post's disposition. Preserve the same post ID, state exactly which components were inspected, and disclose any media that remains unreadable. Do not bypass access controls, substitute another post, or infer content from search-card metadata.

This record completes the bounded access diagnosis, not the requested substantive body-level review. Publication and commit evidence are supplied by the hosted publisher after it verifies and commits these candidate bytes.
