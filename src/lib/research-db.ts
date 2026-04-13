/**
 * research-db.ts — Sync markdown-based research artifacts into SQLite for queryability.
 *
 * Reads knowledge entries, hypotheses, and experiments from their markdown files
 * and upserts them into the DB tables (knowledge_entries, hypotheses, experiments).
 *
 * All sync functions are idempotent (upsert via INSERT OR REPLACE).
 * Parsing is pragmatic — extracts what it can, stores raw_content as fallback.
 */

import { readdirSync, readFileSync, existsSync, statSync } from "fs";
import { join } from "path";
import type { SqliteDb } from "./db.js";

// ── Markdown Parsing Helpers ───────────────────────────────────────────

/**
 * Extract a **Bold Key**: value pattern from markdown.
 * Returns the value string or null if not found.
 * Handles: **Status**: verified, **Priority**: high, etc.
 */
function extractField(content: string, fieldName: string): string | null {
  // Match both patterns:
  //   **FieldName**: value  (colon outside bold)
  //   **FieldName:** value  (colon inside bold)
  const pattern = new RegExp(
    `\\*\\*${fieldName}:?\\*\\*:?\\s+(.+?)\\s*$`,
    "im"
  );
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}

/**
 * Extract the title from a markdown H1 heading.
 * Handles: # KE-001: Title here, # H-001: Title here, # EXP-001: Title
 * Returns { id, title } or null.
 */
function extractH1(content: string): { id: string; title: string } | null {
  const match = content.match(/^#\s+((?:KE|H|EXP)-\d+)\s*[:\-–—]\s*(.+)$/m);
  if (match) {
    return { id: match[1], title: match[2].trim() };
  }
  // Some H1s might just have: # H004: Title (no dash after H)
  const altMatch = content.match(/^#\s+(H\d+)\s*[:\-–—]\s*(.+)$/m);
  if (altMatch) {
    return { id: altMatch[1], title: altMatch[2].trim() };
  }
  return null;
}

/**
 * Extract a section's content by heading name.
 * Returns everything between ## SectionName and the next ## or end of file.
 */
function extractSection(content: string, sectionName: string): string | null {
  const pattern = new RegExp(
    `^##\\s+${sectionName}\\s*$([\\s\\S]*?)(?=^##\\s|$(?!\\n))`,
    "m"
  );
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}

// ── ID Extraction from Filenames ───────────────────────────────────────

/**
 * Extract KE-XXX ID from filename like "KE-001.md".
 */
function extractKeId(filename: string): string | null {
  const match = filename.match(/^(KE-\d+)\.md$/);
  return match ? match[1] : null;
}

/**
 * Extract H-XXX ID from filename like "H-001.md" or "H-009-evaluator-drift.md".
 */
function extractHypothesisId(filename: string): string | null {
  const match = filename.match(/^(H-?\d+)/);
  return match ? match[1] : null;
}

/**
 * Extract EXP-XXX ID from directory name like "EXP-001".
 */
function extractExpId(dirname: string): string | null {
  const match = dirname.match(/^(EXP-\d+)$/);
  return match ? match[1] : null;
}

// ── Sync Functions ─────────────────────────────────────────────────────

/**
 * Sync knowledge entries from agents/shared/knowledge/entries/*.md into DB.
 * Parses frontmatter-style headers, extracts claim, evidence refs, dates.
 */
export function syncKnowledgeEntries(
  db: SqliteDb,
  entriesDir: string
): { synced: number; errors: string[] } {
  const errors: string[] = [];
  let synced = 0;

  if (!existsSync(entriesDir)) {
    return { synced: 0, errors: [`Directory not found: ${entriesDir}`] };
  }

  const files = readdirSync(entriesDir).filter((f) => f.endsWith(".md"));
  const now = Date.now();

  const stmt = db.prepare(
    `INSERT OR REPLACE INTO knowledge_entries
     (id, title, status, claim, evidence_refs, discovered, last_verified, raw_content, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const file of files) {
    try {
      const filePath = join(entriesDir, file);
      const content = readFileSync(filePath, "utf-8");

      // Extract ID from filename first, then from H1
      const fileId = extractKeId(file);
      const h1 = extractH1(content);
      const id = h1?.id ?? fileId;
      if (!id) {
        errors.push(`Could not extract ID from ${file}`);
        continue;
      }

      const title = h1?.title ?? null;
      const status = extractField(content, "Status");
      const claim =
        extractSection(content, "Claim") ?? extractField(content, "Claim");
      const evidenceRaw =
        extractField(content, "Evidence") ?? extractField(content, "Evidence");
      const discovered = extractField(content, "Discovered");
      const lastVerified =
        extractField(content, "Last verified") ??
        extractField(content, "Last Verified");

      stmt.run(
        id,
        title,
        status,
        claim,
        evidenceRaw,
        discovered,
        lastVerified,
        content,
        now
      );
      synced++;
    } catch (err) {
      errors.push(
        `Error syncing ${file}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { synced, errors };
}

/**
 * Sync hypotheses from agents/shared/knowledge/hypotheses/*.md into DB.
 * Parses frontmatter-style headers, extracts hypothesis text, priority, proposer.
 */
export function syncHypotheses(
  db: SqliteDb,
  hypothesesDir: string
): { synced: number; errors: string[] } {
  const errors: string[] = [];
  let synced = 0;

  if (!existsSync(hypothesesDir)) {
    return { synced: 0, errors: [`Directory not found: ${hypothesesDir}`] };
  }

  const files = readdirSync(hypothesesDir).filter((f) => f.endsWith(".md"));
  const now = Date.now();

  const stmt = db.prepare(
    `INSERT OR REPLACE INTO hypotheses
     (id, title, status, priority, proposed_by, hypothesis, raw_content, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const file of files) {
    try {
      const filePath = join(hypothesesDir, file);
      const content = readFileSync(filePath, "utf-8");

      // Extract ID from filename
      const fileId = extractHypothesisId(file);
      const h1 = extractH1(content);
      // Normalize: H004 → H-004 for consistency
      let id = h1?.id ?? fileId;
      if (id && /^H\d+$/.test(id)) {
        id = `H-${id.slice(1).padStart(3, "0")}`;
      }
      if (!id) {
        errors.push(`Could not extract ID from ${file}`);
        continue;
      }

      const title = h1?.title ?? null;
      const status =
        extractField(content, "Status") ?? extractField(content, "status");
      const priority =
        extractField(content, "Priority") ??
        extractField(content, "priority");
      const proposedBy =
        extractField(content, "Proposed by") ??
        extractField(content, "Author");
      const hypothesis = extractSection(content, "Hypothesis");

      stmt.run(id, title, status, priority, proposedBy, hypothesis, content, now);
      synced++;
    } catch (err) {
      errors.push(
        `Error syncing ${file}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { synced, errors };
}

/**
 * Sync experiments from agents/shared/knowledge/experiments/EXP-XXX/ into DB.
 * Reads design.md (or design.json) and results.md, concatenates into raw_content.
 * Extracts status, hypothesis reference, and result summary pragmatically.
 */
export function syncExperiments(
  db: SqliteDb,
  experimentsDir: string
): { synced: number; errors: string[] } {
  const errors: string[] = [];
  let synced = 0;

  if (!existsSync(experimentsDir)) {
    return { synced: 0, errors: [`Directory not found: ${experimentsDir}`] };
  }

  const dirs = readdirSync(experimentsDir).filter((d) => {
    const expId = extractExpId(d);
    if (!expId) return false;
    const fullPath = join(experimentsDir, d);
    return existsSync(fullPath) && statSync(fullPath).isDirectory();
  });

  const now = Date.now();

  const stmt = db.prepare(
    `INSERT OR REPLACE INTO experiments
     (id, title, status, hypothesis_ref, result_summary, raw_content, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  for (const dir of dirs) {
    try {
      const id = extractExpId(dir);
      if (!id) continue;

      const dirPath = join(experimentsDir, dir);
      const parts: string[] = [];

      // Read design file (design.md preferred, fallback to design.json)
      let designContent = "";
      const designMd = join(dirPath, "design.md");
      const designJson = join(dirPath, "design.json");
      if (existsSync(designMd)) {
        designContent = readFileSync(designMd, "utf-8");
        parts.push(designContent);
      } else if (existsSync(designJson)) {
        designContent = readFileSync(designJson, "utf-8");
        parts.push(`[design.json]\n${designContent}`);
      }

      // Read results file
      let resultsContent = "";
      const resultsMd = join(dirPath, "results.md");
      if (existsSync(resultsMd)) {
        resultsContent = readFileSync(resultsMd, "utf-8");
        parts.push(resultsContent);
      }

      // Also check for protocol.md, report.md, README.md as alternate content
      for (const alt of ["protocol.md", "report.md", "README.md"]) {
        const altPath = join(dirPath, alt);
        if (existsSync(altPath) && alt !== "design.md" && alt !== "results.md") {
          parts.push(readFileSync(altPath, "utf-8"));
        }
      }

      const rawContent = parts.join("\n\n---\n\n") || `[Empty experiment: ${id}]`;

      // Extract title from design or results content
      const combinedContent = designContent || resultsContent;
      const h1 = extractH1(combinedContent);
      let title = h1?.title ?? null;
      if (!title) {
        // Try to extract title from any H1 in the combined content
        const anyH1 = combinedContent.match(/^#\s+(.+)$/m);
        title = anyH1 ? anyH1[1].trim() : null;
      }

      // Extract status
      let status =
        extractField(combinedContent, "Status") ??
        extractField(resultsContent, "Status");
      if (!status && designContent) {
        status = extractField(designContent, "Status");
      }
      // Normalize common status variants
      if (status) {
        const lower = status.toLowerCase();
        if (lower.includes("complet")) status = "completed";
        else if (lower.includes("in progress") || lower.includes("in-progress"))
          status = "in-progress";
        else if (lower.includes("design")) status = "designed";
        else if (lower.includes("verif")) status = "verified";
        else if (lower.includes("invalid")) status = "invalidated";
        else if (lower.includes("fail")) status = "failed";
        else if (lower.includes("running")) status = "running";
      }

      // Extract hypothesis reference
      let hypothesisRef =
        extractField(combinedContent, "Hypothesis") ??
        extractField(designContent, "Hypothesis");
      // If it's a long hypothesis text, try to extract just the H-XXX reference
      if (hypothesisRef && hypothesisRef.length > 30) {
        const hRef = hypothesisRef.match(/H-?\d+/);
        hypothesisRef = hRef ? hRef[0] : hypothesisRef.slice(0, 100);
      }
      // Also try to find hypothesis ref from design.json
      if (!hypothesisRef && designContent.startsWith("{")) {
        try {
          const parsed = JSON.parse(designContent) as Record<string, unknown>;
          if (typeof parsed.hypothesis === "string") {
            hypothesisRef = parsed.hypothesis;
          }
        } catch {
          /* not valid JSON, skip */
        }
      }

      // Extract result summary from results content
      let resultSummary: string | null = null;
      if (resultsContent) {
        // Try ## Summary, ## Verdict, ## Findings, ## Key Findings
        resultSummary =
          extractSection(resultsContent, "Summary") ??
          extractSection(resultsContent, "Verdict") ??
          extractSection(resultsContent, "Summary of Findings") ??
          extractSection(resultsContent, "Key Findings");
        // Truncate if too long
        if (resultSummary && resultSummary.length > 2000) {
          resultSummary = resultSummary.slice(0, 2000) + "…";
        }
      }

      stmt.run(
        id,
        title,
        status,
        hypothesisRef,
        resultSummary,
        rawContent,
        now
      );
      synced++;
    } catch (err) {
      errors.push(
        `Error syncing ${dir}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { synced, errors };
}

/**
 * Run all sync operations against the standard directory layout.
 * Convenience function for syncing all research artifacts at once.
 */
export function syncAll(
  db: SqliteDb,
  basePath: string = "agents/shared/knowledge"
): {
  knowledgeEntries: { synced: number; errors: string[] };
  hypotheses: { synced: number; errors: string[] };
  experiments: { synced: number; errors: string[] };
} {
  return {
    knowledgeEntries: syncKnowledgeEntries(db, join(basePath, "entries")),
    hypotheses: syncHypotheses(db, join(basePath, "hypotheses")),
    experiments: syncExperiments(db, join(basePath, "experiments")),
  };
}
