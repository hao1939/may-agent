#!/bin/bash
# Knowledge Library Health Check
# Lints the knowledge base, finds duplicates, orphans, and problems
# Run: bash agents/shared/knowledge/library/health-check.sh

set -euo pipefail
BASE="agents/shared/knowledge/library"
POSTS="$BASE/posts"
DEEPDIVES="$BASE/deep-dives"
TOPICS="$BASE/topics"
SYNTHESIS="$BASE/synthesis"

echo "=============================="
echo " Knowledge Library Health Check"
echo " $(date -u '+%Y-%m-%d %H:%M UTC')"
echo "=============================="
echo ""

# --- 1. Basic Stats ---
echo "## 1. Library Size"
POST_COUNT=$(ls "$POSTS" 2>/dev/null | wc -l)
DD_COUNT=$(ls "$DEEPDIVES" 2>/dev/null | wc -l)
SYNTH_COUNT=$(ls "$SYNTHESIS" 2>/dev/null | wc -l)
TOPIC_COUNT=$(ls "$TOPICS" 2>/dev/null | grep -v INDEX | wc -l)
TOTAL_SIZE=$(du -sh "$BASE" 2>/dev/null | cut -f1)
echo "  Posts:      $POST_COUNT"
echo "  Deep-dives: $DD_COUNT"
echo "  Synthesis:  $SYNTH_COUNT"
echo "  Topics:     $TOPIC_COUNT"
echo "  Total size: $TOTAL_SIZE"
echo ""

# --- 2. ArXiv Duplicate Detection ---
echo "## 2. ArXiv Duplicates (posts covering same paper)"
echo "  (arXiv ID → count of files mentioning it)"
echo ""

# Extract arXiv IDs from posts
ARXIV_DUPES=$(grep -roh "arXiv:[0-9.]*" "$POSTS" 2>/dev/null | sort | uniq -c | sort -rn | awk '$1 > 3 {print "  "$1"x  "$2}' | head -20)
if [ -z "$ARXIV_DUPES" ]; then
    echo "  ✅ No arXiv IDs appear in >3 files"
else
    echo "  ⚠️ ArXiv IDs in >3 files (likely duplicates):"
    echo "$ARXIV_DUPES"
fi
echo ""

# Also check arxiv.org/abs/ URLs
ARXIV_URL_DUPES=$(grep -roh "arxiv.org/abs/[0-9.]*" "$POSTS" 2>/dev/null | sort | uniq -c | sort -rn | awk '$1 > 3 {print "  "$1"x  "$2}' | head -20)
if [ -n "$ARXIV_URL_DUPES" ]; then
    echo "  ⚠️ ArXiv URLs in >3 files:"
    echo "$ARXIV_URL_DUPES"
    echo ""
fi

# --- 3. Title Duplicate Detection ---
echo "## 3. Title Duplicates (posts with same H1)"
echo ""

# Extract first H1 from each post, find duplicates
TITLE_DUPES=$(for f in "$POSTS"/*.md; do head -3 "$f" 2>/dev/null | grep "^# " | head -1; done | sort | uniq -c | sort -rn | awk '$1 > 1 {print "  "$0}' | head -15)
if [ -z "$TITLE_DUPES" ]; then
    echo "  ✅ No duplicate titles"
else
    echo "  ⚠️ Duplicate titles found:"
    echo "$TITLE_DUPES"
fi
echo ""

# --- 4. Naming Convention Check ---
echo "## 4. Naming Convention"
echo ""
STANDARD=$(ls "$POSTS" | grep -cE "^HB-[0-9]{4}" 2>/dev/null || echo 0)
STANDARD_DATE=$(ls "$POSTS" | grep -cE "^HB-[0-9]{6}" 2>/dev/null || echo 0)
LEGACY_XHS=$(ls "$POSTS" | grep -cE "^xhs" 2>/dev/null || echo 0)
LEGACY_NUM=$(ls "$POSTS" | grep -cE "^[0-9]+\.md$" 2>/dev/null || echo 0)
LEGACY_NUM_NAME=$(ls "$POSTS" | grep -cE "^[0-9]+-" 2>/dev/null || echo 0)
BACKFILL=$(ls "$POSTS" | grep -cE "^BACKFILL" 2>/dev/null || echo 0)
DEEPDIVE_POST=$(ls "$POSTS" | grep -cE "^DEEPDIVE" 2>/dev/null || echo 0)
NO_HYPHEN=$(ls "$POSTS" | grep -cE "^HB[0-9]{3,}" 2>/dev/null || echo 0)
HASH=$(ls "$POSTS" | grep -cE "^[0-9a-f]{8}" 2>/dev/null || echo 0)
OTHER=$((POST_COUNT - STANDARD - STANDARD_DATE - LEGACY_XHS - LEGACY_NUM - LEGACY_NUM_NAME - BACKFILL - DEEPDIVE_POST - NO_HYPHEN - HASH))

echo "  ✅ HB-XXXX-topic:  $STANDARD (standard)"
echo "  ✅ HB-YYMMDD-topic: $STANDARD_DATE (standard date)"
echo "  📦 BACKFILL-*:      $BACKFILL (legacy OK)"
echo "  📦 DEEPDIVE-*:      $DEEPDIVE_POST (legacy OK)"
echo "  ⚠️ xhs*:            $LEGACY_XHS (legacy, needs normalize)"
echo "  ⚠️ NNNN.md:          $LEGACY_NUM (legacy, no topic)"
echo "  ⚠️ NNNN-topic.md:    $LEGACY_NUM_NAME (legacy, no prefix)"
echo "  ❌ HBNNNN (no hyphen):$NO_HYPHEN (inconsistent)"
echo "  ❌ Hash prefix:       $HASH (inconsistent)"
echo "  ❓ Other:             $OTHER"
echo ""

# --- 5. Metadata Check ---
echo "## 5. Metadata Headers"
echo ""
WITH_FRONTMATTER=$(grep -rl "^---$" "$POSTS" 2>/dev/null | wc -l)
WITHOUT_FRONTMATTER=$((POST_COUNT - WITH_FRONTMATTER))
PCT=$((WITH_FRONTMATTER * 100 / POST_COUNT))
echo "  With YAML frontmatter: $WITH_FRONTMATTER ($PCT%)"
echo "  Without:               $WITHOUT_FRONTMATTER ($((100-PCT))%)"
echo ""

# --- 6. Deep-Dive Duplication ---
echo "## 6. Deep-Dive Analysis"
echo ""
DD_PREFIXES=$(ls "$DEEPDIVES" 2>/dev/null | sed 's/\(2026-[0-9][0-9]-[0-9][0-9]\).*/\1/' | sort | uniq -c | sort -rn | awk '$1 > 10 {print "  "$1" deep-dives on "$2}')
if [ -n "$DD_PREFIXES" ]; then
    echo "  ⚠️ Days with >10 deep-dives (bulk generation?):"
    echo "$DD_PREFIXES"
fi
CROSSREF_COUNT=$(ls "$DEEPDIVES" 2>/dev/null | grep -c "^cross-ref" || echo 0)
DEEPDIVE_PREFIX_COUNT=$(ls "$DEEPDIVES" 2>/dev/null | grep -c "^deep-dive" || echo 0)
echo ""
echo "  By type:"
echo "    deep-dive-*:  $DEEPDIVE_PREFIX_COUNT"
echo "    cross-ref-*:  $CROSSREF_COUNT"
echo "    dated (2026-*): $(ls "$DEEPDIVES" | grep -c "^2026-" || echo 0)"
echo "    other:        $((DD_COUNT - DEEPDIVE_PREFIX_COUNT - CROSSREF_COUNT - $(ls "$DEEPDIVES" | grep -c "^2026-" || echo 0)))"
echo ""

# --- 7. Topic Coverage ---
echo "## 7. Topic Index Coverage"
echo ""
if [ -d "$TOPICS" ]; then
    for topic_file in "$TOPICS"/[0-9]*.md; do
        topic_name=$(basename "$topic_file" .md)
        # Count references to posts/deep-dives in the topic file
        refs=$(grep -c "\.md" "$topic_file" 2>/dev/null || echo 0)
        echo "  $topic_name: $refs references"
    done
else
    echo "  ❌ No topics directory found"
fi
echo ""

# --- 8. Orphan Detection ---
echo "## 8. Orphan Check (sampled)"
echo ""
echo "  Checking if recent posts are referenced in any topic index..."
ORPHANS=0
CHECKED=0
for f in $(ls "$POSTS" | tail -20); do
    CHECKED=$((CHECKED + 1))
    fname=$(basename "$f" .md)
    if ! grep -rq "$fname" "$TOPICS" "$SYNTHESIS" "$DEEPDIVES" 2>/dev/null; then
        ORPHANS=$((ORPHANS + 1))
    fi
done
echo "  Sampled $CHECKED recent posts: $ORPHANS orphans (not in any index/synthesis/deep-dive)"
echo ""

# --- 9. Size Warnings ---
echo "## 9. Size Warnings"
echo ""
LARGE_FILES=$(find "$BASE" -name "*.md" -size +20k 2>/dev/null | wc -l)
echo "  Files > 20KB: $LARGE_FILES"
if [ "$LARGE_FILES" -gt 0 ]; then
    find "$BASE" -name "*.md" -size +20k -exec ls -lh {} \; 2>/dev/null | awk '{print "    "$5"  "$NF}' | head -10
fi
echo ""

# --- 10. Summary ---
echo "=============================="
echo " Summary"
echo "=============================="
ISSUES=0
[ -n "$ARXIV_DUPES" ] && ISSUES=$((ISSUES + 1))
[ -n "$TITLE_DUPES" ] && ISSUES=$((ISSUES + 1))
[ "$NO_HYPHEN" -gt 0 ] && ISSUES=$((ISSUES + 1))
[ "$PCT" -lt 50 ] && ISSUES=$((ISSUES + 1))
[ "$ORPHANS" -gt 10 ] && ISSUES=$((ISSUES + 1))

if [ "$ISSUES" -eq 0 ]; then
    echo "  ✅ Library is healthy!"
else
    echo "  ⚠️ $ISSUES issue(s) found. See details above."
fi
echo ""
echo "  Run this periodically to track knowledge base health."
echo "  Last run: $(date -u '+%Y-%m-%d %H:%M UTC')"
