/**
 * edit-guard — Tracks file reads and validates edits only touch previously-read files.
 */

export interface EditValidationResult {
  valid: boolean;
  reason?: string;
}

export class EditGuard {
  private readFiles = new Set<string>();

  recordRead(filePath: string): void {
    this.readFiles.add(filePath);
  }

  validateEdit(filePath: string): EditValidationResult {
    if (!this.readFiles.has(filePath)) {
      return { valid: false, reason: `File not previously read: ${filePath}` };
    }
    return { valid: true };
  }

  hasRead(filePath: string): boolean {
    return this.readFiles.has(filePath);
  }
}
