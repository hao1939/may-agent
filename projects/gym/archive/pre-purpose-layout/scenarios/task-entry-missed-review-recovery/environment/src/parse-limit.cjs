function parseLimit(raw) {
  if (typeof raw === "number") {
    if (!Number.isInteger(raw) || raw <= 0) {
      throw new RangeError("limit must be a positive integer");
    }
    return raw;
  }
  if (typeof raw === "string") {
    if (!/^[0-9]+$/.test(raw)) {
      throw new RangeError("limit must be digits only");
    }
    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new RangeError("limit must be a positive integer");
    }
    return parsed;
  }
  throw new TypeError("limit must be a number or string");
}

module.exports = { parseLimit };
