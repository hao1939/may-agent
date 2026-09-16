import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { Type, type Static } from "@may-agent/sdk";
import { Check } from "typebox/value";

export const preferenceSchema = Type.Object(
  {
    operation: Type.Union([Type.Literal("upsert"), Type.Literal("remove")]),
    id: Type.String({ minLength: 1, maxLength: 100 }),
    scope: Type.String({ minLength: 1, maxLength: 300 }),
    rule: Type.String({ minLength: 1, maxLength: 1000 }),
    messageId: Type.String({ minLength: 1 }),
    quote: Type.String({ minLength: 8, maxLength: 2000 }),
  },
  { additionalProperties: false },
);

export type PreferenceProposal = Static<typeof preferenceSchema>;
export type Preference = Pick<PreferenceProposal, "id" | "scope" | "rule"> & {
  source: { conversationId: string; messageId: string; quote: string };
};
export type PreferenceChange = {
  key: string;
  expectedRevision: number;
  conversationId: string;
  proposal: PreferenceProposal;
};
type Book = {
  revision: number;
  preferences: Preference[];
  receipts: Record<string, string>;
};
export const preferenceFactPrefix = "may-preference-proposal:";

/** Model-authored prose cannot impersonate an action staged by the scoped tool. */
export function acceptedPreferenceFacts(
  facts: string[],
  staged: PreferenceChange[],
): string[] {
  if (facts.some((fact) => fact.startsWith(preferenceFactPrefix)))
    throw new Error(
      "Preference facts must originate from the scoped preference tool",
    );
  return [
    ...facts,
    ...staged.map((change) => preferenceFactPrefix + JSON.stringify(change)),
  ];
}

/** Prototype storage adapter. One fixture file is authoritative; no live memory edits. */
export class PreferenceBook {
  constructor(readonly path: string) {}

  read(): Book {
    if (!existsSync(this.path))
      return { revision: 0, preferences: [], receipts: {} };
    const match = readFileSync(this.path, "utf8").match(
      /```json\n([\s\S]*?)\n```/,
    );
    if (!match) throw new Error("Invalid preference file");
    return JSON.parse(match[1]) as Book;
  }

  stage(
    conversationId: string,
    human: { id: string; text: string; kind: string },
    value: unknown,
  ): PreferenceChange {
    if (!Check(preferenceSchema, value))
      throw new Error("Invalid preference proposal");
    if (
      human.kind !== "human" ||
      value.messageId !== human.id ||
      !human.text.includes(value.quote)
    )
      throw new Error(
        "Preference evidence must quote the exact current human message",
      );
    // Permanence and scope are semantic judgments exercised by the model trials.
    // An authentic quote alone does not prove either judgment correct.
    return {
      key: `${conversationId}:${human.id}:${value.id}`,
      expectedRevision: this.read().revision,
      conversationId,
      proposal: value,
    };
  }

  /** Called only for a proposal retained in a successfully accepted Host turn. */
  apply(change: PreferenceChange): "applied" | "replayed" {
    mkdirSync(dirname(this.path), { recursive: true });
    const lock = `${this.path}.lock`;
    const fd = openSync(lock, "wx");
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    try {
      const book = this.read();
      const digest = createHash("sha256")
        .update(JSON.stringify(change))
        .digest("hex");
      const receipt = book.receipts[change.key];
      if (receipt) {
        if (receipt !== digest)
          throw new Error("Conflicting preference replay");
        return "replayed";
      }
      if (book.revision !== change.expectedRevision)
        throw new Error(
          "Preference revision changed; reconsider with current preferences",
        );
      const proposal = change.proposal;
      if (
        proposal.operation === "remove" &&
        !book.preferences.some((p) => p.id === proposal.id)
      )
        throw new Error("Cannot forget an unknown preference");
      book.preferences = book.preferences.filter((p) => p.id !== proposal.id);
      if (proposal.operation === "upsert") {
        book.preferences.push({
          id: proposal.id,
          scope: proposal.scope,
          rule: proposal.rule,
          source: {
            conversationId: change.conversationId,
            messageId: proposal.messageId,
            quote: proposal.quote,
          },
        });
      }
      book.revision++;
      book.receipts[change.key] = digest;
      writeFileSync(
        temporary,
        `# Standing preferences — isolated PoC\n\n\`\`\`json\n${JSON.stringify(book, null, 2)}\n\`\`\`\n`,
      );
      renameSync(temporary, this.path);
      return "applied";
    } finally {
      if (existsSync(temporary)) unlinkSync(temporary);
      closeSync(fd);
      unlinkSync(lock);
    }
  }
}
