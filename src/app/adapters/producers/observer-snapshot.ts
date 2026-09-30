import { MAX_OBSERVER_SNAPSHOT_BYTES, type ObserverSnapshot } from "@may-agent/sdk";

export function copyObserverSnapshot(value: unknown): ObserverSnapshot {
  let remaining = MAX_OBSERVER_SNAPSHOT_BYTES;
  const charge = (bytes: number): void => {
    if (bytes > remaining) throw new Error(`observer snapshot exceeds ${MAX_OBSERVER_SNAPSHOT_BYTES} bytes`);
    remaining -= bytes;
  };
  const chargeString = (item: string): void => {
    // UTF-16 length is a lower bound on JSON UTF-8 size. Reject huge strings
    // before encoding; only input bounded by the budget reaches this encoder.
    charge(item.length);
    charge(Buffer.byteLength(JSON.stringify(item), "utf8") - item.length);
  };
  const copyProperty = (item: object, key: string, depth: number): ObserverSnapshot => {
    const property = Object.getOwnPropertyDescriptor(item, key);
    if (!property || !("value" in property))
      throw new Error("observer snapshot must contain only JSON data properties");
    return copy(property.value, depth);
  };
  const copy = (item: unknown, depth: number): ObserverSnapshot => {
    if (depth > 32) throw new Error("observer snapshot is too complex");
    if (typeof item === "string") {
      chargeString(item);
      return item;
    }
    if (item === null || typeof item === "boolean" || (typeof item === "number" && Number.isFinite(item))) {
      charge(JSON.stringify(item).length);
      return item;
    }
    if (typeof item !== "object" || item === null) throw new Error("observer snapshot must contain only JSON values");
    charge(2); // Brackets/braces; every child and separator also consumes budget.
    if (Array.isArray(item)) {
      const result: ObserverSnapshot[] = [];
      for (let i = 0; i < item.length; i++) {
        if (i > 0) charge(1);
        result.push(copyProperty(item, String(i), depth + 1));
      }
      return result;
    }
    if (Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) {
      throw new Error("observer snapshot must contain only plain JSON objects");
    }
    const result: Record<string, ObserverSnapshot> = Object.create(null);
    let first = true;
    // Do not materialize all values or invoke getters/toJSON on App objects.
    for (const key in item) {
      if (!Object.hasOwn(item, key)) continue;
      charge(first ? 1 : 2); // Colon and, after the first member, comma.
      first = false;
      chargeString(key);
      result[key] = copyProperty(item, key, depth + 1);
    }
    return result;
  };
  return copy(value, 0);
}
