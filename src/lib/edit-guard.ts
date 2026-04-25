/**
 * EditGuard — tracks file reads and enforces read-before-edit convention (C7.4).
 *
 * Agents must read() a file before edit()ing it. This guard tracks which files
 * have been read in the current session and validates edit attempts.
 */

export interface EditValidationResult {
  valid: boolean;
  reason?: string;
}

export class EditGuard {
  private readFiles = new Set<string>();

  /** Record that a file was read. */
  recordRead(filePath: string): void {
    this.readFiles.add(this.normalize(filePath));
  }

  /** Validate an edit attempt. Returns { valid: false } if file wasn't read first. */
  validateEdit(filePath: string): EditValidationResult {
    const normalized = this.normalize(filePath);
    if (this.readFiles.has(normalized)) {
      return { valid: true };
    }
    return {
      valid: false,
      reason: `File "${filePath}" was not read before edit. Read it first to see current content.`,
    };
  }

  /** Check if a file has been read in this session. */
  hasRead(filePath: string): boolean {
    return this.readFiles.has(this.normalize(filePath));
  }

  /** Reset tracking (e.g., between sessions). */
  reset(): void {
    this.readFiles.clear();
  }

  private normalize(filePath: string): string {
    // Strip leading ./ and normalize
    return filePath.replace(/^\.\//, "").replace(/\/+/g, "/");
  }
}
