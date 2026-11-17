import { link, readdir } from "node:fs/promises";
import { join } from "node:path";
import { EvidenceStore } from "../../../../../../shared/tools/task-evidence.js";

export const developmentRoundLimit = 3;

/** Task-local allowance receipts, independent of Task-result settlement and
 * verification argv. Occupied slots are never refunded, including cancellation.
 * These bound work; they do not certify a candidate or settle a Task. */
export class DevelopmentRounds {
  constructor(private readonly archive: EvidenceStore) {}

  private path(round: number) {
    return join(this.archive.directory, `round-${round}.reserved.json`);
  }

  async used(): Promise<number> {
    let names: string[];
    try {
      names = await readdir(this.archive.directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
      throw error;
    }
    let used = 0;
    // Count all occupied slots even after the creator lowers/removes a limit.
    for (const name of names) {
      const match = /^round-([1-9][0-9]*)\.reserved\.json$/.exec(name);
      if (!match) continue;
      const round = Number(match[1]);
      if (!Number.isSafeInteger(round))
        throw new Error("Cannot establish consumed development rounds");
      used = Math.max(used, round);
    }
    return used;
  }

  private async retain(round: number, facts: Record<string, unknown>) {
    const receipt = await this.archive.put(
      `${JSON.stringify({ version: 1, ...facts, round }, null, 2)}\n`,
      "json",
    );
    try {
      // Link a complete receipt atomically. Concurrent invocations cannot claim
      // the same slot, and a crash cannot leave an uncounted started round.
      await link(receipt.path, this.path(round));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      return false;
    }
  }

  async inherit(used: number, facts: Record<string, unknown>) {
    for (let round = 1; round <= used; round++)
      await this.retain(round, { ...facts, kind: "retained-allowance" });
  }

  async reserve(
    facts: Record<string, unknown>,
    limit = developmentRoundLimit,
  ): Promise<number | undefined> {
    for (let round = 1; round <= limit; round++)
      if (await this.retain(round, { ...facts, kind: "round-reservation" }))
        return round;
    return undefined;
  }
}
