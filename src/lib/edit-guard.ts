/**
 * Edit Guard — C1.1 Edit-Without-Read Enforcement.
 *
 * Tracks files read by the agent and validates that edit() calls
 * target files that have been recently read. Prevents blind edits
 * that can cause data loss.
 *
 * Integration: Create an instance per session. Call `trackRead()` on
 * every read() call, then `validateEdit()` before executing edit().
 *
 * Uses only Node.js built-in modules — no external dependencies.
 */

// ── Interfaces ────────────────────────────────────────────────────────

export interface EditValidationResult {
  valid: boolean;
  /** The resolved path that was checked. */
  path: string;
  /** When the file was last read (undefined if never). */
  lastReadAt?: number;
  /** Human-readable error message (present only when valid === false). */
  error?: string;
}

// ── Public API ────────────────────────────────────────────────────────

export class EditGuard {
  /** Map of file path → timestamp of last read. */
  private readLog = new Map<string, number>();

  /** Max age (ms) for a read to count. Default: 10 minutes. */
  private maxAge: number;

  constructor(opts?: { maxAgeMs?: number }) {
    this.maxAge = opts?.maxAgeMs ?? 10 * 60 * 1000;
  }

  /**
   * Record that a file was read. Call this on every read() tool invocation.
   * @param path  The file path (as passed to read()).
   */
  trackRead(path: string): void {
    const normalized = this.normalize(path);
    this.readLog.set(normalized, Date.now());
  }

  /**
   * Validate that a file has been read before editing.
   * @param path  The file path being edited.
   * @returns EditValidationResult — check `.valid` before proceeding.
   */
  validateEdit(path: string): EditValidationResult {
    const normalized = this.normalize(path);
    const lastRead = this.readLog.get(normalized);

    if (lastRead === undefined) {
      return {
        valid: false,
        path: normalized,
        error:
          `C1.1 Edit Without Read: You are editing '${path}' but have not read it ` +
          `in this session. Read the file first to see its current contents, then edit. ` +
          `This prevents data loss from stale assumptions.`,
      };
    }

    const age = Date.now() - lastRead;
    if (age > this.maxAge) {
      return {
        valid: false,
        path: normalized,
        lastReadAt: lastRead,
        error:
          `C1.1 Stale Read: You last read '${path}' ${Math.round(age / 60000)} minutes ago. ` +
          `Re-read the file before editing — it may have changed.`,
      };
    }

    return { valid: true, path: normalized, lastReadAt: lastRead };
  }

  /**
   * Check + throw convenience wrapper. Call in edit() tool handler.
   * @param path The file path being edited.
   * @throws Error with C1.1 message if file not recently read.
   */
  enforceReadBeforeEdit(path: string): void {
    const result = this.validateEdit(path);
    if (!result.valid) {
      throw new Error(result.error);
    }
  }

  /** Reset all tracking (e.g., for tests). */
  reset(): void {
    this.readLog.clear();
  }

  /** Number of files currently tracked. */
  get trackedCount(): number {
    return this.readLog.size;
  }

  private normalize(path: string): string {
    // Strip leading ./ and normalize to consistent form
    return path.replace(/^\.\//, "").replace(/\/+/g, "/");
  }
}
