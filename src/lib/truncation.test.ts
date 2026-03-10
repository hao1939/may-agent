import { describe, it, expect } from "vitest";
import { TruncationTracker } from "./tools.js";

describe("TruncationTracker", () => {
  it("should record truncated reads", () => {
    const tracker = new TruncationTracker();
    const path = "/test/file.txt";
    
    // Initial state: not tracked
    expect(tracker.getOriginalLength(path)).toBeUndefined();
    
    // Record truncation
    tracker.recordTruncatedRead(path, 1000);
    expect(tracker.getOriginalLength(path)).toBe(1000);
  });

  it("should block writes to truncated files via checkWrite", () => {
    const tracker = new TruncationTracker();
    const path = "/test/file.txt";
    
    tracker.recordTruncatedRead(path, 1000);
    
    // checkWrite now delegates to validateWrite which throws for any poisoned path
    expect(() => tracker.checkWrite(path, 900)).toThrow("BLOCKED");
    expect(() => tracker.checkWrite(path, 100)).toThrow("BLOCKED");
  });

  it("should not block writes to non-truncated files", () => {
    const tracker = new TruncationTracker();
    
    // Path was never truncated — write should be allowed
    expect(tracker.checkWrite("/clean/file.txt", 500)).toBeNull();
  });

  it("should enforce strict blocking on poisoned paths via validateWrite", () => {
    const tracker = new TruncationTracker();
    const path = "/test/file.txt";
    
    tracker.recordTruncatedRead(path, 1000);
    
    expect(() => tracker.validateWrite(path)).toThrow("BLOCKED");
  });

  it("should not throw validateWrite for untracked paths", () => {
    const tracker = new TruncationTracker();
    
    // No truncated read recorded — should not throw
    expect(() => tracker.validateWrite("/clean/file.txt")).not.toThrow();
  });
});
