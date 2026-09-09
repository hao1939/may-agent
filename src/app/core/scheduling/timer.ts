/** Owned timer mechanics only. The caller decides what is due and what it means. */
export class OwnedTimer {
  private handle?: ReturnType<typeof setTimeout>;
  private generation = 0;
  private closed = false;

  constructor(private readonly label: string) {}

  get armed(): boolean {
    return this.handle !== undefined;
  }

  after(delayMs: number, run: () => void): void {
    this.replace(delayMs, run, false);
  }

  every(intervalMs: number, run: () => void): void {
    this.replace(intervalMs, run, true);
  }

  cancel(): void {
    this.generation++;
    if (this.handle) clearTimeout(this.handle);
    this.handle = undefined;
  }

  close(): void {
    this.closed = true;
    this.cancel();
  }

  private replace(delayMs: number, run: () => void, recurring: boolean): void {
    if (this.closed) return;
    if (!Number.isFinite(delayMs) || delayMs < 0 || (recurring && delayMs === 0)) {
      throw new Error(`${this.label}: timer delay must be ${recurring ? "positive" : "non-negative"}`);
    }
    this.cancel();
    const generation = this.generation;
    const fire = () => {
      if (this.closed || this.generation !== generation) return;
      if (!recurring) this.handle = undefined;
      try {
        run();
      } catch (error) {
        // One failed read/publication must not terminate the Host. No event,
        // acceptance, retry queue, or domain disposition is invented here.
        console.error(`[${this.label}] timer callback failed: ${String(error)}`);
      }
    };
    this.handle = recurring ? setInterval(fire, delayMs) : setTimeout(fire, delayMs);
    this.handle.unref?.();
  }
}
