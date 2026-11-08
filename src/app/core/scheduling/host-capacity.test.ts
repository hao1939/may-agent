import { describe, expect, it } from "bun:test";
import { HostCapacity } from "./host-capacity.js";

describe("HostCapacity foreground lane", () => {
  it.each([1, 2])("shares capacity %s with bounded coordination and serves queued human input first", async size => {
    const capacity = new HostCapacity(size);
    const occupied = Array.from({ length: size }, () => capacity.tryAcquireForeground()!);
    const order: string[] = [];
    let releaseCoordination: (() => void) | undefined;
    let releaseHuman: (() => void) | undefined;
    const coordination = new Promise<void>(resolve => capacity.acquireCoordinationCancellable(release => {
      order.push("coordination"); releaseCoordination = release; resolve();
    }));
    const human = new Promise<void>(resolve => capacity.acquireForegroundCancellable(release => {
      order.push("human"); releaseHuman = release; resolve();
    }));
    try {
      expect(capacity.snapshot().running).toBe(size);
      expect(capacity.tryAcquireCoordination()).toBeNull();
      occupied[0]!();
      await human;
      expect(order).toEqual(["human"]);
      expect(capacity.snapshot().running).toBe(size);
      releaseHuman!();
      await coordination;
      expect(order).toEqual(["human", "coordination"]);
      expect(capacity.snapshot().running).toBe(size);
    } finally { releaseHuman?.(); releaseCoordination?.(); occupied.forEach(release => release()); }
    expect(capacity.snapshot()).toEqual({ running: 0, waiting: 0 });
  });
  it("reserves one slot from background work", () => {
    const capacity = new HostCapacity(4);
    const releases = [capacity.tryAcquire(), capacity.tryAcquire(), capacity.tryAcquire()];

    expect(releases.every(Boolean)).toBe(true);
    expect(capacity.tryAcquire()).toBeNull();
    expect(capacity.snapshot()).toEqual({ running: 3, waiting: 0 });

    for (const release of releases) release?.();
  });

  it("starts a foreground owner while background capacity is full", async () => {
    const capacity = new HostCapacity(2);
    const releaseBackground = capacity.tryAcquire();
    let started = false;

    const foreground = capacity.runForeground(async () => {
      started = true;
    });
    await foreground;

    expect(started).toBe(true);
    expect(capacity.snapshot()).toEqual({ running: 1, waiting: 0 });
    releaseBackground?.();
  });

  it("gives a queued foreground owner the next released slot", async () => {
    const capacity = new HostCapacity(1);
    const releaseBackground = capacity.tryAcquire();
    const order: string[] = [];
    const background = capacity.run(async () => {
      order.push("background");
    });
    const foreground = capacity.runForeground(async () => {
      order.push("foreground");
    });

    releaseBackground?.();
    await foreground;
    await background;

    expect(order).toEqual(["foreground", "background"]);
  });

  it("supports cancelling a queued foreground acquisition", async () => {
    const capacity = new HostCapacity(1);
    const release = capacity.tryAcquireForeground();
    let started = false;
    const cancel = capacity.acquireForegroundCancellable(() => {
      started = true;
    });

    expect(capacity.snapshot().waiting).toBe(1);
    cancel();
    release?.();
    await Bun.sleep(1);

    expect(started).toBeFalse();
    expect(capacity.snapshot()).toEqual({ running: 0, waiting: 0 });
  });
});
