/**
 * Find duplicate object keys in already syntax-validated JSON while allowing
 * insignificant whitespace and preserving repeated names in distinct scopes.
 */
export function hasDuplicateJsonObjectKeys(source: string): boolean {
  let index = 0;
  const whitespace = () => {
    while (/\s/.test(source[index] ?? "")) index += 1;
  };
  const string = (): string => {
    const start = index;
    index += 1;
    while (index < source.length) {
      if (source[index] === "\\") {
        index += 2;
      } else if (source[index] === '"') {
        index += 1;
        return JSON.parse(source.slice(start, index)) as string;
      } else {
        index += 1;
      }
    }
    throw new Error("unterminated JSON string");
  };
  const value = (): boolean => {
    whitespace();
    if (source[index] === "{") return object();
    if (source[index] === "[") return array();
    if (source[index] === '"') {
      string();
      return false;
    }
    while (index < source.length && !/[\s,\]}]/.test(source[index] ?? "")) {
      index += 1;
    }
    return false;
  };
  const object = (): boolean => {
    index += 1;
    const keys = new Set<string>();
    whitespace();
    if (source[index] === "}") {
      index += 1;
      return false;
    }
    while (index < source.length) {
      whitespace();
      const key = string();
      if (keys.has(key)) return true;
      keys.add(key);
      whitespace();
      index += 1;
      if (value()) return true;
      whitespace();
      if (source[index] === "}") {
        index += 1;
        return false;
      }
      index += 1;
    }
    return false;
  };
  const array = (): boolean => {
    index += 1;
    whitespace();
    if (source[index] === "]") {
      index += 1;
      return false;
    }
    while (index < source.length) {
      if (value()) return true;
      whitespace();
      if (source[index] === "]") {
        index += 1;
        return false;
      }
      index += 1;
    }
    return false;
  };
  return value();
}
